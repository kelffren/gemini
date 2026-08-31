(function () {
  const dummy = {
    id: 'dummy_plaza',
    name: 'Dummy',
    x: 1580,
    y: 1680,
    radius: 22,
    hp: 80,
    maxHp: 80,
    dead: false,
    respawnIn: 0,
    gear: { bodyColor: '#6b5b4a', armorColor: '#c9a24a', weaponColor: '#888' }
  };
  window.trainingDummy = dummy;

  function drawHp(p) {
    if (!p || p.hp == null) return;
    const ratio = Math.max(0, Math.min(1, p.hp / (p.maxHp || 100)));
    const w = 36, h = 4;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(p.x - w / 2, p.y - (p.radius || 20) - 16, w, h);
    ctx.fillStyle = ratio > 0.45 ? '#39d353' : ratio > 0.2 ? '#e3b341' : '#ef476f';
    ctx.fillRect(p.x - w / 2, p.y - (p.radius || 20) - 16, w * ratio, h);
  }

  function hitDummy(dmg) {
    if (dummy.dead) return;
    dummy.hp = Math.max(0, dummy.hp - (dmg || 12));
    if (typeof spawnParticle === 'function') spawnParticle(dummy.x, dummy.y, '#ef476f', 14, 0.25);
    if (dummy.hp <= 0) {
      dummy.dead = true;
      dummy.respawnIn = 3;
      if (typeof showToast === 'function') showToast('Dummy fuera. Reaparece en 3s');
    }
  }

  function nearDummy(x, y, r) {
    return !dummy.dead && Math.hypot(x - dummy.x, y - dummy.y) < (r || 40);
  }

  const _upd = updateSimulation;
  updateSimulation = function (dt) {
    _upd(dt);
    if (dummy.dead) {
      dummy.respawnIn -= dt;
      if (dummy.respawnIn <= 0) {
        dummy.dead = false;
        dummy.hp = dummy.maxHp;
      }
    }
    if (window.skillShots) {
      skillShots.forEach(function (s) {
        if (nearDummy(s.x, s.y, 28) || nearDummy(s.tx, s.ty, 36)) hitDummy(18);
      });
    }
  };

  window.addEventListener('pointerdown', function () {
    if (typeof melee === 'undefined') return;
  }, true);

  const _nRender = render;
  render = function () {
    _nRender();
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    if (!dummy.dead) {
      if (typeof renderAvatar === 'function') renderAvatar(dummy, false);
      else {
        ctx.fillStyle = dummy.gear.bodyColor;
        ctx.beginPath();
        ctx.arc(dummy.x, dummy.y, dummy.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#e7c56a';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DUMMY', dummy.x, dummy.y + dummy.radius + 12);
    } else {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.arc(dummy.x, dummy.y, dummy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    drawHp(localPlayer);
    drawHp(dummy);
    if (typeof simulatedPlayers !== 'undefined') simulatedPlayers.forEach(drawHp);
    ctx.restore();
  };

  const prevMeleeHook = window.addEventListener;
  setInterval(function () {
    if (dummy.dead) return;
    if (Math.hypot(localPlayer.x - dummy.x, localPlayer.y - dummy.y) < 58 && localPlayer.vx + localPlayer.vy !== undefined) {
      /* proximity tag only */
    }
  }, 400);
})();
