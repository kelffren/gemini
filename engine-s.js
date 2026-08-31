(function () {
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
  const BOT_LINES = ['esa vitrina', 'voy al cafe', 'quien es el Rey', 'bonita plaza', 'trade?'];
  let walkT = 0;
  window.keloBubbles = bubbles;

  function worldFromEvent(e) {
    const z = CONFIG.zoom || 1;
    return { x: camera.x + (e.clientX - screenW / 2) / z, y: camera.y + (e.clientY - screenH / 2) / z };
  }

  window.addEventListener('pointerup', function (e) {
    if (e.target && e.target.closest && (e.target.closest('#ui-layer') || e.target.closest('.stone-slot') || e.target.closest('#kelo-chat'))) return;
    const w = worldFromEvent(e);
    if (typeof simulatedPlayers !== 'undefined') {
      simulatedPlayers.forEach(function (bot) {
        if (Math.hypot(w.x - bot.x, w.y - bot.y) < 22 && typeof inspectPlayer === 'function') inspectPlayer(bot, false);
      });
    }
  });

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
    wrap.innerHTML = '<div id="kelo-chat-log" style="max-height:70px;overflow:auto;background:rgba(8,10,14,.55);color:#ddd;padding:4px 6px;border-radius:8px;margin-bottom:4px"></div><form id="kelo-chat-form" style="display:flex;gap:4px"><input id="kelo-chat-in" maxlength="80" placeholder="Escribir mensaje..." style="flex:1;background:rgba(10,13,18,.85);border:1px solid #3a465c;color:#eee;border-radius:8px;padding:6px 8px"><button style="background:#9e6a03;border:0;color:#fff;border-radius:8px;padding:6px 8px">OK</button></form>';
    document.body.appendChild(wrap);
    document.getElementById('kelo-chat-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const inp = document.getElementById('kelo-chat-in');
      const t = (inp.value || '').trim();
      if (!t) return;
      say(localPlayer.name || 'Tu', t);
      inp.value = '';
    });
    const bag = document.createElement('button');
    bag.textContent = 'Mochila';
    bag.style.cssText = 'position:absolute;bottom:118px;right:10px;z-index:90;pointer-events:auto;background:rgba(16,20,28,.9);color:#e7c56a;border:1px solid #c9a24a;border-radius:10px;padding:7px 10px;font-size:11px';
    bag.onclick = function () {
      const p = document.getElementById('kelo-bag');
      p.style.display = p.style.display === 'block' ? 'none' : 'block';
    };
    document.body.appendChild(bag);
    const panel = document.createElement('div');
    panel.id = 'kelo-bag';
    panel.style.cssText = 'display:none;position:absolute;top:84px;right:8px;width:180px;z-index:91;background:rgba(13,17,23,.96);border:1px solid #c9a24a;border-radius:10px;padding:10px;color:#ddd;font-size:12px;pointer-events:auto';
    panel.innerHTML = '<b style="color:#e7c56a">Inventario</b><div>Gema x1</div><div>Reloj x1</div>';
    document.body.appendChild(panel);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureChat);
  else ensureChat();

  const _upd = updateSimulation;
  updateSimulation = function (dt) {
    _upd(dt);
    walkT += dt;
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
    const fountainX = 1440, fountainY = 1510;
    ctx.fillStyle = '#1a3048';
    ctx.beginPath();
    ctx.arc(fountainX, fountainY, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(142,202,230,' + (0.35 + Math.sin(walkT * 3) * 0.12) + ')';
    ctx.beginPath();
    ctx.arc(fountainX, fountainY, 16 + Math.sin(walkT * 4) * 2, 0, Math.PI * 2);
    ctx.fill();
    bubbles.forEach(function (bu) {
      let x = localPlayer.x, y = localPlayer.y - 38;
      const who = simulatedPlayers.find(function (p) { return p.name === bu.name; });
      if (who) { x = who.x; y = who.y - 38; }
      if (bu.name === (localPlayer.name || 'Tu') || (bu.name && bu.name.indexOf('Pioneer') >= 0)) {
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
  };
})();
