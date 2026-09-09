/* KELO-INDEX
 * area: COMBAT
 * owner: KeloDamageResolver
 * keys: DAMAGE RESOLVER HP SHIELD INVULNERABLE BLOCK PURE PRESENTATION-FREE
 * purpose: única mutación local/autoritativa de HP/escudo para daño ya resuelto; no conoce visuals, UI ni abilities concretas
 * public-api: KeloDamageResolver.apply(target, amount, meta)
 * online: mismo contrato server/client fallback; servidor conserva autoridad competitiva
 * do-not: NO seleccionar targets, NO hit geometry, NO VFX
 */
(function(root){
  'use strict';
  const VERSION='damage-resolver-v2.0.0-pvp-bible';
  function apply(target,amount,meta){
    if(!target)return Object.freeze({ok:false,reason:'INVALID_TARGET'});
    const requested=Math.max(0,Number(amount)||0),beforeHp=target.hp==null?100:Math.max(0,Number(target.hp)||0),beforeShield=Math.max(0,Number(target.keloShield)||0);
    const invulnerable=!!(root.KeloStatusEffects&&typeof root.KeloStatusEffects.isInvulnerable==='function'&&root.KeloStatusEffects.isInvulnerable(target));
    if(invulnerable)return Object.freeze({ok:true,blocked:true,blockReason:'INVULNERABLE',requested,absorbed:0,amount:0,hpBefore:beforeHp,hp:beforeHp,shieldBefore:beforeShield,shield:beforeShield,killed:false,meta:meta||null});
    const absorbed=Math.min(beforeShield,requested),dealt=Math.max(0,requested-absorbed),afterShield=Math.max(0,beforeShield-absorbed),afterHp=Math.max(0,beforeHp-dealt);
    if(beforeShield>0||absorbed>0)target.keloShield=afterShield;target.hp=afterHp;
    return Object.freeze({ok:true,blocked:false,requested,absorbed,amount:dealt,hpBefore:beforeHp,hp:afterHp,shieldBefore:beforeShield,shield:afterShield,killed:beforeHp>0&&afterHp<=0,meta:meta||null});
  }
  root.KELO_DAMAGE_RESOLVER_AUDIT={version:VERSION,ready:true,ownsHpMutation:true,shieldAware:true,invulnerabilityAware:true,visualFree:true,domFree:true};
  root.KeloDamageResolver=Object.freeze({version:VERSION,apply});
})(typeof globalThis!=='undefined'?globalThis:window);
