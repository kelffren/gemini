/* KELO-INDEX
 * area: LEGACY CAMERA SUPPORT
 * owner: KeloCamera
 * keys: RESPONSIVE ZOOM TILES LOOKAHEAD LEGACY FOUNDATION
 * purpose: conserva el encuadre histórico por cantidad de tiles usando APIs del owner de cámara
 * public-api: none
 * consumes: KeloCamera, KELO_TILE, screenW
 * state-owned: ninguno
 * extension-points: KeloCamera.setBaseZoom/setFollowTuning
 * reuse: no crear otro sistema responsive; extender KeloCamera si la capacidad cambia
 * legacy: regla histórica de encuadre por ancho
 * do-not: NO escribir CONFIG.zoom ni tuning de cámara directamente
 */
(function () {
  const TILE = window.KELO_TILE || 32;
  const cameraOwner = window.KeloCamera;
  if (!cameraOwner) throw new Error('KeloCamera unavailable before engine-z');
  function applyZoom() {
    const targetTiles = screenW < 500 ? 11 : 14;
    const z = screenW / (targetTiles * TILE);
    cameraOwner.setBaseZoom(Math.max(1.05, Math.min(1.45, z)), 'engine-z:responsive-tiles');
    if (cameraOwner.getFollowTuning().lookAheadDist > 40) cameraOwner.setFollowTuning({ lookAheadDist: 36 });
  }
  applyZoom();
  window.addEventListener('resize', applyZoom, { passive: true });
})();
