/* KELO-INDEX
 * area: CORE
 * owner: KeloUpdater watch helper
 * keys: UPDATE PWA WATCH DEPLOY LONGSESSION BACKGROUND
 * purpose: vuelve a consultar de forma ligera si apareció una build nueva durante sesiones largas sin usar polling agresivo
 * public-api: N/A; consumidor de KeloUpdater.check()/getState()
 * consumes: KeloUpdater
 * state-owned: únicamente un timeout efímero
 * do-not: no descarga assets ni decide políticas de red; eso pertenece a KeloUpdater
 */
(function initKeloUpdaterWatch(global) {
  'use strict';

  if (global.__KELO_UPDATER_WATCH__) return;
  global.__KELO_UPDATER_WATCH__ = true;

  const CHECK_EVERY_MS = 120000;
  let timer = 0;

  function schedule(delay) {
    if (timer) global.clearTimeout(timer);
    timer = global.setTimeout(tick, Math.max(10000, Number(delay) || CHECK_EVERY_MS));
  }

  async function tick() {
    try {
      const updater = global.KeloUpdater;
      if (!updater || typeof updater.check !== 'function' || typeof updater.getState !== 'function') {
        schedule(15000);
        return;
      }

      const snapshot = updater.getState();
      const visible = document.visibilityState === 'visible';
      const busy = !!(snapshot && snapshot.gameplayBusy);

      // El chequeo de versión es pequeño, pero incluso éste cede ante combate/PVP.
      if (visible && !busy) await updater.check();
    } catch (_) {
      // La detección nunca debe afectar al runtime del juego.
    } finally {
      schedule(CHECK_EVERY_MS);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule(4000);
  });

  schedule(CHECK_EVERY_MS);
})(window);
