/* KELO-INDEX
 * area: GUARDIAN / ROOM HOST
 * owner: KeloGuardianRoomHost
 * keys: GUARDIAN ROOM HOST LEASE EPOCH INPUT LOG SNAPSHOT MIGRATION SANDBOX
 * purpose: ejecuta una sala efímera de prueba sobre el DataChannel Guardian mientras este nodo conserva la lease Master
 * consumes: KeloGuardian + KeloSimulation
 * state-owned: salas efímeras, input log acotado, snapshots de sala y diagnóstico local
 * online: cercado por master epoch; NO escribe gameplay persistente, economía, inventario ni resultados PvP
 * do-not: NO segundo loop; NO localStorage; NO tokens; NO autoridad económica; NO restaurar HP/inventario; NO aceptar snapshot/input stale
 */
(function(root){
'use strict';
if(root.KeloGuardianRoomHost||!root.KeloGuardian)return;
const VERSION='kelo-guardian-room-host-v1';
const SCHEMA=1,FIXED_DT=1/60,SNAPSHOT_MS=120,MAX_MESSAGE_BYTES=24*1024,MAX_ROOMS=4,MAX_ACTORS=32,MAX_INPUT_LOG=192,MAX_ROOM_ID=48,MAX_ACTOR_ID=80,MAX_ABILITY_KEY=64,MAX_INPUTS_PER_SECOND=90,SNAPSHOT_FRESH_MS=10000;
const ALLOWED_KINDS=new Set(['move','ability','probe','stop']);
let observedEpoch=0,wasMaster=false,clientRoom='guardian-lab',clientSeq=0,latestSnapshot=null,lastError=null,lastEmitKey='';
const rooms=new Map(),snapshotSeq=new Map(),lastSnapshotSeq=new Map(),rateByPeer=new Map();
const stats={acceptedInputs:0,rejectedInputs:0,staleInputs:0,rateLimited:0,snapshotsSent:0,snapshotsReceived:0,leaseResets:0,migrations:0};
function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function short(v,max){return String(v==null?'':v).replace(/[\u0000-\u001f]/g,'').slice(0,max);}
function bytes(value){try{return new TextEncoder().encode(JSON.stringify(value)).byteLength;}catch(_){try{return JSON.stringify(value).length;}catch(__){return Infinity;}}}
function guardian(){try{return root.KeloGuardian.state()||{};}catch(_){return{};}}
function epoch(){return Math.max(0,Math.floor(finite(guardian().master?.epoch)));}
function visible(){return typeof document==='undefined'||document.visibilityState==='visible';}
function validRoomId(value){const id=short(value||'guardian-lab',MAX_ROOM_ID);return /^[A-Za-z0-9:_-]{1,48}$/.test(id)?id:null;}
function actorId(value,fallback){const id=short(value||fallback||'',MAX_ACTOR_ID);return /^[A-Za-z0-9:_-]{1,80}$/.test(id)?id:null;}
function safeInput(raw,fallbackActor){
  if(!raw||typeof raw!=='object')return null;
  const kind=short(raw.kind,16);if(!ALLOWED_KINDS.has(kind))return null;
  const actor=actorId(raw.actorId,fallbackActor);if(!actor)return null;
  if(kind==='move')return Object.freeze({kind,actorId:actor,moveX:clamp(finite(raw.moveX),-1,1),moveY:clamp(finite(raw.moveY),-1,1),aimX:clamp(finite(raw.aimX,1),-1,1),aimY:clamp(finite(raw.aimY),-1,1)});
  if(kind==='ability')return Object.freeze({kind,actorId:actor,abilityKey:short(raw.abilityKey,MAX_ABILITY_KEY),phase:short(raw.phase||'pressed',16),aimX:clamp(finite(raw.aimX,1),-1,1),aimY:clamp(finite(raw.aimY),-1,1)});
  if(kind==='probe')return Object.freeze({kind,actorId:actor,nonce:short(raw.nonce,48)});
  return Object.freeze({kind:'stop',actorId:actor});
}
function masterLeaseValid(messageEpoch){const g=guardian(),e=epoch(),expires=finite(g.master?.expiresAt||g.masterLeaseExpiresAt,0);return !!(g.masterActive&&e>0&&Number(messageEpoch)===e&&(!expires||Date.now()<expires));}
function peerRateAllowed(peerId,now){const key=String(peerId||''),row=rateByPeer.get(key)||{windowAt:now,count:0};if(now-row.windowAt>=1000){row.windowAt=now;row.count=0;}row.count++;rateByPeer.set(key,row);if(row.count>MAX_INPUTS_PER_SECOND){stats.rateLimited++;return false;}return true;}
function roomFor(roomIdValue,create){const id=validRoomId(roomIdValue);if(!id)return null;let room=rooms.get(id);if(!room&&create){if(rooms.size>=MAX_ROOMS)return null;room={id,epoch:epoch(),tick:0,createdAt:Date.now(),updatedAt:Date.now(),lastSnapshotAt:0,actors:new Map(),inputLog:[],lastClientSeq:new Map(),events:[]};rooms.set(id,room);}return room;}
function ensureActor(room,id){let actor=room.actors.get(id);if(actor)return actor;if(room.actors.size>=MAX_ACTORS)return null;actor={id,x:0,y:0,moveX:0,moveY:0,aimX:1,aimY:0,lastInputSeq:0,lastAbility:null};room.actors.set(id,actor);return actor;}
function appendLog(room,row){room.inputLog.push(Object.freeze(row));while(room.inputLog.length>MAX_INPUT_LOG)room.inputLog.shift();}
function applyInput(room,fromNodeId,input,clientSequence,receivedAt){const actor=ensureActor(room,input.actorId);if(!actor)return false;actor.lastInputSeq=clientSequence;if(input.kind==='move'){actor.moveX=input.moveX;actor.moveY=input.moveY;actor.aimX=input.aimX;actor.aimY=input.aimY;}else if(input.kind==='stop'){actor.moveX=0;actor.moveY=0;}else if(input.kind==='ability'){actor.lastAbility={abilityKey:input.abilityKey,phase:input.phase,aimX:input.aimX,aimY:input.aimY,tick:room.tick};room.events.push({type:'ability-probe',actorId:actor.id,abilityKey:input.abilityKey,phase:input.phase,tick:room.tick});while(room.events.length>32)room.events.shift();}else if(input.kind==='probe'){room.events.push({type:'probe',actorId:actor.id,nonce:input.nonce,tick:room.tick});while(room.events.length>32)room.events.shift();}
  room.updatedAt=receivedAt;appendLog(room,{fromNodeId:String(fromNodeId||''),clientSeq:clientSequence,receivedAt,input});return true;}
function acceptInput(fromNodeId,msg){const now=Date.now();if(!msg||msg.t!=='guardian:room_input'||msg.schema!==SCHEMA||bytes(msg)>MAX_MESSAGE_BYTES||!masterLeaseValid(msg.epoch)){stats.rejectedInputs++;return false;}if(!peerRateAllowed(fromNodeId,now)){stats.rejectedInputs++;return false;}const id=validRoomId(msg.roomId),seq=Math.max(0,Math.floor(finite(msg.clientSeq)));if(!id||!seq){stats.rejectedInputs++;return false;}const room=roomFor(id,true);if(!room||room.epoch!==epoch()){stats.rejectedInputs++;return false;}const peerKey=String(fromNodeId||'')+':'+id,last=room.lastClientSeq.get(peerKey)||0;if(seq<=last){stats.staleInputs++;return false;}const input=safeInput(msg.input,fromNodeId);if(!input){stats.rejectedInputs++;return false;}room.lastClientSeq.set(peerKey,seq);if(!applyInput(room,fromNodeId,input,seq,now)){stats.rejectedInputs++;return false;}stats.acceptedInputs++;return true;}
function actorPublic(a){return Object.freeze({id:a.id,x:Number(a.x.toFixed(3)),y:Number(a.y.toFixed(3)),moveX:a.moveX,moveY:a.moveY,aimX:a.aimX,aimY:a.aimY,lastInputSeq:a.lastInputSeq,lastAbility:a.lastAbility?Object.freeze({...a.lastAbility}):null});}
function roomSnapshot(room,now){const seq=(snapshotSeq.get(room.id)||0)+1;snapshotSeq.set(room.id,seq);const g=guardian();return Object.freeze({t:'guardian:room_snapshot',schema:SCHEMA,roomId:room.id,epoch:room.epoch,masterNodeId:short(g.nodeId,96),seq,tick:room.tick,generatedAt:now,fixedDt:FIXED_DT,actors:Object.freeze([...room.actors.values()].slice(0,MAX_ACTORS).map(actorPublic)),events:Object.freeze(room.events.slice(-16).map(e=>Object.freeze({...e}))),authoritativeGameplay:false,persistentAuthority:false});}
function broadcastSnapshot(room,now){if(now-room.lastSnapshotAt<SNAPSHOT_MS)return false;room.lastSnapshotAt=now;const snapshot=roomSnapshot(room,now);if(bytes(snapshot)>MAX_MESSAGE_BYTES){lastError='GUARDIAN_ROOM_SNAPSHOT_TOO_LARGE';return false;}const sent=root.KeloGuardian.broadcast(snapshot);if(sent>0)stats.snapshotsSent++;return sent>0;}
function acceptSnapshot(fromNodeId,msg){const g=guardian(),master=g.master||{};if(!msg||msg.t!=='guardian:room_snapshot'||msg.schema!==SCHEMA||bytes(msg)>MAX_MESSAGE_BYTES||!master?.nodeId)return false;if(String(fromNodeId)!==String(master.nodeId)||Number(msg.epoch)!==Number(master.epoch))return false;const id=validRoomId(msg.roomId),seq=Math.max(0,Math.floor(finite(msg.seq)));if(!id||!seq)return false;const key=id+':'+String(msg.epoch),last=lastSnapshotSeq.get(key)||0;if(seq<=last)return false;const actors=Array.isArray(msg.actors)?msg.actors.slice(0,MAX_ACTORS).map(a=>Object.freeze({id:actorId(a?.id,'')||'',x:finite(a?.x),y:finite(a?.y),moveX:clamp(finite(a?.moveX),-1,1),moveY:clamp(finite(a?.moveY),-1,1),aimX:clamp(finite(a?.aimX,1),-1,1),aimY:clamp(finite(a?.aimY),-1,1),lastInputSeq:Math.max(0,Math.floor(finite(a?.lastInputSeq)))})).filter(a=>a.id):[];
  lastSnapshotSeq.set(key,seq);latestSnapshot=Object.freeze({roomId:id,epoch:Number(msg.epoch)||0,masterNodeId:String(fromNodeId),seq,tick:Math.max(0,Math.floor(finite(msg.tick))),generatedAt:finite(msg.generatedAt,Date.now()),receivedAt:Date.now(),actors:Object.freeze(actors),authoritativeGameplay:false,persistentAuthority:false});stats.snapshotsReceived++;emit(true);return true;}
function onGuardianData(event){const d=event?.detail||{},msg=d.payload||{};if(msg.t==='guardian:room_input')acceptInput(d.fromNodeId,msg);else if(msg.t==='guardian:room_snapshot')acceptSnapshot(d.fromNodeId,msg);}
function clearHosted(reason){if(rooms.size)stats.leaseResets++;rooms.clear();snapshotSeq.clear();rateByPeer.clear();if(reason)lastError=reason==='lease-lost'?null:lastError;}
function reconcileLease(){const g=guardian(),e=epoch(),active=!!g.masterActive;if(!active&&wasMaster)clearHosted('lease-lost');if(active&&(!wasMaster||e!==observedEpoch))clearHosted('new-lease');wasMaster=active;observedEpoch=e;}
function integrate(room){room.tick++;const speed=180;for(const actor of room.actors.values()){const len=Math.hypot(actor.moveX,actor.moveY)||1,nx=Math.abs(actor.moveX)>1||Math.abs(actor.moveY)>1?actor.moveX/len:actor.moveX,ny=Math.abs(actor.moveX)>1||Math.abs(actor.moveY)>1?actor.moveY/len:actor.moveY;actor.x=clamp(actor.x+nx*speed*FIXED_DT,-10000,10000);actor.y=clamp(actor.y+ny*speed*FIXED_DT,-10000,10000);} }
function tick(){reconcileLease();if(!wasMaster||!visible())return emit();const now=Date.now();for(const room of rooms.values()){if(room.epoch!==observedEpoch)continue;integrate(room);broadcastSnapshot(room,now);}emit();}
function submitInput(input,roomIdValue){const g=guardian(),m=g.master||{},id=validRoomId(roomIdValue||clientRoom);if(!id||!m.nodeId||!m.epoch)return false;const safe=safeInput(input,g.nodeId);if(!safe)return false;clientRoom=id;const msg={t:'guardian:room_input',schema:SCHEMA,roomId:id,epoch:Number(m.epoch)||0,clientSeq:++clientSeq,input:safe,sentAt:Date.now()};if(bytes(msg)>MAX_MESSAGE_BYTES)return false;if(g.masterActive)return acceptInput(g.nodeId,msg);return root.KeloGuardian.sendToMaster(msg);}
function startLab(roomIdValue){const id=validRoomId(roomIdValue||'guardian-lab');if(!id)throw new Error('GUARDIAN_ROOM_ID_INVALID');clientRoom=id;if(guardian().masterActive)roomFor(id,true);emit(true);return state();}
function resetHostedRoom(roomIdValue){if(!guardian().masterActive)throw new Error('GUARDIAN_ROOM_MASTER_REQUIRED');const id=validRoomId(roomIdValue||clientRoom);if(!id)return false;const existed=rooms.delete(id);snapshotSeq.delete(id);emit(true);return existed;}
function adoptLatest(){const g=guardian(),snap=latestSnapshot;if(!g.masterActive||!snap||Date.now()-snap.receivedAt>SNAPSHOT_FRESH_MS)return false;const room=roomFor(snap.roomId,true);if(!room)return false;room.actors.clear();for(const a of snap.actors.slice(0,MAX_ACTORS)){room.actors.set(a.id,{id:a.id,x:a.x,y:a.y,moveX:a.moveX,moveY:a.moveY,aimX:a.aimX,aimY:a.aimY,lastInputSeq:a.lastInputSeq,lastAbility:null});}room.tick=snap.tick;room.epoch=epoch();room.updatedAt=Date.now();stats.migrations++;emit(true);return true;}
function state(){const g=guardian(),now=Date.now(),snap=latestSnapshot,hosted=[...rooms.values()].map(r=>Object.freeze({id:r.id,epoch:r.epoch,tick:r.tick,actors:r.actors.size,inputLog:r.inputLog.length,updatedAt:r.updatedAt}));return Object.freeze({version:VERSION,enabled:!!g.enabled,masterActive:!!g.masterActive,masterEpoch:epoch(),clientRoom,hostedRooms:Object.freeze(hosted),latestSnapshot:snap?Object.freeze({roomId:snap.roomId,epoch:snap.epoch,seq:snap.seq,tick:snap.tick,ageMs:Math.max(0,now-snap.receivedAt),actors:snap.actors.length}):null,stats:Object.freeze({...stats}),authoritativeGameplay:false,persistentAuthority:false,economyAuthority:false,inventoryAuthority:false,lastError});}
function emit(force){const s=state(),key=[s.masterActive,s.masterEpoch,s.hostedRooms.length,s.latestSnapshot?.seq||0,s.stats.acceptedInputs,s.stats.rejectedInputs,s.lastError||''].join('|');if(!force&&key===lastEmitKey)return s;lastEmitKey=key;try{root.dispatchEvent(new CustomEvent('kelo:guardian-room-state',{detail:s}));}catch(_){}return s;}
root.addEventListener('kelo:guardian-data',onGuardianData,{passive:true});root.addEventListener('kelo:guardian-state',()=>{reconcileLease();emit(true);},{passive:true});
if(root.KeloSimulation&&typeof root.KeloSimulation.after==='function')root.KeloSimulation.after('guardian:room-host',tick,370);
root.KeloGuardianRoomHost=Object.freeze({version:VERSION,state,startLab,submitInput,resetHostedRoom,adoptLatest,latestSnapshot:()=>latestSnapshot});
root.KELO_GUARDIAN_ROOM_HOST_AUDIT=Object.freeze({version:VERSION,owner:'KeloGuardianRoomHost',transport:'existing-kelo-guardian-datachannel',leaseFenced:true,epochFenced:true,inputSequenceFenced:true,snapshotSequenceFenced:true,boundedInputLog:true,secondLoop:false,localStorage:false,authoritativeGameplay:false,persistentAuthority:false,economyAuthority:false,inventoryAuthority:false});
reconcileLease();emit(true);
})(typeof globalThis!=='undefined'?globalThis:window);
