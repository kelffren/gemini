(function () {
  const P = { x: 1040, y: 1240 };
  const COLS = 12;
  const sheet = new Image();
  sheet.src = 'assets/plaza.PNG';
  const gx = P.x + 40;
  const gy = P.y + 40;

  function cell(id, dx, dy, dw, dh) {
    if (!sheet.naturalWidth) return;
    const tw = sheet.naturalWidth / COLS;
    const th = sheet.naturalHeight / COLS;
    ctx.drawImage(sheet, (id % COLS) * tw, Math.floor(id / COLS) * th, tw, th, dx, dy, dw || tw * 0.55, dh || th * 0.55);
  }

  function drawKiosk() {
    if (!sheet.naturalWidth || typeof ctx === 'undefined') return;
    const z = (CONFIG && CONFIG.zoom) || 1;
    const s = 58;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    ctx.imageSmoothingEnabled = false;
    cell(36, gx, gy, s, s);
    cell(37, gx + s, gy, s, s);
    cell(38, gx + s * 2, gy, s, s);
    cell(48, gx, gy + s, s, s);
    cell(71, gx + s, gy + s, s, s);
    cell(50, gx + s * 2, gy + s, s, s);
    cell(60, gx, gy + s * 2, s, s);
    cell(61, gx + s, gy + s * 2, s, s);
    cell(62, gx + s * 2, gy + s * 2, s, s);
    ctx.fillStyle = '#e7c56a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LUXE', gx + s * 1.5, gy + 22);
    ctx.restore();
  }

  if (typeof render === 'function') {
    const prev = render;
    render = function () { prev(); drawKiosk(); };
  }
})();
