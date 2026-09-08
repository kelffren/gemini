/* KELO-INDEX
 * area: MELEE
 * keys: ENGINE PROFILE COMBAT ADAPTER REUSABLE
 * hace: selecciona perfil melee y delega resolución a CombatEngine; no dibuja ni muta HP directamente
 */
(function(root){
  'use strict';
  const VERSION='melee-engine-v1.0.0';
  function attack(options){
    const o=options||{},profiles=root.KeloMeleeProfiles,combat=root.KeloCombatEngine;
    if(!profiles||!combat)return Object.freeze({ok:false,reason:'MELEE_FOUNDATION_UNAVAILABLE'});
    const profileId=String(o.profileId||'sword_light_basic'),profile=profiles.get(profileId);
    if(!profile)return Object.freeze({ok:false,reason:'MELEE_PROFILE_NOT_FOUND',profileId:profileId});
    return combat.attack({
      attacker:o.attacker,target:o.target,profile:profile,profileId:profile.id,kind:'melee',
      weaponClass:profile.weaponClass,attackProfile:profile.attackProfile,
      cooldownRemaining:o.cooldownRemaining,attackId:o.attackId,startedAt:o.startedAt,
      source:o.source||'melee-engine',visual:o.visual
    });
  }
  root.KELO_MELEE_ENGINE_AUDIT={version:VERSION,ready:true,usesCombatEngine:true,directHpMutation:false,presentationFree:true};
  root.KeloMeleeEngine=Object.freeze({version:VERSION,attack:attack});
})(typeof globalThis!=='undefined'?globalThis:window);
