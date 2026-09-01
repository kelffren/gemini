(function () {
  const PAD = { x: 1180, y: 1380, w: 520, h: 520 };
  const COLS = 12;
  const ROWS = 12;
  let floor = null;

  const sheet = new Image();
  sheet.onload = bake;
  sheet.src = 'assets/plaza.PNG';

  function cell(g, id, dx, dy, dw, dh) {
    const tw = sheet.naturalWidth / COLS;
    const th = sheet.naturalHeight / ROWS;
    const sx = (id % COLS) * tw;
    const sy = Math.floor(id / COLS) * th;
    g.drawImage(sheet, sx, sy, tw, th, dx, dy, dw, dh);
  }

  function bake() {
    if (!sheet.naturalWidth) return;
    const tw = 52;
    const c = document.createElement('canvas');
    c.width = PAD.w;
    c.height = PAD.h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    const marble = [12, 13, 14, 15, 16, 1, 2];
    for (let y = 0; y < PAD.h; y += tw) {
      for (let x = 0; x < PAD.w; x += tw) {
        const id = marble[(Math.floor(x / tw) + Math.floor(y / tw) * 3) % marble.length];
        cell(g, id, x, y, tw, tw);
      }
    }
    cell(g, 5, PAD.w / 2 - tw, PAD.h / 2 - tw, tw * 2, tw * 2);
    floor = c;
  }

  const _r = render;
  render = function () {
    _r();
    if (!floor) return;
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(floor, PAD.x, PAD.y);
    if (typeof renderAvatar === 'function') {
      if (typeof simulatedPlayers !== 'undefined') simulatedPlayers.forEach(function (p) { renderAvatar(p, false); });
      if (typeof localPlayer !== 'undefined') renderAvatar(localPlayer, true);
    }
    ctx.restore();
  };
})();
