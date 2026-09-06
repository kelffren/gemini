/* KELO-INDEX
 * area: VISUAL
 * keys: INTEGRATION RENDERAVATAR ACTOR BACK FRONT TRANSFORM FINAL BRIDGE
 * hace: instala una única frontera final alrededor del renderAvatar definitivo para action/reaction y FX del actor
 * online: aplica igual a actor local/remoto; no crea autoridad ni modifica pose/física
 */
(function (root) {
  'use strict';

  function installActorBridge() {
    if (typeof renderAvatar !== 'function') return false;
    if (renderAvatar.__keloVisualBridge === true) return true;
    const base = renderAvatar;

    const wrapped = function (actor, isSelf) {
      if (!actor || !root.KeloVisualSystem) return base(actor, isSelf);
      const transform = root.KeloAnimation && root.KeloAnimation.sampleTransform ? root.KeloAnimation.sampleTransform(actor) : null;
      const pivot = root.KeloAnchors && root.KeloAnchors.get ? root.KeloAnchors.get(actor, 'foot') : { x: actor.x, y: actor.y };
      const g = typeof ctx !== 'undefined' ? ctx : null;
      if (!g || !pivot) return base(actor, isSelf);

      g.save();
      if (transform) {
        g.translate(Number(transform.offsetX) || 0, Number(transform.offsetY) || 0);
        g.translate(pivot.x, pivot.y);
        if (Number(transform.rotation)) g.rotate(Number(transform.rotation));
        g.scale(Number(transform.scaleX) || 1, Number(transform.scaleY) || 1);
        g.translate(-pivot.x, -pivot.y);
      }
      root.KeloVisualSystem.renderActorLayer('actorBackFX', actor, g);
      base(actor, isSelf);
      root.KeloVisualSystem.renderActorLayer('actorFrontFX', actor, g);
      g.restore();
    };
    wrapped.__keloVisualBridge = true;
    wrapped.__keloVisualBase = base;
    renderAvatar = wrapped;
    if (root.KELO_VISUAL_AUDIT) root.KELO_VISUAL_AUDIT.actorBridgeWrapped = true;
    return true;
  }

  function boot() {
    const ok = installActorBridge();
    if (root.KeloVisualSystem && typeof root.KeloVisualSystem.syncAudit === 'function') root.KeloVisualSystem.syncAudit();
    if (root.KELO_VISUAL_AUDIT) {
      root.KELO_VISUAL_AUDIT.integrationReady = ok;
      root.KELO_VISUAL_AUDIT.updateBridgeWrapped = false;
      root.KELO_VISUAL_AUDIT.renderBridgePolicy = 'engine-c-explicit-layers-plus-final-actor-bridge-v1';
    }
  }

  root.KeloVisualIntegration = Object.freeze({ version: 'visual-integration-v1.0.0', installActorBridge: installActorBridge });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : window);
