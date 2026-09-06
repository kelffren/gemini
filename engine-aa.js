(function () {
  const T = window.KELO_TILE || 32;
  const OX = 1024, OY = 1216;
  const lamps = [
    { x: OX + 8 * T, y: OY + 7 * T },
    { x: OX + 19 * T, y: OY + 7 * T },
    { x: OX + 8 * T, y: OY + 16 * T },
    { x: OX + 19 * T, y: OY + 16 * T }
  ];
  function resetActive(){return window.KELO_WORLD_DECORATION_RESET===true||window.KELO_WORLD_RENDERER?.decorationReset===true;}

  window.KELO_LEGACY_PLAZA_AUDIT = {
    version: 'legacy-plaza-v1.2',
    proceduralTreeMode: 'disabled-authored-nature-owned-v1',
    proceduralTreeCount: 0,
    lampsPreserved: false,
    fountainGlowPreserved: false,
    decorationReset: true,
    drawCount: 0
  };

  function lamp(ctx, x, y, t) {
    ctx.fillStyle = '#2a2428';
    ctx.fillRect(x - 2, y - 28, 4, 28);
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(x - 6, y - 34, 12, 8);
    const g = 0.22 + Math.sin(t * 2 + x) * 0.06;
    ctx.fillStyle = 'rgba(231,197,106,' + g + ')';
    ctx.beginPath();
    ctx.arc(x, y - 30, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  const _r = render;
  render = function () {
    _r();
    if (resetActive()) {
      window.KELO_LEGACY_PLAZA_AUDIT.decorationReset = true;
      return;
    }
    const z = CONFIG.zoom || 1;
    const t = Date.now() / 1000;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    const fx = 1440, fy = 1510;
    ctx.fillStyle = 'rgba(142,202,230,' + (0.2 + Math.sin(t * 3) * 0.08) + ')';
    ctx.beginPath();
    ctx.arc(fx, fy, 22 + Math.sin(t * 4) * 2, 0, Math.PI * 2);
    ctx.fill();
    lamps.forEach(function (p) { lamp(ctx, p.x, p.y, t); });
    if (typeof simulatedPlayers !== 'undefined') simulatedPlayers.forEach(function (p) { renderAvatar(p, false); });
    renderAvatar(localPlayer, true);
    ctx.restore();
    window.KELO_LEGACY_PLAZA_AUDIT.drawCount++;
  };
})();