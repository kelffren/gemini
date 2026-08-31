(function () {
  if (CONFIG) CONFIG.zoom = Math.min(CONFIG.zoom || 0.95, 1.05);

  function pix(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function drawHero(ctx, p, isSelf) {
    const vx = p.vx || ((p.targetX || p.x) - p.x);
    const vy = p.vy || ((p.targetY || p.y) - p.y);
    const moving = Math.hypot(p.vx || 0, p.vy || 0) > 10 || Math.hypot((p.targetX || p.x) - p.x, (p.targetY || p.y) - p.y) > 10;
    let face = 'down';
    if (Math.abs(vx) + Math.abs(vy) > 6) {
      face = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
    }
    const t = Date.now() / 140;
    const step = moving ? ((Math.floor(t) % 2) ? 2 : -2) : 0;
    const body = (p.gear && p.gear.bodyColor) || '#2f6f8f';
    const gold = (p.gear && p.gear.armorColor) || '#e7c56a';
    const x = Math.round(p.x), y = Math.round(p.y);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    pix(ctx, x - 5, y + 4 + (step > 0 ? 1 : 0), 4, 8, '#1b1520');
    pix(ctx, x + 1, y + 4 + (step < 0 ? 1 : 0), 4, 8, '#1b1520');
    pix(ctx, x - 6, y - 8, 12, 13, body);
    pix(ctx, x - 6, y - 1, 12, 3, gold);
    pix(ctx, x - 7, y - 6, 2, 6, gold);
    pix(ctx, x + 5, y - 6, 2, 6, gold);
    if (face !== 'up') {
      pix(ctx, x - 4, y - 16, 8, 8, '#e6bf9a');
      pix(ctx, x - 3, y - 14, 2, 2, '#2a1a12');
      pix(ctx, x + 1, y - 14, 2, 2, '#2a1a12');
      pix(ctx, x - 2, y - 11, 4, 1, '#a56');
    } else {
      pix(ctx, x - 4, y - 16, 8, 8, '#e6bf9a');
    }
    pix(ctx, x - 5, y - 18, 10, 4, '#1a1210');
    if (isSelf) pix(ctx, x - 3, y - 21, 6, 3, gold);
    if (face === 'left') pix(ctx, x - 8, y - 5, 2, 5, '#c9a24a');
    if (face === 'right') pix(ctx, x + 6, y - 5, 2, 5, '#c9a24a');
    ctx.restore();
    ctx.fillStyle = isSelf ? '#e7c56a' : '#f5f0e6';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || 'Kelo', x, y - 26);
  }

  renderAvatar = function (p, isSelf) { drawHero(ctx, p, !!isSelf); };

  function facade(ctx, x, y, w, h, title, roof) {
    ctx.fillStyle = roof || '#3a2418';
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 10);
    ctx.lineTo(x + w / 2, y - 22);
    ctx.lineTo(x + w + 6, y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(x - 6, y + 8, w + 12, 3);
    ctx.fillStyle = '#2a242c';
    ctx.fillRect(x, y + 10, w, h - 10);
    ctx.strokeStyle = '#8a7040';
    ctx.strokeRect(x, y + 10, w, h - 10);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < Math.max(2, Math.floor(w / 36)); c++) {
        const wx = x + 12 + c * 32;
        const wy = y + 22 + r * 28;
        if (wy < y + h - 30) {
          ctx.fillStyle = '#d4b46a';
          ctx.fillRect(wx, wy, 14, 16);
          ctx.fillStyle = 'rgba(20,16,10,0.55)';
          ctx.fillRect(wx + 1, wy + 1, 12, 14);
        }
      }
    }
    ctx.fillStyle = '#1a120c';
    ctx.fillRect(x + w / 2 - 11, y + h - 24, 22, 24);
    ctx.fillStyle = '#e7c56a';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, x + w / 2, y - 26);
  }

  const _r = render;
  render = function () {
    _r();
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    facade(ctx, 1180, 1288, 150, 110, 'Mercado', '#4a2018');
    facade(ctx, 1688, 1380, 130, 100, 'Banco', '#2a3038');
    facade(ctx, 1088, 1488, 120, 96, 'Atelier', '#402028');
    facade(ctx, 1660, 1688, 160, 120, 'Residencias', '#2c2830');
    facade(ctx, 1120, 1700, 140, 100, 'Café Oro', '#3a2814');
    ctx.fillStyle = '#6b5b3a';
    ctx.fillRect(1420, 1220, 80, 16);
    ctx.fillStyle = '#e7c56a';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SALIDA', 1460, 1212);
    ctx.restore();
  };
})();
