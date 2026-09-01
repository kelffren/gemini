window.KELO_ABILITY_DEBUG = false;
window.STONE_TYPES = Object.freeze({ ELEMENT: 'element', FORM: 'form', MODIFIER: 'modifier' });
window.STONES = Object.freeze({
  fire: { id: 'fire', type: 'element', name: 'Fuego', icon: '\uD83D\uDD25' },
  ice: { id: 'ice', type: 'element', name: 'Hielo', icon: '\u2744\uFE0F' },
  lightning: { id: 'lightning', type: 'element', name: 'Rayo', icon: '\u26A1' },
  wind: { id: 'wind', type: 'element', name: 'Viento', icon: '\uD83C\uDF2A\uFE0F' },
  earth: { id: 'earth', type: 'element', name: 'Tierra', icon: '\uD83E\uDEA8' },
  shadow: { id: 'shadow', type: 'element', name: 'Sombra', icon: '\uD83C\uDF11' },
  poison: { id: 'poison', type: 'element', name: 'Veneno', icon: '\u2620\uFE0F' },
  light: { id: 'light', type: 'element', name: 'Luz', icon: '\u2728' },
  projectile: { id: 'projectile', type: 'form', name: 'Proyectil', icon: '\uD83C\uDFAF' },
  nova: { id: 'nova', type: 'form', name: 'Nova', icon: '\uD83D\uDCA5' },
  chain: { id: 'chain', type: 'form', name: 'Cadena', icon: '\u26D3\uFE0F' },
  dash: { id: 'dash', type: 'form', name: 'Dash', icon: '\uD83D\uDCA8' },
  shield: { id: 'shield', type: 'form', name: 'Escudo', icon: '\uD83D\uDEE1\uFE0F' },
  vortex: { id: 'vortex', type: 'form', name: 'Vortice', icon: '\uD83C\uDF00' },
  wall: { id: 'wall', type: 'form', name: 'Muro', icon: '\uD83E\uDDF1' },
  trap: { id: 'trap', type: 'form', name: 'Trampa', icon: '\uD83E\uDE9A' },
  aura: { id: 'aura', type: 'form', name: 'Aura', icon: '\u2B55' }
});
window.ABILITIES = [
  { id: 1, key: 'fireball', name: 'Bola de Fuego', recipe: ['fire', 'projectile'], targeting: { type: 'direction', range: 500 }, resource: { type: 'mana', cost: 20 }, cooldown: 4, delivery: { type: 'projectile', speed: 420, radius: 16, maxDistance: 500 }, effects: [{ type: 'damage', damageType: 'fire', amount: 35 }, { type: 'status', status: 'burn', duration: 3, magnitude: 6, tickInterval: 1 }], visuals: { color: '#ff6b35' } },
  { id: 2, key: 'ice_nova', name: 'Nova de Hielo', recipe: ['ice', 'nova'], targeting: { type: 'self' }, resource: { type: 'mana', cost: 25 }, cooldown: 7, delivery: { type: 'self_aoe', radius: 130 }, effects: [{ type: 'damage', damageType: 'ice', amount: 22 }, { type: 'status', status: 'slow', duration: 2.5, magnitude: 0.4 }], visuals: { color: '#7ec8ff' } },
  { id: 3, key: 'chain_lightning', name: 'Cadena Electrica', recipe: ['lightning', 'chain'], targeting: { type: 'target', range: 400 }, resource: { type: 'mana', cost: 25 }, cooldown: 6, delivery: { type: 'chain', maxTargets: 3, jumpRange: 180, damageFalloff: 0.8 }, effects: [{ type: 'damage', damageType: 'lightning', amount: 28 }], visuals: { color: '#ffe066' } },
  { id: 4, key: 'wind_dash', name: 'Dash de Viento', recipe: ['wind', 'dash'], targeting: { type: 'direction', range: 160 }, resource: { type: 'mana', cost: 15 }, cooldown: 5, delivery: { type: 'dash', distance: 160, duration: 0.18 }, effects: [], visuals: { color: '#b8f2e6' } },
  { id: 5, key: 'stone_shield', name: 'Escudo de Piedra', recipe: ['earth', 'shield'], targeting: { type: 'self' }, resource: { type: 'mana', cost: 30 }, cooldown: 10, delivery: { type: 'instant' }, effects: [{ type: 'shield', amount: 80, duration: 4 }], visuals: { color: '#c9a24a' } },
  { id: 6, key: 'fire_tornado', name: 'Tornado Igneo', recipe: ['fire', 'vortex'], targeting: { type: 'position', range: 350 }, resource: { type: 'mana', cost: 35 }, cooldown: 9, delivery: { type: 'persistent_area', radius: 90, duration: 3, tickInterval: 0.5 }, effects: [{ type: 'damage', damageType: 'fire', amount: 10, perTick: true }], visuals: { color: '#ff8c42' } },
  { id: 7, key: 'ice_wall', name: 'Muro de Hielo', recipe: ['ice', 'wall'], targeting: { type: 'position', range: 300 }, resource: { type: 'mana', cost: 30 }, cooldown: 12, delivery: { type: 'wall', width: 150, duration: 4, hp: 250, blocksMovement: true, blocksProjectiles: true }, effects: [], visuals: { color: '#a8d8ff' } },
  { id: 8, key: 'shadow_step', name: 'Paso Sombrio', recipe: ['shadow', 'dash'], targeting: { type: 'direction', range: 130 }, resource: { type: 'mana', cost: 25 }, cooldown: 8, delivery: { type: 'blink', distance: 130 }, effects: [], visuals: { color: '#6c5ce7' } },
  { id: 9, key: 'poison_trap', name: 'Trampa Venenosa', recipe: ['poison', 'trap'], targeting: { type: 'position', range: 300 }, resource: { type: 'mana', cost: 20 }, cooldown: 9, delivery: { type: 'trap', activationRadius: 55, armTime: 0.5, duration: 15 }, effects: [{ type: 'damage', damageType: 'poison', amount: 12 }, { type: 'status', status: 'poison', duration: 4, magnitude: 8, tickInterval: 1 }], visuals: { color: '#8ac926' } },
  { id: 10, key: 'light_aura', name: 'Aura de Luz', recipe: ['light', 'aura'], targeting: { type: 'self' }, resource: { type: 'mana', cost: 35 }, cooldown: 12, delivery: { type: 'aura', radius: 100, duration: 4, tickInterval: 1 }, effects: [{ type: 'heal', amount: 12, perTick: true }], visuals: { color: '#fff3b0' } }
];
