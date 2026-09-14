/* KELO-INDEX
 * area: GUARDIAN / PVP WORKER
 * owner: KeloGuardianSimulationHost worker runtime
 * keys: GUARDIAN PVP WORKER PORTABLE AUTHORITY INPUT SNAPSHOT EXPORT IMPORT FIXED STEP
 * purpose: ejecuta KeloPvpAuthorityCore fuera del hilo UI; el hilo principal entrega dt desde KeloSimulation
 * consumes: shared Combat/Effects/Melee UMD contracts + KeloPvpAuthorityCore
 * state-owned: una instancia efímera de autoridad PvP delegada
 * online: solo corre cuando el main thread tiene lease Guardian Master válida; no conoce Supabase/WebRTC directamente
 * do-not: NO setInterval, NO sockets, NO economía, NO persistencia durable, NO confiar HP enviado por cliente
 */
'use strict';
self.window=self;
importScripts(
  '../core/events/event-bus.js',
  '../systems/combat/combat-schema.js',
  '../systems/combat/hit-resolver.js',
  '../systems/combat/damage-resolver.js',
  '../systems/effects/effect-schema.js',
  '../systems/effects/status-engine.js',
  '../systems/effects/effect-engine.js',
  '../systems/combat/combat-engine.js',
  '../systems/melee/melee-schema.js',
  '../systems/melee/melee-weapon-profiles.js',
  '../systems/melee/melee-engine.js',
  '../abilities/abilityData.js',
  '../core/movement-profile.js',
  './pvp-authority-core.js'
);
const VERSION='guardian-pvp-worker-v1';
const deps=Object.freeze({
  abilityData:self.KELO_ABILITY_DATA,
  movementProfile:self.KeloMovementProfile,
  shared:Object.freeze({
    KeloMeleeProfiles:self.KeloMeleeProfiles,
    KeloMeleeEngine:self.KeloMeleeEngine,
    KeloStatusEffects:self.KeloStatusEffects,
    KeloCombatEngine:self.KeloCombatEngine,
    KeloHitResolver:self.KeloHitResolver,
    KeloEffectEngine:self.KeloEffectEngine,
    KeloEvents:self.KeloEvents,
    KeloCombatSchema:self.KeloCombatSchema
  })
});
let authority=null,accumulator=0,snapshotAccumulator=0,epoch=0,hostNodeId='',initialized=false;
const MAX_FRAME_DT=.25,MAX_STEPS_PER_TICK=12;
function safeId(value){return String(value==null?'':value).replace(/[^A-Za-z0-9:_-]/g,'').slice(0,96);}
function safeName(value){return String(value==null?'Kelo':value).replace(/[\u0000-\u001f]/g,'').slice(0,32)||'Kelo';}
function makeAuthority(){
  if(authority)authority.dispose();
  authority=self.KeloPvpAuthorityCore.createPvpAuthority(deps,{onKill:(killer,victim,context)=>{self.postMessage({t:'kill_observed',epoch,killerId:killer&&killer.id||null,victimId:victim&&victim.id||null,context:{source:context&&context.source||'guardian-pvp'}});}});
  accumulator=0;snapshotAccumulator=0;return authority;
}
function actorSeed(raw,id){const row=raw&&typeof raw==='object'?raw:{};return{id:safeId(id),name:safeName(row.name),x:Number(row.x)||0,y:Number(row.y)||0,vx:0,vy:0,radius:20,hp:100,maxHp:100,mana:100,maxMana:100,zone:String(row.zone||'plaza').slice(0,40),face:String(row.face||'down').slice(0,12),gait:'idle'};}
function emitSnapshot(now){if(!authority)return;const snapshot=authority.snapshot(now),events=authority.consumeEvents();self.postMessage({t:'snapshot',epoch,hostNodeId,snapshot:Object.assign({},snapshot,{events})});}
function initialize(msg){epoch=Math.max(0,Math.floor(Number(msg.epoch)||0));hostNodeId=safeId(msg.hostNodeId);makeAuthority();if(msg.state)authority.importState(msg.state,Date.now());initialized=true;self.postMessage({t:'ready',version:VERSION,epoch,hostNodeId,audit:authority.audit()});}
function tick(msg){if(!initialized||!authority||Number(msg.epoch)!==epoch)return;const dt=Math.max(0,Math.min(MAX_FRAME_DT,Number(msg.dt)||0)),now=Number(msg.now)||Date.now();accumulator+=dt;snapshotAccumulator+=dt;let steps=0;while(accumulator>=authority.fixedDt&&steps<MAX_STEPS_PER_TICK){authority.step(authority.fixedDt,now-Math.max(0,accumulator-authority.fixedDt)*1000);accumulator-=authority.fixedDt;steps++;}if(steps===MAX_STEPS_PER_TICK&&accumulator>authority.fixedDt*MAX_STEPS_PER_TICK)accumulator=authority.fixedDt*MAX_STEPS_PER_TICK;const cadence=1/authority.snapshotHz;if(snapshotAccumulator>=cadence){snapshotAccumulator%=cadence;emitSnapshot(now);}}
function input(msg){if(!initialized||!authority||Number(msg.epoch)!==epoch)return;const actorId=safeId(msg.actorId);if(!actorId)return;const seed=actorSeed(msg.actor,actorId),player=authority.getPlayer(actorId)||authority.register(seed),result=authority.ingest(player,msg.intent,Number(msg.now)||Date.now());if(!result.ok)self.postMessage({t:'reject',epoch,actorId,sequence:msg.intent&&msg.intent.sequence||null,reason:result.reason||'REJECTED',ackSequence:result.ackSequence||0});}
function remove(msg){if(!initialized||!authority||Number(msg.epoch)!==epoch)return;authority.unregister(safeId(msg.actorId));}
function exportState(requestId){if(!initialized||!authority)return;self.postMessage({t:'state_export',requestId:String(requestId||''),epoch,state:authority.exportState(Date.now())});}
self.onmessage=function(event){const msg=event&&event.data||{};try{if(msg.t==='init')initialize(msg);else if(msg.t==='tick')tick(msg);else if(msg.t==='input')input(msg);else if(msg.t==='remove')remove(msg);else if(msg.t==='export_state')exportState(msg.requestId);else if(msg.t==='import_state'&&authority&&Number(msg.epoch)===epoch){authority.importState(msg.state,Date.now());self.postMessage({t:'state_imported',epoch,audit:authority.audit()});}else if(msg.t==='snapshot_now')emitSnapshot(Date.now());else if(msg.t==='dispose'){if(authority)authority.dispose();authority=null;initialized=false;self.postMessage({t:'disposed',epoch});self.close();}}catch(error){self.postMessage({t:'worker_error',epoch,code:String(error&&error.message||error),stack:String(error&&error.stack||'').slice(0,4000)});}};
self.postMessage({t:'boot',version:VERSION,portableCore:self.KeloPvpAuthorityCore&&self.KeloPvpAuthorityCore.version||null});
