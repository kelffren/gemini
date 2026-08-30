(function () {
  const dprCap = 3;
  const plazaImg = new Image();
  plazaImg.decoding = 'async';
  const sources = ['assets/plaza.jpg', 'plaza.jpg', 'assets/plaza-sm.jpg'];
  let srcIndex = 0;
  let plazaReady = false;
  plazaImg.onload = function () { plazaReady = true; };
  plazaImg.onerror = function () {
    srcIndex += 1;
    if (srcIndex < sources.length) plazaImg.src = sources[srcIndex];
  };
  plazaImg.src = sources[0];
  resize = function () {
    screenW = window.innerWidth;
    screenH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    canvas.width = Math.floor(screenW * dpr);
    canvas.height = Math.floor(screenH * dpr);
    canvas.style.width = screenW + 'px';
    canvas.style.height = screenH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  };
  resize();
  const PLAZA = { x: 1040, y: 1240, w: 800, h: 560 };
  function drawMarblePlaza() {
    const p = PLAZA;
    ctx.save();
    if (plazaReady) {
      ctx.drawImage(plazaImg, p.x, p.y, p.w, p.h);
    } else {
      const g = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
      g.addColorStop(0, '#12141a');
      g.addColorStop(0.5, '#1c1a16');
      g.addColorStop(1, '#0e1014');
      ctx.fillStyle = g;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = 'rgba(212,175,55,0.45)';
      ctx.lineWidth = 3;
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      ctx.strokeRect(p.x + 90, p.y + 70, p.w - 180, p.h - 140);
      ctx.beginPath();
      ctx.moveTo(cx, cy - 90); ctx.lineTo(cx + 90, cy); ctx.lineTo(cx, cy + 90); ctx.lineTo(cx - 90, cy); ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(212,175,55,0.28)';
      ctx.strokeRect(p.x + 16, p.y + 90, 150, 280);
      ctx.strokeRect(p.x + p.w - 166, p.y + 90, 150, 280);
      [[cx - 160, cy - 120], [cx + 160, cy - 120], [cx - 160, cy + 120], [cx + 160, cy + 120]].forEach(function (pt) {
        ctx.fillStyle = 'rgba(255,210,120,0.18)';
        ctx.beginPath(); ctx.arc(pt[0], pt[1], 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e7c56a';
        ctx.beginPath(); ctx.arc(pt[0], pt[1], 4, 0, Math.PI * 2); ctx.fill();
      });
    }
    const lg = ctx.createRadialGradient(localPlayer.x, localPlayer.y, 20, localPlayer.x, localPlayer.y, 280);
    lg.addColorStop(0, 'rgba(255,210,120,0.08)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
  }
  const _renderC = render;
  render = function () {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const origFillRect = ctx.fillRect.bind(ctx);
    ctx.fillRect = function (x, y, w, h) {
      if (w === 520 && h === 520) { drawMarblePlaza(); return; }
      origFillRect(x, y, w, h);
    };
    _renderC();
    ctx.fillRect = origFillRect;
  };
})();
