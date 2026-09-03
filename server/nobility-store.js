'use strict';

const crypto = require('crypto');

const KC_TO_DONATION = 50000;
const FIXED_RANKS = [
  { id: 'none', name: 'Sin título', minDonation: 0, power: 0 },
  { id: 'knight', name: 'Caballero', minDonation: 30000000, power: 1 },
  { id: 'baron', name: 'Barón', minDonation: 100000000, power: 3 },
  { id: 'earl', name: 'Conde', minDonation: 200000000, power: 5 },
];
const RANKED_RANKS = [
  { id: 'duke', name: 'Duque', top: 50, power: 7 },
  { id: 'prince', name: 'Príncipe', top: 15, power: 9 },
  { id: 'king', name: 'Rey', top: 3, power: 12 },
];

function safeName(name) {
  const value = String(name || 'Kelo').trim().slice(0, 24);
  return value || 'Kelo';
}

function safePlayerId(value) {
  const raw = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(raw) ? raw : crypto.randomUUID();
}

function rankFor(donation, position) {
  const total = Math.max(0, Number(donation) || 0);
  const pos = Math.max(1, Number(position) || Number.MAX_SAFE_INTEGER);
  // Ranking titles are only eligible after the permanent Conde threshold.
  if (total >= 200000000) {
    if (pos <= 3) return RANKED_RANKS[2];
    if (pos <= 15) return RANKED_RANKS[1];
    if (pos <= 50) return RANKED_RANKS[0];
  }
  let rank = FIXED_RANKS[0];
  for (const candidate of FIXED_RANKS) if (total >= candidate.minDonation) rank = candidate;
  return rank;
}

function nextRank(donation, position, board) {
  const total = Math.max(0, Number(donation) || 0);
  const pos = Math.max(1, Number(position) || Number.MAX_SAFE_INTEGER);
  if (total < 30000000) return { type: 'fixed', amount: 30000000 - total, label: 'Para Caballero' };
  if (total < 100000000) return { type: 'fixed', amount: 100000000 - total, label: 'Para Barón' };
  if (total < 200000000) return { type: 'fixed', amount: 200000000 - total, label: 'Para Conde' };
  const rivals = (board || []).filter(x => !x.isPlayer);
  if (pos <= 3) return { type: 'max', amount: 0, label: 'Ya estás en el Top 3' };
  if (pos <= 15) {
    const target = rivals[2];
    return { type: 'ranking', amount: target ? Math.max(0, Number(target.donation) - total + 1) : 0, label: 'Para entrar al Top 3' };
  }
  if (pos <= 50) {
    const target = rivals[14];
    return { type: 'ranking', amount: target ? Math.max(0, Number(target.donation) - total + 1) : 0, label: 'Para entrar al Top 15' };
  }
  const target = rivals[49];
  return { type: 'ranking', amount: target ? Math.max(0, Number(target.donation) - total + 1) : 0, label: 'Para entrar al Top 50' };
}

function createMemoryAdapter() {
  const players = new Map();
  return {
    mode: 'ram-authoritative',
    async ensurePlayer(playerId, name) {
      let row = players.get(playerId);
      if (!row) {
        row = { player_id: playerId, name: safeName(name), gold: 1500, kc: 200, donation: 0, donated_today: 0, donation_day: new Date().toISOString().slice(0, 10) };
        players.set(playerId, row);
      } else row.name = safeName(name);
      return { ...row };
    },
    async getPlayer(playerId) { const row = players.get(playerId); return row ? { ...row } : null; },
    async topPlayers(limit) {
      return Array.from(players.values()).sort((a, b) => Number(b.donation) - Number(a.donation) || a.name.localeCompare(b.name)).slice(0, limit).map(x => ({ ...x }));
    },
    async donate(playerId, currency, amount) {
      const row = players.get(playerId);
      if (!row) throw new Error('PLAYER_NOT_FOUND');
      const value = Math.floor(Number(amount));
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error('INVALID_AMOUNT');
      const day = new Date().toISOString().slice(0, 10);
      if (row.donation_day !== day) { row.donation_day = day; row.donated_today = 0; }
      let added = value;
      if (currency === 'gold') {
        if (row.gold < value) throw new Error('INSUFFICIENT_GOLD');
        row.gold -= value;
      } else if (currency === 'kc') {
        if (row.kc < value) throw new Error('INSUFFICIENT_KC');
        row.kc -= value;
        added = value * KC_TO_DONATION;
      } else throw new Error('INVALID_CURRENCY');
      row.donation += added;
      row.donated_today += added;
      return { ...row, donation_added: added };
    },
    // Test-only provisioning. Never exposed through the WebSocket protocol.
    async _provision(playerId, patch) { const row = players.get(playerId); Object.assign(row, patch); return { ...row }; }
  };
}

function createSupabaseAdapter(url, serviceKey) {
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
    async ensurePlayer(playerId, name) {
      const rows = await request(`/nobility_players?player_id=eq.${encodeURIComponent(playerId)}&select=*`);
      if (rows && rows[0]) {
        if (rows[0].name !== safeName(name)) await request(`/nobility_players?player_id=eq.${encodeURIComponent(playerId)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ name: safeName(name) }) });
        return { ...rows[0], name: safeName(name) };
      }
      const created = await request('/nobility_players', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ player_id: playerId, name: safeName(name) }) });
      return created[0];
    },
    async getPlayer(playerId) {
      const rows = await request(`/nobility_players?player_id=eq.${encodeURIComponent(playerId)}&select=*`);
      return rows && rows[0] ? rows[0] : null;
    },
    async topPlayers(limit) {
      return await request(`/nobility_players?select=player_id,name,donation&order=donation.desc,name.asc&limit=${Math.max(1, Math.min(100, Number(limit) || 60))}`);
    },
    async donate(playerId, currency, amount) {
      const rows = await request('/rpc/nobility_donate', { method: 'POST', body: JSON.stringify({ p_player_id: playerId, p_currency: currency, p_amount: Math.floor(Number(amount)) }) });
      if (!rows || !rows[0]) throw new Error('DONATION_RPC_EMPTY');
      return rows[0];
    }
  };
}

function createNobilityService(options = {}) {
  const adapter = options.adapter || (options.supabaseUrl && options.supabaseServiceKey ? createSupabaseAdapter(options.supabaseUrl, options.supabaseServiceKey) : createMemoryAdapter());

  async function snapshot(playerId, name) {
    const player = await adapter.ensurePlayer(playerId, name);
    let board = await adapter.topPlayers(60);
    if (!board.some(row => row.player_id === playerId)) board.push(player);
    board = board.sort((a, b) => Number(b.donation) - Number(a.donation) || String(a.name).localeCompare(String(b.name)));
    const position = board.findIndex(row => row.player_id === playerId) + 1;
    const publicBoard = board.slice(0, 50).map((row, index) => ({ id: row.player_id, name: row.name, donation: Number(row.donation) || 0, position: index + 1, isPlayer: row.player_id === playerId }));
    const rank = rankFor(player.donation, position || board.length + 1);
    return {
      version: 'server-nobility-v1',
      source: adapter.mode,
      playerId,
      wallet: { gold: Number(player.gold) || 0, kc: Number(player.kc) || 0 },
      donation: Number(player.donation) || 0,
      donatedToday: Number(player.donated_today) || 0,
      position: position || board.length + 1,
      rank,
      next: nextRank(player.donation, position || board.length + 1, board.map(row => ({ id: row.player_id, name: row.name, donation: Number(row.donation) || 0, isPlayer: row.player_id === playerId }))),
      board: publicBoard,
      damageMultiplier: 1 + (rank.power / 100)
    };
  }

  async function donate(playerId, name, currency, amount) {
    await adapter.ensurePlayer(playerId, name);
    const result = await adapter.donate(playerId, currency, amount);
    return { donationAdded: Number(result.donation_added) || 0, snapshot: await snapshot(playerId, name) };
  }

  async function resolveDamage(playerId, name, baseDamage) {
    const base = Math.max(0, Math.min(500, Math.floor(Number(baseDamage) || 0)));
    const snap = await snapshot(playerId, name);
    const damage = Math.max(0, Math.round(base * snap.damageMultiplier));
    return { baseDamage: base, damage, rank: snap.rank, damageMultiplier: snap.damageMultiplier };
  }

  return { version: 'server-nobility-v1', source: adapter.mode, ensurePlayer: adapter.ensurePlayer, snapshot, donate, resolveDamage, rankFor, _adapter: adapter };
}

module.exports = { KC_TO_DONATION, FIXED_RANKS, RANKED_RANKS, safePlayerId, rankFor, createMemoryAdapter, createSupabaseAdapter, createNobilityService };
