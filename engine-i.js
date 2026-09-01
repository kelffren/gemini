(function () {
  const PLAZA = { x: 1040, y: 1240, w: 800, h: 560 };
  const plazaArt = new Image();
  plazaArt.src = 'assets/plaza.jpg';
  function overlapsPlaza(x, y, w, h) {
    return x < PLAZA.x + PLAZA.w && x + w > PLAZA.x && y < PLAZA.y + PLAZA.h && y + h > PLAZA.y;
  }
  const _renderPrev = render;
  render = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (plazaArt.complete && plazaArt.naturalWidth) {
      ctx.save();
      ctx.translate(screenW / 2, screenH / 2);
      ctx.scale(CONFIG.zoom || 1, CONFIG.zoom || 1);
      ctx.translate(-camera.x, -camera.y);
      ctx.drawImage(plazaArt, PLAZA.x, PLAZA.y, PLAZA.w, PLAZA.h);
      ctx.restore();
    }
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
