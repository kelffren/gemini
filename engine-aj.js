(function () {
  // Corta bucles de colision: jitter, obstaculos duplicados, pelea muro/interior.
  let px = localPlayer.x, py = localPlayer.y;
  let flips = 0;

  const seen = {};
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    const k = Math.round(o.x) + ':' + Math.round(o.y) + ':' + Math.round(o.w) + ':' + Math.round(o.h);
    if (seen[k]) obstacles.splice(i, 1);
    else seen[k] = true;
  }

  const _move = updateMovement;
  updateMovement = function (dt) {
    const ox = localPlayer.x, oy = localPlayer.y;
    _move(dt);
    const dx = localPlayer.x - ox;
    const dy = localPlayer.y - oy;
    const pdx = ox - px;
    const pdy = oy - py;
    if (dx * pdx < -4 || dy * pdy < -4) flips += 1;
    else flips = Math.max(0, flips - 1);
    px = ox;
    py = oy;
    if (flips >= 3) {
      localPlayer.x = ox;
      localPlayer.y = oy;
      localPlayer.vx = 0;
      localPlayer.vy = 0;
      flips = 0;
    }
    if (window.keloZone === 'cafe' && window.keloCafe) {
      const r = window.keloCafe.room;
      localPlayer.x = Math.max(r.x + 14, Math.min(r.x + r.w - 14, localPlayer.x));
      localPlayer.y = Math.max(r.y + 14, Math.min(r.y + r.h - 10, localPlayer.y));
    }
  };
})();
