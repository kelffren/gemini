/* KELO-INDEX
 * area: COMBAT
 * keys: DAMAGE RESOLVER HP SHIELD PURE PRESENTATION-FREE
 * hace: única mutación autoritativa local de HP/escudo para daño resuelto; no conoce visuals, UI ni contenido
 * online: reemplazable por authority/server adapter manteniendo el mismo resultado semántico
 */
(function (root) {
  'use strict';

  const VERSION='damage-resolver-v1.0.0';

  function apply(target, amount) {
    if (!target) return Object.freeze({ok:false,reason:'INVALID_TARGET'});
    const requested=Math.max(0,Number(amount)||0);
    const beforeHp=target.hp==null?100:Math.max(0,Number(target.hp)||0);
    const beforeShield=Math.max(0,Number(target.keloShield)||0);
    const absorbed=Math.min(beforeShield,requested);
    const dealt=Math.max(0,requested-absorbed);
    const afterShield=Math.max(0,beforeShield-absorbed);
    const afterHp=Math.max(0,beforeHp-dealt);
    if (beforeShield>0 || absorbed>0) target.keloShield=afterShield;
    target.hp=afterHp;
    return Object.freeze({
      ok:true,
      requested:requested,
      absorbed:absorbed,
      amount:dealt,
      hpBefore:beforeHp,
      hp:afterHp,
      shieldBefore:beforeShield,
      shield:afterShield,
      killed:beforeHp>0&&afterHp<=0
    });
  }

  root.KELO_DAMAGE_RESOLVER_AUDIT={version:VERSION,ready:true,ownsHpMutation:true,visualFree:true,domFree:true};
  root.KeloDamageResolver=Object.freeze({version:VERSION,apply:apply});
})(typeof globalThis !== 'undefined' ? globalThis : window);
