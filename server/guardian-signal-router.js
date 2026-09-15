/* KELO-INDEX
 * area: SERVER / GUARDIAN SIGNALING
 * owner: Kelo Guardian Signal Router
 * keys: GUARDIAN WEBRTC SIGNAL OFFER ANSWER ICE SESSION TTL RATE LIMIT SINGLE SOCKET RELAY
 * purpose: enruta signaling WebRTC entre nodos Guardian autenticados usando el WebSocket existente del juego
 * authority: signaling solamente; no transporta ni acepta autoridad de gameplay/economia/PvP
 * do-not: NO segundo WebSocket, NO credenciales TURN en cliente, NO broadcast SDP/ICE, NO confiar nodeId sin binding autenticado
 */
'use strict';

const NODE_RE=/^[A-Za-z0-9:_-]{8,96}$/;
const SESSION_RE=/^gs_[A-Za-z0-9_-]{8,80}$/;
const SESSION_TTL_MS=60000;
const MAX_SESSIONS_PER_NODE=2;
const RATE_WINDOW_MS=10000;
const RATE_MAX=80;
const SDP_MAX=24576;
const ICE_MAX=2048;

function clean(value,max){return String(value==null?'':value).replace(/[^A-Za-z0-9._:-]/g,'').slice(0,max||96);}
function nodeKey(accountId,nodeId){return String(accountId)+':'+String(nodeId);}
function validNodeId(value){const v=String(value||'');if(!NODE_RE.test(v))throw new Error('GUARDIAN_SIGNAL_NODE_INVALID');return v;}
function send(me,payload){if(me?.ws?.readyState===1)me.ws.send(JSON.stringify(payload));}
function actorFor(me){return{accountId:me.accountId,roles:Array.isArray(me.roles)?me.roles:[],permissions:Array.isArray(me.permissions)?me.permissions:[]};}
function makeSessionId(seq){return 'gs_'+Date.now().toString(36)+'_'+Number(seq).toString(36)+'_'+Math.random().toString(36).slice(2,8);}
function sanitizeSignal(raw){
  const kind=String(raw?.kind||'');
  if(kind==='offer'||kind==='answer'){
    const sdp=String(raw?.sdp||'');
    if(!sdp||sdp.length>SDP_MAX)throw new Error('GUARDIAN_SIGNAL_SDP_INVALID');
    return Object.freeze({kind,sdp});
  }
  if(kind==='ice'){
    const candidate=String(raw?.candidate||'');
    if(!candidate||candidate.length>ICE_MAX)throw new Error('GUARDIAN_SIGNAL_ICE_INVALID');
    const sdpMid=raw?.sdpMid==null?null:String(raw.sdpMid).slice(0,128);
    const idx=raw?.sdpMLineIndex==null?null:Number(raw.sdpMLineIndex);
    if(idx!=null&&(!Number.isInteger(idx)||idx<0||idx>64))throw new Error('GUARDIAN_SIGNAL_ICE_INVALID');
    return Object.freeze({kind,candidate,sdpMid,sdpMLineIndex:idx});
  }
  throw new Error('GUARDIAN_SIGNAL_KIND_INVALID');
}
function errorCode(error){
  const raw=String(error?.message||error);
  const known=['GUARDIAN_SIGNAL_AUTH_REQUIRED','GUARDIAN_SIGNAL_NODE_INVALID','GUARDIAN_SIGNAL_NODE_NOT_BOUND','GUARDIAN_SIGNAL_NODE_NOT_ENABLED','GUARDIAN_SIGNAL_CAPACITY','GUARDIAN_SIGNAL_SESSION_LIMIT','GUARDIAN_SIGNAL_SESSION_INVALID','GUARDIAN_SIGNAL_SESSION_FORBIDDEN','GUARDIAN_SIGNAL_SDP_INVALID','GUARDIAN_SIGNAL_ICE_INVALID','GUARDIAN_SIGNAL_KIND_INVALID','GUARDIAN_SIGNAL_RATE_LIMIT'];
  return known.find(code=>raw.includes(code))||'GUARDIAN_SIGNAL_ERROR';
}

function createGuardianSignalRouter({guardian,now=Date.now}={}){
  if(!guardian)throw new Error('GUARDIAN_SIGNAL_COORDINATOR_REQUIRED');
  const bindings=new Map(),sessions=new Map(),rates=new WeakMap();let seq=0;

  function rate(me){
    const at=now(),prev=rates.get(me)||{at,count:0};
    if(at-prev.at>=RATE_WINDOW_MS){prev.at=at;prev.count=0;}
    prev.count++;rates.set(me,prev);if(prev.count>RATE_MAX)throw new Error('GUARDIAN_SIGNAL_RATE_LIMIT');
  }
  function requireAuth(me){if(!me?.accountId)throw new Error('GUARDIAN_SIGNAL_AUTH_REQUIRED');return actorFor(me);}
  function bindingFor(me){const key=me?._guardianNodeKey,row=key&&bindings.get(key);if(!row||row.me!==me)throw new Error('GUARDIAN_SIGNAL_NODE_NOT_BOUND');return row;}
  function sessionCount(key){let n=0;for(const row of sessions.values())if(row.a===key||row.b===key)n++;return n;}
  function closeSession(id,reason='closed',notify=true){
    const row=sessions.get(id);if(!row)return false;sessions.delete(id);
    if(notify){for(const key of [row.a,row.b]){const bound=bindings.get(key);if(bound)send(bound.me,{t:'guardian:peer:closed',sessionId:id,reason:clean(reason,64),source:'guardian-signal-router-v1'});}}
    return true;
  }
  function sweep(at=now()){
    let expired=0;for(const [id,row] of [...sessions])if(row.expiresAt<=at){closeSession(id,'ttl-expired',true);expired++;}
    for(const [key,row] of [...bindings])if(!row?.me?.ws||row.me.ws.readyState!==1)bindings.delete(key);
    return Object.freeze({expired,bindings:bindings.size,sessions:sessions.size});
  }
  function bind(me,nodeId,requestId){
    const actor=requireAuth(me);nodeId=validNodeId(nodeId);sweep();
    const status=guardian.status(actor,{nodeId});if(!status?.node?.enabled)throw new Error('GUARDIAN_SIGNAL_NODE_NOT_ENABLED');
    if(me._guardianNodeKey&&me._guardianNodeKey!==nodeKey(me.accountId,nodeId))unbind(me,'rebind');
    const key=nodeKey(me.accountId,nodeId),prior=bindings.get(key);
    if(prior&&prior.me!==me)unbind(prior.me,'replaced');
    me._guardianNodeKey=key;me._guardianNodeId=nodeId;bindings.set(key,{key,nodeId,accountId:me.accountId,me,boundAt:now()});
    const result={t:'guardian:bound',requestId:requestId||null,nodeId,sessionTtlMs:SESSION_TTL_MS,maxSessions:MAX_SESSIONS_PER_NODE,source:'guardian-signal-router-v1'};send(me,result);return result;
  }
  function unbind(me,reason='disconnect'){
    const key=me?._guardianNodeKey;if(!key)return false;
    bindings.delete(key);for(const [id,row] of [...sessions])if(row.a===key||row.b===key)closeSession(id,reason,true);
    me._guardianNodeKey=null;me._guardianNodeId=null;return true;
  }
  function requestPeer(me,input={}){
    requireAuth(me);rate(me);sweep();const source=bindingFor(me);
    if(sessionCount(source.key)>=MAX_SESSIONS_PER_NODE)throw new Error('GUARDIAN_SIGNAL_SESSION_LIMIT');
    const region=clean(input.region||'global',48)||'global';
    const plan=guardian.planWorkload({type:'relay',region,limit:8,excludeNodeKeys:[source.key]});
    const candidate=(plan.candidates||[]).find(row=>{const b=bindings.get(row.nodeKey);return b&&b.me!==me&&b.me.ws?.readyState===1&&sessionCount(row.nodeKey)<MAX_SESSIONS_PER_NODE;});
    if(!candidate)throw new Error('GUARDIAN_SIGNAL_CAPACITY');
    const id=makeSessionId(++seq),at=now(),row={id,a:source.key,b:candidate.nodeKey,createdAt:at,expiresAt:at+SESSION_TTL_MS,region};sessions.set(id,row);
    const peer=bindings.get(candidate.nodeKey);
    const invite={t:'guardian:peer:invite',sessionId:id,peerNodeId:source.nodeId,region,expiresAt:row.expiresAt,source:'guardian-signal-router-v1'};
    send(peer.me,invite);
    const response={t:'guardian:peer:session',requestId:input.requestId||null,sessionId:id,peerNodeId:peer.nodeId,role:'offerer',region,expiresAt:row.expiresAt,source:'guardian-signal-router-v1'};send(me,response);return response;
  }
  function routeSignal(me,input={}){
    requireAuth(me);rate(me);sweep();const source=bindingFor(me),id=String(input.sessionId||'');
    if(!SESSION_RE.test(id))throw new Error('GUARDIAN_SIGNAL_SESSION_INVALID');const row=sessions.get(id);if(!row)throw new Error('GUARDIAN_SIGNAL_SESSION_INVALID');
    if(row.a!==source.key&&row.b!==source.key)throw new Error('GUARDIAN_SIGNAL_SESSION_FORBIDDEN');
    const targetKey=row.a===source.key?row.b:row.a,target=bindings.get(targetKey);if(!target||target.me.ws?.readyState!==1){closeSession(id,'peer-offline',false);throw new Error('GUARDIAN_SIGNAL_CAPACITY');}
    const signal=sanitizeSignal(input.signal);row.expiresAt=now()+SESSION_TTL_MS;
    const out={t:'guardian:peer:signal',sessionId:id,peerNodeId:source.nodeId,signal,expiresAt:row.expiresAt,source:'guardian-signal-router-v1'};send(target.me,out);return Object.freeze({ok:true,sessionId:id});
  }
  function closeFrom(me,input={}){requireAuth(me);rate(me);const source=bindingFor(me),id=String(input.sessionId||''),row=sessions.get(id);if(!row)return{ok:true,closed:false};if(row.a!==source.key&&row.b!==source.key)throw new Error('GUARDIAN_SIGNAL_SESSION_FORBIDDEN');return{ok:true,closed:closeSession(id,input.reason||'peer-closed',true)};}
  function handle(me,msg){
    if(!String(msg?.t||'').startsWith('guardian:'))return false;
    try{
      let result;if(msg.t==='guardian:bind')result=bind(me,msg.nodeId,msg.requestId);
      else if(msg.t==='guardian:peer:request')result=requestPeer(me,{...msg,requestId:msg.requestId});
      else if(msg.t==='guardian:peer:signal')result=routeSignal(me,msg);
      else if(msg.t==='guardian:peer:close')result=closeFrom(me,msg);
      else return false;
      if(msg.requestId&&msg.t!=='guardian:bind'&&msg.t!=='guardian:peer:request')send(me,{t:'guardian:result',requestId:msg.requestId,...result,source:'guardian-signal-router-v1'});
      return true;
    }catch(error){send(me,{t:'guardian:error',requestId:msg?.requestId||null,code:errorCode(error),source:'guardian-signal-router-v1'});return true;}
  }
  function audit(){sweep();return Object.freeze({version:'guardian-signal-router-v1',bindings:bindings.size,sessions:sessions.size,sessionTtlMs:SESSION_TTL_MS,maxSessionsPerNode:MAX_SESSIONS_PER_NODE,singleSocket:true,gameplayAuthority:false,economyAuthority:false,pvpAuthority:false});}
  return Object.freeze({version:'guardian-signal-router-v1',handle,bind,unbind,requestPeer,routeSignal,closeFrom,sweep,audit});
}

module.exports={createGuardianSignalRouter,sanitizeSignal};
