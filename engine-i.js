(function () {
  const PLAZA = { x: 1040, y: 1240, w: 800, h: 560 };
  const T = 40;
  let floor = null;

  function bakeFloor() {
    const c = document.createElement('canvas');
    c.width = PLAZA.w;
    c.height = PLAZA.h;
    const g = c.getContext('2d');
    g.fillStyle = '#12151c';
    g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < c.height; y += T) {
      for (let x = 0; x < c.width; x += T) {
        const checker = ((x + y) / T) % 2;
        g.fillStyle = checker ? '#1a1f29' : '#161b24';
        g.fillRect(x + 1, y + 1, T - 2, T - 2);
      }
    }
    floor = c;
  }
  bakeFloor();

  const plazaArt = new Image();
  const paths = [
    'assets/tileset .PNG',
    'assets/tileset.PNG',
    'assets/tileset.png',
    'assets/plaza.jpg',
    'assets/plaza.png'
  ];
  let pi = 0;
  plazaArt.onload = function () {};
  plazaArt.onerror = function () {
    pi += 1;
    if (pi < paths.length) plazaArt.src = paths[pi];
  };
  plazaArt.src = paths[0];

  function overlapsPlaza(x, y, w, h) {
    return x < PLAZA.x + PLAZA.w && x + w > PLAZA.x && y < PLAZA.y + PLAZA.h && y + h > PLAZA.y;
  }

  const _renderPrev = render;
  render = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(CONFIG.zoom || 1, CONFIG.zoom || 1);
    ctx.translate(-camera.x, -camera.y);
    if (plazaArt.complete && plazaArt.naturalWidth) {
      ctx.drawImage(plazaArt, PLAZA.x, PLAZA.y, PLAZA.w, PLAZA.h);
    } else if (floor) {
      ctx.drawImage(floor, PLAZA.x, PLAZA.y);
    }
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
