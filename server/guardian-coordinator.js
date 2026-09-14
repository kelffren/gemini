/* KELO-INDEX
 * area: SERVER / GUARDIAN
 * owner: Kelo Guardian Coordinator
 * keys: GUARDIAN DONATION HOST LEASE MASTER IOS RELAY ASSET COMPUTE HEARTBEAT AUTH
 * purpose: coordina nodos Guardian autenticados, su disponibilidad y una lease de host foreground para administradores
 * online: el servidor central conserva autoridad; Guardian solo anuncia capacidad hasta que un workload explícito sea asignado y verificado
 * do-not: NO confiar métricas de recompensa declaradas por cliente; NO mover economía/PvP al nodo sin protocolo de verificación
 */
'use strict';

const NODE_RE=/^[A-Za-z0-9:_-]{8,96}$/;
const PLATFORM=new Set(['ios','android','desktop','web']);
const DEVICE_CLASS=new Set(['phone','tablet','desktop','unknown']);
const VISIBILITY=new Set(['visible','hidden','prerender','unknown']);
const EFFECTIVE_TYPE=new Set(['slow-2g','2g','3g','4g','unknown']);

function clamp(n,min,max,fallback){n=Number(n);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function bool(v){return v===true;}
function short(v,max){return String(v==null?'':v).replace(/[^A-Za-z0-9._:-]/g,'').slice(0,max||64);}
function normalizeNodeId(value){const id=String(value||'').trim();if(!NODE_RE.test(id))throw new Error('GUARDIAN_NODE_ID_INVALID');return id;}
function sanitizeCapabilities(raw={}){
  const platform=PLATFORM.has(String(raw.platform))?String(raw.platform):'web';
  const deviceClass=DEVICE_CLASS.has(String(raw.deviceClass))?String(raw.deviceClass):'unknown';
  const visibility=VISIBILITY.has(String(raw.visibility))?String(raw.visibility):'unknown';
  const effectiveType=EFFECTIVE_TYPE.has(String(raw.effectiveType))?String(raw.effectiveType):'unknown';
  return Object.freeze({
    platform,deviceClass,visibility,effectiveType,
    online:raw.online!==false,
    webrtc:bool(raw.webrtc),serviceWorker:bool(raw.serviceWorker),saveData:bool(raw.saveData),touch:bool(raw.touch),
    cores:Math.round(clamp(raw.cores,1,64,1)),memoryGb:clamp(raw.memoryGb,0,128,0),
    batteryLevel:raw.batteryLevel==null?null:clamp(raw.batteryLevel,0,1,null),charging:raw.charging==null?null:bool(raw.charging),
    networkType:short(raw.networkType||'unknown',24)||'unknown',screenClass:short(raw.screenClass||'unknown',24)||'unknown'
  });
}
function sanitizePreferences(raw={}){
  return Object.freeze({
    idleDonation:raw.idleDonation!==false,wifiOnly:raw.wifiOnly!==false,chargingOnly:bool(raw.chargingOnly),
    allowAssets:raw.allowAssets!==false,allowRelay:raw.allowRelay!==false,allowCompute:bool(raw.allowCompute),
    maxUploadMbps:clamp(raw.maxUploadMbps,1,200,10),storageMb:Math.round(clamp(raw.storageMb,64,102400,512))
  });
}
function recommendedRoles(capabilities,preferences){
  const out=['witness-ready'];
  if(preferences.allowAssets)out.push('asset-seeder-ready');
  if(preferences.allowRelay&&capabilities.webrtc)out.push('relay-ready');
  if(preferences.allowCompute&&capabilities.cores>=4&&capabilities.visibility==='visible')out.push('compute-candidate');
  return Object.freeze(out);
}
function errorCode(error){const raw=String(error&&error.message||error);const known=['AUTH_TOKEN_REQUIRED','ACCOUNT_BANNED','ACCOUNT_SUSPENDED','GUARDIAN_NODE_ID_INVALID','GUARDIAN_NODE_NOT_ENABLED','GUARDIAN_MASTER_PERMISSION_DENIED','GUARDIAN_FOREGROUND_REQUIRED','GUARDIAN_MASTER_BUSY','GUARDIAN_BODY_TOO_LARGE','GUARDIAN_INVALID_JSON'];return known.find(code=>raw.includes(code))||'GUARDIAN_SERVER_ERROR';}
function json(res,status,payload){
  res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload));
}
function cors(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
  res.setHeader('Access-Control-Max-Age','600');
  if(req.method==='OPTIONS'){res.statusCode=204;res.end();return true;}return false;
}
function readJson(req,maxBytes=32768){
  return new Promise((resolve,reject)=>{
    let size=0,body='',settled=false;
    req.setEncoding('utf8');
    req.on('data',chunk=>{if(settled)return;size+=Buffer.byteLength(chunk);if(size>maxBytes){settled=true;reject(new Error('GUARDIAN_BODY_TOO_LARGE'));return;}body+=chunk;});
    req.on('end',()=>{if(settled)return;if(!body){resolve({});return;}try{resolve(JSON.parse(body));}catch(_){reject(new Error('GUARDIAN_INVALID_JSON'));}});
    req.on('error',error=>{if(!settled)reject(error);});
  });
}
function bearer(req){const value=String(req.headers.authorization||'');const match=/^Bearer\s+(.+)$/i.exec(value);return match?match[1].trim():'';}

function createGuardianCoordinator(options={}){
  const identity=options.identity;if(!identity)throw new Error('GUARDIAN_IDENTITY_REQUIRED');
  const now=typeof options.now==='function'?options.now:Date.now;
  const STALE_MS=Math.max(15000,Number(options.staleMs)||45000);
  const MASTER_LEASE_MS=Math.max(10000,Number(options.masterLeaseMs)||25000);
  const nodes=new Map();
  let epoch=0,masterLease=null;

  function masterEligible(actor){
    const roles=new Set(Array.isArray(actor?.roles)?actor.roles.map(String):[]),permissions=new Set(Array.isArray(actor?.permissions)?actor.permissions.map(String):[]);
    return roles.has('admin')||permissions.has('guardian.master_host')||permissions.has('guardian.master-host');
  }
  function nodeKey(accountId,nodeId){return String(accountId)+':'+String(nodeId);}
  function sweepLeaseOnly(at){if(masterLease&&masterLease.expiresAt<=at){const prior=nodes.get(masterLease.nodeKey);if(prior&&prior.role==='master-host')prior.role='donor-ready';masterLease=null;}}
  function networkSummary(at=now()){
    sweepLeaseOnly(at);
    let active=0,ios=0,relayReady=0,assetReady=0,computeReady=0;
    for(const node of nodes.values()){
      if(at-node.lastHeartbeatAt>STALE_MS)continue;active++;
      if(node.capabilities.platform==='ios')ios++;
      if(node.recommendedRoles.includes('relay-ready'))relayReady++;
      if(node.recommendedRoles.includes('asset-seeder-ready'))assetReady++;
      if(node.recommendedRoles.includes('compute-candidate'))computeReady++;
    }
    return Object.freeze({activeNodes:active,iosNodes:ios,relayReady,assetReady,computeReady,masterActive:!!masterLease,masterEpoch:masterLease?.epoch||0});
  }
  function sweep(at=now()){
    for(const [key,node] of nodes){if(at-node.lastHeartbeatAt>STALE_MS)nodes.delete(key);}
    sweepLeaseOnly(at);
    return networkSummary(at);
  }
  function publicNode(node){if(!node)return null;return Object.freeze({nodeId:node.nodeId,enabled:true,role:node.role,recommendedRoles:node.recommendedRoles,capabilities:node.capabilities,preferences:node.preferences,lastHeartbeatAt:node.lastHeartbeatAt,masterLeaseExpiresAt:masterLease?.nodeKey===node.key?masterLease.expiresAt:null,masterEpoch:masterLease?.nodeKey===node.key?masterLease.epoch:null});}
  function payload(actor,node,at=now()){
    sweep(at);return Object.freeze({ok:true,source:'guardian-coordinator-v1',serverTime:at,masterEligible:masterEligible(actor),node:publicNode(node),network:networkSummary(at)});
  }
  function enable(actor,input={}){
    const at=now(),nodeId=normalizeNodeId(input.nodeId),key=nodeKey(actor.accountId,nodeId),capabilities=sanitizeCapabilities(input.capabilities),preferences=sanitizePreferences(input.preferences),existing=nodes.get(key);
    const node=existing||{key,nodeId,accountId:actor.accountId,createdAt:at};
    node.capabilities=capabilities;node.preferences=preferences;node.recommendedRoles=recommendedRoles(capabilities,preferences);node.lastHeartbeatAt=at;node.role=masterLease?.nodeKey===key?'master-host':'donor-ready';nodes.set(key,node);return payload(actor,node,at);
  }
  function heartbeat(actor,input={}){
    const at=now(),nodeId=normalizeNodeId(input.nodeId),key=nodeKey(actor.accountId,nodeId),node=nodes.get(key);if(!node)throw new Error('GUARDIAN_NODE_NOT_ENABLED');
    if(input.capabilities)node.capabilities=sanitizeCapabilities(input.capabilities);if(input.preferences)node.preferences=sanitizePreferences(input.preferences);node.recommendedRoles=recommendedRoles(node.capabilities,node.preferences);node.lastHeartbeatAt=at;
    if(masterLease?.nodeKey===key){if(node.capabilities.visibility==='visible'){masterLease.expiresAt=at+MASTER_LEASE_MS;node.role='master-host';}else{masterLease=null;node.role='donor-ready';}}
    return payload(actor,node,at);
  }
  function disable(actor,input={}){
    const at=now(),nodeId=normalizeNodeId(input.nodeId),key=nodeKey(actor.accountId,nodeId);nodes.delete(key);if(masterLease?.nodeKey===key)masterLease=null;return payload(actor,null,at);
  }
  function status(actor,input={}){
    const at=now(),nodeId=normalizeNodeId(input.nodeId),node=nodes.get(nodeKey(actor.accountId,nodeId));return payload(actor,node,at);
  }
  function startMaster(actor,input={}){
    if(!masterEligible(actor))throw new Error('GUARDIAN_MASTER_PERMISSION_DENIED');
    const at=now(),nodeId=normalizeNodeId(input.nodeId),key=nodeKey(actor.accountId,nodeId);let node=nodes.get(key);if(!node){enable(actor,input);node=nodes.get(key);}
    if(!node)throw new Error('GUARDIAN_NODE_NOT_ENABLED');if(node.capabilities.visibility!=='visible')throw new Error('GUARDIAN_FOREGROUND_REQUIRED');
    sweep(at);if(masterLease&&masterLease.nodeKey!==key&&masterLease.accountId!==actor.accountId)throw new Error('GUARDIAN_MASTER_BUSY');
    if(masterLease&&masterLease.nodeKey!==key){const previous=nodes.get(masterLease.nodeKey);if(previous)previous.role='donor-ready';}
    masterLease={nodeKey:key,accountId:actor.accountId,nodeId,epoch:++epoch,startedAt:at,expiresAt:at+MASTER_LEASE_MS};node.role='master-host';node.lastHeartbeatAt=at;return payload(actor,node,at);
  }
  function stopMaster(actor,input={}){
    if(!masterEligible(actor))throw new Error('GUARDIAN_MASTER_PERMISSION_DENIED');
    const at=now(),nodeId=normalizeNodeId(input.nodeId),key=nodeKey(actor.accountId,nodeId),node=nodes.get(key);if(masterLease?.nodeKey===key)masterLease=null;if(node)node.role='donor-ready';return payload(actor,node,at);
  }
  async function authenticate(req){
    const token=bearer(req);if(!token)throw new Error('AUTH_TOKEN_REQUIRED');const user=await identity.verifyAccessToken(token),access=await identity.getAccountAccess(token);if(access.status==='banned')throw new Error('ACCOUNT_BANNED');if(access.status==='suspended')throw new Error('ACCOUNT_SUSPENDED');return{accountId:user.id,roles:access.roles||[],permissions:access.permissions||[]};
  }
  async function handleHttp(req,res){
    const url=new URL(String(req.url||'/'),'http://guardian.local');if(!url.pathname.startsWith('/api/guardian'))return false;if(cors(req,res))return true;
    try{
      const actor=await authenticate(req);let body={};if(req.method==='POST')body=await readJson(req);
      let result;
      if(req.method==='GET'&&url.pathname==='/api/guardian/status')result=status(actor,{nodeId:url.searchParams.get('nodeId')});
      else if(req.method==='POST'&&url.pathname==='/api/guardian/enable')result=enable(actor,body);
      else if(req.method==='POST'&&url.pathname==='/api/guardian/heartbeat')result=heartbeat(actor,body);
      else if(req.method==='POST'&&url.pathname==='/api/guardian/disable')result=disable(actor,body);
      else if(req.method==='POST'&&url.pathname==='/api/guardian/master/start')result=startMaster(actor,body);
      else if(req.method==='POST'&&url.pathname==='/api/guardian/master/stop')result=stopMaster(actor,body);
      else{json(res,404,{ok:false,error:'GUARDIAN_NOT_FOUND'});return true;}
      json(res,200,result);return true;
    }catch(error){const code=errorCode(error),status=code==='AUTH_TOKEN_REQUIRED'?401:code==='GUARDIAN_MASTER_PERMISSION_DENIED'?403:code==='GUARDIAN_MASTER_BUSY'?409:code==='GUARDIAN_SERVER_ERROR'?500:400;json(res,status,{ok:false,error:code});return true;}
  }
  function audit(){const at=now();sweep(at);return Object.freeze({version:'guardian-coordinator-v1',activeNodes:networkSummary(at).activeNodes,masterActive:!!masterLease,masterEpoch:masterLease?.epoch||0,masterLeaseMs:MASTER_LEASE_MS,staleMs:STALE_MS,serverAuthorityPreserved:true,rewardMetricsClientTrusted:false});}
  return Object.freeze({version:'guardian-coordinator-v1',enable,heartbeat,disable,status,startMaster,stopMaster,sweep,handleHttp,audit});
}

module.exports={createGuardianCoordinator,sanitizeCapabilities,sanitizePreferences,recommendedRoles};