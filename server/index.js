/* KELO-INDEX
 * area: SERVER
 * keys: WEBSOCKET AUTHORITY VISUAL EVENT RELAY CAST PROJECTILE STATUS VALIDATION
 * hace: autoridad de sistemas compartidos existentes y relay validado de eventos puramente visuales
 * online: visual:event no resuelve gameplay; solo retransmite presentación semántica saneada
 */
/**
 * Kelo plaza room — WebSocket authority for movement, Nobleza, PvP damage and forging.
 * Supabase persistence hooks activate when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY exist.
 * Without them the same gameplay contracts run in authoritative RAM for development.
 */
const { WebSocketServer } = require('ws');
const { createNobilityService, safePlayerId } = require('./nobility-store');
const { createForgeService } = require('./forge-store');

const PORT = Number(process.env.PORT || 2567);
const MAX = 32;
const WORLD = { w: 3600, h: 3200 };
const VISUAL_EVENT_ALLOWLIST = new Set([
  'CAST_CONFIRMED','PROJECTILE_SPAWNED','PROJECTILE_HIT','PROJECTILE_EXPIRED','ABILITY_IMPACT',
  'STATUS_APPLIED','STATUS_REMOVED','SHIELD_APPLIED','SHIELD_BROKEN','DASH_STARTED','DASH_ENDED','DEATH'
]);
const players = new Map();
let seq = 1;

const nobility = createNobilityService({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
const forge = createForgeService({
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
      armorScore: p.armorScore || 0,
      auraRank: p.auraRank || 0,
      averageQuality: p.averageQuality || 0,
      averageGrade: p.averageGrade || 0,
      equipmentSummary: Array.isArray(p.equipmentSummary) ? p.equipmentSummary : [],
    };
  });
  return out;
}

function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(obj, except) {
  const raw = JSON.stringify(obj);
  players.forEach((p) => { if (p !== except && p.ws && p.ws.readyState === 1) p.ws.send(raw); });
}
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function shortId(value, max) { return value == null ? null : String(value).replace(/[^a-zA-Z0-9_:\-.]/g, '').slice(0, max || 96); }
function safeVec(value) {
  if (!value || !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) return null;
  return { x: clamp(Number(value.x), -256, WORLD.w + 256), y: clamp(Number(value.y), -256, WORLD.h + 256) };
}
function safeDirection(value) {
  if (!value || !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) return null;
  const x = Number(value.x), y = Number(value.y), len = Math.hypot(x, y);
  if (!len || len > 1000) return null;
  return { x: Number((x / len).toFixed(5)), y: Number((y / len).toFixed(5)) };
}
function sanitizeVisualContext(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const gp = c.gameplay && typeof c.gameplay === 'object' ? c.gameplay : {};
  const visual = c.visual && typeof c.visual === 'object' ? c.visual : {};
  return {
    castId: shortId(c.castId, 96),
    abilityId: Number.isSafeInteger(Number(c.abilityId)) ? clamp(Number(c.abilityId), 0, 100000) : null,
    abilityKey: shortId(c.abilityKey, 64),
    origin: safeVec(c.origin),
    target: safeVec(c.target),
    direction: safeDirection(c.direction),
    gameplay: {
      speed: Number.isFinite(Number(gp.speed)) ? clamp(Number(gp.speed), 0, 5000) : 0,
      range: Number.isFinite(Number(gp.range)) ? clamp(Number(gp.range), 0, 5000) : 0,
      radius: Number.isFinite(Number(gp.radius)) ? clamp(Number(gp.radius), 0, 1000) : 0,
    },
    visual: {
      scale: Number.isFinite(Number(visual.scale)) ? clamp(Number(visual.scale), 0.05, 8) : 1,
      seed: Number.isFinite(Number(visual.seed)) ? (Number(visual.seed) >>> 0) : 0,
      variant: shortId(visual.variant, 64),
    },
    projectileId: shortId(c.projectileId, 96),
    statusId: shortId(c.statusId, 96),
    confirmed: true,
  };
}
function sanitizeVisualMeta(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const targetActorId = shortId(m.targetActorId, 80);
  return {
    status: shortId(m.status, 40),
    duration: Number.isFinite(Number(m.duration)) ? clamp(Number(m.duration), 0, 120) : null,
    targetActorId: targetActorId && players.has(targetActorId) ? targetActorId : null,
    amount: Number.isFinite(Number(m.amount)) ? clamp(Number(m.amount), -1000000, 1000000) : null,
    reason: shortId(m.reason, 80),
  };
}

async function refreshNobility(me, requestId) {
  const snapshot = await nobility.snapshot(me.playerKey, me.name);
  me.nobilityRank = snapshot.rank.id;
  me.nobilityPower = snapshot.rank.power;
  send(me.ws, { t: 'nobility:snapshot', requestId: requestId || null, snapshot });
  return snapshot;
}
async function refreshForge(me, requestId) {
  const snapshot = await forge.snapshot(me.playerKey);
  me.armorScore = snapshot.armorScore;
  me.auraRank = snapshot.auraRank;
  me.averageQuality = snapshot.averageQuality;
  me.averageGrade = snapshot.averageGrade;
  me.equipmentSummary = snapshot.equipmentSummary;
  send(me.ws, { t: 'forge:snapshot', requestId: requestId || null, snapshot, source: forge.source });
  return snapshot;
}
function protocolError(ws, requestId, code, message) { send(ws, { t: 'error', requestId: requestId || null, code, message: message || code }); }

const wss = new WebSocketServer({ port: PORT });
console.log(`Kelo plaza room on ws://0.0.0.0:${PORT} · Nobleza ${nobility.source} · Forge ${forge.source}`);

wss.on('connection', (ws) => {
  if (players.size >= MAX) { ws.close(1013, 'room full'); return; }
  const id = 'p' + (seq++);
  const me = { id, ws, playerKey: null, name: 'Kelo', x: 1400, y: 1600, face: 'down', gait: 'idle', zone: 'plaza', nobilityRank: 'none', nobilityPower: 0, armorScore: 0, auraRank: 0, averageQuality: 0, averageGrade: 0, equipmentSummary: [] };
  players.set(id, me);
  send(ws, { t: 'welcome', id, players: publicState(), nobilitySource: nobility.source, forgeSource: forge.source });
  broadcast({ t: 'join', player: publicState()[id] }, me);

  ws.on('message', async (buf) => {
    let msg;
    try { msg = JSON.parse(String(buf)); } catch (e) { return; }
    try {
      if (msg.t === 'hello') {
        if (typeof msg.name === 'string' && msg.name.trim()) me.name = msg.name.trim().slice(0, 24);
        me.playerKey = safePlayerId(msg.playerKey);
        await nobility.ensurePlayer(me.playerKey, me.name);
        await forge.ensurePlayer(me.playerKey);
        send(ws, { t: 'identity', playerKey: me.playerKey });
        await refreshNobility(me, msg.requestId);
        await refreshForge(me, msg.requestId);
        broadcast({ t: 'state', players: publicState() }, me);
        return;
      }
      if (msg.t === 'pose') {
        if (Number.isFinite(msg.x)) me.x = clamp(msg.x, 20, WORLD.w - 20);
        if (Number.isFinite(msg.y)) me.y = clamp(msg.y, 20, WORLD.h - 20);
        if (['up','down','left','right'].includes(msg.face)) me.face = msg.face;
        if (['idle','walk','run'].includes(msg.gait)) me.gait = msg.gait;
        if (msg.zone === 'plaza' || msg.zone === 'cafe') me.zone = msg.zone;
        return;
      }
      if (!me.playerKey) { protocolError(ws, msg.requestId, 'IDENTITY_REQUIRED', 'Envía hello antes de usar sistemas autoritativos.'); return; }
      if (msg.t === 'visual:event') {
        if (!VISUAL_EVENT_ALLOWLIST.has(msg.name)) { protocolError(ws, msg.requestId, 'INVALID_VISUAL_EVENT', 'Evento visual no permitido.'); return; }
        const context = sanitizeVisualContext(msg.context);
        const meta = sanitizeVisualMeta(msg.meta);
        broadcast({ t: 'visual:event', name: msg.name, actorId: me.id, context, meta, serverTime: Date.now(), source: 'server-visual-relay-v1' }, me);
        return;
      }
      if (msg.t === 'nobility:get') { await refreshNobility(me, msg.requestId); return; }
      if (msg.t === 'nobility:donate') {
        const currency = msg.currency === 'kc' ? 'kc' : (msg.currency === 'gold' ? 'gold' : null);
        const amount = Math.floor(Number(msg.amount));
        if (!currency || !Number.isSafeInteger(amount) || amount <= 0) { protocolError(ws, msg.requestId, 'INVALID_DONATION', 'Donación inválida.'); return; }
        const result = await nobility.donate(me.playerKey, me.name, currency, amount);
        me.nobilityRank = result.snapshot.rank.id; me.nobilityPower = result.snapshot.rank.power;
        send(ws, { t: 'nobility:donated', requestId: msg.requestId || null, donationAdded: result.donationAdded, snapshot: result.snapshot });
        broadcast({ t: 'state', players: publicState() }, me); return;
      }
      if (msg.t === 'combat:resolve') { const result = await nobility.resolveDamage(me.playerKey, me.name, msg.baseDamage); send(ws, { t: 'combat:resolved', requestId: msg.requestId || null, ...result }); return; }
      if (msg.t === 'forge:get') { await refreshForge(me, msg.requestId); return; }
      if (msg.t === 'forge:attempt') {
        const result = await forge.attempt(me.playerKey, { itemId: msg.itemId, forgeType: msg.forgeType, materialLevel: msg.materialLevel, crystals: msg.crystals });
        me.armorScore = result.armorScore; me.auraRank = result.auraRank; me.averageQuality = result.averageQuality; me.averageGrade = result.averageGrade; me.equipmentSummary = result.equipmentSummary;
        send(ws, { t: 'forge:result', requestId: msg.requestId || null, ...result, source: 'server-authoritative' });
        broadcast({ t: 'state', players: publicState() }, me); return;
      }
      if (msg.t === 'forge:combine') {
        const snapshot = await forge.combine(me.playerKey, msg.materialId);
        me.armorScore = snapshot.armorScore; me.auraRank = snapshot.auraRank; me.averageQuality = snapshot.averageQuality; me.averageGrade = snapshot.averageGrade; me.equipmentSummary = snapshot.equipmentSummary;
        send(ws, { t: 'forge:combined', requestId: msg.requestId || null, snapshot }); return;
      }
    } catch (err) {
      const raw = String(err && err.message || err);
      const known=['INSUFFICIENT_GOLD','INSUFFICIENT_KC','INVALID_AMOUNT','INVALID_CURRENCY','ITEM_NOT_OWNED','INVALID_FORGE_TYPE','INVALID_TIER','MAX_TIER','INVALID_MATERIAL_LEVEL','TOO_MANY_CRYSTALS','INVALID_CRYSTAL','MATERIAL_REQUIRED','CRYSTAL_REQUIRED','INVALID_MATERIAL','MAX_MATERIAL_LEVEL','NEED_SIX','INVALID_VISUAL_EVENT'];
      const code = known.find(k=>raw.includes(k)) || 'SERVER_ERROR';
      console.error('protocol error', msg && msg.t, raw);
      protocolError(ws, msg && msg.requestId, code, code);
    }
  });
  ws.on('close', () => { players.delete(id); broadcast({ t: 'leave', id }); });
});

setInterval(() => {
  if (!players.size) return;
  const raw = JSON.stringify({ t: 'state', players: publicState() });
  players.forEach((p) => { if (p.ws && p.ws.readyState === 1) p.ws.send(raw); });
}, 100);
