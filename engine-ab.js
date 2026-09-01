(function () {
  const raw = new Image();
  let sheet = null, ok = false, FW = 0, FH = 0;
  const COLS = 4, ROWS = 4;
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
    for (let p = 0; p < d.length; p += 4) {
      const r = d[p], gv = d[p + 1], b = d[p + 2];
      if ((r > 220 && gv > 220 && b > 220) || (r < 12 && gv < 12 && b < 12)) d[p + 3] = 0;
    }
    g.putImageData(data, 0, 0);
    sheet = c;
    FW = c.width / COLS;
    FH = c.height / ROWS;
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

  function stepCol(p) {
    if (p._lx == null) { p._lx = p.x; p._ly = p.y; p._step = 0; }
    const dx = p.x - p._lx, dy = p.y - p._ly;
    p._lx = p.x; p._ly = p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.25) { p._step = 0; return 0; }
    p._step += dist;
    return Math.floor(p._step / 20) % COLS;
  }

  const _av = renderAvatar;
  renderAvatar = function (p, isSelf) {
    if (!ok || !p || !sheet) return _av(p, isSelf);
    const col = stepCol(p);
    const row = dirRow[faceOf(p)] || 0;
    const pad = 1;
    const dw = 28, dh = 40;
    const footY = p.y;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(p.x, footY + 1, 9, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(
      sheet,
      col * FW + pad, row * FH + pad, Math.max(1, FW - pad * 2), Math.max(1, FH - pad * 2),
      Math.round(p.x - dw / 2), Math.round(footY - dh + 2),
      dw, dh
    );
    ctx.fillStyle = isSelf ? '#e7c56a' : '#f3eee4';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || 'Kelo', p.x, footY - dh - 2);
    ctx.restore();
  };
})();
