(function () {
  // LIVE owner: hero walk. Sheet is 1024x1536 = 4x4 cells of 256x384.
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

  const dirRow = { down: 0, left: 1, right: 2, up: 3 };
  function faceOf(p) {
    const vx = p.vx || 0, vy = p.vy || 0;
    if (Math.hypot(vx, vy) < 12) return p._face || 'down';
    const f = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
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
    if (gait === 'idle') {
      p._step = 0;
      return 0;
    }
    p._step += dist;
    const stride = gait === 'run' ? 12 : 20;
    return Math.floor(p._step / stride) % COLS;
  }

  const _av = renderAvatar;
  renderAvatar = function (p, isSelf) {
    if (!ok || !p || !sheet) return _av(p, isSelf);
    const col = stepCol(p);
    const row = dirRow[faceOf(p)] || 0;
    const padX = Math.max(2, FW * 0.04);
    const padY = Math.max(2, FH * 0.03);
    const dw = 36;
    const dh = Math.round(dw * (FH / FW));
    const footY = p.y;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(p.x, footY + 1, dw * 0.28, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
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
    ctx.fillStyle = isSelf ? '#e7c56a' : '#f3eee4';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || 'Kelo', Math.round(p.x), Math.round(footY - dh - 4));
    ctx.restore();
  };
})();
