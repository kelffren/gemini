/* KELO-INDEX
 * area: GUARDIAN / PVP HOST
 * owner: KeloGuardianPvPHost
 * keys: GUARDIAN PVP TEMPORARY AUTHORITY ROOM FIXED STEP INTENT SNAPSHOT LEASE EPOCH MOBILE
 * purpose: ejecuta el mismo core PvP del servidor dentro del Guardian Master para salas temporales de prueba
 * consumes: KeloGuardian + KeloSharedPvPAuthority + KeloSimulation
 * state-owned: una sala PvP efímera, binding node->actor, snapshots y diagnóstico
 * online: autoridad gameplay SOLO dentro de la sala temporal mientras la lease Master/epoch sigan válidos
 * do-not: NO economía, NO inventario, NO persistencia, NO recompensas, NO segundo loop, NO autoproclamarse Master
 */
(function(root){
'use strict';
if(root.KeloGuardianPvPHost||!root.KeloGuardian)return;
const VERSION='kelo-guardian-pvp-host-v1.1',SCHEMA=1,MAX_ROOMS=1,MAX_PLAYERS=16,MAX_MESSAGE_BYTES=48*1024,MAX_CATCHUP_STEPS=5,SNAPSHOT_MS=50;
let activeRoom=null,snapshotSeq=0,latest=null,lastSnapshotSeq=0,lastError=null,wasMaster=false,observedEpoch=0,accumulator=0,lastEmitKey='';
const rooms=new Map();
const stats={intentsAccepted:0,intentsRejected:0,snapshotsSent:0,snapshotsReceived:0,leaseResets:0,roomsCreated:0,maxCatchupHit:0};
function guardian(){try{return root.KeloGuardian.state();}catch(_){return{};}}
function epoch(){return Number(guardian().master?.epoch||guardian().network?.masterEpoch||0)||0;}
function short(v,max=96){return String(v==null?'':v).replace(/[\u0000-\u001f]/g,'').slice(0,max);}
function roomId(v){const s=short(v,64);return /^[A-Za-z0-9_.:-]{1,64}$/.test(s)?s:null;}
function bytes(v){try{return new TextEncoder().encode(JSON.stringify(v)).byteLength;}catch(_){try{return JSON.stringify(v).length;}catch(__){return Infinity;}}}
function actorIdForNode(nodeId){const clean=short(nodeId,80).replace(/[^A-Za-z0-9_-]/g,'_');return clean?'gp_'+clean.slice(-72):null;}
function actorId(){return actorIdForNode(guardian().nodeId);}
function visible(){return typeof document==='undefined'||document.visibilityState==='visible';}
function masterValid(messageEpoch){const g=guardian();return !!(g.enabled&&g.masterActive&&visible()&&epoch()&&Number(messageEpoch)===epoch());}
function sanitizeIntent(raw){
  const m=raw&&typeof raw==='object'?raw:{},action=short(m.action||'input',32),phase=short(m.phase||'none',24),sequence=Number(m.sequence);
  if(!Number.isSafeInteger(sequence)||sequence<0)return null;
  const moveX=Number(m.moveX)||0,moveY=Number(m.moveY)||0,aimX=Number(m.aimX)||0,aimY=Number(m.aimY)||0;
  if(Math.hypot(moveX,moveY)>1.001||Math.hypot(aimX,aimY)>1.0015)return null;
  return Object.freeze({sequence,moveX,moveY,aimX,aimY,action,phase,abilityKey:m.abilityKey==null?null:short(m.abilityKey,64),slot:Number.isInteger(Number(m.slot))?Number(m.slot):null,direction:m.direction&&typeof m.direction==='object'?{x:Number(m.direction.x)||0,y:Number(m.direction.y)||0}:null,position:m.position&&typeof m.position==='object'?{x:Number(m.position.x)||0,y:Number(m.position.y)||0}:null,targetId:m.targetId==null?null:short(m.targetId,80),attackId:m.attackId==null?null:short(m.attackId,96),swordEntityId:m.swordEntityId==null?null:short(m.swordEntityId,96),clientTime:Number(m.clientTime)||Date.now()});
}
function disposeRoom(row){if(!row)return;try{row.authority?.dispose?.();}catch(_){} }
function clearHosted(reason){if(rooms.size)stats.leaseResets++;for(const row of rooms.values())disposeRoom(row);rooms.clear();accumulator=0;snapshotSeq=0;if(reason&&reason!=='lease-lost')lastError=reason;}
function reconcileLease(){const g=guardian(),e=epoch(),active=!!g.masterActive;if(!active&&wasMaster)clearHosted('lease-lost');if(active&&(!wasMaster||e!==observedEpoch))clearHosted('new-lease');wasMaster=active;observedEpoch=e;}
function createRoom(id){
  if(!root.KeloSharedPvPAuthority?.createPvpAuthority){lastError='GUARDIAN_PVP_CORE_UNAVAILABLE';return null;}
  if(rooms.size>=MAX_ROOMS)return null;
  const row={id,epoch:epoch(),authority:root.KeloSharedPvPAuthority.createPvpAuthority(),playersByNode:new Map(),createdAt:Date.now(),updatedAt:Date.now(),lastSnapshotAt:0};
  rooms.set(id,row);stats.roomsCreated++;return row;
}
function roomFor(id,create){id=roomId(id);if(!id)return null;let row=rooms.get(id);if(!row&&create)row=createRoom(id);return row;}
function playerFor(row,nodeId,meta){
  const key=short(nodeId,96);let p=row.playersByNode.get(key);if(p)return p;if(row.playersByNode.size>=MAX_PLAYERS)return null;
  const id=actorIdForNode(key);if(!id)return null;p={id,name:short(meta?.name||'Guardian',24),x:0,y:0,radius:20,hp:100,maxHp:100,mana:100,maxMana:100,zone:'plaza',face:'down',gait:'idle'};row.playersByNode.set(key,p);return p;
}
function acceptIntent(fromNodeId,msg){
  if(!msg||msg.t!=='guardian:pvp_intent'||msg.schema!==SCHEMA||bytes(msg)>MAX_MESSAGE_BYTES||!masterValid(msg.epoch)){stats.intentsRejected++;return false;}
  const id=roomId(msg.roomId),intent=sanitizeIntent(msg.intent);if(!id||!intent){stats.intentsRejected++;return false;}
  const row=roomFor(id,true);if(!row||row.epoch!==epoch()){stats.intentsRejected++;return false;}
  const player=playerFor(row,fromNodeId,msg.actor);if(!player){stats.intentsRejected++;return false;}
  const result=row.authority.ingest(player,intent,Date.now());row.updatedAt=Date.now();
  if(!result?.ok){stats.intentsRejected++;root.KeloGuardian.broadcast({t:'guardian:pvp_reject',schema:SCHEMA,roomId:id,epoch:row.epoch,actorId:player.id,sequence:intent.sequence,ackSequence:result?.ackSequence||0,code:short(result?.reason||'REJECTED',64)});return false;}
  stats.intentsAccepted++;return true;
}
function publicSnapshot(row,now){
  const snap=row.authority.snapshot(now),events=row.authority.consumeEvents(),players={};
  Object.keys(snap.players||{}).slice(0,MAX_PLAYERS).forEach(id=>{players[id]=snap.players[id];});
  return {t:'guardian:pvp_snapshot',schema:SCHEMA,roomId:row.id,epoch:row.epoch,masterNodeId:short(guardian().nodeId,96),seq:++snapshotSeq,serverTick:snap.serverTick,serverTime:snap.serverTime,fixedDt:snap.fixedDt,maxRewindMs:snap.maxRewindMs,inputBufferMs:snap.inputBufferMs,movementProfileVersion:snap.movementProfileVersion,players,projectiles:Array.isArray(snap.projectiles)?snap.projectiles.slice(0,64):[],events:Array.isArray(events)?events.slice(-32):[],temporaryAuthority:true,persistentAuthority:false,economyAuthority:false,inventoryAuthority:false};
}
function broadcastSnapshot(row,now){
  if(now-row.lastSnapshotAt<SNAPSHOT_MS)return;row.lastSnapshotAt=now;const msg=publicSnapshot(row,now);
  if(bytes(msg)>MAX_MESSAGE_BYTES){msg.projectiles=[];msg.events=[];}
  if(bytes(msg)>MAX_MESSAGE_BYTES){lastError='GUARDIAN_PVP_SNAPSHOT_TOO_LARGE';return;}
  const sent=root.KeloGuardian.broadcast(msg);if(sent>0)stats.snapshotsSent++;
  if(activeRoom===row.id)acceptSnapshot(guardian().nodeId,msg,true);
}
function acceptSnapshot(fromNodeId,msg,localMaster){
  const g=guardian(),master=g.master||{};if(!msg||msg.t!=='guardian:pvp_snapshot'||msg.schema!==SCHEMA||bytes(msg)>MAX_MESSAGE_BYTES)return false;
  if(!localMaster){if(!master.nodeId||String(fromNodeId)!==String(master.nodeId)||Number(msg.epoch)!==Number(master.epoch))return false;}
  if(activeRoom&&String(msg.roomId)!==String(activeRoom))return false;
  const seq=Math.max(0,Math.floor(Number(msg.seq)||0));if(!seq||seq<=lastSnapshotSeq)return false;lastSnapshotSeq=seq;
  latest=Object.freeze({...msg,receivedAt:Date.now(),source:'guardian-temporary-authority'});stats.snapshotsReceived++;
  try{root.dispatchEvent(new CustomEvent('kelo:guardian-pvp-snapshot',{detail:{snapshot:latest,localActorId:actorId()}}));}catch(_){}
  emit(true);return true;
}
function onGuardianData(event){const d=event?.detail||{},msg=d.payload||{};if(msg.t==='guardian:pvp_intent')acceptIntent(d.fromNodeId,msg);else if(msg.t==='guardian:pvp_snapshot')acceptSnapshot(d.fromNodeId,msg,false);else if(msg.t==='guardian:pvp_reject'&&activeRoom===msg.roomId){try{root.dispatchEvent(new CustomEvent('kelo:guardian-pvp-reject',{detail:msg}));}catch(_){}}}
function submitIntent(raw){
  const id=roomId(activeRoom),g=guardian(),m=g.master||{},intent=sanitizeIntent(raw);if(!id||!intent||!g.enabled||!m.nodeId||!m.epoch)return false;
  const msg={t:'guardian:pvp_intent',schema:SCHEMA,roomId:id,epoch:Number(m.epoch),actor:{name:short(typeof root.localPlayer!=='undefined'&&root.localPlayer?.name||'Kelo',24)},intent,sentAt:Date.now()};
  if(bytes(msg)>MAX_MESSAGE_BYTES)return false;
  if(g.masterActive)return acceptIntent(g.nodeId,msg)?intent.sequence:false;
  return root.KeloGuardian.sendToMaster(msg)?intent.sequence:false;
}
function start(id){
  id=roomId(id||'pvp-lab');if(!id)throw new Error('GUARDIAN_PVP_ROOM_INVALID');const g=guardian();
  if(!g.enabled)throw new Error('GUARDIAN_PVP_GUARDIAN_OFF');if(!g.master?.nodeId||!g.master?.epoch)throw new Error('GUARDIAN_PVP_MASTER_REQUIRED');
  activeRoom=id;lastSnapshotSeq=0;latest=null;lastError=null;if(g.masterActive)roomFor(id,true);emit(true);return state();
}
function stop(){activeRoom=null;latest=null;lastSnapshotSeq=0;emit(true);return state();}
function isActive(){const g=guardian();return !!(activeRoom&&g.enabled&&g.master?.nodeId&&g.master?.epoch);}
function tick(context){
  reconcileLease();if(!wasMaster||!visible()||!rooms.size)return emit();
  const dt=Math.max(0,Math.min(.1,Number(context?.dt)||0));accumulator+=dt;let steps=0,now=Date.now();
  while(accumulator>=root.KeloSharedPvPAuthority.FIXED_DT&&steps<MAX_CATCHUP_STEPS){for(const row of rooms.values())if(row.epoch===observedEpoch)row.authority.step(root.KeloSharedPvPAuthority.FIXED_DT,now);accumulator-=root.KeloSharedPvPAuthority.FIXED_DT;steps++;}
  if(steps===MAX_CATCHUP_STEPS&&accumulator>=root.KeloSharedPvPAuthority.FIXED_DT){accumulator=0;stats.maxCatchupHit++;}
  now=Date.now();for(const row of rooms.values())if(row.epoch===observedEpoch)broadcastSnapshot(row,now);emit();
}
function state(){const g=guardian();return Object.freeze({version:VERSION,enabled:!!g.enabled,active:isActive(),roomId:activeRoom,actorId:actorId(),masterActive:!!g.masterActive,masterNodeId:g.master?.nodeId||null,masterEpoch:epoch(),hostedRooms:Object.freeze([...rooms.values()].map(r=>Object.freeze({id:r.id,epoch:r.epoch,players:r.playersByNode.size,tick:r.authority.snapshot(Date.now()).serverTick}))),latestSnapshot:latest?Object.freeze({roomId:latest.roomId,seq:latest.seq,serverTick:latest.serverTick,ageMs:Math.max(0,Date.now()-latest.receivedAt),players:Object.keys(latest.players||{}).length}):null,stats:Object.freeze({...stats}),temporaryGameplayAuthority:true,persistentAuthority:false,economyAuthority:false,inventoryAuthority:false,rewardsAuthority:false,lastError});}
function emit(force){const s=state(),key=[s.active,s.roomId,s.masterActive,s.masterEpoch,s.hostedRooms.length,s.latestSnapshot?.seq||0,s.stats.intentsAccepted,s.stats.intentsRejected,s.lastError||''].join('|');if(!force&&key===lastEmitKey)return s;lastEmitKey=key;try{root.dispatchEvent(new CustomEvent('kelo:guardian-pvp-state',{detail:s}));}catch(_){}return s;}
root.addEventListener('kelo:guardian-data',onGuardianData,{passive:true});
root.addEventListener('kelo:guardian-state',()=>{reconcileLease();emit(true);},{passive:true});
if(!root.KeloSimulation||typeof root.KeloSimulation.after!=='function')throw new Error('GUARDIAN_PVP_SIMULATION_OWNER_UNAVAILABLE');
root.KeloSimulation.after('guardian:pvp-host',tick,375);
root.KeloGuardianPvPHost=Object.freeze({version:VERSION,state,start,stop,isActive,actorId,submitIntent,latestSnapshot:()=>latest});
root.KELO_GUARDIAN_PVP_HOST_AUDIT=Object.freeze({version:VERSION,owner:'KeloGuardianPvPHost',sharedAuthorityCore:true,existingGuardianDataChannel:true,fixedStep:true,maxRooms:MAX_ROOMS,maxCatchupSteps:MAX_CATCHUP_STEPS,leaseFenced:true,epochFenced:true,temporaryGameplayAuthority:true,persistentAuthority:false,economyAuthority:false,inventoryAuthority:false,rewardsAuthority:false,secondLoop:false,localStorage:false});
reconcileLease();emit(true);
})(typeof globalThis!=='undefined'?globalThis:window);
