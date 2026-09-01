(function () {
  const raw = new Image();
  let sheet = null, ok = false, FW = 256, FH = 384;
  const COLS = 4, ROWS = 4;
  raw.onload = function () {
    const c = document.createElement('canvas');
    c.width = raw.width;
    c.height = raw.height;
    const g = c.getContext('2d');
    g.drawImage(raw, 0, 0);
    const data = g.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let p = 0; p < d.length; p += 4) {
      const r = d[p], gv = d[p + 1], b = d[p + 2];
      if (r > 232 && gv > 232 && b > 232) d[p + 3] = 0;
    }
    g.putImageData(data, 0, 0);
    sheet = c;
    FW = c.width / COLS;
    FH = c.height / ROWS;
    ok = true;
  };
  raw.onerror = function () { raw.src = 'assets/hero.png'; };
  raw.src = 'assets/hero.PNG';

  function faceOf(p) {
    const vx = p.vx || 0, vy = p.vy || 0;
    if (Math.hypot(vx, vy) < 12) return p._face || 'down';
    const side = Math.abs(vx) * 1.15 >= Math.abs(vy);
    const f = side ? (vx >= 0 ? 'right' : 'left') : (vy >= 0 ? 'down' : 'up');
    p._face = f;
    return f;
  }

  function gaitOf(p) {
    if (p._gait && p._gait !== 'idle') return p._gait;
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    if (spd > 190) return 'run';
    if (spd > 28) return 'walk';
    return 'idle';
  }

  function stepCol(p) {
    const gait = gaitOf(p);
    if (p._lx == null) { p._lx = p.x; p._ly = p.y; p._step = 0; }
    const dist = Math.hypot(p.x - p._lx, p.y - p._ly);
    p._lx = p.x; p._ly = p.y;
    if (gait === 'idle') { p._step = 0; return 0; }
    p._step += dist;
    const stride = gait === 'run' ? 12 : 20;
    return Math.floor(p._step / stride) % COLS;
  }

  const _av = renderAvatar;
  renderAvatar = function (p, isSelf) {
    if (!ok || !p || !sheet) return _av(p, isSelf);
    const face = faceOf(p);
    const col = stepCol(p);
    const side = face === 'left' || face === 'right';
    const row = face === 'up' ? 3 : (face === 'down' ? 0 : 2);
    const padX = Math.max(2, FW * 0.05);
    const padY = Math.max(2, FH * 0.035);
    const dw = side ? 32 : 36;
    const dh = Math.round(36 * (FH / FW));
    const footY = p.y;
    ctx.save();
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (face === 'left') {
      ctx.translate(p.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-p.x, 0);
    }
    ctx.drawImage(
      sheet,
      col * FW + padX,
      row * FH + padY,
      FW - padX * 2,
      FH - padY * 2,
      Math.round(p.x - dw / 2),
      Math.round(footY - dh + 3),
      dw,
      dh
    );
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.restore();
    ctx.save();
    ctx.fillStyle = isSelf ? '#e7c56a' : '#f3eee4';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || 'Kelo', Math.round(p.x), Math.round(footY - dh - 4));
    ctx.restore();
  };
})();
