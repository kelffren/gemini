/* KELO-INDEX
 * area: MELEE
 * owner: KeloMeleeEngine
 * keys: ENGINE PROFILE COMBAT ADAPTER REUSABLE DIRECTION SWEEP
 * purpose: selecciona perfil melee y delega resolución single/sweep al KeloCombatEngine
 * public-api: beginAttack / attack / attackSweep / getProfile
 * online: la misma llamada puede ejecutarse detrás de autoridad server
 * do-not: NO dibujar ni mutar HP directamente
 */
(function(root){
  'use strict';
  const VERSION='melee-engine-v2.0.0-action-combat';
  function profileOf(id){return root.KeloMeleeProfiles&&root.KeloMeleeProfiles.get(String(id||'sword_light_basic'));}
  function base(o,profile){return{attacker:o.attacker,profile,profileId:profile.id,kind:'melee',weaponClass:profile.weaponClass,attackProfile:profile.attackProfile,direction:o.direction,cooldownRemaining:o.cooldownRemaining,attackId:o.attackId,startedAt:o.startedAt,source:o.source||'melee-engine',visual:o.visual,skipStart:o.skipStart};}
  function beginAttack(options){
    const o=options||{},combat=root.KeloCombatEngine,profile=profileOf(o.profileId);
    if(!profile||!combat||typeof combat.beginAttack!=='function')return Object.freeze({ok:false,reason:'MELEE_FOUNDATION_UNAVAILABLE'});
    return combat.beginAttack(base(o,profile));
  }
  function attack(options){
    const o=options||{},combat=root.KeloCombatEngine,profile=profileOf(o.profileId);
    if(!profile||!combat)return Object.freeze({ok:false,reason:'MELEE_FOUNDATION_UNAVAILABLE'});
    return combat.attack(Object.assign(base(o,profile),{target:o.target}));
  }
  function attackSweep(options){
    const o=options||{},combat=root.KeloCombatEngine,profile=profileOf(o.profileId);
    if(!profile||!combat||typeof combat.attackSweep!=='function')return Object.freeze({ok:false,reason:'MELEE_SWEEP_UNAVAILABLE',hits:[]});
    return combat.attackSweep(Object.assign(base(o,profile),{targets:Array.isArray(o.targets)?o.targets:[]}));
  }
  root.KELO_MELEE_ENGINE_AUDIT={version:VERSION,ready:true,usesCombatEngine:true,directHpMutation:false,presentationFree:true,directional:true,sweep:true};
  root.KeloMeleeEngine=Object.freeze({version:VERSION,beginAttack,attack,attackSweep,getProfile:profileOf});
})(typeof globalThis!=='undefined'?globalThis:window);
