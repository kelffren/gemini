/* KELO-INDEX
 * area: WORKER / GUARDIAN PVP AUTHORITY
 * owner: GuardianPvPAuthorityWorker
 * keys: GUARDIAN PVP WORKER ISOLATION FIXED STEP STATUS EFFECTS AUTHORITY SNAPSHOT
 * purpose: ejecuta el core PvP compartido en un realm aislado para que status/effects del host no compartan estado con la presentación cliente
 * consumes: mensajes init/intent/step/dispose; no crea timers propios
 * state-owned: una autoridad PvP efímera y actores de una room Guardian
 * do-not: NO setInterval/setTimeout game loop, NO red, NO DOM, NO persistencia, NO economía/inventario/recompensas
 */
'use strict';
importScripts(
  '../core/events/event-bus.js?v=1',
  '../core/movement-profile.js?v=1',
  '../abilities/abilityData.js?v=20260916-pvp-first-use-1',
  '../systems/combat/combat-schema.js?v=2',
  '../systems/combat/hit-resolver.js?v=2',
  '../systems/combat/damage-resolver.js?v=3-player-vitals',
  '../systems/effects/effect-schema.js?v=2',
  '../systems/effects/status-engine.js?v=1',
  '../systems/effects/effect-engine.js?v=2',
  '../systems/combat/combat-engine.js?v=2',
  '../systems/melee/melee-schema.js?v=3',
  '../systems/melee/melee-weapon-profiles.js?v=3',
  '../systems/melee/melee-engine.js?v=3',
  '../systems/pvp/shared-pvp-authority.js?v=1'
);

const VERSION='guardian-pvp-authority-worker-v1';
const MAX_PLAYERS=16,MAX_EVENTS=32,MAX_PROJECTILES=64,SNAPSHOT_MS=50;
let roomId=null,epoch=0,authority=null,snapshotSeq=0,lastSnapshotAt=0,disposed=false;
const playersByNode=new Map();

function short(v,max=96){return String(v==null?'':v).replace(/[\u0000-\u001f]/g,'').slice(0,max);}
function actorIdForNode(nodeId){const clean=short(nodeId,80).replace(/[^A-Za-z0-9_-]/g,'_');return clean?'gp_'+clean.slice(-72):null;}
function post(type,payload,transfer){try{self.postMessage(Object.assign({t:type,workerVersion:VERSION},payload||{}),transfer||[]);}catch(error){try{self.postMessage({t:'error',workerVersion:VERSION,code:'WORKER_POST_FAILED',message:String(error?.message||error)});}catch(_){}}}
function ensurePlayer(nodeId,meta){
  const key=short(nodeId,96);let player=playersByNode.get(key);if(player)return player;if(playersByNode.size>=MAX_PLAYERS)return null;
  const id=actorIdForNode(key);if(!id)return null;
  player={id,name:short(meta?.name||'Guardian',24),x:0,y:0,radius:20,hp:100,maxHp:100,mana:100,maxMana:100,zone:'plaza',face:'down',gait:'idle'};
  playersByNode.set(key,player);return player;
}
function init(msg){
  if(authority)try{authority.dispose();}catch(_){}
  roomId=short(msg.roomId,64);epoch=Number(msg.epoch)||0;snapshotSeq=0;lastSnapshotAt=0;playersByNode.clear();disposed=false;
  authority=self.KeloSharedPvPAuthority.createPvpAuthority();
  post('ready',{roomId,epoch,fixedDt:self.KeloSharedPvPAuthority.FIXED_DT,snapshotHz:self.KeloSharedPvPAuthority.SNAPSHOT_HZ});
}
function ingest(msg){
  if(disposed||!authority||String(msg.roomId)!==roomId||Number(msg.epoch)!==epoch)return;
  const player=ensurePlayer(msg.nodeId,msg.actor);if(!player){post('reject',{roomId,epoch,nodeId:short(msg.nodeId,96),sequence:Number(msg.intent?.sequence)||0,ackSequence:0,code:'ROOM_PLAYER_LIMIT'});return;}
  const result=authority.ingest(player,msg.intent,Number(msg.now)||Date.now());
  if(!result?.ok)post('reject',{roomId,epoch,nodeId:short(msg.nodeId,96),actorId:player.id,sequence:Number(msg.intent?.sequence)||0,ackSequence:Number(result?.ackSequence)||0,code:short(result?.reason||'REJECTED',64)});
}
function snapshot(now){
  const snap=authority.snapshot(now),events=authority.consumeEvents(),players={};
  Object.keys(snap.players||{}).slice(0,MAX_PLAYERS).forEach(id=>{players[id]=snap.players[id];});
  post('snapshot',{roomId,epoch,seq:++snapshotSeq,serverTick:snap.serverTick,serverTime:snap.serverTime,fixedDt:snap.fixedDt,maxRewindMs:snap.maxRewindMs,inputBufferMs:snap.inputBufferMs,movementProfileVersion:snap.movementProfileVersion,players,projectiles:Array.isArray(snap.projectiles)?snap.projectiles.slice(0,MAX_PROJECTILES):[],events:Array.isArray(events)?events.slice(-MAX_EVENTS):[]});
}
function step(msg){
  if(disposed||!authority||String(msg.roomId)!==roomId||Number(msg.epoch)!==epoch)return;
  const steps=Math.max(0,Math.min(5,Math.floor(Number(msg.steps)||0))),dt=self.KeloSharedPvPAuthority.FIXED_DT,baseNow=Number(msg.now)||Date.now();
  for(let i=0;i<steps;i++)authority.step(dt,baseNow-(steps-1-i)*dt*1000);
  if(steps>0&&baseNow-lastSnapshotAt>=SNAPSHOT_MS){lastSnapshotAt=baseNow;snapshot(baseNow);}
}
function dispose(){disposed=true;try{authority?.dispose?.();}catch(_){}authority=null;playersByNode.clear();post('disposed',{roomId,epoch});roomId=null;epoch=0;}

self.onmessage=event=>{
  const msg=event?.data||{};
  try{
    if(msg.t==='init')init(msg);
    else if(msg.t==='intent')ingest(msg);
    else if(msg.t==='step')step(msg);
    else if(msg.t==='dispose')dispose();
  }catch(error){post('error',{roomId,epoch,code:'WORKER_RUNTIME_ERROR',message:String(error?.message||error),stack:String(error?.stack||'').slice(0,1500)});}
};
post('boot',{capabilities:{isolatedRealm:true,noOwnLoop:true,persistentAuthority:false,economyAuthority:false,inventoryAuthority:false,rewardsAuthority:false}});
