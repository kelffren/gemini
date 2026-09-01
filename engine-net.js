(function () {
  const params = new URLSearchParams(location.search);
  const NET = params.get('net');
  window.keloNet = { on: false, id: null, peers: {}, url: NET };

  function badge(text) {
    const el = document.getElementById('telemetry-bar');
    if (!el) return;
    if (el.dataset.netHooked) {
      el.dataset.net = text;
      return;
    }
    el.dataset.netHooked = '1';
    const orig = el.textContent;
    setInterval(function () {
      el.textContent = orig + ' | ' + (el.dataset.net || 'NET off');
    }, 800);
    el.dataset.net = text;
  }

  if (!NET) {
    badge('NET off');
    return;
  }

  let ws = null;
  let myId = null;
  const peers = window.keloNet.peers;
  let sendAcc = 0;

  function connect() {
    try { ws = new WebSocket(NET); } catch (e) {
      badge('NET fail');
      return;
    }
    badge('NET…');
    ws.onopen = function () {
      window.keloNet.on = true;
      ws.send(JSON.stringify({ t: 'hello', name: (localPlayer && localPlayer.name) || 'Kelo' }));
      badge('NET on');
    };
    ws.onclose = function () {
      window.keloNet.on = false;
      badge('NET off');
      setTimeout(connect, 1500);
    };
    ws.onerror = function () { badge('NET err'); };
    ws.onmessage = function (ev) {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.t === 'welcome') {
        myId = msg.id;
        window.keloNet.id = myId;
        ingest(msg.players);
        badge('NET ' + Object.keys(peers).length);
      }
      if (msg.t === 'state') ingest(msg.players);
      if (msg.t === 'join' && msg.player) upsert(msg.player);
      if (msg.t === 'leave' && msg.id) delete peers[msg.id];
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
    badge('NET ' + Object.keys(peers).length);
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
