(function () {
  const PLAZA = { x: 1040, y: 1240, w: 800, h: 560 };
  const COLS = 12;
  const ROWS = 12;
  let floor = null;
  let sheetOk = false;

  const plazaArt = new Image();
  plazaArt.onload = function () {
    sheetOk = plazaArt.naturalWidth > 0;
    bakeFromSheet();
  };
  plazaArt.src = 'assets/plaza.PNG';

  function bakeFromSheet() {
    const c = document.createElement('canvas');
    c.width = PLAZA.w;
    c.height = PLAZA.h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1a1a22';
    g.fillRect(0, 0, c.width, c.height);
    if (!sheetOk) { floor = c; return; }
    const tw = Math.floor(plazaArt.naturalWidth / COLS);
    const th = Math.floor(plazaArt.naturalHeight / ROWS);
    const ids = [0, 1, 2, 3, 4, 12, 13, 14];
    for (let y = 0; y < c.height; y += tw) {
      for (let x = 0; x < c.width; x += tw) {
        const id = ids[(x / tw + y / tw) % ids.length];
        const sx = (id % COLS) * tw;
        const sy = Math.floor(id / COLS) * th;
        g.drawImage(plazaArt, sx, sy, tw, th, x, y, tw, tw);
      }
    }
    const star = 5;
    g.drawImage(plazaArt, (star % COLS) * tw, Math.floor(star / COLS) * th, tw, th,
      Math.floor(c.width / 2 - tw / 2), Math.floor(c.height / 2 - tw / 2), tw, tw);
    floor = c;
  }

  function overlapsPlaza(x, y, w, h) {
    return x < PLAZA.x + PLAZA.w && x + w > PLAZA.x && y < PLAZA.y + PLAZA.h && y + h > PLAZA.y;
  }

  const _renderPrev = render;
  render = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(CONFIG.zoom || 1, CONFIG.zoom || 1);
    ctx.translate(-camera.x, -camera.y);
    if (floor) ctx.drawImage(floor, PLAZA.x, PLAZA.y);
    ctx.restore();
    const origFill = ctx.fillRect.bind(ctx);
    ctx.fillRect = function (x, y, w, h) {
      if (w === 520 && h === 520) return;
      if (overlapsPlaza(x, y, w, h) && w >= 36 && h >= 36 && w <= 280) return;
      origFill(x, y, w, h);
    };
    _renderPrev();
    ctx.fillRect = origFill;
  };
})();
