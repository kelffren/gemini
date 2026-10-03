'use strict';
/* KELO-INDEX
 * area: SERVER / PERSISTENCE
 * owner: Kelo server authority
 * keys: SUPABASE EDGE STATE SNAPSHOT NOBILITY WORLD CELL LEDGER IDEMPOTENCY BACKEND SECRET SERIALIZATION
 * purpose: único puente server->Supabase Edge; serializa saves por personaje y expone world state/ledger solo al trusted server
 * online: solo el proceso trusted server conoce KELO_SERVER_BRIDGE_KEY; navegador nunca invoca este módulo
 * do-not: NO poner KELO_SERVER_BRIDGE_KEY en respuestas/logs/cliente; NO segundo gameplay authority; NO aceptar world authority desde browser
 */
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CELL_RE=/^[A-Za-z0-9_-]{1,48}:-?[0-9]{1,8}:-?[0-9]{1,8}$/;
const EVENT_RE=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const EVENT_TYPE_RE=/^[a-z][a-z0-9_.:-]{0,95}$/;
const INSTANCES=new Map();
function clean(value){return String(value||'').trim();}
function validCell(value){const cell=clean(value);if(!CELL_RE.test(cell))throw new Error('WORLD_CELL_ID_INVALID');return cell;}
function createServerStateBridge(opts={}){
  const url=clean(opts.url||process.env.KELO_SERVER_STATE_URL),serverKey=clean(opts.serverKey||process.env.KELO_SERVER_BRIDGE_KEY),instanceKey=url+'|'+serverKey;
  if(INSTANCES.has(instanceKey))return INSTANCES.get(instanceKey);
  const configured=Boolean(url&&serverKey),saveQueues=new Map();let requests=0,worldRequests=0,failures=0,lastError=null,lastSuccessAt=0;
  async function request(body){
    if(!configured)throw new Error('PERSISTENCE_BRIDGE_NOT_CONFIGURED');requests++;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
    try{const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-kelo-server-key':serverKey},body:JSON.stringify(body||{}),signal:controller.signal});const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch(_){data=null;}if(!res.ok||!data?.ok)throw new Error(String(data?.code||`PERSISTENCE_${res.status}`));lastSuccessAt=Date.now();lastError=null;return data;}
    catch(error){failures++;lastError=String(error&&error.message||error);throw error;}finally{clearTimeout(timer);}
  }
  async function call(op,characterId,payload={}){
    const id=clean(characterId).toLowerCase();if(!UUID_RE.test(id))throw new Error('PERSISTENCE_CHARACTER_REQUIRED');return request({op,characterId:id,...payload});
  }
  async function callWorld(op,payload={}){worldRequests++;return request({op,...payload});}
  function queuedSave(id,state){
    const key=clean(id).toLowerCase(),previous=saveQueues.get(key)||Promise.resolve();
    const task=previous.catch(()=>{}).then(async()=>{const data=await call('save',key,{state});return data.snapshot||null;});
    saveQueues.set(key,task);task.finally(()=>{if(saveQueues.get(key)===task)saveQueues.delete(key);}).catch(()=>{});return task;
  }
  async function worldLoad(cellId){const data=await callWorld('world:load',{cellId:validCell(cellId)});return data.snapshot||null;}
  async function worldReplay(cellId,afterRevision=0,limit=500){const data=await callWorld('world:replay',{cellId:validCell(cellId),afterRevision:Math.max(0,Math.floor(Number(afterRevision)||0)),limit:Math.max(1,Math.min(1000,Math.floor(Number(limit)||500)))});return Array.isArray(data.events)?data.events:[];}
  async function worldMutate(input={}){
    const cellId=validCell(input.cellId),eventId=clean(input.eventId),eventType=clean(input.eventType),aggregateId=clean(input.aggregateId||'world'),expectedRevision=Math.floor(Number(input.expectedRevision));
    if(!EVENT_RE.test(eventId))throw new Error('WORLD_EVENT_ID_INVALID');if(!EVENT_TYPE_RE.test(eventType))throw new Error('WORLD_EVENT_TYPE_INVALID');if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new Error('WORLD_EXPECTED_REVISION_INVALID');
    const patch=input.patch&&typeof input.patch==='object'&&!Array.isArray(input.patch)?input.patch:null;if(!patch)throw new Error('WORLD_PATCH_INVALID');
    const characterId=input.characterId==null?null:clean(input.characterId).toLowerCase();if(characterId&&!UUID_RE.test(characterId))throw new Error('INVALID_CHARACTER_ID');
    const data=await callWorld('world:mutate',{cellId,eventId,eventType,aggregateId,expectedRevision,patch,requestId:clean(input.requestId).slice(0,160)||null,...(characterId?{characterId}:{})});return data.result||null;
  }
  const api=Object.freeze({version:'kelo-server-state-bridge-v3-world-ledger',configured,load:async id=>(await call('load',id)).snapshot||null,save:queuedSave,nobilityEnsure:async(id,name)=>(await call('nobility:ensure',id,{name})).row||null,nobilityGet:async id=>(await call('nobility:get',id)).row||null,nobilityTop:async(id,limit)=>(await call('nobility:top',id,{limit})).rows||[],nobilityDonate:async(id,currency,amount)=>(await call('nobility:donate',id,{currency,amount})).row||null,worldLoad,worldReplay,worldMutate,audit:()=>({version:'kelo-server-state-bridge-v3-world-ledger',configured,requests,worldRequests,failures,pendingSaves:saveQueues.size,lastError,lastSuccessAt,worldLedger:true})});
  INSTANCES.set(instanceKey,api);return api;
}
module.exports={createServerStateBridge};
