(function () {
  const T = window.KELO_TILE || 32;
  const OX = 1024, OY = 1216;
  const lamps = [
    { x: OX + 8 * T, y: OY + 7 * T },
    { x: OX + 19 * T, y: OY + 7 * T },
    { x: OX + 8 * T, y: OY + 16 * T },
    { x: OX + 19 * T, y: OY + 16 * T }
  ];
  const trees = [
    { x: OX + 6 * T, y: OY + 12 * T },
    { x: OX + 22 * T, y: OY + 12 * T },
    { x: OX + 11 * T, y: OY + 17 * T }
  ];

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

  function tree(ctx, x, y, t) {
    const sway = Math.sin(t * 1.4 + x) * 3;
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(x - 3, y - 10, 6, 16);
    ctx.fillStyle = '#1e3a28';
    ctx.beginPath();
    ctx.ellipse(x + sway, y - 22, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a5a38';
    ctx.beginPath();
    ctx.ellipse(x + sway - 4, y - 26, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const _r = render;
  render = function () {
    _r();
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
    trees.forEach(function (p) { tree(ctx, p.x, p.y, t); });
    if (typeof simulatedPlayers !== 'undefined') simulatedPlayers.forEach(function (p) { renderAvatar(p, false); });
    renderAvatar(localPlayer, true);
    ctx.restore();
  };
})();
