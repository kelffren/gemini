(function () {
  // Unico sistema de Cafe Oro. Interior SOBRE el edificio de la plaza, no en 2360,2360.
  const T = window.KELO_TILE || 32;
  const OX = 1024, OY = 1216;
  const box = { x: OX + 18 * T, y: OY + 14 * T, w: 5 * T, h: 3 * T };
  const door = { x: box.x + box.w / 2, y: box.y + box.h };
  const room = { x: box.x - 8, y: box.y - 8, w: box.w + 16, h: box.h + 40 };
  const spawnIn = { x: door.x, y: door.y - 28 };
  const spawnOut = { x: door.x, y: door.y + 36 };
  window.keloZone = window.keloZone || 'plaza';
  window.keloCafe = { box: box, door: door, room: room };

  function snapCam() {
    camera.x = camera.targetX = localPlayer.x;
    camera.y = camera.targetY = localPlayer.y;
    localPlayer.vx = 0;
    localPlayer.vy = 0;
  }

  function enterCafe() {
    if (window.keloZone === 'cafe') return;
    window.keloZone = 'cafe';
    localPlayer.x = spawnIn.x;
    localPlayer.y = spawnIn.y;
    snapCam();
    const bar = document.getElementById('action-bar-container');
    if (bar) bar.style.display = 'none';
    if (typeof showToast === 'function') showToast('Cafe Oro');
  }

  function exitCafe() {
    if (window.keloZone !== 'cafe') return;
    window.keloZone = 'plaza';
    localPlayer.x = spawnOut.x;
    localPlayer.y = spawnOut.y;
    snapCam();
    const bar = document.getElementById('action-bar-container');
    if (bar) bar.style.display = '';
    if (typeof showToast === 'function') showToast('Plaza');
  }

  window.enterCafe = enterCafe;
  window.exitCafe = exitCafe;

  function atDoor() {
    return Math.abs(localPlayer.x - door.x) < 22 &&
      localPlayer.y > door.y - 10 &&
      localPlayer.y < door.y + 28;
  }

  const _move = updateMovement;
  updateMovement = function (dt) {
    _move(dt);
    if (window.keloZone === 'plaza' && atDoor() && (localPlayer.vy || 0) < -8) {
      enterCafe();
    }
    if (window.keloZone === 'cafe') {
      localPlayer.x = Math.max(room.x + 18, Math.min(room.x + room.w - 18, localPlayer.x));
      localPlayer.y = Math.max(room.y + 22, Math.min(room.y + room.h - 8, localPlayer.y));
      if (localPlayer.y > door.y + 8 && (localPlayer.vy || 0) > 10) exitCafe();
    }
  };

  function drawInterior(ctx) {
    const r = room;
    ctx.fillStyle = 'rgba(8,6,5,0.88)';
    ctx.fillRect(r.x - 12, r.y - 20, r.w + 24, r.h + 36);
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(r.x + 10, r.y + 10, r.w - 20, 28);
    ctx.fillStyle = '#e7c56a';
    ctx.fillRect(r.x + 10, r.y + 36, r.w - 20, 3);
    ctx.fillStyle = '#241810';
    [[18, 58], [70, 58], [122, 58]].forEach(function (t) {
      ctx.fillRect(r.x + t[0], r.y + t[1], 28, 24);
    });
    ctx.fillStyle = '#8a2020';
    ctx.beginPath();
    ctx.arc(r.x + 32, r.y + 68, 4, 0, Math.PI * 2);
    ctx.arc(r.x + 84, r.y + 68, 4, 0, Math.PI * 2);
    ctx.arc(r.x + 136, r.y + 68, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#140e0a';
    ctx.fillRect(door.x - 16, door.y - 4, 32, 14);
    ctx.fillStyle = '#e7c56a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Cafe Oro', r.x + r.w / 2, r.y - 6);
    ctx.font = '10px sans-serif';
    ctx.fillText('abajo para salir', r.x + r.w / 2, door.y + 22);
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
      drawInterior(ctx);
      if (typeof renderAvatar === 'function') renderAvatar(localPlayer, true);
    } else {
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(door.x - 14, door.y - 6, 28, 12);
      ctx.fillStyle = '#1a120c';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CAFE', door.x, door.y + 3);
    }
    ctx.restore();
  };
})();
