(function () {
  const T = window.KELO_TILE || 32;
  const OX = 1024, OY = 1216;
  const box = { x: OX + 18 * T, y: OY + 14 * T, w: 5 * T, h: 3 * T };
  const door = { x: box.x + box.w / 2, y: box.y + box.h };
  const room = { x: box.x + 8, y: box.y + 20, w: box.w - 16, h: box.h + 8 };
  const spawnIn = { x: door.x, y: box.y + box.h * 0.62 };
  const spawnOut = { x: door.x, y: door.y + 44 };
  window.keloZone = 'plaza';
  window.keloCafe = { box: box, door: door, room: room };
  let lock = 0;

  obstacles.forEach(function (o) {
    if (Math.abs(o.x - box.x) < 4 && Math.abs(o.y - box.y) < 4) {
      o._cafe = true;
      o._ow = o.w;
      o._oh = o.h;
    }
  });

  function cafeSolid(on) {
    obstacles.forEach(function (o) {
      if (!o._cafe) return;
      if (on) { o.w = o._ow; o.h = o._oh; }
      else { o.w = 0; o.h = 0; }
    });
  }

  function snap() {
    localPlayer.vx = 0;
    localPlayer.vy = 0;
    input.normX = 0;
    input.normY = 0;
    camera.x = camera.targetX = localPlayer.x;
    camera.y = camera.targetY = localPlayer.y;
    lock = 0.45;
  }

  function enterCafe() {
    if (window.keloZone === 'cafe' || lock > 0) return;
    window.keloZone = 'cafe';
    cafeSolid(false);
    localPlayer.x = spawnIn.x;
    localPlayer.y = spawnIn.y;
    snap();
    const bar = document.getElementById('action-bar-container');
    if (bar) bar.style.display = 'none';
    if (typeof showToast === 'function') showToast('Cafe Oro');
  }

  function exitCafe() {
    if (window.keloZone !== 'cafe' || lock > 0) return;
    window.keloZone = 'plaza';
    cafeSolid(true);
    localPlayer.x = spawnOut.x;
    localPlayer.y = spawnOut.y;
    snap();
    const bar = document.getElementById('action-bar-container');
    if (bar) bar.style.display = '';
    if (typeof showToast === 'function') showToast('Plaza');
  }

  window.enterCafe = enterCafe;
  window.exitCafe = exitCafe;

  const btn = document.createElement('button');
  btn.className = 'btn-panel-toggle';
  btn.id = 'kelo-cafe-btn';
  btn.textContent = 'Cafe';
  btn.style.pointerEvents = 'auto';
  btn.onclick = function (e) {
    e.stopPropagation();
    if (window.keloZone === 'cafe') exitCafe();
    else enterCafe();
  };
  const top = document.querySelector('.top-bar div:last-child');
  if (top && !document.getElementById('kelo-cafe-btn')) top.insertBefore(btn, top.firstChild);

  function atDoor() {
    return Math.abs(localPlayer.x - door.x) < 20 &&
      localPlayer.y > door.y - 6 &&
      localPlayer.y < door.y + 32;
  }

  const _move = updateMovement;
  updateMovement = function (dt) {
    if (lock > 0) lock -= dt;
    _move(dt);
    if (lock > 0) return;
    if (window.keloZone === 'plaza' && atDoor() && (localPlayer.vy || 0) < -12) {
      enterCafe();
      return;
    }
    if (window.keloZone === 'cafe') {
      localPlayer.x = Math.max(room.x + 16, Math.min(room.x + room.w - 16, localPlayer.x));
      localPlayer.y = Math.max(room.y + 16, Math.min(room.y + room.h - 10, localPlayer.y));
      if (localPlayer.y > door.y + 6 && (localPlayer.vy || 0) > 14) exitCafe();
    }
  };

  function drawInterior(c) {
    const r = room;
    c.fillStyle = '#1a120c';
    c.fillRect(box.x - 6, box.y - 10, box.w + 12, box.h + 28);
    c.fillStyle = '#3a2a1c';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = '#c9a24a';
    c.lineWidth = 2;
    c.strokeRect(r.x, r.y, r.w, r.h);
    c.fillStyle = '#5a3a22';
    c.fillRect(r.x + 8, r.y + 8, r.w - 16, 18);
    c.fillStyle = '#e7c56a';
    c.fillRect(r.x + 8, r.y + 26, r.w - 16, 3);
    c.fillStyle = '#241810';
    c.fillRect(r.x + 16, r.y + 40, 22, 18);
    c.fillRect(r.x + r.w / 2 - 11, r.y + 40, 22, 18);
    c.fillRect(r.x + r.w - 38, r.y + 40, 22, 18);
    c.fillStyle = '#140e0a';
    c.fillRect(door.x - 12, door.y - 8, 24, 12);
    c.fillStyle = '#e7c56a';
    c.font = 'bold 11px sans-serif';
    c.textAlign = 'center';
    c.fillText('Cafe Oro', box.x + box.w / 2, box.y - 14);
    c.font = '10px sans-serif';
    c.fillText('abajo o boton Cafe', box.x + box.w / 2, door.y + 18);
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
    } else {
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(door.x - 12, door.y - 5, 24, 10);
      ctx.fillStyle = '#1a120c';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CAFE', door.x, door.y + 3);
    }
    ctx.restore();
  };
})();
