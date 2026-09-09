#!/usr/bin/env node
/* KELO-INDEX
 * area: TOOLING / PERFORMANCE
 * owner: Performance Foundation CI contract
 * keys: AUDIT PERFORMANCE LAZY SLEEP WAKE LRU AOI NETWORK VISIBILITY ABILITIES PVP
 * purpose: detectar regresiones estructurales que vuelven eager/per-frame/global trabajo que debe ser lazy/dormible/espacial
 * public-api: CLI `node scripts/performance-foundation-audit.js`
 * consumes: source text only; no browser/network required
 * state-owned: none
 * extension-points: añadir invariantes permanentes cuando se prueba una optimización nueva
 * reuse: CI y auditoría local
 * do-not: NO medir FPS sintético aquí; este audit valida contratos deterministas
 */
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
let failed = 0;
let passed = 0;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function ok(condition, message) {
  if (condition) {
    passed += 1;
    console.log('✓', message);
  } else {
    failed += 1;
    console.error('✗', message);
  }
}
function has(text, token) { return text.includes(token); }

const profile = read('src/ui/profile-panel-close.js');
const pvpLoader = read('src/systems/pvp-combat-runtime-loader.js');
const simulation = read('src/core/simulation-extension-system.js');
const render = read('src/core/render-extension-system.js');
const visual = read('src/visuals/visual-system.js');
const abilities = read('src/abilities/kelo-ability-boot.js');
const perf = read('src/systems/performance-governor.js');
const atlas = read('src/environment/atlas-contract.js');
const world = read('src/environment/world-map.js');
const net = read('engine-net.js');
const server = read('server/index.js');
const index = read('index.html');
const catalog = JSON.parse(read('docs/system-catalog.json'));

ok(!has(profile, "loadScript('src/core/kelo-runtime-bootstrap.js") && !has(profile, 'RUNTIME_SCRIPTS'), 'Profile no arranca combat/effects/melee como side effect');
ok(has(profile, 'CUSTOMIZATION_SCRIPTS') && has(profile, 'ensureCustomizer') && has(profile, 'characterCustomizationLazy:true'), 'Character Customizer tiene launcher lazy de primera acción');
ok(!/character-customizer-(?:ui|preview)\.js[^\n<]*<script/i.test(index), 'Character Customizer pesado no está en el critical path de index.html');

ok(has(pvpLoader, "BOOTSTRAP_SRC='src/core/kelo-runtime-bootstrap.js") && has(pvpLoader, 'ensureCombatReady') && has(pvpLoader, 'combatReady()'), 'PvP carga Combat/Effects/Melee por first-use usando el bootstrap existente');
ok(has(pvpLoader, 'enterPromise') && has(pvpLoader, 'if(enterPromise)return enterPromise'), 'PvP deduplica entradas mientras Combat está cargando');
ok(has(pvpLoader, 'Object.getOwnPropertyDescriptors(original)') && has(pvpLoader, 'descriptors.enter=') && has(pvpLoader, 'descriptors.ensureCombatReady='), 'PvP conserva la API/getters del owner al instalar la fachada lazy');
ok(has(index, 'src/systems/pvp-combat-runtime-loader.js?v=1'), 'Runtime monta el bridge lazy inmediatamente después de KeloPvPWorld');
ok(!/<script[^>]+src=["']src\/core\/kelo-runtime-bootstrap\.js/i.test(index), 'Combat bootstrap pesado no vuelve al critical path de index.html');

ok(has(simulation, 'setEnabled') && has(simulation, 'enabled') && has(simulation, 'activeBefore'), 'KeloSimulation soporta sleep/wake sin unregister/register por frame');
ok(has(render, 'setEnabled') && has(render, 'enabled') && has(render, 'activeAfter'), 'KeloRender soporta sleep/wake sin wrapper paralelo');

ok(has(visual, 'hasActiveWork') && has(visual, 'sleep') && has(visual, 'wake'), 'Visual System tiene fast-path lifecycle para trabajo vacío');
ok(has(abilities, 'hasSimulationWork') && has(abilities, 'hasLegacyVisualWork') && has(abilities, 'syncLifecycle'), 'KeloAbilities puede detectar trabajo real y dormir sus hooks');
ok(has(abilities, 'simulationHookId') && has(abilities, 'renderHookId') && has(abilities, 'KeloSimulation.setEnabled') && has(abilities, 'KeloRender.setEnabled'), 'KeloAbilities reutiliza los owners Foundation para sleep/wake');
ok(has(abilities, 'performanceSnapshot') && has(abilities, 'simulationInitiallySleeping') && has(abilities, 'renderInitiallySleeping'), 'KeloAbilities expone telemetría de lifecycle auditable');
ok(has(abilities, 'visibleStoneCount') && has(abilities, 'if (!html) return') && has(abilities, 'if (!equip) return'), 'Stone panel conserva seguridad para inventario mixto');

ok(has(perf, 'visibilitychange') && has(perf, 'CLIENT_HIDDEN') && has(perf, 'CLIENT_VISIBLE'), 'Performance Governor posee lifecycle semántico de visibilidad');
ok(has(perf, 'shouldUpdate') && has(perf, 'shouldRenderActor'), 'Performance Governor conserva LOD espacial reusable');

ok(has(atlas, 'warmMs') && has(atlas, 'evict') && has(atlas, 'runtimeSnapshot'), 'Atlas Contract soporta warm residency + eviction observable');
ok(has(world, 'touchCache') && has(world, "cache.delete(key);cache.set(key,value)") && has(world, "chunkCacheMode:'lru-v1'"), 'World chunk cache es LRU limitada');
ok(has(world, 'requestGardens') && has(world, 'releaseGardens') && has(world, 'syncDistrictAssets'), 'Gardens usa residency lazy por distrito');
ok(!/acquireManagedAtlases\(\)[\s\S]{0,900}A\.acquire\(['\"]gardensBase['\"]\)/.test(world), 'Core terrain bootstrap no adquiere Gardens incondicionalmente');
ok(has(world, 'CAM.worldView()'), 'World culling reutiliza KeloCamera como owner de viewport');

ok(has(net, 'POSE_HEARTBEAT_INTERVAL') && has(net, 'poseChanged') && has(net, 'poseSkippedUnchanged'), 'Pose client es change-driven con heartbeat idle');
ok(has(net, "perf.shouldUpdate('net-peer:'") && has(net, 'perf.shouldRenderActor'), 'Peers reutilizan KELO_PERF para update/render LOD');
ok(has(server, 'AOI_CELL') && has(server, 'AOI_RADIUS') && has(server, 'AOI_HYSTERESIS'), 'Server declara AOI espacial con hysteresis');
ok(has(server, 'publicStateFor') && has(server, 'sendRelevantStates') && has(server, 'viewer.zone !== target.zone'), 'Server state se filtra por zone + AOI por viewer');
ok(has(server, 'sendRelevantEvent') && has(server, 'server-visual-relay-v2-aoi'), 'Visual relay server respeta AOI');

const perfEntry = Array.isArray(catalog.systems) && catalog.systems.find((s) => s.id === 'performance-foundation');
ok(!!perfEntry && perfEntry.technicalDoc === 'docs/systems/PERFORMANCE_FOUNDATION.md', 'Performance Foundation está registrada en system catalog');
ok(fs.existsSync(path.join(root, 'docs/systems/PERFORMANCE_FOUNDATION.md')), 'Documento técnico Performance Foundation existe');

const forbidden = [
  ['src/core/simulation-extension-system.js', /setInterval\s*\(/],
  ['src/core/render-extension-system.js', /setInterval\s*\(/],
  ['src/ui/profile-panel-close.js', /setInterval\s*\(/],
  ['src/abilities/kelo-ability-boot.js', /setInterval\s*\(/],
  ['src/systems/pvp-combat-runtime-loader.js', /setInterval\s*\(/],
];
for (const [rel, re] of forbidden) ok(!re.test(read(rel)), rel + ' no introduce watchdog setInterval');

console.log(`\nPerformance Foundation audit: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
