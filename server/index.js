/**
 * Kelo plaza room — WebSocket authority for movement, Nobleza and PvP damage.
 * Supabase persistence activates when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY exist.
 * Without them the same contract runs in authoritative RAM for development.
 */
const { WebSocketServer } = require('ws');
const { createNobilityService, safePlayerId } = require('./nobility-store');

const PORT = Number(process.env.PORT || 2567);
const MAX = 32;
const WORLD = { w: 3600, h: 3200 };
const players = new Map();
let seq = 1;

const nobility = createNobilityService({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

function publicState() {
  const out = {};
  players.forEach((p, id) => {
    out[id] = {
      id: p.id,
      playerKey: p.playerKey,
      name: p.name,
      x: p.x,
      y: p.y,
      face: p.face,
      gait: p.gait,
      zone: p.zone,
      nobilityRank: p.nobilityRank || 'none',
      nobilityPower: p.nobilityPower || 0,
    };
  });
  return out;
}

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function broadcast(obj, except) {
  const raw = JSON.stringify(obj);
  players.forEach((p) => {
    if (p === except) return;
    if (p.ws && p.ws.readyState === 1) p.ws.send(raw);
  });
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

async function refreshNobility(me, requestId) {
  const snapshot = await nobility.snapshot(me.playerKey, me.name);
  me.nobilityRank = snapshot.rank.id;
  me.nobilityPower = snapshot.rank.power;
  send(me.ws, { t: 'nobility:snapshot', requestId: requestId || null, snapshot });
  return snapshot;
}

function protocolError(ws, requestId, code, message) {
  send(ws, { t: 'error', requestId: requestId || null, code, message: message || code });
}

const wss = new WebSocketServer({ port: PORT });
console.log(`Kelo plaza room on ws://0.0.0.0:${PORT} · Nobleza ${nobility.source}`);

wss.on('connection', (ws) => {
  if (players.size >= MAX) {
    ws.close(1013, 'room full');
    return;
  }

  const id = 'p' + (seq++);
  const me = {
    id,
    ws,
    playerKey: null,
    name: 'Kelo',
    x: 1400,
    y: 1600,
    face: 'down',
    gait: 'idle',
    zone: 'plaza',
    nobilityRank: 'none',
    nobilityPower: 0,
  };
  players.set(id, me);
  send(ws, { t: 'welcome', id, players: publicState(), nobilitySource: nobility.source });
  broadcast({ t: 'join', player: publicState()[id] }, me);

  ws.on('message', async (buf) => {
    let msg;
    try { msg = JSON.parse(String(buf)); } catch (e) { return; }

    try {
      if (msg.t === 'hello') {
        if (typeof msg.name === 'string' && msg.name.trim()) me.name = msg.name.trim().slice(0, 24);
        me.playerKey = safePlayerId(msg.playerKey);
        await nobility.ensurePlayer(me.playerKey, me.name);
        send(ws, { t: 'identity', playerKey: me.playerKey });
        await refreshNobility(me, msg.requestId);
        broadcast({ t: 'state', players: publicState() }, me);
        return;
      }

      if (msg.t === 'pose') {
        if (Number.isFinite(msg.x)) me.x = clamp(msg.x, 20, WORLD.w - 20);
        if (Number.isFinite(msg.y)) me.y = clamp(msg.y, 20, WORLD.h - 20);
        if (msg.face === 'up' || msg.face === 'down' || msg.face === 'left' || msg.face === 'right') me.face = msg.face;
        if (msg.gait === 'idle' || msg.gait === 'walk' || msg.gait === 'run') me.gait = msg.gait;
        if (msg.zone === 'plaza' || msg.zone === 'cafe') me.zone = msg.zone;
        return;
      }

      if (!me.playerKey) {
        protocolError(ws, msg.requestId, 'IDENTITY_REQUIRED', 'Envía hello antes de usar sistemas autoritativos.');
        return;
      }

      if (msg.t === 'nobility:get') {
        await refreshNobility(me, msg.requestId);
        return;
      }

      if (msg.t === 'nobility:donate') {
        const currency = msg.currency === 'kc' ? 'kc' : (msg.currency === 'gold' ? 'gold' : null);
        const amount = Math.floor(Number(msg.amount));
        if (!currency || !Number.isSafeInteger(amount) || amount <= 0) {
          protocolError(ws, msg.requestId, 'INVALID_DONATION', 'Donación inválida.');
          return;
        }
        const result = await nobility.donate(me.playerKey, me.name, currency, amount);
        me.nobilityRank = result.snapshot.rank.id;
        me.nobilityPower = result.snapshot.rank.power;
        send(ws, { t: 'nobility:donated', requestId: msg.requestId || null, donationAdded: result.donationAdded, snapshot: result.snapshot });
        broadcast({ t: 'state', players: publicState() }, me);
        return;
      }

      if (msg.t === 'combat:resolve') {
        const result = await nobility.resolveDamage(me.playerKey, me.name, msg.baseDamage);
        send(ws, { t: 'combat:resolved', requestId: msg.requestId || null, ...result });
        return;
      }
    } catch (err) {
      const raw = String(err && err.message || err);
      let code = 'SERVER_ERROR';
      if (raw.includes('INSUFFICIENT_GOLD')) code = 'INSUFFICIENT_GOLD';
      else if (raw.includes('INSUFFICIENT_KC')) code = 'INSUFFICIENT_KC';
      else if (raw.includes('INVALID_AMOUNT')) code = 'INVALID_AMOUNT';
      else if (raw.includes('INVALID_CURRENCY')) code = 'INVALID_CURRENCY';
      console.error('protocol error', msg && msg.t, raw);
      protocolError(ws, msg && msg.requestId, code, code);
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ t: 'leave', id });
  });
});

setInterval(() => {
  if (!players.size) return;
  const raw = JSON.stringify({ t: 'state', players: publicState() });
  players.forEach((p) => {
    if (p.ws && p.ws.readyState === 1) p.ws.send(raw);
  });
}, 100);
