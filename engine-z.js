(function () {
  const TILE = window.KELO_TILE || 32;
  function applyZoom() {
    const targetTiles = screenW < 500 ? 11 : 14;
    const z = screenW / (targetTiles * TILE);
    CONFIG.zoom = Math.max(1.05, Math.min(1.45, z));
    if (CONFIG.lookAheadDist > 40) CONFIG.lookAheadDist = 36;
  }
  applyZoom();
  window.addEventListener('resize', applyZoom);
})();
