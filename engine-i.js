(function () {
  const PAD = { x: 1180, y: 1380, w: 520, h: 520 };
  const COLS = 12;
  const ROWS = 12;
  let floor = null;

  const sheet = new Image();
  sheet.onload = bake;
  sheet.src = 'assets/plaza.PNG';

  function bake() {
    if (!sheet.naturalWidth) return;
    const tw = Math.floor(sheet.naturalWidth / COLS);
    const th = Math.floor(sheet.naturalHeight / ROWS);
    const c = document.createElement('canvas');
    c.width = PAD.w;
    c.height = PAD.h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const floorIds = [0, 1, 2, 3, 12, 13];
    for (let y = 0; y < PAD.h; y += tw) {
      for (let x = 0; x < PAD.w; x += tw) {
        const id = floorIds[(Math.floor(x / tw) + Math.floor(y / tw)) % floorIds.length];
        g.drawImage(sheet, (id % COLS) * tw, Math.floor(id / COLS) * th, tw, th, x, y, tw, tw);
      }
    }
    const star = 5;
    g.drawImage(sheet, (star % COLS) * tw, Math.floor(star / COLS) * th, tw, th,
      Math.floor(PAD.w / 2 - tw / 2), Math.floor(PAD.h / 2 - tw / 2), tw, tw);
    floor = c;
  }

  function worldCam() {
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    ctx.imageSmoothingEnabled = false;
  }

  const _r = render;
  render = function () {
    _r();
    if (!floor) return;
    worldCam();
    ctx.drawImage(floor, PAD.x, PAD.y);
    if (typeof renderAvatar === 'function') {
      if (typeof simulatedPlayers !== 'undefined') simulatedPlayers.forEach(function (p) { renderAvatar(p, false); });
      if (typeof localPlayer !== 'undefined') renderAvatar(localPlayer, true);
    }
    ctx.restore();
  };
})();
