(function () {
  const npcs = [
    { id: 'portero', name: 'Portero', x: 1320, y: 1580, color: '#8ab4ff', line: 'Bienvenido a la Plaza Kelo. El Joyero espera a tu derecha.' },
    { id: 'joyero', name: 'Joyero', x: 1520, y: 1520, color: '#e7c56a', line: 'Corta en el brillo. Si aciertas, hay KC.' }
  ];
  window.keloNpcs = npcs;

  let near = null;
  let talkOpen = false;
  let game = { on: false, t: 0, hit: 0.62, hold: false };

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function closest() {
    let best = null, bestD = 64;
    npcs.forEach(function (n) {
      const d = dist(localPlayer, n);
      if (d < bestD) { best = n; bestD = d; }
    });
    return best;
  }

  function reward(ok) {
    if (!STATE) return;
    if (ok) {
      STATE.kc = (STATE.kc || 0) + 8;
      STATE.gold = (STATE.gold || 0) + 15;
      if (typeof showToast === 'function') showToast('Corte limpio +8 KC +15 oro');
    } else if (typeof showToast === 'function') showToast('Fallaste el brillo');
    if (typeof saveState === 'function') saveState();
    if (typeof updateHud === 'function') updateHud();
  }

  function startCut() {
    game.on = true;
    game.t = 0;
    talkOpen = false;
  }

  function tryCut() {
    if (!game.on) return;
    const pos = (Math.sin(game.t * 3.2) + 1) / 2;
    const ok = Math.abs(pos - game.hit) < 0.09;
    game.on = false;
    reward(ok);
  }

  window.addEventListener('keydown', function (e) {
    if (e.key === 'e' || e.key === 'E') {
      if (game.on) { tryCut(); return; }
      near = closest();
      if (near) talkOpen = !talkOpen;
    }
    if (e.key === ' ' && game.on) tryCut();
  });

  window.addEventListener('pointerdown', function (e) {
    if (game.on) {
      e.preventDefault();
      tryCut();
      return;
    }
    if (!near) return;
    const top = e.target && e.target.id === 'npc-talk-go';
    if (top) return;
  }, true);

  function ensureUi() {
    if (document.getElementById('npc-talk')) return;
    const box = document.createElement('div');
    box.id = 'npc-talk';
    box.style.cssText = 'display:none;position:absolute;left:10px;right:10px;bottom:118px;z-index:80;pointer-events:auto;background:rgba(10,13,18,.94);border:1px solid #c9a24a;border-radius:12px;padding:12px;color:#eee;font-size:13px';
    box.innerHTML = '<div id="npc-talk-name" style="color:#e7c56a;font-weight:700;margin-bottom:6px"></div><div id="npc-talk-line" style="margin-bottom:10px"></div><button id="npc-talk-go" style="background:#9e6a03;border:1px solid #e5a93c;color:#fff;padding:8px 12px;border-radius:8px;font-weight:700">OK</button>';
    document.body.appendChild(box);
    document.getElementById('npc-talk-go').addEventListener('click', function () {
      if (near && near.id === 'joyero') startCut();
      else talkOpen = false;
    });
    const hint = document.createElement('div');
    hint.id = 'npc-hint';
    hint.style.cssText = 'display:none;position:absolute;left:50%;bottom:210px;transform:translateX(-50%);z-index:70;color:#e7c56a;font-size:12px;background:rgba(0,0,0,.55);padding:6px 10px;border-radius:999px;pointer-events:none';
    hint.textContent = 'Hablar';
    document.body.appendChild(hint);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUi);
  else ensureUi();

  const _upd = updateSimulation;
  updateSimulation = function (dt) {
    _upd(dt);
    near = closest();
    if (game.on) game.t += dt;
    const hint = document.getElementById('npc-hint');
    const box = document.getElementById('npc-talk');
    if (hint) hint.style.display = (!talkOpen && !game.on && near) ? 'block' : 'none';
    if (box) {
      box.style.display = talkOpen && near ? 'block' : 'none';
      if (talkOpen && near) {
        document.getElementById('npc-talk-name').textContent = near.name;
        document.getElementById('npc-talk-line').textContent = near.line;
        document.getElementById('npc-talk-go').textContent = near.id === 'joyero' ? 'Cortar' : 'Cerrar';
      }
    }
  };

  const _r = render;
  render = function () {
    _r();
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    npcs.forEach(function (n) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(n.x, n.y + 16, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = n.color;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(n.name, n.x, n.y - 22);
    });
    ctx.restore();

    if (game.on) {
      const pos = (Math.sin(game.t * 3.2) + 1) / 2;
      const x = 24, y = screenH * 0.38, w = screenW - 48, h = 28;
      ctx.fillStyle = 'rgba(8,10,14,0.82)';
      ctx.fillRect(x - 8, y - 36, w + 16, 78);
      ctx.fillStyle = '#e7c56a';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Toca cuando entre en el brillo', screenW / 2, y - 14);
      ctx.fillStyle = '#1b2230';
      ctx.fillRect(x, y, w, h);
      const zx = x + w * (game.hit - 0.08);
      ctx.fillStyle = 'rgba(231,197,106,0.55)';
      ctx.fillRect(zx, y, w * 0.16, h);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + w * pos - 3, y - 4, 6, h + 8);
    }
  };
})();
