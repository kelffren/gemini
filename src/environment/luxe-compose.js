(function () {
  const P = { x: 1040, y: 1240, w: 800, h: 560 };
  const kiosk = { x: P.x + 36, y: P.y + 48, w: 150, h: 128 };

  function booth() {
    ctx.fillStyle = '#1a1428';
    ctx.fillRect(kiosk.x, kiosk.y + 36, kiosk.w, kiosk.h - 36);
    ctx.fillStyle = '#0d0a16';
    ctx.beginPath();
    ctx.moveTo(kiosk.x - 10, kiosk.y + 44);
    ctx.lineTo(kiosk.x + kiosk.w / 2, kiosk.y);
    ctx.lineTo(kiosk.x + kiosk.w + 10, kiosk.y + 44);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e7c56a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#e7c56a';
    ctx.fillRect(kiosk.x + 16, kiosk.y + 70, kiosk.w - 32, 36);
    ctx.fillStyle = '#1a1428';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LUXE', kiosk.x + kiosk.w / 2, kiosk.y + 93);
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(kiosk.x + 20, kiosk.y + 112, 28, 18);
    ctx.fillRect(kiosk.x + kiosk.w - 48, kiosk.y + 112, 28, 18);
  }

  function pathAndWater() {
    const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
    ctx.fillStyle = 'rgba(210,198,170,0.55)';
    ctx.fillRect(cx - 28, P.y + 20, 56, P.h - 40);
    ctx.fillRect(P.x + 24, cy - 22, P.w - 48, 44);
    ctx.fillStyle = 'rgba(70,150,190,0.35)';
    ctx.beginPath();
    ctx.ellipse(P.x + 90, P.y + P.h - 70, 70, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(231,197,106,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + 10, cy + 8, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,190,220,0.25)';
    ctx.beginPath();
    ctx.arc(cx + 10, cy + 8, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    if (typeof ctx === 'undefined' || typeof camera === 'undefined') return;
    const z = (CONFIG && CONFIG.zoom) || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    pathAndWater();
    booth();
    if (typeof renderAvatar === 'function') {
      if (typeof simulatedPlayers !== 'undefined') simulatedPlayers.forEach(function (p) { renderAvatar(p, false); });
      if (typeof localPlayer !== 'undefined') renderAvatar(localPlayer, true);
    }
    ctx.restore();
  }

  if (typeof render === 'function') {
    const prev = render;
    render = function () { prev(); draw(); };
  }
  window.KELO_LUXE_COMPOSE = { kiosk: kiosk };
})();
