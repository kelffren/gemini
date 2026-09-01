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
        const cx = Math.floor(x / T);
        const cy = Math.floor(y / T);
        const checker = (cx + cy) % 2;
        g.fillStyle = checker ? '#1a1f29' : '#161b24';
        g.fillRect(x + 1, y + 1, T - 2, T - 2);
        g.strokeStyle = 'rgba(201,162,74,0.18)';
        g.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
        if (checker) {
          g.fillStyle = 'rgba(231,197,106,0.06)';
          g.fillRect(x + 8, y + 8, T - 16, T - 16);
        }
      }
    }
    const grd = g.createRadialGradient(c.width / 2, c.height / 2, 40, c.width / 2, c.height / 2, 280);
    grd.addColorStop(0, 'rgba(231,197,106,0.16)');
    grd.addColorStop(1, 'rgba(231,197,106,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(231,197,106,0.55)';
    g.lineWidth = 3;
    g.strokeRect(6, 6, c.width - 12, c.height - 12);
    g.strokeStyle = 'rgba(231,197,106,0.28)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(c.width / 2, 18);
    g.lineTo(c.width / 2, c.height - 18);
    g.moveTo(18, c.height / 2);
    g.lineTo(c.width - 18, c.height / 2);
    g.stroke();
    floor = c;
  }
  bakeFloor();

  const plazaArt = new Image();
  plazaArt.onload = function () { /* photo wins if someone uploads it */ };
  plazaArt.src = 'assets/plaza.jpg';

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
