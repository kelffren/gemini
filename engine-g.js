/* KELO-INDEX
 * area: LEGACY ABILITY / MOVEMENT
 * owner: legacy dash tween; aim lifecycle owned by KeloAbilityAim; action bar owned by first-use KeloAbilities; movement extension owned by KeloMovement
 * keys: DASH MOVEMENT INTERCEPT ABILITY COMPATIBILITY
 * purpose: conserva únicamente estado compatibility compartido y dash tween legacy mientras KeloAbilities posee la hotbar moderna al primer uso
 * consumes: KeloMovement, STATE, localPlayer, obstacles
 * state-owned: skillAim + dashTween legacy compatibility state
 * extension-points: KeloMovement.intercept
 * reuse: NO añadir habilidades nuevas aquí; usar sistema moderno de abilities
 * legacy: dash tween pendiente de migración; action bar/aim/cast/listeners/renderer retirados
 * do-not: NO implementar hotbar, aim/cast, pointer listeners, render hooks, NO envolver updateMovement/render
 */
const skillAim = { active: false, index: -1, typeId: '', pointerId: null, originX: 0, originY: 0, currentX: 0, currentY: 0, dirX: 1, dirY: 0 };
const dashTween = { active: false, t: 0, dur: 0.16, fromX: 0, fromY: 0, toX: 0, toY: 0 };

if(!window.KeloMovement) throw new Error('KeloMovement unavailable before engine-g');
window.KeloMovement.intercept('engine-g:legacy-dash', function(ctx) {
  if (!dashTween.active) return false;
  dashTween.t += ctx.dt;
  const u = Math.min(1, dashTween.t / dashTween.dur);
  const ease = 1 - Math.pow(1 - u, 2);
  localPlayer.x = dashTween.fromX + (dashTween.toX - dashTween.fromX) * ease;
  localPlayer.y = dashTween.fromY + (dashTween.toY - dashTween.fromY) * ease;
  for (const b of obstacles) {
    const res = resolveCircleAABB(localPlayer.x, localPlayer.y, localPlayer.radius, b);
    if (res.collided) { localPlayer.x += res.pushX; localPlayer.y += res.pushY; }
  }
  if (isPvPActive && arenaPvP.rival && Math.hypot(localPlayer.x - arenaPvP.rival.x, localPlayer.y - arenaPvP.rival.y) < 52) {
    const stone = STATE.equipped.find(s => s.typeId === 'dash');
    applyPvPDamage(arenaPvP.rival, stone ? stone.dmg : 15);
  }
  if (u >= 1) dashTween.active = false;
  return true;
}, 10);
