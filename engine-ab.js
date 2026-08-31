(function () {
  const raw = new Image();
  let sheet = null, ok = false, FW = 0, FH = 0;
  const paths = ['assets/hero.PNG', 'assets/hero.png', 'assets/hero.JPG', 'assets/hero.jpg'];
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
      const light = r > 220 && gv > 220 && b > 220;
      const nearBlack = r < 18 && gv < 18 && b < 18;
      if (light || nearBlack) {
        d[p + 3] = 0;
      } else {
        const x = (p / 4) % c.width;
        const y = Math.floor(p / 4 / c.width);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    g.putImageData(data, 0, 0);
    if (maxX <= minX) {
      sheet = c; FW = c.width / 4; FH = c.height / 4; ok = true; return;
    }
    const pad = 4;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(c.width - 1, maxX + pad);
    maxY = Math.min(c.height - 1, maxY + pad);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const cut = document.createElement('canvas');
    cut.width = w; cut.height = h;
    cut.getContext('2d').drawImage(c, minX, minY, w, h, 0, 0, w, h);
    sheet = cut;
    FW = w / 4;
    FH = h / 4;
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

  const _av = renderAvatar;
  renderAvatar = function (p, isSelf) {
    if (!ok || !p || !sheet) return _av(p, isSelf);
    const moving = Math.hypot(p.vx || 0, p.vy || 0) > 10;
    const row = dirRow[faceOf(p)] || 0;
    const col = moving ? (Math.floor(Date.now() / 140) % 4) : 0;
    const dw = 36, dh = 54;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 16, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(sheet, col * FW, row * FH, FW, FH, Math.round(p.x - dw / 2), Math.round(p.y - dh + 16), dw, dh);
    ctx.fillStyle = isSelf ? '#e7c56a' : '#f3eee4';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || 'Kelo', p.x, yName(p));
    ctx.restore();
  };
  function yName(p) { return p.y - 42; }
})();
