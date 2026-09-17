/* KELO-INDEX
 * area: MMORPG / COMMUNITY PLATFORM FOUNDATION
 * owner: Kelo MMO Community Platform
 * owns: shared primitives used by the 59-system MMORPG + UGC expansion program
 * does-not-own: current render/movement/commerce/gameplay owners; this module composes with them
 * rule: authority-owned state and UGC publication must remain versioned, reversible and auditable
 */
const F=Object.freeze;
const clone=value=>{if(value==null)return value;if(typeof structuredClone==='function')return structuredClone(value);return JSON.parse(JSON.stringify(value));};
const nowIso=clock=>new Date(clock()).toISOString();
const normalizeId=value=>String(value||'').trim();
const assertId=(value,code='ID_REQUIRED')=>{const id=normalizeId(value);if(!id)throw new Error(code);return id;};

export const COMMUNITY_SCRIPT_POLICY=F({
  version:1,executionModel:'declarative-graph-only',arbitraryJavaScript:false,networkAccess:false,
  secretAccess:false,filesystemAccess:false,authorityWrites:false,maxNodes:256,maxDepth:32,
  maxEmitsPerTick:64,maxStringBytes:8192,
  allowedNodeTypes:F(['sequence','selector','condition','compare','timer','counter','emit','set-local','read-context','quest-step','npc-action'])
});

export function createEventBus(){
  const listeners=new Map(),history=[];
  return F({
    on(type,fn){const key=assertId(type,'EVENT_TYPE_REQUIRED');if(typeof fn!=='function')throw new Error('EVENT_HANDLER_REQUIRED');if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(fn);return()=>listeners.get(key)?.delete(fn);},
    emit(type,payload,meta={}){const key=assertId(type,'EVENT_TYPE_REQUIRED'),event=F({type:key,payload:clone(payload),meta:clone(meta)});history.push(event);if(history.length>256)history.shift();for(const fn of listeners.get(key)||[]){try{fn(event);}catch{}}return event;},
    recent(limit=32){return history.slice(-Math.max(0,Number(limit)||0)).map(clone);},
    clear(type){if(type==null)listeners.clear();else listeners.delete(String(type));}
  });
}

export function createIdempotencyLedger({maxEntries=10000}={}){
  const rows=new Map(),order=[];
  const trim=()=>{while(order.length>maxEntries){const key=order.shift();rows.delete(key);}};
  const commit=(key,result,meta={})=>{const id=assertId(key,'IDEMPOTENCY_KEY_REQUIRED');if(rows.has(id))return clone(rows.get(id));const row=F({key:id,result:clone(result),meta:clone(meta)});rows.set(id,row);order.push(id);trim();return clone(row);};
  return F({
    has:key=>rows.has(assertId(key,'IDEMPOTENCY_KEY_REQUIRED')),
    get:key=>clone(rows.get(assertId(key,'IDEMPOTENCY_KEY_REQUIRED'))||null),commit,
    run(key,fn,meta={}){const id=assertId(key,'IDEMPOTENCY_KEY_REQUIRED');if(rows.has(id))return F({replay:true,entry:clone(rows.get(id))});if(typeof fn!=='function')throw new Error('IDEMPOTENCY_FN_REQUIRED');return F({replay:false,entry:commit(id,fn(),meta)});},
    size:()=>rows.size
  });
}

export function createCapabilityGate(){
  const roles=new Map(),grants=new Map();
  const ensure=actorId=>{const id=assertId(actorId,'ACTOR_ID_REQUIRED');if(!grants.has(id))grants.set(id,new Set());return grants.get(id);};
  const capabilities=actorId=>{const direct=ensure(actorId),out=new Set();for(const token of direct){if(token.startsWith('role:'))for(const cap of roles.get(token.slice(5))||[])out.add(cap);else out.add(token);}return[...out].sort();};
  const can=(actorId,capability)=>capabilities(actorId).includes(assertId(capability,'CAPABILITY_REQUIRED'));
  return F({
    defineRole(roleId,caps=[]){const id=assertId(roleId,'ROLE_ID_REQUIRED');roles.set(id,new Set(Array.from(caps,String)));return id;},
    assignRole(actorId,roleId){const role=assertId(roleId,'ROLE_ID_REQUIRED');if(!roles.has(role))throw new Error(`UNKNOWN_ROLE:${role}`);ensure(actorId).add(`role:${role}`);return true;},
    grant(actorId,capability){ensure(actorId).add(assertId(capability,'CAPABILITY_REQUIRED'));return true;},
    revoke:(actorId,capability)=>ensure(actorId).delete(String(capability)),capabilities,can,
    require(actorId,capability){if(!can(actorId,capability))throw new Error(`CAPABILITY_DENIED:${actorId}:${capability}`);return true;}
  });
}

function stableObject(value){if(Array.isArray(value))return value.map(stableObject);if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableObject(value[key])]));}
const stableStringify=value=>JSON.stringify(stableObject(value));
function simpleHash(value){const raw=stableStringify(value);let hash=2166136261;for(let i=0;i<raw.length;i+=1){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619);}return`fnv1a:${(hash>>>0).toString(16).padStart(8,'0')}`;}

export function createVersionStore({clock=Date.now}={}){
  const objects=new Map(),branches=new Map(),revisions=new Map();
  const branchKey=(objectId,branch)=>`${objectId}::${branch}`;
  const ensureObject=objectId=>{const id=assertId(objectId,'OBJECT_ID_REQUIRED');if(!objects.has(id))objects.set(id,{id,createdAt:nowIso(clock)});return id;};
  const head=(objectId,branch='main')=>branches.get(branchKey(objectId,branch))||null;
  const getRevision=revisionId=>clone(revisions.get(String(revisionId))||null);
  const ancestry=revisionId=>{const seen=new Set(),queue=[revisionId].filter(Boolean);while(queue.length){const id=queue.shift();if(!id||seen.has(id))continue;seen.add(id);const row=revisions.get(id);if(row)queue.push(...row.parentIds);}return seen;};
  const commonAncestor=(a,b)=>{const aa=ancestry(a),queue=[b].filter(Boolean),seen=new Set();while(queue.length){const id=queue.shift();if(!id||seen.has(id))continue;if(aa.has(id))return id;seen.add(id);const row=revisions.get(id);if(row)queue.push(...row.parentIds);}return null;};
  function commit({objectId,branch='main',payload,authorId='system',message='',expectedHead=undefined}){
    const id=ensureObject(objectId),b=assertId(branch,'BRANCH_REQUIRED'),current=head(id,b);if(expectedHead!==undefined&&expectedHead!==current)throw new Error(`REVISION_CONFLICT:${id}:${b}`);
    const body=clone(payload),contentHash=simpleHash(body),revisionId=`${id}@${contentHash.slice(6)}:${revisions.size+1}`;
    const row=F({revisionId,objectId:id,branch:b,parentIds:F(current?[current]:[]),contentHash,payload:F(body),authorId:String(authorId||'system'),message:String(message||''),createdAt:nowIso(clock)});revisions.set(revisionId,row);branches.set(branchKey(id,b),revisionId);return clone(row);
  }
  function fork({objectId,from='main',branch,atRevision=null}){const id=ensureObject(objectId),target=assertId(branch,'BRANCH_REQUIRED'),sourceHead=atRevision||head(id,from);if(!sourceHead||!revisions.has(sourceHead))throw new Error(`SOURCE_REVISION_REQUIRED:${id}:${from}`);const key=branchKey(id,target);if(branches.has(key))throw new Error(`BRANCH_EXISTS:${id}:${target}`);branches.set(key,sourceHead);return F({objectId:id,branch:target,head:sourceHead});}
  function merge({objectId,sourceBranch,targetBranch='main',authorId='system',resolver=null}){
    const id=ensureObject(objectId),sourceHead=head(id,sourceBranch),targetHead=head(id,targetBranch);if(!sourceHead||!targetHead)throw new Error(`MERGE_HEAD_REQUIRED:${id}`);if(sourceHead===targetHead)return F({merged:false,fastForward:true,head:targetHead,conflicts:[]});
    const baseId=commonAncestor(sourceHead,targetHead);if(!baseId)throw new Error(`NO_COMMON_ANCESTOR:${id}`);const base=revisions.get(baseId)?.payload||{},source=revisions.get(sourceHead)?.payload||{},target=revisions.get(targetHead)?.payload||{},keys=new Set([...Object.keys(base),...Object.keys(source),...Object.keys(target)]),merged={},conflicts=[];
    for(const key of keys){const b=stableStringify(base[key]),s=stableStringify(source[key]),t=stableStringify(target[key]);if(s===t)merged[key]=clone(source[key]);else if(s===b)merged[key]=clone(target[key]);else if(t===b)merged[key]=clone(source[key]);else{const resolution=typeof resolver==='function'?resolver({key,base:clone(base[key]),source:clone(source[key]),target:clone(target[key])}):undefined;if(resolution===undefined)conflicts.push(key);else merged[key]=clone(resolution);}}
    if(conflicts.length)return F({merged:false,fastForward:false,head:targetHead,conflicts:F(conflicts)});
    const contentHash=simpleHash(merged),revisionId=`${id}@${contentHash.slice(6)}:${revisions.size+1}`,row=F({revisionId,objectId:id,branch:targetBranch,parentIds:F([targetHead,sourceHead]),contentHash,payload:F(clone(merged)),authorId:String(authorId||'system'),message:`merge ${sourceBranch} -> ${targetBranch}`,createdAt:nowIso(clock)});revisions.set(revisionId,row);branches.set(branchKey(id,targetBranch),revisionId);return F({merged:true,fastForward:false,head:revisionId,conflicts:F([]),revision:clone(row)});
  }
  return F({commit,fork,merge,head,getRevision,listBranches(objectId){const prefix=`${String(objectId)}::`;return[...branches.entries()].filter(([key])=>key.startsWith(prefix)).map(([key,value])=>F({branch:key.slice(prefix.length),head:value}));},history:objectId=>[...revisions.values()].filter(row=>row.objectId===String(objectId)).map(clone)});
}

export const PUBLICATION_TRANSITIONS=F({draft:F(['test']),test:F(['review','draft']),review:F(['approved','rejected','draft']),approved:F(['staged','draft']),staged:F(['live','draft']),live:F(['legacy','rolled-back']),legacy:F(['archived','live']),rejected:F(['draft','archived']),'rolled-back':F(['draft','archived']),archived:F([])});

export function createPublicationMachine({clock=Date.now,eventBus=null}={}){
  const rows=new Map();
  const create=({contentId,revisionId,creatorId,meta={}})=>{const id=assertId(contentId,'CONTENT_ID_REQUIRED'),row={contentId:id,revisionId:assertId(revisionId,'REVISION_ID_REQUIRED'),creatorId:assertId(creatorId,'CREATOR_ID_REQUIRED'),state:'draft',meta:clone(meta),history:[]};rows.set(id,row);return clone(row);};
  const transition=(contentId,nextState,actorId,evidence={})=>{const id=assertId(contentId,'CONTENT_ID_REQUIRED'),row=rows.get(id);if(!row)throw new Error(`UNKNOWN_CONTENT:${id}`);const next=assertId(nextState,'PUBLICATION_STATE_REQUIRED'),allowed=PUBLICATION_TRANSITIONS[row.state]||[];if(!allowed.includes(next))throw new Error(`INVALID_PUBLICATION_TRANSITION:${row.state}->${next}`);const event=F({from:row.state,to:next,actorId:String(actorId||'system'),evidence:clone(evidence),at:nowIso(clock)});row.state=next;row.history.push(event);eventBus?.emit?.('kelo:mmorpg:publication-transition',{contentId:id,...event});return clone(row);};
  return F({create,transition,get:id=>clone(rows.get(String(id))||null),list:state=>[...rows.values()].filter(row=>!state||row.state===state).map(clone)});
}

export function createWorldGrid({cellSize=2048}={}){
  const size=Math.max(64,Number(cellSize)||2048),coord=value=>Math.floor(Number(value)/size),cellId=(x,y,realm='world')=>`${String(realm)}:${coord(x)}:${coord(y)}`,
    bounds=(cx,cy)=>F({minX:cx*size,minY:cy*size,maxX:(cx+1)*size,maxY:(cy+1)*size}),
    neighbors=(cx,cy,radius=1,realm='world')=>{const out=[],r=Math.max(0,Math.floor(Number(radius)||0));for(let y=cy-r;y<=cy+r;y+=1)for(let x=cx-r;x<=cx+r;x+=1)out.push(`${realm}:${x}:${y}`);return out;};
  return F({cellSize:size,coord,cellId,bounds,neighbors});
}

export function createAOIIndex({grid=createWorldGrid(),radiusCells=1}={}){
  const entities=new Map(),cells=new Map();
  const put=(cellId,entityId)=>{if(!cells.has(cellId))cells.set(cellId,new Set());cells.get(cellId).add(entityId);},remove=(cellId,entityId)=>{cells.get(cellId)?.delete(entityId);if(cells.get(cellId)?.size===0)cells.delete(cellId);};
  return F({
    upsert(entity){const id=assertId(entity?.id,'ENTITY_ID_REQUIRED'),nextCell=grid.cellId(entity.x,entity.y,entity.realm||'world'),prev=entities.get(id);if(prev?.cellId!==nextCell){if(prev)remove(prev.cellId,id);put(nextCell,id);}entities.set(id,F({...clone(entity),id,cellId:nextCell}));return clone(entities.get(id));},
    remove(entityId){const id=String(entityId),prev=entities.get(id);if(!prev)return false;remove(prev.cellId,id);return entities.delete(id);},
    query({x,y,realm='world',radius=radiusCells,predicate=null}){const cx=grid.coord(x),cy=grid.coord(y),ids=new Set();for(const cellId of grid.neighbors(cx,cy,radius,realm))for(const id of cells.get(cellId)||[])ids.add(id);let out=[...ids].map(id=>entities.get(id)).filter(Boolean);if(typeof predicate==='function')out=out.filter(predicate);return out.map(clone);},
    stats:()=>F({entities:entities.size,occupiedCells:cells.size})
  });
}

export function validateCommunityGraph(graph,policy=COMMUNITY_SCRIPT_POLICY){
  const nodes=Array.isArray(graph?.nodes)?graph.nodes:[];if(nodes.length>policy.maxNodes)return F({ok:false,code:'GRAPH_NODE_BUDGET_EXCEEDED'});const ids=new Set();
  for(const node of nodes){const id=normalizeId(node?.id);if(!id||ids.has(id))return F({ok:false,code:'GRAPH_NODE_ID_INVALID'});ids.add(id);if(!policy.allowedNodeTypes.includes(String(node.type)))return F({ok:false,code:'GRAPH_NODE_TYPE_FORBIDDEN',nodeId:id});if(stableStringify(node).length>policy.maxStringBytes)return F({ok:false,code:'GRAPH_NODE_SIZE_EXCEEDED',nodeId:id});}
  const edges=Array.isArray(graph?.edges)?graph.edges:[];for(const edge of edges)if(!ids.has(String(edge?.from))||!ids.has(String(edge?.to)))return F({ok:false,code:'GRAPH_EDGE_REFERENCE_INVALID'});return F({ok:true,nodes:nodes.length,edges:edges.length});
}

export function createFeatureFlagPlane({eventBus=null}={}){
  const flags=new Map();
  const set=(id,patch={},actorId='system')=>{const key=assertId(id,'FLAG_ID_REQUIRED'),current=flags.get(key);if(!current)throw new Error(`UNKNOWN_FLAG:${key}`);const next={...current,...clone(patch),rollout:patch.rollout==null?current.rollout:Math.max(0,Math.min(100,Number(patch.rollout)||0))};flags.set(key,next);eventBus?.emit?.('kelo:mmorpg:flag-change',{id:key,actorId,next:clone(next)});return clone(next);};
  return F({define(id,{enabled=false,rollout=0,killSwitch=true,meta={}}={}){const key=assertId(id,'FLAG_ID_REQUIRED');flags.set(key,{id:key,enabled:Boolean(enabled),rollout:Math.max(0,Math.min(100,Number(rollout)||0)),killSwitch:Boolean(killSwitch),meta:clone(meta)});return clone(flags.get(key));},set,emergencyDisable:(id,actorId='system',reason='emergency')=>set(id,{enabled:false,rollout:0,emergencyReason:String(reason)},actorId),get:id=>clone(flags.get(String(id))||null),list:()=>[...flags.values()].map(clone)});
}

export function createSystemLifecycle({eventBus=null}={}){
  const states=new Map(),adapters=new Map();
  const define=(id,meta={})=>{const key=assertId(id,'SYSTEM_ID_REQUIRED');if(!states.has(key))states.set(key,{id:key,state:'defined',meta:clone(meta),lastError:null});return clone(states.get(key));};
  return F({define,attach(id,adapter){const key=assertId(id,'SYSTEM_ID_REQUIRED');define(key);if(!adapter||typeof adapter!=='object')throw new Error(`SYSTEM_ADAPTER_REQUIRED:${key}`);adapters.set(key,adapter);states.set(key,{...states.get(key),state:'attached',lastError:null});return clone(states.get(key));},async start(id,context={}){const key=assertId(id,'SYSTEM_ID_REQUIRED');define(key);const adapter=adapters.get(key);if(!adapter)throw new Error(`SYSTEM_ADAPTER_MISSING:${key}`);try{if(typeof adapter.start==='function')await adapter.start(context);states.set(key,{...states.get(key),state:'active',lastError:null});eventBus?.emit?.('kelo:mmorpg:system-active',{id:key});}catch(error){states.set(key,{...states.get(key),state:'failed',lastError:String(error?.message||error)});throw error;}return clone(states.get(key));},async stop(id,context={}){const key=assertId(id,'SYSTEM_ID_REQUIRED'),adapter=adapters.get(key);if(typeof adapter?.stop==='function')await adapter.stop(context);if(states.has(key))states.set(key,{...states.get(key),state:'stopped'});return clone(states.get(key)||null);},get:id=>clone(states.get(String(id))||null),list:()=>[...states.values()].map(clone)});
}

export function createMMOCommunityFoundation(options={}){
  const eventBus=options.eventBus||createEventBus(),grid=createWorldGrid(options.worldGrid),foundation={version:'kelo-mmorpg-community-foundation-v0.1.0',eventBus,idempotency:createIdempotencyLedger(options.idempotency),capabilities:createCapabilityGate(),versions:createVersionStore({clock:options.clock||Date.now}),publication:createPublicationMachine({clock:options.clock||Date.now,eventBus}),worldGrid:grid,areaOfInterest:createAOIIndex({grid,radiusCells:options.radiusCells??1}),liveOps:createFeatureFlagPlane({eventBus}),lifecycle:createSystemLifecycle({eventBus}),scriptPolicy:COMMUNITY_SCRIPT_POLICY,validateCommunityGraph};
  foundation.capabilities.defineRole('creator',['ugc:create','ugc:edit-own','ugc:playtest-own']);
  foundation.capabilities.defineRole('reviewer',['ugc:review','ugc:moderation-view']);
  foundation.capabilities.defineRole('publisher',['ugc:publish','ugc:rollback']);
  foundation.capabilities.defineRole('admin',['ugc:create','ugc:review','ugc:publish','ugc:rollback','ugc:moderate','liveops:flags','liveops:emergency-disable']);
  return F(foundation);
}
