(function (root, factory) {
  const data = factory();

  if (root) {
    root.KELO_ABILITY_DATA = data;
    root.KELO_ABILITY_DEBUG = root.KELO_ABILITY_DEBUG === true;
    root.STONE_TYPES = data.STONE_TYPES;
    root.STONES = data.STONES;
    root.ABILITIES = data.ABILITIES;
    root.KELO_STONE_TIERS = data.TIERS;
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = data;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 3;

  const STONE_TYPES = Object.freeze({
    ELEMENT: 'element',
    FORM: 'form',
  });

  const TIERS = Object.freeze({
    Common: Object.freeze({ rank: 0, affixes: 0, minRoll: 0, maxRoll: 0 }),
    Rare: Object.freeze({ rank: 1, affixes: 1, minRoll: 0.03, maxRoll: 0.06 }),
    Epic: Object.freeze({ rank: 2, affixes: 1, minRoll: 0.06, maxRoll: 0.09 }),
    Legendary: Object.freeze({ rank: 3, affixes: 2, minRoll: 0.07, maxRoll: 0.11 }),
    Mythic: Object.freeze({ rank: 4, affixes: 2, minRoll: 0.10, maxRoll: 0.14 }),
    Divine: Object.freeze({ rank: 5, affixes: 3, minRoll: 0.12, maxRoll: 0.18 }),
  });

  const STONES = Object.freeze({
    fire: Object.freeze({ id: 'fire', type: STONE_TYPES.ELEMENT, name: 'Fuego', icon: '🔥' }),
    ice: Object.freeze({ id: 'ice', type: STONE_TYPES.ELEMENT, name: 'Hielo', icon: '❄️' }),
    lightning: Object.freeze({ id: 'lightning', type: STONE_TYPES.ELEMENT, name: 'Rayo', icon: '⚡' }),
    wind: Object.freeze({ id: 'wind', type: STONE_TYPES.ELEMENT, name: 'Viento', icon: '🌪️' }),
    earth: Object.freeze({ id: 'earth', type: STONE_TYPES.ELEMENT, name: 'Tierra', icon: '🪨' }),
    shadow: Object.freeze({ id: 'shadow', type: STONE_TYPES.ELEMENT, name: 'Sombra', icon: '🌑' }),
    poison: Object.freeze({ id: 'poison', type: STONE_TYPES.ELEMENT, name: 'Veneno', icon: '☠️' }),
    light: Object.freeze({ id: 'light', type: STONE_TYPES.ELEMENT, name: 'Luz', icon: '✨' }),

    projectile: Object.freeze({ id: 'projectile', type: STONE_TYPES.FORM, name: 'Proyectil', icon: '🎯' }),
    nova: Object.freeze({ id: 'nova', type: STONE_TYPES.FORM, name: 'Nova', icon: '💥' }),
    chain: Object.freeze({ id: 'chain', type: STONE_TYPES.FORM, name: 'Cadena', icon: '⛓️' }),
    dash: Object.freeze({ id: 'dash', type: STONE_TYPES.FORM, name: 'Dash', icon: '💨' }),
    shield: Object.freeze({ id: 'shield', type: STONE_TYPES.FORM, name: 'Escudo', icon: '🛡️' }),
    vortex: Object.freeze({ id: 'vortex', type: STONE_TYPES.FORM, name: 'Vórtice', icon: '🌀' }),
    wall: Object.freeze({ id: 'wall', type: STONE_TYPES.FORM, name: 'Muro', icon: '🧱' }),
    trap: Object.freeze({ id: 'trap', type: STONE_TYPES.FORM, name: 'Trampa', icon: '🪤' }),
    aura: Object.freeze({ id: 'aura', type: STONE_TYPES.FORM, name: 'Aura', icon: '⭕' }),
    swap: Object.freeze({ id: 'swap', type: STONE_TYPES.FORM, name: 'Intercambio', icon: '🗡️' }),
  });

  const ABILITIES = Object.freeze([
    Object.freeze({
      id: 1,
      key: 'fireball',
      name: 'Bola de Fuego',
      icon: '🔥',
      slotType: 'normal',
      role: 'burst',
      recipe: Object.freeze(['fire', 'projectile']),
      targeting: Object.freeze({ type: 'direction', range: 500 }),
      resource: Object.freeze({ type: 'mana', cost: 20 }),
      cooldown: 4,
      delivery: Object.freeze({ type: 'projectile', speed: 420, radius: 16, maxDistance: 500 }),
      effects: Object.freeze([
        Object.freeze({ type: 'damage', damageType: 'fire', amount: 35 }),
        Object.freeze({ type: 'status', status: 'burn', duration: 3, magnitude: 6, tickInterval: 1 }),
      ]),
      visuals: Object.freeze({ color: '#ff6b35', fx: 'fireball' }),
    }),
    Object.freeze({
      id: 2,
      key: 'ice_nova',
      name: 'Nova de Hielo',
      icon: '❄️',
      slotType: 'normal',
      role: 'control',
      recipe: Object.freeze(['ice', 'nova']),
      targeting: Object.freeze({ type: 'self' }),
      resource: Object.freeze({ type: 'mana', cost: 25 }),
      cooldown: 7,
      delivery: Object.freeze({ type: 'self_aoe', radius: 130 }),
      effects: Object.freeze([
        Object.freeze({ type: 'damage', damageType: 'ice', amount: 22 }),
        Object.freeze({ type: 'status', status: 'slow', duration: 2.5, magnitude: 0.4 }),
      ]),
      visuals: Object.freeze({ color: '#7ec8ff', fx: 'ice_nova' }),
    }),
    Object.freeze({
      id: 3,
      key: 'chain_lightning',
      name: 'Cadena Eléctrica',
      icon: '⚡',
      slotType: 'normal',
      role: 'burst',
      recipe: Object.freeze(['lightning', 'chain']),
      targeting: Object.freeze({ type: 'target', range: 400 }),
      resource: Object.freeze({ type: 'mana', cost: 25 }),
      cooldown: 6,
      delivery: Object.freeze({ type: 'chain', maxTargets: 3, jumpRange: 180, damageFalloff: 0.8 }),
      effects: Object.freeze([Object.freeze({ type: 'damage', damageType: 'lightning', amount: 28 })]),
      visuals: Object.freeze({ color: '#ffe066', fx: 'chain_lightning' }),
    }),
    Object.freeze({
      id: 4,
      key: 'wind_dash',
      name: 'Dash de Viento',
      icon: '🌪️',
      slotType: 'normal',
      role: 'mobility',
      recipe: Object.freeze(['wind', 'dash']),
      targeting: Object.freeze({ type: 'direction', range: 160 }),
      resource: Object.freeze({ type: 'mana', cost: 15 }),
      cooldown: 5,
      delivery: Object.freeze({ type: 'dash', distance: 160, duration: 0.18 }),
      effects: Object.freeze([]),
      visuals: Object.freeze({ color: '#b8f2e6', fx: 'wind_dash' }),
    }),
    Object.freeze({
      id: 5,
      key: 'stone_shield',
      name: 'Escudo de Piedra',
      icon: '🪨',
      slotType: 'normal',
      role: 'defense',
      recipe: Object.freeze(['earth', 'shield']),
      targeting: Object.freeze({ type: 'self' }),
      resource: Object.freeze({ type: 'mana', cost: 30 }),
      cooldown: 10,
      delivery: Object.freeze({ type: 'instant' }),
      effects: Object.freeze([Object.freeze({ type: 'shield', amount: 80, duration: 4 })]),
      visuals: Object.freeze({ color: '#c9a24a', fx: 'stone_shield' }),
    }),
    Object.freeze({
      id: 6,
      key: 'fire_tornado',
      name: 'Tornado Ígneo',
      icon: '🌋',
      slotType: 'ultimate',
      role: 'ultimate',
      recipe: Object.freeze(['fire', 'vortex']),
      targeting: Object.freeze({ type: 'position', range: 350 }),
      resource: Object.freeze({ type: 'mana', cost: 35 }),
      cooldown: 9,
      delivery: Object.freeze({ type: 'persistent_area', radius: 90, duration: 3, tickInterval: 0.5 }),
      effects: Object.freeze([Object.freeze({ type: 'damage', damageType: 'fire', amount: 10, perTick: true })]),
      visuals: Object.freeze({ color: '#ff8c42', fx: 'fire_tornado' }),
    }),
    Object.freeze({
      id: 7,
      key: 'ice_wall',
      name: 'Muro de Hielo',
      icon: '🧊',
      slotType: 'normal',
      role: 'control',
      recipe: Object.freeze(['ice', 'wall']),
      targeting: Object.freeze({ type: 'position', range: 300 }),
      resource: Object.freeze({ type: 'mana', cost: 30 }),
      cooldown: 12,
      delivery: Object.freeze({ type: 'wall', width: 150, duration: 4, hp: 250, blocksMovement: true, blocksProjectiles: true }),
      effects: Object.freeze([]),
      visuals: Object.freeze({ color: '#a8d8ff', fx: 'ice_wall' }),
    }),
    Object.freeze({
      id: 8,
      key: 'shadow_step',
      name: 'Paso Sombrío',
      icon: '🌑',
      slotType: 'normal',
      role: 'mobility',
      recipe: Object.freeze(['shadow', 'dash']),
      targeting: Object.freeze({ type: 'direction', range: 130 }),
      resource: Object.freeze({ type: 'mana', cost: 25 }),
      cooldown: 8,
      delivery: Object.freeze({ type: 'blink', distance: 130 }),
      effects: Object.freeze([]),
      visuals: Object.freeze({ color: '#6c5ce7', fx: 'shadow_step' }),
    }),
    Object.freeze({
      id: 9,
      key: 'poison_trap',
      name: 'Trampa Venenosa',
      icon: '☠️',
      slotType: 'normal',
      role: 'control',
      recipe: Object.freeze(['poison', 'trap']),
      targeting: Object.freeze({ type: 'position', range: 300 }),
      resource: Object.freeze({ type: 'mana', cost: 20 }),
      cooldown: 9,
      delivery: Object.freeze({ type: 'trap', activationRadius: 55, armTime: 0.5, duration: 15 }),
      effects: Object.freeze([
        Object.freeze({ type: 'damage', damageType: 'poison', amount: 12 }),
        Object.freeze({ type: 'status', status: 'poison', duration: 4, magnitude: 8, tickInterval: 1 }),
      ]),
      visuals: Object.freeze({ color: '#8ac926', fx: 'poison_trap' }),
    }),
    Object.freeze({
      id: 10,
      key: 'light_aura',
      name: 'Aura de Luz',
      icon: '✨',
      slotType: 'normal',
      role: 'sustain',
      recipe: Object.freeze(['light', 'aura']),
      targeting: Object.freeze({ type: 'self' }),
      resource: Object.freeze({ type: 'mana', cost: 35 }),
      cooldown: 12,
      delivery: Object.freeze({ type: 'aura', radius: 100, duration: 4, tickInterval: 1 }),
      effects: Object.freeze([Object.freeze({ type: 'heal', amount: 12, perTick: true })]),
      visuals: Object.freeze({ color: '#fff3b0', fx: 'light_aura' }),
    }),
    Object.freeze({
      id: 11,
      key: 'swap_sword',
      name: 'Espada de Intercambio',
      icon: '🗡️',
      slotType: 'normal',
      role: 'mobility',
      recipe: Object.freeze(['shadow', 'swap']),
      targeting: Object.freeze({ type: 'position', range: 420 }),
      resource: Object.freeze({ type: 'mana', cost: 30 }),
      cooldown: 12,
      delivery: Object.freeze({ type: 'swap_sword', speed: 720, selectRadius: 42, returnDuration: 0.28 }),
      effects: Object.freeze([]),
      visuals: Object.freeze({ color: '#64d7ff', accent: '#e7c56a', fx: 'swap_sword' }),
    }),
  ]);

  return Object.freeze({ VERSION, STONE_TYPES, TIERS, STONES, ABILITIES });
});