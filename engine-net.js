/* KELO-INDEX
 * area: NETWORK
 * keys: WEBSOCKET AUTHORITY POSE VISUAL EVENT CAST PROJECTILE STATUS ONLINE
 * hace: transporte cliente para pose/sistemas autoritativos y relay semántico de presentación visual
 * online: visual:event jamás decide gameplay; servidor sigue siendo la frontera para estado valioso/compartido
 */
(function () {
  const params = new URLSearchParams(location.search);
  const NET = params.get('net');
  const PLAYER_KEY_STORAGE = 'kelo_player_key_v1';
  const pending = new Map();
  const VISUAL_EVENT_ALLOWLIST = new Set([
    'CAST_CONFIRMED','PROJECTILE_SPAWNED','PROJECTILE_HIT','PROJECTILE_EXPIRED','ABILITY_IMPACT',
    'STATUS_APPLIED','STATUS_REMOVED','SHIELD_APPLIED','SHIELD_BROKEN','DASH_STARTED','DASH_ENDED','DEATH'
  ]);
  let requestSeq = 1;

  function makePlayerKey() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function readPlayerKey() { try { let key = localStorage.getItem(PLAYER_KEY_STORAGE); if (!key) { key = makePlayerKey(); localStorage.setItem(PLAYER_KEY_STORAGE, key); } return key; } catch (e) { return makePlayerKey(); } }
  function savePlayerKey(key) { if (!key) return; try { localStorage.setItem(PLAYER_KEY_STORAGE, key); } catch (e) {} }
  window.keloNet = { on: false, id: null, peers: {}, url: NET, playerKey: readPlayerKey(), nobilitySource: 'local-fallback', forgeSource: 'local-fallback', visualEventSource: 'local-fallback' };

  function ensureChip() { let chip = document.getElementById('kelo-online'); if (chip) return chip; chip = document.createElement('div'); chip.id = 'kelo-online'; chip.style.cssText = ['position:absolute','top:max(44px, calc(env(safe-area-inset-top) + 36px))','left:max(8px, env(safe-area-inset-left))','z-index:80','pointer-events:none','display:flex','align-items:center','gap:6px','padding:5px 10px','border-radius:999px','background:rgba(10,13,18,.92)','border:1px solid rgba(231,197,106,.35)','color:#e7c56a','font:700 10px/1.2 -apple-system,sans-serif','white-space:nowrap'].join(';'); document.body.appendChild(chip); return chip; }
  function paintChip(state, n) { const chip = ensureChip(); const dot = state === 'on' ? '#3ddc84' : (state === 'wait' ? '#e7c56a' : '#8a9099'); const label = state === 'on' ? ('Online ' + n) : state === 'wait' ? 'Conectando' : state === 'err' ? 'Sin señal' : 'Local'; chip.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:' + dot + '"></span><span>' + label + '</span>'; }
  function countOnline() { const others = Object.keys(window.keloNet.peers || {}).length; return window.keloNet.on ? (1 + others) : 0; }
  let ws = null, myId = null, sendAcc = 0;
  const peers = window.keloNet.peers;
  function nextRequestId(prefix) { return prefix + '_' + Date.now().toString(36) + '_' + (requestSeq++).toString(36); }
  function request(type, payload, timeoutMs) { if (!ws || ws.readyState !== 1) return Promise.reject(new Error('NETWORK_OFFLINE')); const requestId = nextRequestId(type.replace(/[^a-z]/gi, '')); return new Promise(function(resolve, reject) { const timer = setTimeout(function() { pending.delete(requestId); reject(new Error('NETWORK_TIMEOUT')); }, timeoutMs || 8000); pending.set(requestId, { resolve, reject, timer }); ws.send(JSON.stringify(Object.assign({ t: type, requestId }, payload || {}))); }); }
  function settle(requestId, ok, value) { if (!requestId || !pending.has(requestId)) return; const item = pending.get(requestId); pending.delete(requestId); clearTimeout(item.timer); if (ok) item.resolve(value); else item.reject(value instanceof Error ? value : new Error(String(value || 'SERVER_ERROR'))); }
  function ingestNobility(snapshot) { if (!snapshot) return; window.keloNet.nobilitySource = snapshot.source || 'server-authoritative'; if (window.KeloNobility && typeof window.KeloNobility.ingestServerSnapshot === 'function') window.KeloNobility.ingestServerSnapshot(snapshot); }
  function ingestForge(snapshot) { if (!snapshot) return; window.keloNet.forgeSource = 'server-authoritative'; if (typeof STATE !== 'undefined' && Number.isFinite(snapshot.gold)) STATE.gold = snapshot.gold; if (window.KeloEquipment) { if (Array.isArray(snapshot.equipment)) snapshot.equipment.forEach(function(item){ window.KeloEquipment.applyServerItem(item); }); if (typeof localPlayer !== 'undefined') { localPlayer.armorScore = snapshot.armorScore || 0; localPlayer.auraRank = snapshot.auraRank || 0; localPlayer.averageQuality = snapshot.averageQuality || 0; localPlayer.averageGrade = snapshot.averageGrade || 0; localPlayer.equipmentSummary = snapshot.equipmentSummary || []; } } }

  function visualMeta(payload) {
    const p = payload || {};
    return {
      status: typeof p.status === 'string' ? p.status.slice(0, 40) : null,
      duration: Number.isFinite(Number(p.duration)) ? Number(p.duration) : (p.effect && Number.isFinite(Number(p.effect.duration)) ? Number(p.effect.duration) : null),
      targetActorId: p.targetActorId == null ? null : String(p.targetActorId).slice(0, 80),
      amount: Number.isFinite(Number(p.amount)) ? Number(p.amount) : null,
      reason: p.reason == null ? null : String(p.reason).slice(0, 80)
    };
  }

  // KELO-INDEX NETWORK/VISUAL manda eventos semánticos compactos, nunca frames/sprites/partículas/Canvas.
  function replicateVisualEvent(name, payload) {
    if (!VISUAL_EVENT_ALLOWLIST.has(name) || !ws || ws.readyState !== 1 || !window.keloNet.on) return false;
    if (payload && (payload.remote === true || payload.networkReplay === true)) return false;
    const context = window.KeloVisualContext && typeof window.KeloVisualContext.serialize === 'function'
      ? window.KeloVisualContext.serialize(payload || {})
      : null;
    if (!context) return false;
    ws.send(JSON.stringify({ t: 'visual:event', name: name, context: context, meta: visualMeta(payload) }));
    return true;
  }

  function ingestVisualEvent(msg) {
    if (!msg || !VISUAL_EVENT_ALLOWLIST.has(msg.name) || !window.KeloVisualEventBus) return;
    const c = Object.assign({}, msg.context || {}, msg.meta || {}, {
      remote: true,
      networkReplay: true,
      serverTime: Number(msg.serverTime) || null,
      sourceActorId: msg.actorId || null
    });
    if (msg.name === 'CAST_CONFIRMED' || msg.name === 'PROJECTILE_SPAWNED' || msg.name === 'PROJECTILE_HIT' || msg.name === 'PROJECTILE_EXPIRED' || msg.name === 'ABILITY_IMPACT' || msg.name === 'DASH_STARTED' || msg.name === 'DASH_ENDED') {
      c.actorId = msg.actorId || c.actorId;
      c.actor = peers[c.actorId] || null;
    } else if (c.actorId) {
      c.actor = peers[c.actorId] || null;
    }
    window.keloNet.visualEventSource = 'server-relay';
    window.KeloVisualEventBus.emit(msg.name, c);
  }

  function connect() {
    if (!NET) { paintChip('off', 0); return; }
    try { ws = new WebSocket(NET); } catch (e) { paintChip('err', 0); return; }
    paintChip('wait', 0);
    ws.onopen = function () { window.keloNet.on = true; ws.send(JSON.stringify({ t: 'hello', name: (localPlayer && localPlayer.name) || 'Kelo', playerKey: window.keloNet.playerKey })); paintChip('on', countOnline()); };
    ws.onclose = function () { window.keloNet.on = false; pending.forEach(function(item) { clearTimeout(item.timer); item.reject(new Error('NETWORK_CLOSED')); }); pending.clear(); paintChip('err', 0); setTimeout(connect, 1500); };
    ws.onerror = function () { paintChip('err', 0); };
    ws.onmessage = function (ev) {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.t === 'welcome') { myId = msg.id; window.keloNet.id = myId; window.keloNet.nobilitySource = msg.nobilitySource || window.keloNet.nobilitySource; window.keloNet.forgeSource = msg.forgeSource || window.keloNet.forgeSource; ingest(msg.players); }
      if (msg.t === 'identity' && msg.playerKey) { window.keloNet.playerKey = msg.playerKey; savePlayerKey(msg.playerKey); }
      if (msg.t === 'state') ingest(msg.players);
      if (msg.t === 'join' && msg.player) upsert(msg.player);
      if (msg.t === 'leave' && msg.id) { delete peers[msg.id]; paintChip(window.keloNet.on ? 'on' : 'err', countOnline()); }
      if (msg.t === 'visual:event') ingestVisualEvent(msg);
      if (msg.t === 'nobility:snapshot') { ingestNobility(msg.snapshot); settle(msg.requestId, true, msg.snapshot); }
      if (msg.t === 'nobility:donated') { ingestNobility(msg.snapshot); settle(msg.requestId, true, msg); }
      if (msg.t === 'combat:resolved') settle(msg.requestId, true, msg);
      if (msg.t === 'forge:snapshot') { ingestForge(msg.snapshot); settle(msg.requestId, true, msg.snapshot); }
      if (msg.t === 'forge:result') { if (msg.item && window.KeloEquipment) window.KeloEquipment.applyServerItem(msg.item); if (Number.isFinite(msg.gold) && typeof STATE !== 'undefined') STATE.gold = msg.gold; settle(msg.requestId, true, msg); }
      if (msg.t === 'forge:combined') { ingestForge(msg.snapshot); settle(msg.requestId, true, msg.snapshot); }
      if (msg.t === 'error') settle(msg.requestId, false, new Error(msg.code || msg.message || 'SERVER_ERROR'));
    };
  }
  function upsert(p) {
    if (!p || !p.id || p.id === myId) return;
    const prev = peers[p.id] || { id: p.id, name: p.name || 'Kelo', x: p.x, y: p.y, vx: 0, vy: 0, radius: 20, hp: 100, maxHp: 100, gear: { bodyColor: '#7b6cff', armorColor: '#e7c56a', weaponColor: '#fff' }, _face: p.face || 'down', _gait: p.gait || 'idle', targetX: p.x, targetY: p.y };
    prev.name = p.name || prev.name; prev.targetX = p.x; prev.targetY = p.y; prev._face = p.face || prev._face; prev._gait = p.gait || 'walk';
    prev.nobilityRank = p.nobilityRank || prev.nobilityRank || 'none'; prev.nobilityPower = Number(p.nobilityPower) || 0;
    prev.armorScore = Math.max(0, Math.floor(Number(p.armorScore)||0)); prev.auraRank = Math.max(0, Math.min(9, Math.floor(Number(p.auraRank)||0))); prev.averageQuality = Number(p.averageQuality)||0; prev.averageGrade = Number(p.averageGrade)||0; prev.equipmentSummary = Array.isArray(p.equipmentSummary)?p.equipmentSummary:[];
    peers[p.id] = prev; paintChip('on', countOnline());
  }
  function ingest(map) { if (!map) return; const live = {}; Object.keys(map).forEach(function (id) { live[id] = true; upsert(map[id]); }); Object.keys(peers).forEach(function (id) { if (!live[id]) delete peers[id]; }); paintChip(window.keloNet.on ? 'on' : 'wait', countOnline()); }
  window.KeloNetAuthority = Object.freeze({
    version: 'net-authority-v3',
    isOnline: function() { return !!(ws && ws.readyState === 1 && window.keloNet.on); },
    getNobility: function() { return request('nobility:get'); },
    donateNobility: function(currency, amount) { return request('nobility:donate', { currency, amount: Math.floor(Number(amount)) }); },
    resolveDamage: function(baseDamage) { return request('combat:resolve', { baseDamage: Math.floor(Number(baseDamage)) }); },
    getForge: function() { return request('forge:get'); },
    attemptForge: function(itemId, forgeType, materialLevel, crystals) { return request('forge:attempt', { itemId, forgeType, materialLevel: Math.floor(Number(materialLevel)), crystals: Array.isArray(crystals)?crystals:[] }); },
    combineForgeMaterials: function(materialId) { return request('forge:combine', { materialId }); },
    syncEquipment: function() { return Promise.resolve({ok:true,mode:'server-derived'}); },
    replicateVisualEvent: replicateVisualEvent
  });

  if (window.KeloVisualEventBus && typeof window.KeloVisualEventBus.on === 'function') {
    VISUAL_EVENT_ALLOWLIST.forEach(function (name) {
      window.KeloVisualEventBus.on(name, function (payload) { replicateVisualEvent(name, payload); });
    });
  }

  connect();
  const _sim = updateSimulation;
  updateSimulation = function (dt) { _sim(dt); sendAcc += dt; if (ws && ws.readyState === 1 && localPlayer && sendAcc > 0.1) { sendAcc = 0; ws.send(JSON.stringify({ t: 'pose', x: localPlayer.x, y: localPlayer.y, face: localPlayer._face || 'down', gait: localPlayer._gait || 'idle', zone: window.keloZone || 'plaza' })); } Object.keys(peers).forEach(function (id) { const p = peers[id], tx = p.targetX != null ? p.targetX : p.x, ty = p.targetY != null ? p.targetY : p.y; p.x += (tx - p.x) * Math.min(1, 12 * dt); p.y += (ty - p.y) * Math.min(1, 12 * dt); }); };
  const _render = render;
  render = function () { _render(); if (typeof renderAvatar !== 'function') return; const ids = Object.keys(peers); if (!ids.length) return; const z = CONFIG.zoom || 1; ctx.save(); ctx.translate(screenW / 2, screenH / 2); ctx.scale(z, z); ctx.translate(-camera.x, -camera.y); ids.forEach(function (id) { renderAvatar(peers[id], false); }); ctx.restore(); };
})();
