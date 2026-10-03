'use strict';
/* KELO-INDEX
 * area: SERVER / WORLD PERSISTENCE
 * owner: Kelo server authority
 * keys: WORLD CELL SNAPSHOT LEDGER REPLAY REVISION CAS IDEMPOTENCY
 * purpose: owner server-side de mutaciones persistentes del mundo; delega durability al único server-state bridge
 * online: producción -> Supabase world_cell_snapshots + world_event_ledger mediante kelo-server-state
 * fallback: memoria solo para local/CI cuando bridge no está configurado; nunca se declara durable
 * do-not: NO aceptar commits desde browser; NO reemplazar Map Forge authored versions; NO convertir Guardian en autoridad
 */
const CELL_RE=/^[A-Za-z0-9_-]{1,48}:-?[0-9]{1,8}:-?[0-9]{1,8}$/;
const EVENT_RE=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const EVENT_TYPE_RE=/^[a-z][a-z0-9_.:-]{0,95}$/;
const MAX_PATCH_BYTES=120000,MAX_STATE_BYTES=450000;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const bytes=v=>Buffer.byteLength(JSON.stringify(v),'utf8');
function clean(v){return String(v==null?'':v).trim();}
function cell(v){const x=clean(v);if(!CELL_RE.test(x))throw new Error('WORLD_CELL_ID_INVALID');return x;}
function normalizeMutation(input={}){
  const cellId=cell(input.cellId),eventId=clean(input.eventId),eventType=clean(input.eventType),aggregateId=clean(input.aggregateId||'world'),expectedRevision=Math.floor(Number(input.expectedRevision));
  if(!EVENT_RE.test(eventId))throw new Error('WORLD_EVENT_ID_INVALID');if(!EVENT_TYPE_RE.test(eventType))throw new Error('WORLD_EVENT_TYPE_INVALID');if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new Error('WORLD_EXPECTED_REVISION_INVALID');
  const patch=input.patch&&typeof input.patch==='object'&&!Array.isArray(input.patch)?clone(input.patch):null;if(!patch)throw new Error('WORLD_PATCH_INVALID');if(bytes(patch)>MAX_PATCH_BYTES)throw new Error('WORLD_PATCH_TOO_LARGE');
  if(!aggregateId||aggregateId.length>128)throw new Error('WORLD_AGGREGATE_INVALID');
  return{cellId,eventId,eventType,aggregateId,expectedRevision,patch,characterId:input.characterId||null,requestId:clean(input.requestId).slice(0,160)||null};
}
function createWorldStateStore({bridge=null,clock=Date.now}={}){
  const durable=!!(bridge?.configured&&typeof bridge.worldLoad==='function'&&typeof bridge.worldMutate==='function'&&typeof bridge.worldReplay==='function');
  const snapshots=new Map(),events=[],idempotency=new Map();let loads=0,mutations=0,replays=0,conflicts=0,lastError=null;
  function memoryLoad(cellId){return clone(snapshots.get(cellId)||null);}
  function memoryMutate(input){
    const m=normalizeMutation(input),existing=idempotency.get(m.eventId);if(existing){if(existing.cellId!==m.cellId)throw new Error('WORLD_EVENT_ID_REUSED');return clone(existing);}
    const current=snapshots.get(m.cellId)||{cellId:m.cellId,revision:0,schemaVersion:1,state:{},lastEventId:null,updatedAt:null};if(current.revision!==m.expectedRevision){conflicts++;throw new Error(`WORLD_REVISION_CONFLICT:expected=${m.expectedRevision} actual=${current.revision}`);}
    const merged={...current.state,...m.patch};if(bytes(merged)>MAX_STATE_BYTES)throw new Error('WORLD_STATE_TOO_LARGE');
    const next={cellId:m.cellId,revision:current.revision+1,schemaVersion:1,state:merged,lastEventId:m.eventId,updatedAt:new Date(clock()).toISOString()};
    const event={sequenceId:events.length+1,eventId:m.eventId,cellId:m.cellId,revision:next.revision,aggregateId:m.aggregateId,eventType:m.eventType,payload:{patch:clone(m.patch),resultingRevision:next.revision},characterId:m.characterId,requestId:m.requestId,createdAt:next.updatedAt};
    snapshots.set(m.cellId,next);events.push(event);const result={cellId:m.cellId,revision:next.revision,schemaVersion:1,eventId:m.eventId,eventType:m.eventType,aggregateId:m.aggregateId};idempotency.set(m.eventId,result);return clone(result);
  }
  function memoryReplay(cellId,afterRevision=0,limit=500){const after=Math.max(0,Math.floor(Number(afterRevision)||0)),cap=Math.max(1,Math.min(1000,Math.floor(Number(limit)||500)));return events.filter(e=>e.cellId===cellId&&e.revision>after).sort((a,b)=>a.revision-b.revision).slice(0,cap).map(clone);}
  async function load(cellId){loads++;const key=cell(cellId);try{const result=durable?await bridge.worldLoad(key):memoryLoad(key);lastError=null;return result;}catch(error){lastError=String(error?.message||error);throw error;}}
  async function mutate(input){mutations++;const normalized=normalizeMutation(input);try{const result=durable?await bridge.worldMutate(normalized):memoryMutate(normalized);lastError=null;return result;}catch(error){if(String(error?.message||error).includes('WORLD_REVISION_CONFLICT'))conflicts++;lastError=String(error?.message||error);throw error;}}
  async function replay(cellId,afterRevision=0,limit=500){replays++;const key=cell(cellId);try{const result=durable?await bridge.worldReplay(key,afterRevision,limit):memoryReplay(key,afterRevision,limit);lastError=null;return result;}catch(error){lastError=String(error?.message||error);throw error;}}
  function audit(){return Object.freeze({version:'kelo-world-state-store-v1.1',source:durable?'supabase-world-ledger':'memory-world-transition',durable,replayable:true,revisionCas:true,idempotentEvents:true,patchMaxBytes:MAX_PATCH_BYTES,stateMaxBytes:MAX_STATE_BYTES,clientWritable:false,loads,mutations,replays,conflicts,lastError});}
  return Object.freeze({version:'kelo-world-state-store-v1.1',source:durable?'supabase-world-ledger':'memory-world-transition',durable,load,mutate,replay,audit});
}
module.exports={createWorldStateStore};
