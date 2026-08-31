(function () {
  const BUILDINGS = [
    { id: 'mercado', name: 'Mercado', x: 1180, y: 1288, w: 150, h: 110, door: 'PRÓXIMAMENTE' },
    { id: 'banco', name: 'Banco', x: 1688, y: 1380, w: 130, h: 100, door: 'PRÓXIMAMENTE' },
    { id: 'ropa', name: 'Atelier', x: 1088, y: 1488, w: 120, h: 96, door: 'PRÓXIMAMENTE' },
    { id: 'aptos', name: 'Residencias', x: 1660, y: 1688, w: 160, h: 120, door: 'PRÓXIMAMENTE' },
    { id: 'cafe', name: 'Café Oro', x: 1120, y: 1700, w: 140, h: 100, door: 'PRÓXIMAMENTE' },
    { id: 'salida', name: 'Salida', x: 1420, y: 1220, w: 80, h: 36, door: 'Camino cerrado' }
  ];
  BUILDINGS.forEach(function (b) {
    obstacles.push({ x: b.x, y: b.y, w: b.w, h: b.h });
  });

  const EXTRA = [
    { id: 'b3', name: 'Andrea', x: 1460, y: 1500, targetX: 1460, targetY: 1500, hp: 100, maxHp: 100, radius: 16, gear: { bodyColor: '#d4a5c9', armorColor: '#fff', weaponColor: '#e7c56a' } },
    { id: 'b4', name: 'Trader01', x: 1380, y: 1620, targetX: 1380, targetY: 1620, hp: 100, maxHp: 100, radius: 16, gear: { bodyColor: '#3d8b6e', armorColor: '#c9a24a', weaponColor: '#fff' } },
    { id: 'b5', name: 'DiamondKing', x: 1550, y: 1570, targetX: 1550, targetY: 1570, hp: 100, maxHp: 100, radius: 16, gear: { bodyColor: '#2a2a32', armorColor: '#e7c56a', weaponColor: '#ef476f' } },
    { id: 'b6', name: 'Kelo', x: 1490, y: 1710, targetX: 1490, targetY: 1710, hp: 100, maxHp: 100, radius: 16, gear: { bodyColor: '#4b6cb7', armorColor: '#d4af37', weaponColor: '#fff' } },
    { id: 'b7', name: 'Nova', x: 1288, y: 1644, targetX: 1288, targetY: 1644, hp: 100, maxHp: 100, radius: 16, gear: { bodyColor: '#7b4b94', armorColor: '#eee', weaponColor: '#88f' } }
  ];
  if (typeof simulatedPlayers !== 'undefined') {
    EXTRA.forEach(function (p) { simulatedPlayers.push(p); });
  }

  const bubbles = [];
  const BOT_LINES = ['esa vitrina', 'voy al café', 'quién es el Rey', 'bonita plaza', 'trade?'];
  let walkT = 0;
  let nav = null;
  let doorMsg = null;
  let doorT = 0;

  function dirFromVel(vx, vy) {
    if (Math.abs(vx) + Math.abs(vy) < 8) return 'idle';
    if (Math.abs(vx) > Math.abs(vy)) return vx > 0 ? 'right' : 'left';
    return vy > 0 ? 'down' : 'up';
  }

  function drawPixelPerson(ctx, p, isSelf) {
    const vx = p.vx || 0, vy = p.vy || 0;
    const moving = Math.hypot(vx, vy) > 12 || (p.targetX && Math.hypot((p.targetX || p.x) - p.x, (p.targetY || p.y) - p.y) > 8);
    const d = dirFromVel(vx || ((p.targetX || p.x) - p.x), vy || ((p.targetY || p.y) - p.y));
    const frame = moving ? (Math.floor(walkT * 8) % 2) : 0;
    const s = 3;
    const body = (p.gear && p.gear.bodyColor) || '#4aa';
    const acc = (p.gear && p.gear.armorColor) || '#e7c56a';
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 8, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    const leg = frame ? 3 : -3;
    ctx.fillStyle = '#2a2430';
    ctx.fillRect(-5, 4, 4, 7 + (moving ? (frame ? 1 : -1) : 0));
    ctx.fillRect(1, 4, 4, 7 + (moving ? (frame ? -1 : 1) : 0));
    ctx.fillStyle = body;
    ctx.fillRect(-6, -8, 12, 13);
    ctx.fillStyle = acc;
    ctx.fillRect(-6, -2, 12, 3);
    ctx.fillStyle = '#f0d0b0';
    ctx.fillRect(-4, -16, 8, 8);
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(-4, -17, 8, 3);
    if (d === 'left') ctx.fillRect(-7, -14, 2, 2);
    if (d === 'right') ctx.fillRect(5, -14, 2, 2);
    ctx.fillStyle = acc;
    ctx.fillRect(-3, -19, 6, 3);
    ctx.restore();
    ctx.fillStyle = isSelf ? '#e7c56a' : '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || 'Kelo', p.x, p.y - 24);
  }

  const _av = renderAvatar;
  renderAvatar = function (p, isSelf) {
    drawPixelPerson(ctx, p, isSelf);
  };

  function worldFromEvent(e) {
    const z = CONFIG.zoom || 1;
    return {
      x: camera.x + (e.clientX - screenW / 2) / z,
      y: camera.y + (e.clientY - screenH / 2) / z
    };
  }

  window.addEventListener('pointerup', function (e) {
    if (e.target && e.target.closest && (e.target.closest('#ui-layer') || e.target.closest('.stone-slot') || e.target.closest('#kelo-chat') || e.target.closest('#npc-talk'))) return;
    const w = worldFromEvent(e);
    BUILDINGS.forEach(function (b) {
      if (w.x > b.x && w.x < b.x + b.w && w.y > b.y && w.y < b.y + b.h + 18) {
        doorMsg = b.name + ' — ' + b.door;
        doorT = 2.2;
      }
    });
    if (typeof simulatedPlayers !== 'undefined') {
      simulatedPlayers.forEach(function (bot) {
        if (Math.hypot(w.x - bot.x, w.y - bot.y) < 22) {
          if (typeof inspectPlayer === 'function') inspectPlayer(bot, false);
        }
      });
    }
    if (e.clientX < screenW * 0.55) return;
    nav = w;
  });

  const _move = updateMovement;
  updateMovement = function (dt) {
    if (nav && !(input.touchActive && eNearStick())) {
      const dx = nav.x - localPlayer.x, dy = nav.y - localPlayer.y;
      const d = Math.hypot(dx, dy);
      if (d < 10) nav = null;
      else if (!input.touchActive && !input.keys.w && !input.keys.a && !input.keys.s && !input.keys.d) {
        input.normX = dx / d;
        input.normY = dy / d;
      }
    }
    _move(dt);
  };
  function eNearStick() { return input.touchActive; }

  function say(who, text) {
    bubbles.push({ name: who, text: text, x: 0, y: 0, t: 3.2 });
    const log = document.getElementById('kelo-chat-log');
    if (log) {
      const row = document.createElement('div');
      row.textContent = who + ': ' + text;
      log.appendChild(row);
      log.scrollTop = log.scrollHeight;
    }
  }
  window.keloSay = say;

  function ensureChat() {
    if (document.getElementById('kelo-chat')) return;
    const wrap = document.createElement('div');
    wrap.id = 'kelo-chat';
    wrap.style.cssText = 'position:absolute;left:8px;bottom:10px;width:min(230px,48vw);z-index:90;pointer-events:auto;font-size:11px';
    wrap.innerHTML = '<div id="kelo-chat-log" style="max-height:70px;overflow:auto;background:rgba(8,10,14,.55);color:#ddd;padding:4px 6px;border-radius:8px;margin-bottom:4px"></div><form id="kelo-chat-form" style="display:flex;gap:4px"><input id="kelo-chat-in" maxlength="80" placeholder="Escribir mensaje…" style="flex:1;background:rgba(10,13,18,.85);border:1px solid #3a465c;color:#eee;border-radius:8px;padding:6px 8px"><button style="background:#9e6a03;border:0;color:#fff;border-radius:8px;padding:6px 8px">OK</button></form>';
    document.body.appendChild(wrap);
    document.getElementById('kelo-chat-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const inp = document.getElementById('kelo-chat-in');
      const t = (inp.value || '').trim();
      if (!t) return;
      say(localPlayer.name || 'Tú', t);
      inp.value = '';
    });
    const bag = document.createElement('button');
    bag.textContent = 'Mochila';
    bag.style.cssText = 'position:absolute;top:48px;right:8px;z-index:90;pointer-events:auto;background:rgba(16,20,28,.9);color:#e7c56a;border:1px solid #c9a24a;border-radius:10px;padding:7px 10px;font-size:11px';
    bag.onclick = function () {
      const p = document.getElementById('kelo-bag');
      p.style.display = p.style.display === 'block' ? 'none' : 'block';
    };
    document.body.appendChild(bag);
    const panel = document.createElement('div');
    panel.id = 'kelo-bag';
    panel.style.cssText = 'display:none;position:absolute;top:84px;right:8px;width:180px;z-index:91;background:rgba(13,17,23,.96);border:1px solid #c9a24a;border-radius:10px;padding:10px;color:#ddd;font-size:12px;pointer-events:auto';
    panel.innerHTML = '<b style="color:#e7c56a">Inventario</b><div>Gema ×1</div><div>Reloj ×1</div><div>Camisa ×1</div><div>Madera ×4</div><div>Huevo ×2</div>';
    document.body.appendChild(panel);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureChat);
  else ensureChat();

  const _upd = updateSimulation;
  updateSimulation = function (dt) {
    _upd(dt);
    walkT += dt;
    if (doorT > 0) doorT -= dt;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      bubbles[i].t -= dt;
      if (bubbles[i].t <= 0) bubbles.splice(i, 1);
    }
    if (Math.random() < 0.003 && simulatedPlayers.length) {
      const b = simulatedPlayers[Math.floor(Math.random() * simulatedPlayers.length)];
      say(b.name, BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)]);
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
    BUILDINGS.forEach(function (b) {
      ctx.fillStyle = 'rgba(18,16,22,0.92)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#c9a24a';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#3a2a18';
      ctx.fillRect(b.x + b.w / 2 - 12, b.y + b.h - 22, 24, 22);
      ctx.fillStyle = '#e7c56a';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y - 6);
    });
    const fountainX = 1440, fountainY = 1510;
    ctx.fillStyle = '#1a3048';
    ctx.beginPath();
    ctx.arc(fountainX, fountainY, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8ecae6';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(142,202,230,' + (0.35 + Math.sin(walkT * 3) * 0.12) + ')';
    ctx.beginPath();
    ctx.arc(fountainX, fountainY, 16 + Math.sin(walkT * 4) * 2, 0, Math.PI * 2);
    ctx.fill();
    bubbles.forEach(function (bu) {
      let x = localPlayer.x, y = localPlayer.y - 38;
      const who = simulatedPlayers.find(function (p) { return p.name === bu.name; });
      if (who) { x = who.x; y = who.y - 38; }
      if (bu.name === (localPlayer.name || 'Tú') || bu.name.indexOf('Pioneer') >= 0) {
        x = localPlayer.x; y = localPlayer.y - 38;
      }
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(x - 40, y - 16, 80, 16);
      ctx.fillStyle = '#111';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bu.text.slice(0, 18), x, y - 4);
    });
    ctx.restore();
    if (doorT > 0 && doorMsg) {
      ctx.fillStyle = 'rgba(10,13,18,0.86)';
      ctx.fillRect(screenW / 2 - 120, 64, 240, 28);
      ctx.fillStyle = '#e7c56a';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(doorMsg, screenW / 2, 83);
    }
  };
})();
