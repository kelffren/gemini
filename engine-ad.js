(function () {
  const T = window.KELO_TILE || 32;
  const OX = 1024, OY = 1216;
  const cafeDoor = { x: OX + 18 * T + 2.5 * T, y: OY + 14 * T + 3 * T + 10, r: 36 };
  const cafeRoom = { x: 2360, y: 2360, w: 280, h: 220 };
  const cafeSpawn = { x: 2500, y: 2548 };
  const plazaReturn = { x: cafeDoor.x, y: cafeDoor.y + 28 };
  window.keloZone = 'plaza';
  let hint = 0;

  function enterCafe() {
    if (keloZone === 'cafe') return;
    keloZone = 'cafe';
    localPlayer.x = cafeSpawn.x;
    localPlayer.y = cafeSpawn.y;
    camera.x = localPlayer.x;
    camera.y = localPlayer.y;
    camera.targetX = localPlayer.x;
    camera.targetY = localPlayer.y;
    const bar = document.getElementById('action-bar-container');
    if (bar) bar.style.opacity = '0.25';
  }
  function exitCafe() {
    if (keloZone !== 'cafe') return;
    keloZone = 'plaza';
    localPlayer.x = plazaReturn.x;
    localPlayer.y = plazaReturn.y;
    camera.x = localPlayer.x;
    camera.y = localPlayer.y;
    camera.targetX = localPlayer.x;
    camera.targetY = localPlayer.y;
    const bar = document.getElementById('action-bar-container');
    if (bar) bar.style.opacity = '0.88';
  }
  window.enterCafe = enterCafe;
  window.exitCafe = exitCafe;

  const _sim = updateSimulation;
  updateSimulation = function (dt) {
    _sim(dt);
    if (keloZone === 'plaza') {
      const d = Math.hypot(localPlayer.x - cafeDoor.x, localPlayer.y - cafeDoor.y);
      hint = d < cafeDoor.r ? 1 : 0;
      if (d < 22) enterCafe();
    } else {
      if (localPlayer.y > cafeRoom.y + cafeRoom.h - 18) exitCafe();
      localPlayer.x = Math.max(cafeRoom.x + 20, Math.min(cafeRoom.x + cafeRoom.w - 20, localPlayer.x));
      localPlayer.y = Math.max(cafeRoom.y + 36, Math.min(cafeRoom.y + cafeRoom.h - 12, localPlayer.y));
    }
  };

  function drawCafe(ctx) {
    const r = cafeRoom;
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(r.x - 40, r.y - 40, r.w + 80, r.h + 80);
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#2a1e14';
    for (let x = r.x; x < r.x + r.w; x += 28) {
      for (let y = r.y; y < r.y + r.h; y += 28) {
        ctx.fillRect(x, y, 26, 26);
      }
    }
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(r.x + 20, r.y + 18, r.w - 40, 36);
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(r.x + 20, r.y + 50, r.w - 40, 4);
    ctx.fillStyle = '#241810';
    ctx.fillRect(r.x + 40, r.y + 110, 36, 36);
    ctx.fillRect(r.x + 120, r.y + 110, 36, 36);
    ctx.fillRect(r.x + 200, r.y + 110, 36, 36);
    ctx.fillStyle = '#6a4a28';
    ctx.fillRect(r.x + 38, r.y + 128, 40, 8);
    ctx.fillRect(r.x + 118, r.y + 128, 40, 8);
    ctx.fillRect(r.x + 198, r.y + 128, 40, 8);
    ctx.fillStyle = '#8a2020';
    ctx.beginPath();
    ctx.arc(r.x + 58, r.y + 124, 5, 0, Math.PI * 2);
    ctx.arc(r.x + 138, r.y + 124, 5, 0, Math.PI * 2);
    ctx.arc(r.x + 218, r.y + 124, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#140e0a';
    ctx.fillRect(r.x + r.w / 2 - 22, r.y + r.h - 16, 44, 16);
    ctx.fillStyle = '#e7c56a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Caf\u00e9 Oro', r.x + r.w / 2, r.y - 10);
    ctx.font = '10px sans-serif';
    ctx.fillText('salir \u2193', r.x + r.w / 2, r.y + r.h - 20);
  }

  const _r = render;
  render = function () {
    _r();
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    if (keloZone === 'cafe') {
      drawCafe(ctx);
      renderAvatar(localPlayer, true);
    } else if (hint) {
      ctx.fillStyle = 'rgba(10,13,18,0.85)';
      ctx.fillRect(cafeDoor.x - 54, cafeDoor.y - 38, 108, 22);
      ctx.fillStyle = '#e7c56a';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Entrar Caf\u00e9 Oro', cafeDoor.x, cafeDoor.y - 23);
    }
    ctx.restore();
  };
})();
