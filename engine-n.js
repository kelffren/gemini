(function () {
  const melee = {
    cd: 0,
    maxCd: 0.42,
    anim: 0,
    dirX: 1,
    dirY: 0,
    reach: 62
  };

  function facing() {
    if (Math.hypot(localPlayer.vx, localPlayer.vy) > 12) {
      const l = Math.hypot(localPlayer.vx, localPlayer.vy);
      return { x: localPlayer.vx / l, y: localPlayer.vy / l };
    }
    if (typeof aim !== 'undefined') return { x: aim.x || 1, y: aim.y || 0 };
    return { x: 1, y: 0 };
  }

  function isUi(el) {
    return !!(el && el.closest && (
      el.closest('.action-bar') ||
      el.closest('.stone-slot') ||
      el.closest('.top-bar') ||
      el.closest('.app-panel') ||
      el.closest('#menu-sheet') ||
      el.closest('#social-modal') ||
      el.closest('.btn-panel-toggle') ||
      el.closest('#build-mode-bar') ||
      el.closest('#pvp-hud')
    ));
  }

  function doMelee() {
    if (melee.cd > 0 || melee.anim > 0) return;
    if (typeof skillAim !== 'undefined' && skillAim.active) return;
    const f = facing();
    melee.dirX = f.x;
    melee.dirY = f.y;
    melee.anim = 0.22;
    melee.cd = melee.maxCd;
    localPlayer.x += f.x * 10;
    localPlayer.y += f.y * 10;
    const hx = localPlayer.x + f.x * melee.reach;
    const hy = localPlayer.y + f.y * melee.reach;
    if (typeof spawnParticle === 'function') {
      for (let i = 0; i < 8; i++) spawnParticle(hx + (Math.random() - 0.5) * 18, hy + (Math.random() - 0.5) * 18, '#ffe08a', 10, 0.22);
    }
    if (typeof simulatedPlayers !== 'undefined') {
      simulatedPlayers.forEach(function (bot) {
        if (Math.hypot(hx - bot.x, hy - bot.y) < 40) {
          spawnParticle(bot.x, bot.y, '#ef476f', 14, 0.3);
        }
      });
    }
  }

  window.addEventListener('pointerdown', function (e) {
    if (e.button != null && e.button !== 0) return;
    if (isUi(e.target)) return;
    if (e.clientX < screenW * 0.52) return;
    e.preventDefault();
    doMelee();
  }, { capture: true });

  const _upd = updateSimulation;
  updateSimulation = function (dt) {
    _upd(dt);
    if (melee.cd > 0) melee.cd = Math.max(0, melee.cd - dt);
    if (melee.anim > 0) melee.anim = Math.max(0, melee.anim - dt);
  };

  function drawMelee() {
    if (melee.anim <= 0) return;
    const t = 1 - melee.anim / 0.22;
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    ctx.translate(localPlayer.x, localPlayer.y);
    ctx.rotate(Math.atan2(melee.dirY, melee.dirX));
    ctx.strokeStyle = 'rgba(255,224,138,' + (1 - t) + ')';
    ctx.fillStyle = 'rgba(255,224,138,' + (0.28 * (1 - t)) + ')';
    ctx.lineWidth = 5;
    const a0 = -0.9 + t * 1.6;
    const a1 = a0 + 1.1;
    ctx.beginPath();
    ctx.arc(18, 0, 34 + t * 10, a0, a1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.arc(18, 0, 40, a0, a1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const _r = render;
  render = function () {
    _r();
    drawMelee();
  };
})();
