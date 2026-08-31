(function () {
  const T = window.KELO_TILE || 32;
  const OX = 1024, OY = 1216;
  const cafeBox = { x: OX + 18 * T, y: OY + 14 * T, w: 5 * T, h: 3 * T };
  // Door sits on the SOUTH face of the building (bottom edge).
  const cafeDoor = { x: cafeBox.x + cafeBox.w / 2, y: cafeBox.y + cafeBox.h };
  const cafeRoom = { x: 2360, y: 2360, w: 280, h: 220 };
  const cafeSpawn = { x: 2500, y: 2535 };
  // Exit just south of the door, outside the building footprint and clear of walls.
  const plazaReturn = { x: cafeDoor.x, y: cafeDoor.y + 70 };
  window.keloZone = 'plaza';

  function enterCafe() {
    if (window.keloZone === 'cafe') return;
    window.keloZone = 'cafe';
    localPlayer.x = cafeSpawn.x;
    localPlayer.y = cafeSpawn.y;
    camera.x = camera.targetX = localPlayer.x;
    camera.y = camera.targetY = localPlayer.y;
    const bar = document.getElementById('action-bar-container');
    if (bar) bar.style.display = 'none';
  }
  function exitCafe() {
    if (window.keloZone !== 'cafe') return;
    window.keloZone = 'plaza';
    localPlayer.x = plazaReturn.x;
    localPlayer.y = plazaReturn.y;
    camera.x = camera.targetX = localPlayer.x;
    camera.y = camera.targetY = localPlayer.y;
    const bar = document.getElementById('action-bar-container');
    if (bar) bar.style.display = '';
  }
  window.enterCafe = enterCafe;
  window.exitCafe = exitCafe;

  const btn = document.createElement('button');
  btn.className = 'btn-panel-toggle';
  btn.textContent = 'Caf\u00e9';
  btn.style.pointerEvents = 'auto';
  btn.onclick = function (e) {
    e.stopPropagation();
    if (window.keloZone === 'cafe') exitCafe();
    else enterCafe();
  };
  const top = document.querySelector('.top-bar div:last-child');
  if (top) top.insertBefore(btn, top.firstChild);

  function nearCafe() {
    return localPlayer.x > cafeBox.x - 20 && localPlayer.x < cafeBox.x + cafeBox.w + 20 &&
      localPlayer.y > cafeBox.y && localPlayer.y < cafeBox.y + cafeBox.h + 55;
  }

  const _move = updateMovement;
  updateMovement = function (dt) {
    _move(dt);
    if (window.keloZone === 'plaza' && nearCafe()) enterCafe();
    if (window.keloZone === 'cafe') {
      if (localPlayer.y > cafeRoom.y + cafeRoom.h - 14) exitCafe();
      localPlayer.x = Math.max(cafeRoom.x + 22, Math.min(cafeRoom.x + cafeRoom.w - 22, localPlayer.x));
      localPlayer.y = Math.max(cafeRoom.y + 40, Math.min(cafeRoom.y + cafeRoom.h - 10, localPlayer.y));
    }
  };

  function drawCafe(ctx) {
    const r = cafeRoom;
    ctx.fillStyle = '#120e0c';
    ctx.fillRect(r.x - 80, r.y - 80, r.w + 160, r.h + 160);
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#c9a24a';
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(r.x + 16, r.y + 16, r.w - 32, 40);
    ctx.fillStyle = '#e7c56a';
    ctx.fillRect(r.x + 16, r.y + 52, r.w - 32, 4);
    ctx.fillStyle = '#241810';
    [[40, 110], [120, 110], [200, 110]].forEach(function (t) {
      ctx.fillRect(r.x + t[0], r.y + t[1], 36, 36);
    });
    ctx.fillStyle = '#8a2020';
    ctx.beginPath();
    ctx.arc(r.x + 58, r.y + 124, 5, 0, Math.PI * 2);
    ctx.arc(r.x + 138, r.y + 124, 5, 0, Math.PI * 2);
    ctx.arc(r.x + 218, r.y + 124, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#140e0a';
    ctx.fillRect(r.x + r.w / 2 - 24, r.y + r.h - 18, 48, 18);
    ctx.fillStyle = '#e7c56a';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Caf\u00e9 Oro', r.x + r.w / 2, r.y - 12);
    ctx.font = '11px sans-serif';
    ctx.fillText('camina abajo para salir', r.x + r.w / 2, r.y + r.h - 22);
  }

  const _r = render;
  render = function () {
    _r();
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    if (window.keloZone === 'cafe') {
      drawCafe(ctx);
      renderAvatar(localPlayer, true);
    } else {
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(cafeDoor.x - 18, cafeDoor.y - 8, 36, 16);
      ctx.fillStyle = '#1a120c';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CAFE', cafeDoor.x, cafeDoor.y + 4);
    }
    ctx.restore();
  };
})();
