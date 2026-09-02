(function () {
  const P = { x: 1040, y: 1240, w: 800, h: 560 };
  const kiosk = { x: P.x + 36, y: P.y + 48, w: 150, h: 128 };
  const solid = { x: kiosk.x + 8, y: kiosk.y + 70, w: kiosk.w - 16, h: 50 };
  if (typeof obstacles !== 'undefined') {
    const exists = obstacles.some(function (o) { return o._luxeKiosk; });
    if (!exists) obstacles.push({ x: solid.x, y: solid.y, w: solid.w, h: solid.h, _luxeKiosk: true });
  }

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
    ctx.fillStyle = 'rgba(210,198,170,0.22)';
    ctx.fillRect(cx - 22, P.y + 28, 44, P.h - 56);
    ctx.fillRect(P.x + 40, cy - 16, P.w - 80, 32);
    ctx.fillStyle = 'rgba(70,150,190,0.22)';
    ctx.beginPath();
    ctx.ellipse(P.x + 90, P.y + P.h - 70, 70, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(231,197,106,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + 10, cy + 8, 46, 0, Math.PI * 2);
    ctx.stroke();
  }

  function draw() {
    if (typeof ctx === 'undefined' || typeof camera === 'undefined') return;
    const z = (CONFIG && CONFIG.zoom) || 1;
    const foot = (typeof localPlayer !== 'undefined' && localPlayer) ? (localPlayer.y + (localPlayer.radius || 16)) : 0;
    const boothBase = kiosk.y + kiosk.h;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    pathAndWater();
    const playerInFront = foot >= boothBase - 8;
    if (!playerInFront) booth();
    if (typeof renderAvatar === 'function') {
      if (typeof simulatedPlayers !== 'undefined') simulatedPlayers.forEach(function (p) { renderAvatar(p, false); });
      if (typeof localPlayer !== 'undefined') renderAvatar(localPlayer, true);
    }
    if (playerInFront) booth();
    ctx.restore();
  }

  if (typeof render === 'function') {
    const prev = render;
    render = function () { prev(); draw(); };
  }
  window.KELO_LUXE_COMPOSE = { kiosk: kiosk, solid: solid };
})();
