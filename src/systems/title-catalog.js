/* KELO-INDEX
 * area: PROGRESSION / TITLES
 * owner: KeloTitles consumes this pure data catalog
 * keys: TITLES CATALOG DATA PROGRESSION ACHIEVEMENTS RARITY
 * purpose: catálogo declarativo e indexado de títulos desbloqueables; añadir contenido no toca el engine
 * public-api: KeloTitleCatalog.list/get/byStat/categories/rarities
 * consumes: N/A (pure data)
 * state-owned: definiciones inmutables + índice requirement.stat
 * extension-points: registrar títulos como data en TITLES
 * reuse: achievements, quests, leaderboard y UI pueden resolver metadata por ID estable
 * legacy: N/A
 * do-not: NO decidir kills, autoridad, persistencia ni render
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.KeloTitleCatalog = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CATEGORIES = Object.freeze([
    'pvp','pve','bosses','exploration','commerce','economy','professions','construction',
    'nobility','clans','factions','caravans','events','seasons','secrets','collections'
  ]);
  const RARITIES = Object.freeze(['common','uncommon','rare','epic','legendary','mythic']);

  const TITLES = Object.freeze([
    Object.freeze({
      id: 'pvp_combatant', name: 'Combatiente', category: 'pvp', rarity: 'common', styleKey: 'common', iconKey: 'pvp',
      description: 'Derrota a 10 jugadores en PvP de Mundo Abierto.',
      requirement: Object.freeze({ stat: 'openWorldPlayerKills', operator: 'gte', value: 10 })
    }),
    Object.freeze({
      id: 'pvp_hunter', name: 'Cazador', category: 'pvp', rarity: 'rare', styleKey: 'rare', iconKey: 'pvp',
      description: 'Derrota a 50 jugadores en PvP de Mundo Abierto.',
      requirement: Object.freeze({ stat: 'openWorldPlayerKills', operator: 'gte', value: 50 })
    }),
    Object.freeze({
      id: 'pvp_assassin', name: 'Asesino', category: 'pvp', rarity: 'epic', styleKey: 'epic', iconKey: 'pvp',
      description: 'Derrota a 200 jugadores en PvP de Mundo Abierto.',
      requirement: Object.freeze({ stat: 'openWorldPlayerKills', operator: 'gte', value: 200 })
    }),
    Object.freeze({
      id: 'pvp_executioner', name: 'Verdugo', category: 'pvp', rarity: 'legendary', styleKey: 'legendary', iconKey: 'pvp',
      description: 'Derrota a 500 jugadores en PvP de Mundo Abierto.',
      requirement: Object.freeze({ stat: 'openWorldPlayerKills', operator: 'gte', value: 500 })
    }),
    Object.freeze({
      id: 'pvp_realm_scourge', name: 'Azote del Reino', category: 'pvp', rarity: 'mythic', styleKey: 'mythic', iconKey: 'pvp',
      description: 'Derrota a 1.000 jugadores en PvP de Mundo Abierto.',
      requirement: Object.freeze({ stat: 'openWorldPlayerKills', operator: 'gte', value: 1000 })
    })
  ]);

  const BY_ID = new Map();
  const BY_STAT = new Map();
  TITLES.forEach(function (title) {
    if (BY_ID.has(title.id)) throw new Error('Duplicate title id: ' + title.id);
    BY_ID.set(title.id, title);
    const stat = title.requirement && title.requirement.stat;
    if (!stat) return;
    if (!BY_STAT.has(stat)) BY_STAT.set(stat, []);
    BY_STAT.get(stat).push(title);
  });
  BY_STAT.forEach(function (list, stat) {
    list.sort(function (a, b) { return Number(a.requirement.value) - Number(b.requirement.value); });
    BY_STAT.set(stat, Object.freeze(list.slice()));
  });

  function list() { return TITLES; }
  function get(id) { return BY_ID.get(String(id || '')) || null; }
  function byStat(stat) { return BY_STAT.get(String(stat || '')) || Object.freeze([]); }

  return Object.freeze({
    version: 'title-catalog-v1',
    list: list,
    get: get,
    byStat: byStat,
    categories: CATEGORIES,
    rarities: RARITIES
  });
});
