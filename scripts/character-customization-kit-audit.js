'use strict';
const fs = require('fs');

function read(path) { return fs.readFileSync(path, 'utf8'); }
function assert(ok, message) {
  if (!ok) { console.error('FAIL:', message); process.exitCode = 1; }
  else console.log('PASS:', message);
}

const kitPath = 'src/characters/character-demo-kit.js';
const previewPath = 'src/ui/character-customizer-preview.js';
const bootstrapPath = 'src/ui/profile-panel-close.js';
const kit = read(kitPath);
const preview = read(previewPath);
const bootstrap = read(bootstrapPath);

const sheetAssets = [
  'vanguard-torso.svg',
  'vanguard-legs.svg',
  'vanguard-feet.svg',
  'vanguard-crown.svg',
  'night-visor.svg'
];
const weaponAssets = ['solar-saber.svg', 'onyx-katana.svg'];
const ids = [
  'torso_kelo_vanguard','legs_kelo_vanguard','feet_kelo_vanguard',
  'head_vanguard_crown','head_night_visor','weapon_solar_saber','weapon_onyx_katana',
  'outfit_kelo_vanguard'
];

ids.forEach(id => assert(kit.includes(id), 'demo kit declares ' + id));
assert(!/\.hp\s*=|\.damage\s*=|cooldown\s*=|attackPower\s*=/.test(kit), 'demo kit contains no gameplay stat mutation');
assert(kit.includes("mode: 'sheet'") && kit.includes('columns: 4') && kit.includes('rows: 4'), 'outfit and helmet overlays use 4x4 directional sheets');
assert(kit.includes("socket: 'weapon'"), 'weapons attach to semantic weapon socket');
assert(kit.includes("slots:{ torso:'torso_kelo_vanguard', legs:'legs_kelo_vanguard', feet:'feet_kelo_vanguard' }"), 'Vanguard outfit remains a modular preset');

sheetAssets.forEach(name => {
  const path = 'src/characters/customization-assets/' + name;
  assert(fs.existsSync(path), name + ' exists');
  if (!fs.existsSync(path)) return;
  const svg = read(path);
  assert(/<svg[^>]+width="512"[^>]+height="768"/.test(svg), name + ' is 512x768 / 4x4 actor-sheet sized');
  const uses = (svg.match(/<use\b/g) || []).length;
  assert(uses === 16, name + ' explicitly covers all 16 directional frames');
  assert(svg.includes('shape-rendering="crispEdges"'), name + ' keeps crisp pixel sampling');
});

weaponAssets.forEach(name => {
  const path = 'src/characters/customization-assets/' + name;
  assert(fs.existsSync(path), name + ' exists');
  if (!fs.existsSync(path)) return;
  const svg = read(path);
  assert(/<svg[^>]+width="64"[^>]+height="64"/.test(svg), name + ' uses a compact 64x64 weapon canvas');
  assert(svg.includes('shape-rendering="crispEdges"'), name + ' keeps crisp pixel sampling');
});

const coreAt = bootstrap.indexOf('character-customization.js');
const kitAt = bootstrap.indexOf('character-demo-kit.js');
const uiAt = bootstrap.indexOf('character-customizer-ui.js');
const previewAt = bootstrap.indexOf('character-customizer-preview.js');
assert(coreAt >= 0 && coreAt < kitAt && kitAt < uiAt && uiAt < previewAt, 'bootstrap order is core -> content -> UI -> layered preview');
assert(preview.includes("SHEET_SLOTS") && preview.includes("state.slots.weaponMain"), 'preview composes selected clothing/head and weapon independently');
assert(preview.includes('image-rendering:pixelated'), 'preview preserves pixel-art sampling');

if (process.exitCode) {
  console.error('\nCharacter customization demo kit audit FAILED');
  process.exit(process.exitCode);
} else {
  console.log('\nCharacter customization demo kit audit OK');
}
