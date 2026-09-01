(function () {
  const params = new URLSearchParams(location.search);
  const NET = params.get('net');
  window.keloNet = { on: false, id: null, peers: {}, url: NET };

  function ensureChip() {
    let chip = document.getElementById('kelo-online');
    if (chip) return chip;
    chip = document.createElement('div');
    chip.id = 'kelo-online';
    chip.style.cssText = [
      'position:absolute',
      'top:max(8px,env(safe-area-inset-top))',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:80',
      'pointer-events:none',
      'display:flex',
      'align-items:center',
      'gap:6px',
      'padding:6px 12px',
      'border-radius:999px',
      'background:rgba(10,13,18,.92)',
      'border:1px solid rgba(231,197,106,.35)',
      'color:#e7c56a',
      'font:700 11px/1.2 -apple-system,sans-serif',
      'white-space:nowrap',
      'box-shadow:0 6px 18px rgba(0,0,0,.35)'
    ].join(';');
    document.body.appendChild(chip);
    return chip;
  }

  function paintChip(state, n) {
    const chip = ensureChip();
    const dot = state === 'on' ? '#3ddc84' : (state === 'wait' ? '#e7c56a' : '#8a9099');
    const label =
      state === 'on' ? ('En línea  ·  ' + n) :
      state === 'wait' ? 'Conectando…' :
      state === 'err' ? 'Sin señal' :
      'Solo local';
    chip.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:' + dot +
      ';box-shadow:0 0 8px ' + dot + '"></span><span>' + label + '</span>';
  }

  function countOnline() {
    const others = Object.keys(window.keloNet.peers || {}).length;
    return window.keloNet.on ? (1 + others) : 0;
  }

  if (!NET) {
    paintChip('off', 0);
    return;
  }

  let ws = null;
  let myId = null;
  const peers = window.keloNet.peers;
  let sendAcc = 0;

  function connect() {
    try { ws = new WebSocket(NET); } catch (e) {
      paintChip('err', 0);
      return;
    }
    paintChip('wait', 0);
    ws.onopen = function () {
      window.keloNet.on = true;
      ws.send(JSON.stringify({ t: 'hello', name: (localPlayer && localPlayer.name) || 'Kelo' }));
      paintChip('on', countOnline());
    };
    ws.onclose = function () {
      window.keloNet.on = false;
      paintChip('err', 0);
      setTimeout(connect, 1500);
    };
    ws.onerror = function () { paintChip('err', 0); };
    ws.onmessage = function (ev) {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.t === 'welcome') {
        myId = msg.id;
        window.keloNet.id = myId;
        ingest(msg.players);
      }
      if (msg.t === 'state') ingest(msg.players);
      if (msg.t === 'join' && msg.player) upsert(msg.player);
      if (msg.t === 'leave' && msg.id) {
        delete peers[msg.id];
        paintChip(window.keloNet.on ? 'on' : 'err', countOnline());
      }
    };
  }

  function upsert(p) {
    if (!p || !p.id || p.id === myId) return;
    const prev = peers[p.id] || {
      id: p.id, name: p.name || 'Kelo', x: p.x, y: p.y,
      vx: 0, vy: 0, radius: 20, hp: 100, maxHp: 100,
      gear: { bodyColor: '#7b6cff', armorColor: '#e7c56a', weaponColor: '#fff' },
      _face: p.face || 'down', _gait: p.gait || 'idle', targetX: p.x, targetY: p.y,
    };
    prev.name = p.name || prev.name;
    prev.targetX = p.x;
    prev.targetY = p.y;
    prev._face = p.face || prev._face;
    prev._gait = p.gait || 'walk';
    peers[p.id] = prev;
    paintChip('on', countOnline());
  }

  function ingest(map) {
    if (!map) return;
    const live = {};
    Object.keys(map).forEach(function (id) {
      live[id] = true;
      upsert(map[id]);
    });
    Object.keys(peers).forEach(function (id) {
      if (!live[id]) delete peers[id];
    });
    paintChip(window.keloNet.on ? 'on' : 'wait', countOnline());
  }

  connect();

  const _sim = updateSimulation;
  updateSimulation = function (dt) {
    _sim(dt);
    sendAcc += dt;
    if (ws && ws.readyState === 1 && localPlayer && sendAcc > 0.1) {
      sendAcc = 0;
      ws.send(JSON.stringify({
        t: 'pose',
        x: localPlayer.x,
        y: localPlayer.y,
        face: localPlayer._face || 'down',
        gait: localPlayer._gait || 'idle',
        zone: window.keloZone || 'plaza',
      }));
    }
    Object.keys(peers).forEach(function (id) {
      const p = peers[id];
      const tx = p.targetX != null ? p.targetX : p.x;
      const ty = p.targetY != null ? p.targetY : p.y;
      p.x += (tx - p.x) * Math.min(1, 12 * dt);
      p.y += (ty - p.y) * Math.min(1, 12 * dt);
    });
  };

  const _render = render;
  render = function () {
    _render();
    if (typeof renderAvatar !== 'function') return;
    const ids = Object.keys(peers);
    if (!ids.length) return;
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    ids.forEach(function (id) { renderAvatar(peers[id], false); });
    ctx.restore();
  };
})();
