(function () {
  const raw = new Image();
  let sheet = null, ok = false, FW = 0, FH = 0, single = true;
  const paths = ['assets/hero.PNG', 'assets/hero.png'];
  let i = 0;
  function tryNext() {
    if (i >= paths.length) return;
    raw.src = paths[i++];
  }
  raw.onload = function () {
    const c = document.createElement('canvas');
    c.width = raw.width;
    c.height = raw.height;
    const g = c.getContext('2d');
    g.drawImage(raw, 0, 0);
    const data = g.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
    for (let p = 0; p < d.length; p += 4) {
      const r = d[p], gv = d[p + 1], b = d[p + 2];
      if ((r > 220 && gv > 220 && b > 220) || (r < 18 && gv < 18 && b < 18)) {
        d[p + 3] = 0;
      } else {
        const x = (p / 4) % c.width;
        const y = Math.floor((p / 4) / c.width);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    g.putImageData(data, 0, 0);
    if (maxX <= minX) {
      sheet = c; FW = c.width; FH = c.height; single = true; ok = true; return;
    }
    minX = Math.max(0, minX - 2); minY = Math.max(0, minY - 2);
    maxX = Math.min(c.width - 1, maxX + 2); maxY = Math.min(c.height - 1, maxY + 2);
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const cut = document.createElement('canvas');
    cut.width = w; cut.height = h;
    cut.getContext('2d').drawImage(c, minX, minY, w, h, 0, 0, w, h);
    sheet = cut;
    single = (w / h) < 0.9;
    if (single) { FW = w; FH = h; }
    else { FW = w / 4; FH = h / 4; }
    ok = true;
  };
  raw.onerror = tryNext;
  tryNext();

  const dirRow = { down: 0, left: 1, right: 2, up: 3 };
  function faceOf(p) {
    const vx = p.vx || 0, vy = p.vy || 0;
    if (Math.hypot(vx, vy) < 8) return p._face || 'down';
    const f = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
    p._face = f;
    return f;
  }

  function stepPhase(p) {
    if (p._lx == null) { p._lx = p.x; p._ly = p.y; p._step = 0; }
    const dx = p.x - p._lx, dy = p.y - p._ly;
    p._lx = p.x; p._ly = p.y;
    const dist = Math.hypot(dx, dy);
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    const moving = dist > 0.2 || spd > 20;
    if (!moving) { p._step = 0; return 0; }
    p._step += dist;
    return (p._step / 22) % 1;
  }

  const _av = renderAvatar;
  renderAvatar = function (p, isSelf) {
    if (!ok || !p || !sheet) return _av(p, isSelf);
    const phase = stepPhase(p);
    const moving = phase > 0;
    const face = faceOf(p);
    const dw = 36, dh = 52;
    const footY = p.y;
    const bob = moving ? Math.sin(phase * Math.PI * 2) * 1.1 : 0;
    const squash = moving ? 1 - Math.abs(Math.sin(phase * Math.PI * 2)) * 0.04 : 1;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.beginPath();
    ctx.ellipse(p.x, footY + 1, 10.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    let sx = 0, sy = 0, sw = FW, sh = FH;
    if (!single) {
      const col = Math.floor(phase * 4) % 4;
      const row = dirRow[face] || 0;
      sx = col * FW; sy = row * FH;
    }
    const drawH = dh * squash;
    const drawY = Math.round(footY - drawH + 2 - bob);
    if (face === 'left' && single) {
      ctx.translate(p.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-p.x, 0);
    }
    ctx.drawImage(sheet, sx, sy, sw, sh, Math.round(p.x - dw / 2), drawY, dw, drawH);
    ctx.fillStyle = isSelf ? '#e7c56a' : '#f3eee4';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || 'Kelo', p.x, footY - dh + 4);
    ctx.restore();
  };
})();
