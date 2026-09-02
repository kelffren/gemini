'use strict';

const assert = require('assert');
const data = require('../src/abilities/abilityData.js');
const stones = require('../src/abilities/stone-system.js');

const supportedDelivery = new Set([
  'projectile', 'self_aoe', 'chain', 'dash', 'blink',
  'instant', 'persistent_area', 'wall', 'trap', 'aura',
]);

function recipeKey(recipe) {
  return [...recipe].sort().join('|');
}

function auditCatalog() {
  assert.equal(data.ABILITIES.length, 10, 'V1 must expose exactly 10 abilities');
  const ids = new Set();
  const keys = new Set();
  const recipes = new Set();

  for (const ability of data.ABILITIES) {
    assert(!ids.has(ability.id), 'duplicate ability id ' + ability.id);
    assert(!keys.has(ability.key), 'duplicate ability key ' + ability.key);
    const rKey = recipeKey(ability.recipe);
    assert(!recipes.has(rKey), 'duplicate recipe ' + rKey);
    ids.add(ability.id);
    keys.add(ability.key);
    recipes.add(rKey);

    assert.equal(ability.recipe.length, 2, ability.key + ' must use element + form');
    const parts = ability.recipe.map((id) => data.STONES[id]);
    assert(parts.every(Boolean), ability.key + ' references unknown recipe component');
    assert(parts.some((p) => p.type === data.STONE_TYPES.ELEMENT), ability.key + ' missing element');
    assert(parts.some((p) => p.type === data.STONE_TYPES.FORM), ability.key + ' missing form');
    assert(supportedDelivery.has(ability.delivery.type), ability.key + ' uses unsupported delivery ' + ability.delivery.type);
    assert(['normal', 'ultimate'].includes(ability.slotType), ability.key + ' missing slotType');
  }

  return { abilities: ids.size, recipes: recipes.size };
}

function auditMigration() {
  const state = {
    inventory: [
      { uid: 'legacy_a', typeId: 'fireball', tier: 'Rare' },
      { uid: 'legacy_b', typeId: 'dash', tier: 'Common' },
    ],
    equipped: [
      { uid: 'legacy_c', typeId: 'shield', tier: 'Epic' },
      { uid: 'legacy_d', typeId: 'frostnova', tier: 'Common' },
      { uid: 'legacy_e', typeId: 'meteor', tier: 'Rare' },
    ],
    marketListings: [],
  };
  const report = stones.migrateState(state);
  assert.equal(report.quarantined, 0, 'known legacy stones must migrate');
  assert.equal(state.equipped[2].abilityKey, 'fire_tornado', 'legacy meteor must map to V1 ultimate');
  assert(state.inventory.concat(state.equipped).every((stone) => stone.schemaVersion === stones.SCHEMA_VERSION));
  return report;
}

function auditLoadout() {
  const starter = stones.createStarterSet();
  assert.equal(starter.length, 5, 'starter loadout must contain five stones');
  assert.equal(starter[4].abilityKey, 'fire_tornado', 'fifth starter slot must be the ultimate');
  assert.equal(stones.abilityByKey(starter[4].abilityKey).slotType, 'ultimate');

  const state = { inventory: [], equipped: starter, marketListings: [] };
  stones.migrateState(state);
  const snapshot = stones.exportLoadout(state);
  assert.equal(snapshot.slots.filter(Boolean).length, 5);
  assert(stones.validateLoadoutSnapshot(snapshot, state).valid, 'authoritative snapshot should validate');
  return { fingerprint: snapshot.fingerprint, slots: snapshot.slots.length };
}

function auditScale() {
  const ids = new Set();
  const originalDefinitions = JSON.stringify(data.ABILITIES);
  for (let i = 0; i < 1000; i++) {
    const ability = data.ABILITIES[i % data.ABILITIES.length];
    const tier = stones.TIER_NAMES[i % stones.TIER_NAMES.length];
    const stone = stones.createAbilityStone(ability.key, tier);
    assert(!ids.has(stone.uid), 'stone uid collision at ' + i);
    ids.add(stone.uid);
    const resolved = stones.resolveAbility(stone);
    assert(resolved && resolved.key === ability.key, 'stone failed to resolve at ' + i);
  }
  assert.equal(JSON.stringify(data.ABILITIES), originalDefinitions, 'runtime must never mutate catalog definitions');
  return { generated: ids.size };
}

const report = {
  catalog: auditCatalog(),
  migration: auditMigration(),
  loadout: auditLoadout(),
  scale: auditScale(),
};

console.log('KELO_STONE_AUDIT=PASS');
console.log(JSON.stringify(report, null, 2));
