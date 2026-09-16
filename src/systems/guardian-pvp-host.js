/* KELO-INDEX
 * area: GUARDIAN / PVP HOST
 * owner: KeloGuardianPvPHost
 * keys: GUARDIAN PVP TEMPORARY AUTHORITY ROOM FIXED STEP INTENT SNAPSHOT LEASE EPOCH TAKEOVER RATE LIMIT WORKER MOBILE
 * purpose: coordina una autoridad PvP temporal en un Web Worker aislado y restaura una semilla segura al cambiar de Master
 * consumes: KeloGuardian + GuardianPvPAuthorityWorker + KeloSimulation
 * state-owned: una sala PvP efímera, snapshots, semilla de takeover, rate-limit y diagnóstico
 * online: autoridad gameplay SOLO dentro de la sala temporal mientras la lease Master/epoch sigan válidos; servidor central siempre tiene prioridad
 * do-not: NO economía, NO inventario, NO persistencia, NO recompensas, NO segundo loop, NO autoproclamarse Master
 */
(function(root){
'use strict';
if(root.KeloGuardianPvPHost||!root.KeloGuardian)return;
const VERSION='kelo-guardian-pvp-host-v2-worker',SCHEMA=1,FIXED_DT=1/60,MAX_PLAYERS=16,MAX_MESSAGE_BYTES=48*1024,MAX_CATCHUP_STEPS=5,TAKEOVER_MAX_AGE_MS=7000,MAX_INPUTS_PER_SECOND=90;
const WORKER_URL='src/workers/guardian-pvp-authority-worker.js?v=2-takeover';
let activeRoom=null,latest=null,lastSnapshotSeq=0,lastSnapshotEpoch=0,lastError=null,wasMaster=false,observedEpoch=0,accumulator=0,lastEmitKey='';
let worker=null,workerRoom=null,workerReady=false;
const inputRateByPeer=new Map();
const stats={intentsAccepted:0,intentsRejected:0,rateLimited:0,snapshotsSent:0,snapshotsReceived:0,leaseResets:0,roomsCreated:0,maxCatchupHit:0,takeoversRestored:0,playersRestored:0,transientActionsReset:0,projectilesReset:0,workerStarts:0,workerErrors:0};
function guardian(){try{return root.KeloGuardian.state();}catch(_){return{};}}
function epoch(){return Number(guardian().master?.epoch||guardian().network?.masterEpoch||0)||0;}
function short(v,max=96){return String(v==null?'':v).replace(/[\u0000-\u001f]/g,'').slice(0,max);}
function roomId(v){const s=short(v,64);return /^[A-Za-z0-9_.:-]{1,64}$/.test(s)?s:null;}
function bytes(v){try{return new TextEncoder().encode(JSON.stringify(v)).byteLength;}catch(_){try{return JSON.stringify(v).length;}catch(__){return Infinity;}}}
function actorIdForNode(nodeId){const clean=short(nodeId,80).replace(/[^A-Za-z0-9_-]/g,'_');return clean?'gp_'+clean.slice(-72):null;}
function actorId(){return actorIdForNode(guardian().nodeId);}
function visible(){return typeof document==='undefined'||document.visibilityState==='visible';}
function centralOnline(){try{const base=root.KeloGuardianPvPNetAdapter?.baseAuthority;return !!(base&&typeof base.isOnline==='function'&&base.isOnline());}catch(_){return false;}}
function workerSupported(){return typeof root.Worker==='function';}
function masterValid(messageEpoch){const g=guardian();return !!(g.enabled&&g.masterActive&&!centralOnline()&&visible()&&epoch()&&Number(messageEpoch)===epoch());}
function rateAllowed(peerId,now){const key=short(peerId,96),row=inputRateByPeer.get(key)||{windowAt:now,count:0};if(now-row.windowAt>=1000){row.windowAt=now;row.count=0;}row.count++;inputRateByPeer.set(key,row);if(row.count>MAX_INPUTS_PER_SECOND){stats.rateLimited++;return false;}return true;}
function sanitizeIntent(raw){
  const m=raw&&typeof raw==='object'?raw:{},action=short(m.action||'input',32),phase=short(m.phase||'none',24),sequence=Number(m.sequence);
  if(!Number.isSafeInteger(sequence)||sequence<0)return null;
  const moveX=Number(m.moveX)||0,moveY=Number(m.moveY)||0,aimX=Number(m.aimX)||0,aimY=Number(m.aimY)||0;
  if(Math.hypot(moveX,moveY)>1.001||Math.hypot(aimX,aimY)>1.0015)return null;
  return Object.freeze({sequence,moveX,moveY,aimX,aimY,action,phase,abilityKey:m.abilityKey==null?null:short(m.abilityKey,64),slot:Number.isInteger(Number(m.slot))?Number(m.slot):null,direction:m.direction&&typeof m.direction==='object'?{x:Number(m.direction.x)||0,y:Number(m.direction.y)||0}:null,position:m.position&&typeof m.position==='object'?{x:Number(m.position.x)||0,y:Number(m.position.y)||0}:null,targetId:m.targetId==null?null:short(m.targetId,80),attackId:m.attackId==null?null:short(m.attackId,96),swordEntityId:m.swordEntityId==null?null:short(m.swordEntityId,96),clientTime:Number(m.clientTime)||Date.now()});
}
function takeoverSeedFor(nextEpoch){
  const snap=latest,now=Date.now();
  if(!activeRoom||!snap||String(snap.roomId)!==String(activeRoom)||!snap.receivedAt||now-snap.receivedAt>TAKEOVER_MAX_AGE_MS||Number(snap.epoch)<=0||Number(snap.epoch)===Number(nextEpoch))return null;
  return snap;
}
function stopWorker(reason){
  const had=!!workerRoom;
  if(worker){try{worker.postMessage({t:'dispose'});}catch(_){}try{worker.terminate();}catch(_){}}
  worker=null;workerRoom=null;workerReady=false;accumulator=0;inputRateByPeer.clear();
  if(had)stats.leaseResets++;
  if(reason&&!['lease-lost','new-lease','stop','central-online','replace'].includes(reason))lastError=reason;
}
function dispatchReject(msg){
  if(String(msg?.nodeId||'')===String(guardian().nodeId||'')){try{root.dispatchEvent(new CustomEvent('kelo:guardian-pvp-reject',{detail:msg}));}catch(_){}}
}
function handleWorkerMessage(event){
  const msg=event?.data||{},row=workerRoom;if(!row)return;
  if(msg.roomId!=null&&String(msg.roomId)!==String(row.id))return;
  if(msg.epoch!=null&&Number(msg.epoch)!==Number(row.epoch))return;
  if(msg.t==='ready'){
    workerReady=true;row.ready=true;row.tick=Math.max(0,Number(msg.tickOffset)||0);row.takeoverFromEpoch=Math.max(0,Number(msg.takeoverFromEpoch)||0);
    if(msg.takeoverRestored){
      const restored=Math.max(0,Number(msg.playersRestored)||0),resetProjectiles=Math.max(0,Number(msg.projectilesReset)||0);
      stats.takeoversRestored++;stats.playersRestored+=restored;stats.transientActionsReset+=restored;stats.projectilesReset+=resetProjectiles;
      const notice={t:'guardian:pvp_takeover',schema:SCHEMA,roomId:row.id,previousEpoch:row.takeoverFromEpoch,newEpoch:row.epoch,sourceSnapshotSeq:Math.max(0,Number(msg.takeoverSnapshotSeq)||0),serverTick:row.tick,playersRestored:restored,transientActionsReset:true,projectilesReset:true,at:Date.now(),persistentAuthority:false};
      root.KeloGuardian.broadcast(notice);try{root.dispatchEvent(new CustomEvent('kelo:guardian-pvp-takeover',{detail:notice}));}catch(_){}
    }
    lastError=null;emit(true);return;
  }
  if(msg.t==='reject'){
    stats.intentsRejected++;if(stats.intentsAccepted>0)stats.intentsAccepted--;
    const reject={t:'guardian:pvp_reject',schema:SCHEMA,roomId:row.id,epoch:row.epoch,nodeId:short(msg.nodeId,96),actorId:short(msg.actorId,80),sequence:Number(msg.sequence)||0,ackSequence:Number(msg.ackSequence)||0,code:short(msg.code||'REJECTED',64)};
    root.KeloGuardian.broadcast(reject);dispatchReject(reject);emit(true);return;
  }
  if(msg.t==='snapshot'){
    const out={t:'guardian:pvp_snapshot',schema:SCHEMA,roomId:row.id,epoch:row.epoch,masterNodeId:short(guardian().nodeId,96),seq:Math.max(1,Number(msg.seq)||1),serverTick:Math.max(0,Number(msg.serverTick)||0),serverTime:Number(msg.serverTime)||Date.now(),fixedDt:Number(msg.fixedDt)||FIXED_DT,maxRewindMs:Math.max(0,Number(msg.maxRewindMs)||0),inputBufferMs:Math.max(0,Number(msg.inputBufferMs)||0),movementProfileVersion:short(msg.movementProfileVersion,80),players:msg.players&&typeof msg.players==='object'?msg.players:{},projectiles:Array.isArray(msg.projectiles)?msg.projectiles.slice(0,64):[],events:Array.isArray(msg.events)?msg.events.slice(-32):[],temporaryAuthority:true,persistentAuthority:false,economyAuthority:false,inventoryAuthority:false};
    if(bytes(out)>MAX_MESSAGE_BYTES){out.projectiles=[];out.events=[];}
    if(bytes(out)>MAX_MESSAGE_BYTES){lastError='GUARDIAN_PVP_SNAPSHOT_TOO_LARGE';emit(true);return;}
    row.tick=out.serverTick;row.players=Object.keys(out.players).length;row.updatedAt=Date.now();
    const sent=root.KeloGuardian.broadcast(out);if(sent>0)stats.snapshotsSent++;
    acceptSnapshot(guardian().nodeId,out,true);return;
  }
  if(msg.t==='error'){stats.workerErrors++;lastError=short(msg.code||'GUARDIAN_PVP_WORKER_ERROR',80)+':'+short(msg.message||'',180);stopWorker('worker-error');emit(true);}
}
function startWorker(id,seed){
  if(!workerSupported()){lastError='GUARDIAN_PVP_WORKER_UNAVAILABLE';return false;}
  stopWorker('replace');
  const e=epoch();if(!e)return false;
  try{
    const url=new URL(WORKER_URL,document.baseURI).href,w=new root.Worker(url);
    worker=w;workerReady=false;workerRoom={id,epoch:e,ready:false,players:0,tick:seed?Math.max(0,Number(seed.serverTick)||0):0,createdAt:Date.now(),updatedAt:Date.now(),takeoverFromEpoch:seed?Math.max(0,Number(seed.epoch)||0):0};
    w.onmessage=handleWorkerMessage;
    w.onerror=event=>{stats.workerErrors++;lastError='GUARDIAN_PVP_WORKER_LOAD_ERROR:'+short(event?.message||'',180);stopWorker('worker-load-error');emit(true);};
    w.onmessageerror=()=>{stats.workerErrors++;lastError='GUARDIAN_PVP_WORKER_MESSAGE_ERROR';stopWorker('worker-message-error');emit(true);};
    w.postMessage({t:'init',roomId:id,epoch:e,seed:seed||null,now:Date.now()});
    stats.roomsCreated++;stats.workerStarts++;emit(true);return true;
  }catch(error){stats.workerErrors++;lastError='GUARDIAN_PVP_WORKER_START_ERROR:'+short(error?.message||error,180);stopWorker('worker-start-error');emit(true);return false;}
}
function reconcileLease(){
  const g=guardian(),e=epoch(),active=!!g.masterActive,becameMaster=active&&(!wasMaster||e!==observedEpoch);
  if(!active&&wasMaster)stopWorker('lease-lost');
  if(becameMaster){
    stopWorker('new-lease');observedEpoch=e;wasMaster=true;
    if(activeRoom){
      const seed=takeoverSeedFor(e);
      if(latest&&Number(latest.epoch)!==e&&!seed){lastError='GUARDIAN_PVP_TAKEOVER_SEED_UNAVAILABLE';emit(true);return;}
      startWorker(activeRoom,seed);
    }
    return;
  }
  wasMaster=active;observedEpoch=e;
}
function acceptIntent(fromNodeId,msg){
  const now=Date.now();if(!msg||msg.t!=='guardian:pvp_intent'||msg.schema!==SCHEMA||bytes(msg)>MAX_MESSAGE_BYTES||!masterValid(msg.epoch)){stats.intentsRejected++;return false;}
  if(!rateAllowed(fromNodeId,now)){stats.intentsRejected++;return false;}
  const id=roomId(msg.roomId),intent=sanitizeIntent(msg.intent);if(!id||!intent||!worker||!workerRoom||String(workerRoom.id)!==id||Number(workerRoom.epoch)!==epoch()){stats.intentsRejected++;return false;}
  try{worker.postMessage({t:'intent',roomId:id,epoch:workerRoom.epoch,nodeId:short(fromNodeId,96),actor:{name:short(msg.actor?.name||'Guardian',24)},intent,now});stats.intentsAccepted++;workerRoom.updatedAt=now;return true;}
  catch(error){stats.intentsRejected++;lastError='GUARDIAN_PVP_WORKER_INTENT_ERROR:'+short(error?.message||error,160);emit(true);return false;}
}
function acceptSnapshot(fromNodeId,msg,localMaster){
  const g=guardian(),master=g.master||{};if(!msg||msg.t!=='guardian:pvp_snapshot'||msg.schema!==SCHEMA||bytes(msg)>MAX_MESSAGE_BYTES)return false;
  if(!localMaster){if(!master.nodeId||String(fromNodeId)!==String(master.nodeId)||Number(msg.epoch)!==Number(master.epoch))return false;}
  if(activeRoom&&String(msg.roomId)!==String(activeRoom))return false;
  const msgEpoch=Math.max(0,Math.floor(Number(msg.epoch)||0));if(!msgEpoch)return false;if(msgEpoch!==lastSnapshotEpoch){lastSnapshotEpoch=msgEpoch;lastSnapshotSeq=0;}
  const seq=Math.max(0,Math.floor(Number(msg.seq)||0));if(!seq||seq<=lastSnapshotSeq)return false;lastSnapshotSeq=seq;
  latest=Object.freeze({...msg,receivedAt:Date.now(),source:'guardian-temporary-authority'});stats.snapshotsReceived++;
  try{root.dispatchEvent(new CustomEvent('kelo:guardian-pvp-snapshot',{detail:{snapshot:latest,localActorId:actorId()}}));}catch(_){}
  emit(true);return true;
}
function onGuardianData(event){
  const d=event?.detail||{},msg=d.payload||{};
  if(msg.t==='guardian:pvp_intent')acceptIntent(d.fromNodeId,msg);
  else if(msg.t==='guardian:pvp_snapshot')acceptSnapshot(d.fromNodeId,msg,false);
  else if(msg.t==='guardian:pvp_takeover'){try{root.dispatchEvent(new CustomEvent('kelo:guardian-pvp-takeover',{detail:msg}));}catch(_){} }
  else if(msg.t==='guardian:pvp_reject'&&activeRoom===msg.roomId&&(!msg.nodeId||String(msg.nodeId)===String(guardian().nodeId))){try{root.dispatchEvent(new CustomEvent('kelo:guardian-pvp-reject',{detail:msg}));}catch(_){} }
}
function submitIntent(raw){
  const id=roomId(activeRoom),g=guardian(),m=g.master||{},intent=sanitizeIntent(raw);if(!id||!intent||!g.enabled||!m.nodeId||!m.epoch||centralOnline())return false;
  const msg={t:'guardian:pvp_intent',schema:SCHEMA,roomId:id,epoch:Number(m.epoch),actor:{name:short(typeof root.localPlayer!=='undefined'&&root.localPlayer?.name||'Kelo',24)},intent,sentAt:Date.now()};
  if(bytes(msg)>MAX_MESSAGE_BYTES)return false;
  if(g.masterActive)return acceptIntent(g.nodeId,msg)?intent.sequence:false;
  return root.KeloGuardian.sendToMaster(msg)?intent.sequence:false;
}
function start(id){
  id=roomId(id||'pvp-lab');if(!id)throw new Error('GUARDIAN_PVP_ROOM_INVALID');const g=guardian();
  if(centralOnline())throw new Error('GUARDIAN_PVP_CENTRAL_SERVER_ACTIVE');if(!workerSupported())throw new Error('GUARDIAN_PVP_WORKER_UNAVAILABLE');if(!g.enabled)throw new Error('GUARDIAN_PVP_GUARDIAN_OFF');if(!g.master?.nodeId||!g.master?.epoch)throw new Error('GUARDIAN_PVP_MASTER_REQUIRED');
  activeRoom=id;lastSnapshotSeq=0;lastSnapshotEpoch=0;latest=null;lastError=null;
  if(g.masterActive&&!startWorker(id,null))throw new Error(lastError||'GUARDIAN_PVP_WORKER_START_FAILED');
  emit(true);return state();
}
function stop(){activeRoom=null;latest=null;lastSnapshotSeq=0;lastSnapshotEpoch=0;stopWorker('stop');emit(true);return state();}
function isActive(){const g=guardian();return !!(activeRoom&&g.enabled&&!centralOnline()&&g.master?.nodeId&&g.master?.epoch);}
function tick(context){
  reconcileLease();if(centralOnline()){if(worker)stopWorker('central-online');return emit();}if(!wasMaster||!visible()||!worker||!workerRoom)return emit();
  const dt=Math.max(0,Math.min(.1,Number(context?.dt)||0));accumulator+=dt;let steps=0;
  while(accumulator>=FIXED_DT&&steps<MAX_CATCHUP_STEPS){accumulator-=FIXED_DT;steps++;}
  if(steps===MAX_CATCHUP_STEPS&&accumulator>=FIXED_DT){accumulator=0;stats.maxCatchupHit++;}
  if(steps>0){try{worker.postMessage({t:'step',roomId:workerRoom.id,epoch:workerRoom.epoch,steps,now:Date.now()});}catch(error){stats.workerErrors++;lastError='GUARDIAN_PVP_WORKER_STEP_ERROR:'+short(error?.message||error,160);stopWorker('worker-step-error');}}
  emit();
}
function state(){
  const g=guardian(),now=Date.now(),hosted=workerRoom?Object.freeze({id:workerRoom.id,epoch:workerRoom.epoch,ready:workerReady,players:workerRoom.players,tick:workerRoom.tick,takeoverFromEpoch:workerRoom.takeoverFromEpoch||0,updatedAt:workerRoom.updatedAt}):null;
  return Object.freeze({version:VERSION,enabled:!!g.enabled,active:isActive(),roomId:activeRoom,actorId:actorId(),masterActive:!!g.masterActive,masterNodeId:g.master?.nodeId||null,masterEpoch:epoch(),workerSupported:workerSupported(),workerReady,hostedRooms:Object.freeze(hosted?[hosted]:[]),latestSnapshot:latest?Object.freeze({roomId:latest.roomId,epoch:latest.epoch,seq:latest.seq,serverTick:latest.serverTick,ageMs:Math.max(0,now-latest.receivedAt),players:Object.keys(latest.players||{}).length}):null,stats:Object.freeze({...stats}),takeover:Object.freeze({maxAgeMs:TAKEOVER_MAX_AGE_MS,transientActionsReset:true,projectilesReset:true}),temporaryGameplayAuthority:true,persistentAuthority:false,economyAuthority:false,inventoryAuthority:false,rewardsAuthority:false,lastError});
}
function emit(force){const s=state(),key=[s.active,s.roomId,s.masterActive,s.masterEpoch,s.workerReady,s.hostedRooms.length,s.latestSnapshot?.seq||0,s.stats.intentsAccepted,s.stats.intentsRejected,s.stats.takeoversRestored,s.lastError||''].join('|');if(!force&&key===lastEmitKey)return s;lastEmitKey=key;try{root.dispatchEvent(new CustomEvent('kelo:guardian-pvp-state',{detail:s}));}catch(_){}return s;}
root.addEventListener('kelo:guardian-data',onGuardianData,{passive:true});
root.addEventListener('kelo:guardian-state',()=>{reconcileLease();emit(true);},{passive:true});
root.addEventListener('pagehide',()=>stopWorker('pagehide'),{once:true});
if(!root.KeloSimulation||typeof root.KeloSimulation.after!=='function')throw new Error('GUARDIAN_PVP_SIMULATION_OWNER_UNAVAILABLE');
root.KeloSimulation.after('guardian:pvp-host',tick,375);
root.KeloGuardianPvPHost=Object.freeze({version:VERSION,state,start,stop,isActive,actorId,submitIntent,latestSnapshot:()=>latest});
root.KELO_GUARDIAN_PVP_HOST_AUDIT=Object.freeze({version:VERSION,owner:'KeloGuardianPvPHost',isolatedWorker:true,statusRealmIsolated:true,workerOwnLoop:false,existingGuardianDataChannel:true,fixedStep:true,maxRooms:1,maxPlayers:MAX_PLAYERS,maxCatchupSteps:MAX_CATCHUP_STEPS,leaseFenced:true,epochFenced:true,snapshotEpochFenced:true,inputRateLimit:MAX_INPUTS_PER_SECOND,takeoverRestore:true,takeoverMaxAgeMs:TAKEOVER_MAX_AGE_MS,transientActionsReset:true,projectilesReset:true,centralAuthorityPriority:true,temporaryGameplayAuthority:true,persistentAuthority:false,economyAuthority:false,inventoryAuthority:false,rewardsAuthority:false,secondLoop:false,localStorage:false});
reconcileLease();emit(true);
})(typeof globalThis!=='undefined'?globalThis:window);
