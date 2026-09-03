(function () {
  const raw = new Image();
  raw.decoding = 'async';
  if ('fetchPriority' in raw) raw.fetchPriority = 'high';
  let sheet = null, ok = false, FW = 256, FH = 384;
  const COLS = 4;

  function useRawSheet() {
    sheet = raw;
    FW = raw.width / COLS;
    FH = raw.height / 4;
    ok = true;
  }

  function knockWhite() {
    try {
      const c = document.createElement('canvas');
      c.width = raw.width;
      c.height = raw.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(raw, 0, 0);
      const data = g.getImageData(0, 0, c.width, c.height);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 232 && d[i + 1] > 232 && d[i + 2] > 232) d[i + 3] = 0;
      }
      g.putImageData(data, 0, 0);
      sheet = c;
    } catch (e) {}
  }

  raw.onload = function () {
    useRawSheet();
    const later = function () { knockWhite(); };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(later, { timeout: 900 });
    else setTimeout(later, 0);
  };
  raw.onerror = function () { console.error('[Kelo hero] production sprite load failed'); };
  raw.src = 'assets/hero.PNG';

  function legacyMovingOf(p) {
    if (p._lx == null) { p._lx = p.x; p._ly = p.y; }
    const dx = p.x - p._lx;
    const dy = p.y - p._ly;
    const dist = Math.hypot(dx, dy);
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    const toTarget = (p.targetX != null)
      ? Math.hypot((p.targetX - p.x), (p.targetY - p.y))
      : 0;
    if (dist > 0.12 || spd > 16 || toTarget > 14) p._walkHold = 10;
    else if (p._walkHold) p._walkHold -= 1;
    if (dist > 0.12) {
      p._mdx = dx;
      p._mdy = dy;
    } else if (spd > 16) {
      p._mdx = p.vx;
      p._mdy = p.vy;
    } else if (toTarget > 14) {
      p._mdx = p.targetX - p.x;
      p._mdy = p.targetY - p.y;
    }
    p._lx = p.x;
    p._ly = p.y;
    return { dx: p._mdx || 0, dy: p._mdy || 0, on: (p._walkHold || 0) > 0 };
  }

  function motionOf(p) {
    const v = p && p._visualMotion;
    if (v) return { dx: v.dx || 0, dy: v.dy || 0, on: !!v.on, face: v.face || p._face || 'down', frame: v.frame || 0 };
    const m = legacyMovingOf(p);
    m.face = p._face || 'down';
    m.frame = null;
    return m;
  }

  function faceOf(p, m) {
    if (m.face) return m.face;
    if (!m.on) return p._face || 'down';
    const side = Math.abs(m.dx) * 1.15 >= Math.abs(m.dy);
    const f = side ? (m.dx >= 0 ? 'right' : 'left') : (m.dy >= 0 ? 'down' : 'up');
    p._face = f;
    return f;
  }

  function stepCol(p, m) {
    if (!m.on) return 0;
    if (m.frame != null) return m.frame % COLS;
    return Math.floor(Date.now() / 130) % COLS;
  }

  const _av = renderAvatar;
  renderAvatar = function (p, isSelf) {
    if (!ok || !p || !sheet) return _av(p, isSelf);
    const m = motionOf(p);
    const face = faceOf(p, m);
    const col = stepCol(p, m);
    const side = face === 'left' || face === 'right';
    const row = face === 'up' ? 3 : (face === 'down' ? 0 : 2);
    const padX = Math.max(2, FW * 0.05);
    const padY = Math.max(2, FH * 0.04);
    const dw = side ? 48 : 54;
    const dh = Math.round(54 * (FH / FW));
    const footY = p.y + 10;
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
      Math.round(p.x - dw / 2), Math.round(footY - dh),
      dw, dh
    );
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.restore();
    ctx.save();
    ctx.fillStyle = isSelf ? '#e7c56a' : '#f3eee4';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || 'Kelo', Math.round(p.x), Math.round(footY - dh - 6));
    ctx.restore();
  };
})();
