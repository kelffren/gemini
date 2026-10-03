/* KELO-INDEX
 * area: PVE / COMBAT ADAPTER
 * owner: Kelo PvE
 * purpose: expose PvE actors to canonical KeloCombatEngine/KeloDamageResolver and translate combat kills into PvE death finalization
 * do-not: no duplicate hit geometry, damage resolver, renderer, loop or inventory authority
 */
const F=Object.freeze;
export function createCombatTarget(actorRuntime){
  if(!actorRuntime)throw new Error('PVE_ACTOR_REQUIRED');
  const view={};
  Object.defineProperties(view,{
    id:{get:()=>actorRuntime.snapshot.id},x:{get:()=>actorRuntime.snapshot.x},y:{get:()=>actorRuntime.snapshot.y},
    hp:{get:()=>actorRuntime.snapshot.hp,set:v=>actorRuntime.setHp(v,{source:'KeloDamageResolver'})},
    radius:{get:()=>Number(actorRuntime.snapshot.radius)||18}
  });
  return view;
}
export function bindPveCombat({encounter,combatEngine=globalThis.KeloCombatEngine,eventBus=globalThis.KeloEvents,combatEvents=globalThis.KeloCombatSchema?.events,seed='world'}={}){
  if(!encounter)throw new Error('PVE_ENCOUNTER_REQUIRED');
  const targets=new Map();
  for(const row of encounter.snapshot()){const runtime=encounter.actor(row.id);if(runtime)targets.set(row.id,createCombatTarget(runtime))}
  let stop=()=>{};
  if(eventBus?.on&&combatEvents?.ENTITY_KILLED){
    stop=eventBus.on(combatEvents.ENTITY_KILLED,payload=>{const id=String(payload?.targetActorId||'');if(targets.has(id))encounter.finalizeDeath(id,{sourceId:payload?.actorId||null,seed:seed+':combat'})});
  }
  return F({
    targets:F([...targets.values()]),
    target(id){return targets.get(String(id))||null},
    melee({attacker,targetId,profile,direction}={}){if(!combatEngine?.attack)throw new Error('PVE_COMBAT_ENGINE_UNAVAILABLE');const target=targets.get(String(targetId));if(!target)return F({ok:false,reason:'PVE_TARGET_UNKNOWN'});return combatEngine.attack({attacker,target,profile,direction,source:'pve-combat-adapter'})},
    dispose(){stop();return true}
  });
}
