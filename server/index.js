/**
 * Kelo plaza room — RAM only. No DB.
 * Schema shape matches the future Colyseus Player.
 *   node index.js   → ws://0.0.0.0:2567
 */
const { WebSocketServer } = require('ws');
const PORT = Number(process.env.PORT || 2567);
const MAX = 32;
const WORLD = { w: 3600, h: 3200 };

const players = new Map();
let seq = 1;

function publicState() {
  const out = {};
  players.forEach((p, id) => {
    out[id] = {
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      face: p.face,
      gait: p.gait,
      zone: p.zone,
    };
  });
  return out;
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

const wss = new WebSocketServer({ port: PORT });
console.log('Kelo plaza room on ws://0.0.0.0:' + PORT + ' (RAM, no DB)');

wss.on('connection', (ws) => {
  if (players.size >= MAX) {
    ws.close(1013, 'room full');
    return;
  }
  const id = 'p' + (seq++);
  const me = {
    id: id,
    ws: ws,
    name: 'Kelo',
    x: 1400,
    y: 1600,
    face: 'down',
    gait: 'idle',
    zone: 'plaza',
  };
  players.set(id, me);
  ws.send(JSON.stringify({ t: 'welcome', id: id, players: publicState() }));
  broadcast({ t: 'join', player: publicState()[id] }, me);

  ws.on('message', (buf) => {
    let msg;
    try { msg = JSON.parse(String(buf)); } catch (e) { return; }
    if (msg.t === 'hello') {
      if (typeof msg.name === 'string' && msg.name.trim()) me.name = msg.name.trim().slice(0, 24);
    }
    if (msg.t === 'pose') {
      if (Number.isFinite(msg.x)) me.x = clamp(msg.x, 20, WORLD.w - 20);
      if (Number.isFinite(msg.y)) me.y = clamp(msg.y, 20, WORLD.h - 20);
      if (msg.face === 'up' || msg.face === 'down' || msg.face === 'left' || msg.face === 'right') me.face = msg.face;
      if (msg.gait === 'idle' || msg.gait === 'walk' || msg.gait === 'run') me.gait = msg.gait;
      if (msg.zone === 'plaza' || msg.zone === 'cafe') me.zone = msg.zone;
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast({ t: 'leave', id: id });
  });
});

setInterval(() => {
  if (!players.size) return;
  const raw = JSON.stringify({ t: 'state', players: publicState() });
  players.forEach((p) => {
    if (p.ws && p.ws.readyState === 1) p.ws.send(raw);
  });
}, 100);
