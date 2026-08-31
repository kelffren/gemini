(function () {
  const hero = new Image();
  let ok = false;
  const paths = ['assets/hero.png', 'assets/hero.png.JPG', 'assets/hero.jpg', 'assets/hero.PNG'];
  let i = 0;
  function tryNext() {
    if (i >= paths.length) return;
    hero.src = paths[i++];
  }
  hero.onload = function () { ok = hero.width > 64; };
  hero.onerror = tryNext;
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
    if (!ok || !p) return _av(p, isSelf);
    const cols = 4, rows = 4;
    const FW = hero.width / cols;
    const FH = hero.height / rows;
    const moving = Math.hypot(p.vx || 0, p.vy || 0) > 10;
    const row = dirRow[faceOf(p)] || 0;
    const col = moving ? (Math.floor(Date.now() / 140) % 4) : 0;
    const dw = 44, dh = 62;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 18, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(hero, col * FW, row * FH, FW, FH, Math.round(p.x - dw / 2), Math.round(p.y - dh + 18), dw, dh);
    ctx.fillStyle = isSelf ? '#e7c56a' : '#f3eee4';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || 'Kelo', p.x, p.y - 48);
    ctx.restore();
  };
})();
