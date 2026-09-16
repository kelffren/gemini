/* KELO-INDEX
 * area: WORKER / GUARDIAN PVP AUTHORITY
 * owner: GuardianPvPAuthorityWorker
 * keys: GUARDIAN PVP WORKER ISOLATION FIXED STEP STATUS EFFECTS AUTHORITY SNAPSHOT TAKEOVER PRUNE
 * purpose: ejecuta el core PvP compartido en un realm aislado y elimina actores restaurados que no reclaman su sesión tras un takeover
 * consumes: mensajes init/intent/step/dispose; no crea timers propios
 * state-owned: una autoridad PvP efímera, actores de una room Guardian y ventana de reclamación post-takeover
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

const VERSION='guardian-pvp-authority-worker-v3-takeover-prune';
const MAX_PLAYERS=16,MAX_EVENTS=32,MAX_PROJECTILES=64,SNAPSHOT_MS=50,TAKEOVER_COMBO_GRACE_MS=250,RESTORED_ACTOR_RECLAIM_MS=5000;
let roomId=null,epoch=0,authority=null,snapshotSeq=0,lastSnapshotAt=0,disposed=false,tickOffset=0,takeoverFromEpoch=0,takeoverSnapshotSeq=0,staleRestoredPlayersPruned=0;
const playersByNode=new Map(),pendingRestoredActors=new Map();

function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function short(v,max=96){return String(v==null?'':v).replace(/[\u0000-\u001f]/g,'').slice(0,max);}
function actorIdForNode(nodeId){const clean=short(nodeId,80).replace(/[^A-Za-z0-9_-]/g,'_');return clean?'gp_'+clean.slice(-72):null;}
function post(type,payload,transfer){try{self.postMessage(Object.assign({t:type,workerVersion:VERSION},payload||{}),transfer||[]);}catch(error){try{self.postMessage({t:'error',workerVersion:VERSION,code:'WORKER_POST_FAILED',message:String(error?.message||error)});}catch(_){}}}
function safeCooldowns(raw){const out=Object.create(null);if(!raw||typeof raw!=='object')return out;for(const key of Object.keys(raw).slice(0,32)){const clean=short(key,64);if(clean)out[clean]=clamp(finite(raw[key]),0,120);}return out;}
function restoreResource(target,raw){if(!target||!raw||typeof raw!=='object')return;target.max=Math.max(1,Math.floor(finite(raw.max,target.max||1)));target.current=clamp(finite(raw.current,target.current),0,target.max);target.rechargeElapsed=Math.max(0,finite(raw.rechargeElapsed,target.rechargeElapsed));}
function restoreStatuses(player,rows){
  try{self.KeloStatusEffects.clear(player,'guardian-worker-takeover');}catch(_){}
  if(!Array.isArray(rows))return;
  for(const s of rows.slice(0,16)){
    const type=short(s?.type,32),remaining=clamp(finite(s?.remaining),0,30);if(!type||!remaining||type==='invulnerable')continue;
    try{self.KeloStatusEffects.apply(player,{id:short(s.id,96)||undefined,status:type,sourceId:short(s.sourceId,80),duration:remaining,stacks:clamp(Math.floor(finite(s.stacks,1)),1,16),magnitude:finite(s.magnitude),refreshPolicy:short(s.refreshPolicy||'refresh',16),dispellable:s.dispellable!==false,gameplayTags:Array.isArray(s.tags)?s.tags.slice(0,12).map(v=>short(v,32)):[],visualProfileId:s.visualProfileId==null?null:short(s.visualProfileId,96)},{source:null,target:player});}catch(_){}
  }
}
function restorePlayer(raw,now){
  if(!raw||typeof raw!=='object')return null;const id=short(raw.id,80);if(!/^[A-Za-z0-9:_-]{1,80}$/.test(id))return null;
  const arena=self.KeloSharedPvPAuthority.ARENA||{x:2660,y:360,w:720,h:720,spawnX:2790,spawnY:720};
  const player=authority.register({id,name:short(raw.name||'Guardian',24),x:finite(raw.x),y:finite(raw.y),radius:20,hp:100,maxHp:100,mana:100,maxMana:100,zone:'pvp',face:'down',gait:'idle'});
  player.name=short(raw.name||player.name||'Guardian',24);player.x=clamp(finite(raw.x,arena.spawnX||arena.x),arena.x+20,arena.x+arena.w-20);player.y=clamp(finite(raw.y,arena.spawnY||arena.y),arena.y+20,arena.y+arena.h-20);
  player.maxHp=clamp(finite(raw.maxHp,100),1,100);player.hp=clamp(finite(raw.hp,player.maxHp),0,player.maxHp);player.maxMana=clamp(finite(raw.maxMana,100),1,100);player.mana=clamp(finite(raw.mana,player.maxMana),0,player.maxMana);player.zone=raw.zone==='pvp'?'pvp':'plaza';player.face=short(raw.face||'down',12);player.gait=short(raw.gait||'idle',16);
  const ack=Math.max(0,Math.floor(finite(raw.ackSequence)));player._pvpAck=ack;player._pvpLastSequence=ack;player._pvpInput={moveX:0,moveY:0,aimX:1,aimY:0,clientTime:now};player._pvpCooldowns=safeCooldowns(raw.cooldowns);player._pvpAttack=null;player._pvpCast=null;player._pvpDash=null;player._pvpHistory=[];player._pvpActive=player.zone==='pvp';player._pvpBufferedBasic=null;player._pvpSpecialHold=null;player._pvpComboStep=clamp(Math.floor(finite(raw.comboStep)),0,8);player._pvpComboExpiresAt=player._pvpComboStep?now+TAKEOVER_COMBO_GRACE_MS:0;player._pvpDodgeCooldown=clamp(finite(raw.dodgeCooldown),0,10);player._pvpDeadHandled=player.hp<=0;
  restoreResource(player._pvpBasicResource,raw.basicResource);restoreResource(player._pvpSpecialResource,raw.specialResource);restoreStatuses(player,raw.statuses);return player;
}
function restoreSeed(seed,now){
  if(!seed||typeof seed!=='object'||String(seed.roomId)!==roomId||Number(seed.epoch)<=0||Number(seed.epoch)===epoch)return{restored:0,projectilesReset:0};
  tickOffset=Math.max(0,Math.floor(finite(seed.serverTick)));takeoverFromEpoch=Number(seed.epoch)||0;takeoverSnapshotSeq=Math.max(0,Math.floor(finite(seed.seq)));
  let restored=0;for(const p of Object.values(seed.players||{}).slice(0,MAX_PLAYERS)){const player=restorePlayer(p,now);if(!player)continue;pendingRestoredActors.set(String(player.id),now+RESTORED_ACTOR_RECLAIM_MS);restored++;}
  return{restored,projectilesReset:Array.isArray(seed.projectiles)?seed.projectiles.length:0};
}
function ensurePlayer(nodeId,meta){
  const key=short(nodeId,96);let player=playersByNode.get(key);if(player){pendingRestoredActors.delete(String(player.id));return player;}if(playersByNode.size>=MAX_PLAYERS)return null;
  const id=actorIdForNode(key);if(!id)return null;player=authority?.getPlayer?.(id)||null;
  if(!player)player={id,name:short(meta?.name||'Guardian',24),x:0,y:0,radius:20,hp:100,maxHp:100,mana:100,maxMana:100,zone:'plaza',face:'down',gait:'idle'};else if(meta?.name)player.name=short(meta.name,24);
  pendingRestoredActors.delete(String(id));playersByNode.set(key,player);return player;
}
function pruneUnclaimedRestored(now){
  if(!authority||!pendingRestoredActors.size)return 0;let pruned=0;const actorIds=[];
  for(const [actorId,deadline] of Array.from(pendingRestoredActors.entries())){
    if(now<deadline)continue;pendingRestoredActors.delete(actorId);try{authority.unregister(actorId);}catch(_){}pruned++;actorIds.push(actorId);
  }
  if(pruned){staleRestoredPlayersPruned+=pruned;post('pruned',{roomId,epoch,count:pruned,total:staleRestoredPlayersPruned,actorIds:actorIds.slice(0,MAX_PLAYERS),reclaimMs:RESTORED_ACTOR_RECLAIM_MS});}
  return pruned;
}
function init(msg){
  if(authority)try{authority.dispose();}catch(_){}
  roomId=short(msg.roomId,64);epoch=Number(msg.epoch)||0;snapshotSeq=0;lastSnapshotAt=0;tickOffset=0;takeoverFromEpoch=0;takeoverSnapshotSeq=0;staleRestoredPlayersPruned=0;playersByNode.clear();pendingRestoredActors.clear();disposed=false;
  authority=self.KeloSharedPvPAuthority.createPvpAuthority();const now=Number(msg.now)||Date.now(),takeover=restoreSeed(msg.seed,now);
  post('ready',{roomId,epoch,fixedDt:self.KeloSharedPvPAuthority.FIXED_DT,snapshotHz:self.KeloSharedPvPAuthority.SNAPSHOT_HZ,takeoverRestored:takeover.restored>0,playersRestored:takeover.restored,projectilesReset:takeover.projectilesReset,takeoverFromEpoch,takeoverSnapshotSeq,tickOffset,restoredActorReclaimMs:RESTORED_ACTOR_RECLAIM_MS});
}
function ingest(msg){
  if(disposed||!authority||String(msg.roomId)!==roomId||Number(msg.epoch)!==epoch)return;
  const player=ensurePlayer(msg.nodeId,msg.actor);if(!player){post('reject',{roomId,epoch,nodeId:short(msg.nodeId,96),sequence:Number(msg.intent?.sequence)||0,ackSequence:0,code:'ROOM_PLAYER_LIMIT'});return;}
  const result=authority.ingest(player,msg.intent,Number(msg.now)||Date.now());
  if(!result?.ok)post('reject',{roomId,epoch,nodeId:short(msg.nodeId,96),actorId:player.id,sequence:Number(msg.intent?.sequence)||0,ackSequence:Number(result?.ackSequence)||0,code:short(result?.reason||'REJECTED',64)});
}
function snapshot(now){
  const snap=authority.snapshot(now),rawEvents=authority.consumeEvents(),players={};
  Object.keys(snap.players||{}).slice(0,MAX_PLAYERS).forEach(id=>{players[id]=snap.players[id];});
  const events=Array.isArray(rawEvents)?rawEvents.slice(-MAX_EVENTS).map(ev=>Object.assign({},ev,{id:'ge'+epoch+':'+String(ev.id||''),serverTick:tickOffset+Math.max(0,Number(ev.serverTick)||0)})):[];
  post('snapshot',{roomId,epoch,seq:++snapshotSeq,serverTick:tickOffset+Math.max(0,Number(snap.serverTick)||0),serverTime:snap.serverTime,fixedDt:snap.fixedDt,maxRewindMs:snap.maxRewindMs,inputBufferMs:snap.inputBufferMs,movementProfileVersion:snap.movementProfileVersion,players,projectiles:Array.isArray(snap.projectiles)?snap.projectiles.slice(0,MAX_PROJECTILES):[],events,takeoverFromEpoch,takeoverSnapshotSeq,staleRestoredPlayersPruned});
}
function step(msg){
  if(disposed||!authority||String(msg.roomId)!==roomId||Number(msg.epoch)!==epoch)return;
  const steps=Math.max(0,Math.min(5,Math.floor(Number(msg.steps)||0))),dt=self.KeloSharedPvPAuthority.FIXED_DT,baseNow=Number(msg.now)||Date.now();
  for(let i=0;i<steps;i++)authority.step(dt,baseNow-(steps-1-i)*dt*1000);pruneUnclaimedRestored(baseNow);
  if(steps>0&&baseNow-lastSnapshotAt>=SNAPSHOT_MS){lastSnapshotAt=baseNow;snapshot(baseNow);}
}
function dispose(){disposed=true;try{authority?.dispose?.();}catch(_){}authority=null;playersByNode.clear();pendingRestoredActors.clear();post('disposed',{roomId,epoch});roomId=null;epoch=0;tickOffset=0;takeoverFromEpoch=0;takeoverSnapshotSeq=0;staleRestoredPlayersPruned=0;}

self.onmessage=event=>{
  const msg=event?.data||{};
  try{
    if(msg.t==='init')init(msg);
    else if(msg.t==='intent')ingest(msg);
    else if(msg.t==='step')step(msg);
    else if(msg.t==='dispose')dispose();
  }catch(error){post('error',{roomId,epoch,code:'WORKER_RUNTIME_ERROR',message:String(error?.message||error),stack:String(error?.stack||'').slice(0,1500)});}
};
post('boot',{capabilities:{isolatedRealm:true,noOwnLoop:true,takeoverRestore:true,restoredActorPrune:true,restoredActorReclaimMs:RESTORED_ACTOR_RECLAIM_MS,transientActionsReset:true,projectilesReset:true,persistentAuthority:false,economyAuthority:false,inventoryAuthority:false,rewardsAuthority:false}});
