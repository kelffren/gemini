(function () {
  function pushOut(px, py, pr, ox, oy, or) {
    const dx = px - ox;
    const dy = py - oy;
    const min = pr + or;
    const d = Math.hypot(dx, dy) || 0.001;
    if (d >= min) return { x: px, y: py, hit: false };
    const u = (min - d) / d;
    return { x: px + dx * u, y: py + dy * u, hit: true };
  }

  function bodies() {
    const list = [];
    if (window.keloNpcs) {
      window.keloNpcs.forEach(function (n) {
        list.push({ x: n.x, y: n.y, r: 16 });
      });
    }
    if (typeof simulatedPlayers !== 'undefined') {
      simulatedPlayers.forEach(function (p) {
        list.push({ x: p.x, y: p.y, r: p.radius || 18 });
      });
    }
    if (window.trainingDummy && !trainingDummy.dead) {
      list.push({ x: trainingDummy.x, y: trainingDummy.y, r: trainingDummy.radius || 20 });
    }
    return list;
  }

  const _move = updateMovement;
  updateMovement = function (dt) {
    _move(dt);
    const pr = localPlayer.radius || 20;
    bodies().forEach(function (b) {
      const res = pushOut(localPlayer.x, localPlayer.y, pr, b.x, b.y, b.r);
      if (res.hit) {
        localPlayer.x = res.x;
        localPlayer.y = res.y;
      }
    });
    localPlayer.x = Math.max(pr, Math.min(CONFIG.worldWidth - pr, localPlayer.x));
    localPlayer.y = Math.max(pr, Math.min(CONFIG.worldHeight - pr, localPlayer.y));
  };
})();
