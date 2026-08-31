(function () {
  const T = 32, OX = 1024, OY = 1216;

  function facade(ctx, x, y, w, h, title, wall, roof) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(x + 6, y + h - 4, w, 8);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 18);
    ctx.lineTo(x + w / 2, y - 26);
    ctx.lineTo(x + w + 8, y + 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(x - 8, y + 16, w + 16, 4);
    ctx.fillStyle = wall;
    ctx.fillRect(x, y + 20, w, h - 20);
    ctx.strokeStyle = '#8a7040';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y + 20, w, h - 20);
    const cols = Math.max(2, Math.floor(w / 36));
    for (let c = 0; c < cols; c++) {
      const wx = x + 10 + c * Math.floor(w / cols);
      const wy = y + 30;
      if (wx + 16 < x + w - 8) {
        ctx.fillStyle = '#d4b46a';
        ctx.fillRect(wx, wy, 16, 18);
        ctx.fillStyle = '#1c1810';
        ctx.fillRect(wx + 2, wy + 2, 12, 14);
        ctx.fillStyle = 'rgba(231,197,106,0.25)';
        ctx.fillRect(wx + 3, wy + 3, 5, 6);
      }
    }
    ctx.fillStyle = '#140e0a';
    ctx.fillRect(x + w / 2 - 12, y + h - 28, 24, 28);
    ctx.fillStyle = '#e7c56a';
    ctx.fillRect(x + w / 2 + 4, y + h - 16, 3, 3);
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, x + w / 2, y - 30);
  }

  const _r = render;
  render = function () {
    _r();
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    facade(ctx, OX + 4 * T, OY + 2 * T, 5 * T, 3 * T, 'Mercado', '#4a281c', '#6a3020');
    facade(ctx, OX + 20 * T, OY + 5 * T, 4 * T, 3 * T, 'Banco', '#2a3038', '#3a4048');
    facade(ctx, OX + 2 * T, OY + 8 * T, 4 * T, 3 * T, 'Atelier', '#402028', '#5a2830');
    facade(ctx, OX + 18 * T, OY + 14 * T, 5 * T, 3 * T, 'Café Oro', '#3a2814', '#5a3a18');
    if (typeof simulatedPlayers !== 'undefined') simulatedPlayers.forEach(function (p) { renderAvatar(p, false); });
    if (window.keloNpcs) keloNpcs.forEach(function (n) {
      renderAvatar({ name: n.name, x: n.x, y: n.y, gear: { bodyColor: n.color, armorColor: '#e7c56a' } }, false);
    });
    renderAvatar(localPlayer, true);
    ctx.restore();
  };
})();
