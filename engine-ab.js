(function () {
  const raw = new Image();
  let sheet = null, ok = false, FW = 256, FH = 384;
  const COLS = 4;
  raw.onload = function () {
    const c = document.createElement('canvas');
    c.width = raw.width;
    c.height = raw.height;
    const g = c.getContext('2d');
    g.drawImage(raw, 0, 0);
    const data = g.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 232 && d[i + 1] > 232 && d[i + 2] > 232) d[i + 3] = 0;
    }
    g.putImageData(data, 0, 0);
    sheet = c;
    FW = c.width / COLS;
    FH = c.height / 4;
    ok = true;
  };
  raw.onerror = function () { raw.src = 'assets/hero.png'; };
  raw.src = 'assets/hero.PNG';

  function motion(p) {
    if (p._lx == null) { p._lx = p.x; p._ly = p.y; }
    const dx = p.x - p._lx;
    const dy = p.y - p._ly;
    const dist = Math.hypot(dx, dy);
    const vx = p.vx || 0;
    const vy = p.vy || 0;
    const spd = Math.hypot(vx, vy);
    return { dx: dist > 0.15 ? dx : vx, dy: dist > 0.15 ? dy : vy, dist: dist, spd: Math.max(spd, dist * 60) };
  }

  function faceOf(p, m) {
    const mx = m.dx, my = m.dy;
    if (Math.hypot(mx, my) < 0.2 && m.spd < 12) return p._face || 'down';
    const side = Math.abs(mx) * 1.15 >= Math.abs(my);
    const f = side ? (mx >= 0 ? 'right' : 'left') : (my >= 0 ? 'down' : 'up');
    p._face = f;
    return f;
  }

  function stepCol(p, m) {
    p._lx = p.x;
    p._ly = p.y;
    const moving = m.dist > 0.2 || m.spd > 20;
    if (!moving) { p._step = 0; return 0; }
    p._step = (p._step || 0) + Math.max(m.dist, 0.35);
    const stride = m.spd > 180 ? 14 : 22;
    return Math.floor(p._step / stride) % COLS;
  }

  const _av = renderAvatar;
  renderAvatar = function (p, isSelf) {
    if (!ok || !p || !sheet) return _av(p, isSelf);
    const m = motion(p);
    const face = faceOf(p, m);
    const col = stepCol(p, m);
    const side = face === 'left' || face === 'right';
    const row = face === 'up' ? 3 : (face === 'down' ? 0 : 2);
    const padX = Math.max(2, FW * 0.05);
    const padY = Math.max(2, FH * 0.035);
    const dw = side ? 48 : 54;
    const dh = Math.round(54 * (FH / FW));
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
      col * FW + padX, row * FH + padY, FW - padX * 2, FH - padY * 2,
      Math.round(p.x - dw / 2), Math.round(footY - dh + 3), dw, dh
    );
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.restore();
    ctx.save();
    ctx.fillStyle = isSelf ? '#e7c56a' : '#f3eee4';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || 'Kelo', Math.round(p.x), Math.round(footY - dh - 4));
    ctx.restore();
  };
})();
