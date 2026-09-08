'use strict';

/* KELO-INDEX
 * area: SERVER / PROGRESSION / TITLES
 * owner: server title authority
 * keys: TITLES STATS KILLS UNLOCK EQUIP AUTHORITY PERSISTENCE
 * purpose: valida progreso de títulos, desbloqueos y equipamiento en autoridad server; cliente nunca ordena unlock
 * public-api: createTitleService/createMemoryAdapter/createSupabaseAdapter
 * consumes: shared KeloTitleCatalog
 * state-owned: progress, unlocked, equippedTitleId y ledger mínimo de kills confirmadas
 * extension-points: recordConfirmedKill desde futuro owner server de combate; nuevas definiciones solo en title-catalog
 * reuse: achievements/títulos server-authoritative
 * legacy: RAM authoritative para desarrollo; Supabase opcional cuando KELO_TITLES_SUPABASE=1
 * do-not: NO aceptar kills desde WebSocket cliente; NO usar visual:event DEATH como gameplay
 */
const catalog = require('../src/systems/title-catalog.js');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function cleanId(value) { return String(value || '').replace(/[^a-zA-Z0-9_:\-.]/g, '').slice(0, 96); }
function normalizeProgress(progress) {
  const out = {};
  if (progress && typeof progress === 'object' && !Array.isArray(progress)) Object.keys(progress).forEach((key) => {
    out[key] = Math.max(0, Math.floor(Number(progress[key]) || 0));
  });
  return out;
}
function normalizeUnlocked(unlocked) {
  return Array.from(new Set((Array.isArray(unlocked) ? unlocked : []).filter((id) => !!catalog.get(id))));
}
function makeRow(playerId) {
  return { player_id: cleanId(playerId), progress: {}, unlocked: [], equipped_title_id: null, kill_ledger: [], updated_at: Date.now() };
}

function createMemoryAdapter() {
  const players = new Map();
  return {
    mode: 'ram-authoritative',
    async ensurePlayer(playerId) {
      const id = cleanId(playerId); if (!id) throw new Error('INVALID_PLAYER_ID');
      if (!players.has(id)) players.set(id, makeRow(id));
      return clone(players.get(id));
    },
    async getPlayer(playerId) { const row = players.get(cleanId(playerId)); return row ? clone(row) : null; },
    async savePlayer(playerId, patch) {
      const id = cleanId(playerId); const row = players.get(id) || makeRow(id);
      if (patch.progress) row.progress = normalizeProgress(patch.progress);
      if (patch.unlocked) row.unlocked = normalizeUnlocked(patch.unlocked);
      if (Object.prototype.hasOwnProperty.call(patch, 'equipped_title_id')) row.equipped_title_id = patch.equipped_title_id || null;
      if (patch.kill_ledger) row.kill_ledger = Array.isArray(patch.kill_ledger) ? clone(patch.kill_ledger).slice(-100) : [];
      row.updated_at = Date.now(); players.set(id, row); return clone(row);
    },
    // Test-only provisioning. Never exposed through WebSocket.
    async _provision(playerId, patch) { await this.ensurePlayer(playerId); return this.savePlayer(playerId, patch || {}); }
  };
}

function createSupabaseAdapter(url, serviceKey, tableName) {
  const table = /^[a-zA-Z0-9_]+$/.test(String(tableName || '')) ? String(tableName) : 'title_players';
  const base = String(url).replace(/\/$/, '') + '/rest/v1';
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  async function request(path, options = {}) {
    const res = await fetch(base + path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const text = await res.text();
    if (!res.ok) throw new Error(`SUPABASE_${res.status}:${text.slice(0, 240)}`);
    return text ? JSON.parse(text) : null;
  }
  return {
    mode: 'supabase-authoritative',
    async ensurePlayer(playerId) {
      const id = cleanId(playerId); if (!id) throw new Error('INVALID_PLAYER_ID');
      const rows = await request(`/${table}?player_id=eq.${encodeURIComponent(id)}&select=*`);
      if (rows && rows[0]) return rows[0];
      const created = await request(`/${table}`, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ player_id: id, progress: {}, unlocked: [], kill_ledger: [] }) });
      return created[0];
    },
    async getPlayer(playerId) {
      const rows = await request(`/${table}?player_id=eq.${encodeURIComponent(cleanId(playerId))}&select=*`);
      return rows && rows[0] ? rows[0] : null;
    },
    async savePlayer(playerId, patch) {
      const body = {};
      if (patch.progress) body.progress = normalizeProgress(patch.progress);
      if (patch.unlocked) body.unlocked = normalizeUnlocked(patch.unlocked);
      if (Object.prototype.hasOwnProperty.call(patch, 'equipped_title_id')) body.equipped_title_id = patch.equipped_title_id || null;
      if (patch.kill_ledger) body.kill_ledger = Array.isArray(patch.kill_ledger) ? patch.kill_ledger.slice(-100) : [];
      body.updated_at = new Date().toISOString();
      const rows = await request(`/${table}?player_id=eq.${encodeURIComponent(cleanId(playerId))}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) });
      if (!rows || !rows[0]) throw new Error('TITLE_PERSISTENCE_EMPTY');
      return rows[0];
    }
  };
}

function requirementMet(requirement, value) {
  return !!requirement && requirement.operator === 'gte' && Number(value) >= Number(requirement.value);
}
function evaluateForStat(row, stat) {
  const unlocked = new Set(normalizeUnlocked(row.unlocked));
  const added = [];
  catalog.byStat(stat).forEach((title) => {
    if (!unlocked.has(title.id) && requirementMet(title.requirement, row.progress[stat])) { unlocked.add(title.id); added.push(title.id); }
  });
  row.unlocked = Array.from(unlocked);
  return added;
}
function evaluateAll(row) {
  const added = [];
  catalog.list().forEach((title) => {
    const unlocked = new Set(row.unlocked || []);
    if (!unlocked.has(title.id) && requirementMet(title.requirement, row.progress[title.requirement.stat])) { row.unlocked.push(title.id); added.push(title.id); }
  });
  row.unlocked = normalizeUnlocked(row.unlocked);
  return added;
}
function validOpenWorldKill(killerId, victimId, context) {
  const killer = cleanId(killerId), victim = cleanId(victimId), c = context && typeof context === 'object' ? context : {};
  if (!killer || !victim || killer === victim) return false;
  if (c.confirmed !== true || c.worldPvP !== true) return false;
  if (c.mode !== 'open-world-pvp' && c.combatType !== 'open-world-pvp') return false;
  if (c.victimType !== 'player' || c.npc === true || c.dummy === true || c.training === true || c.arena === true) return false;
  return true;
}

function createTitleService(options = {}) {
  const adapter = options.adapter || (options.enableSupabase && options.supabaseUrl && options.supabaseServiceKey
    ? createSupabaseAdapter(options.supabaseUrl, options.supabaseServiceKey, options.tableName || 'title_players')
    : createMemoryAdapter());

  async function ensurePlayer(playerId) { return adapter.ensurePlayer(playerId); }
  async function snapshot(playerId) {
    let row = await adapter.ensurePlayer(playerId);
    row.progress = normalizeProgress(row.progress);
    row.unlocked = normalizeUnlocked(row.unlocked);
    const added = evaluateAll(row);
    if (row.equipped_title_id && row.unlocked.indexOf(row.equipped_title_id) < 0) row.equipped_title_id = null;
    if (added.length) row = await adapter.savePlayer(playerId, { progress: row.progress, unlocked: row.unlocked, equipped_title_id: row.equipped_title_id, kill_ledger: row.kill_ledger || [] });
    return {
      version: 'server-titles-v1', source: adapter.mode, playerId: cleanId(playerId),
      equippedTitleId: row.equipped_title_id || null,
      unlocked: normalizeUnlocked(row.unlocked),
      progress: normalizeProgress(row.progress)
    };
  }
  async function equip(playerId, titleId) {
    const id = String(titleId || ''); const title = catalog.get(id);
    if (!title) throw new Error('UNKNOWN_TITLE');
    const snap = await snapshot(playerId);
    if (snap.unlocked.indexOf(id) < 0) throw new Error('TITLE_LOCKED');
    await adapter.savePlayer(playerId, { progress: snap.progress, unlocked: snap.unlocked, equipped_title_id: id });
    return snapshot(playerId);
  }
  async function unequip(playerId) {
    const snap = await snapshot(playerId);
    await adapter.savePlayer(playerId, { progress: snap.progress, unlocked: snap.unlocked, equipped_title_id: null });
    return snapshot(playerId);
  }

  // KELO-INDEX SERVER/TITLES única entrada de progreso PvP. Solo debe llamarla combate server tras confirmar una muerte real.
  async function recordConfirmedKill(killerId, victimId, context) {
    if (!validOpenWorldKill(killerId, victimId, context)) return { counted: false, reason: 'INVALID_OPEN_WORLD_KILL', snapshot: await snapshot(killerId), newUnlocks: [] };
    let row = await adapter.ensurePlayer(killerId);
    row.progress = normalizeProgress(row.progress); row.unlocked = normalizeUnlocked(row.unlocked);
    row.progress.openWorldPlayerKills = Math.min(Number.MAX_SAFE_INTEGER, (row.progress.openWorldPlayerKills || 0) + 1);
    const newUnlocks = evaluateForStat(row, 'openWorldPlayerKills');
    const ledger = Array.isArray(row.kill_ledger) ? row.kill_ledger.slice(-99) : [];
    ledger.push({ victimId: cleanId(victimId), at: Number(context.timestamp) || Date.now(), zone: cleanId(context.zone || ''), mode: 'open-world-pvp' });
    await adapter.savePlayer(killerId, { progress: row.progress, unlocked: row.unlocked, equipped_title_id: row.equipped_title_id || null, kill_ledger: ledger });
    return { counted: true, newUnlocks, snapshot: await snapshot(killerId) };
  }

  return Object.freeze({
    version: 'server-titles-v1', source: adapter.mode, ensurePlayer, snapshot, equip, unequip,
    recordConfirmedKill, validOpenWorldKill, _adapter: adapter
  });
}

module.exports = { createMemoryAdapter, createSupabaseAdapter, createTitleService, validOpenWorldKill };
