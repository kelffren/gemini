#!/usr/bin/env node
/* KELO-INDEX
 * area: PERFORMANCE / CI
 * owner: Performance Foundation audit
 * keys: PERFORMANCE LIFECYCLE SLEEP WAKE LAZY AOI CULL ATLAS VISIBILITY CI
 * purpose: protege contratos estructurales de rendimiento sin depender de timings inestables
 * online: valida fronteras de transporte/AOI; no sustituye tests de autoridad server
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}
function ok(condition, message) {
  assert.ok(condition, message);
  console.log('PASS', message);
}
function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

function auditSimulationLifecycle() {
  const source = read('src/core/simulation-extension-system.js');
  const context = vm.createContext({ console, globalThis: null, updateSimulation(dt) { context.baseCalls += 1; return dt; }, baseCalls: 0 });
  context.globalThis = context;
  vm.runInContext(source, context, { filename: 'simulation-extension-system.js' });
  const S = context.KeloSimulation;
  assert.ok(S && typeof S.setEnabled === 'function');
  let calls = 0;
  const id = S.after('audit:test', () => { calls += 1; }, 10);
  context.updateSimulation(0.016);
  assert.strictEqual(calls, 1);
  assert.strictEqual(S.setEnabled(id, false), true);
  assert.strictEqual(S.setEnabled(id, false), true);
  context.updateSimulation(0.016);
  assert.strictEqual(calls, 1, 'sleeping hook executed');
  let snap = S.snapshot();
  assert.strictEqual(snap.sleeping, 1);
  assert.strictEqual(snap.enabled, 0);
  assert.strictEqual(S.setEnabled(id, true), true);
  assert.strictEqual(S.setEnabled(id, true), true);
  context.updateSimulation(0.016);
  assert.strictEqual(calls, 2, 'wake duplicated hook or failed');
  assert.strictEqual(S.unregister(id), true);
  context.updateSimulation(0.016);
  assert.strictEqual(calls, 2, 'unregistered hook executed');
  snap = S.snapshot();
  assert.strictEqual(snap.registered, 0);
  ok(true, 'KeloSimulation sleep/wake is idempotent and unregister-safe');
}

function auditRenderLifecycle() {
  const source = read('src/core/render-extension-system.js');
  const context = vm.createContext({ console, globalThis: null, render() { context.baseCalls += 1; }, baseCalls: 0 });
  context.globalThis = context;
  vm.runInContext(source, context, { filename: 'render-extension-system.js' });
  const R = context.KeloRender;
  assert.ok(R && typeof R.setEnabled === 'function');
  let calls = 0;
  const id = R.afterFrame('audit:test', () => { calls += 1; }, 10);
  context.render();
  assert.strictEqual(calls, 1);
  R.setEnabled(id, false);
  R.setEnabled(id, false);
  context.render();
  assert.strictEqual(calls, 1, 'sleeping render hook executed');
  assert.strictEqual(R.snapshot().sleeping, 1);
  R.setEnabled(id, true);
  R.setEnabled(id, true);
  context.render();
  assert.strictEqual(calls, 2, 'wake duplicated render hook or failed');
  R.unregister(id);
  context.render();
  assert.strictEqual(calls, 2);
  ok(true, 'KeloRender sleep/wake is idempotent and unregister-safe');
}

function auditStaticContracts() {
  const sim = read('src/core/simulation-extension-system.js');
  const render = read('src/core/render-extension-system.js');
  const profile = read('src/ui/profile-panel-close.js');
  const selfUi = read('src/ui/self-interaction-ui.js');
  const preview = read('src/ui/character-customizer-preview.js');
  const studio = read('src/ui/studio-launcher.js');
  const net = read('engine-net.js');
  const server = read('server/index.js');
  const perf = read('src/systems/performance-governor.js');
  const atlas = read('src/environment/atlas-contract.js');
  const index = read('index.html');

  ok(count(sim, /updateSimulation\s*=\s*function/g) === 1, 'KeloSimulation keeps one authorized legacy bridge');
  ok(count(render, /render\s*=\s*function/g) === 1, 'KeloRender keeps one authorized legacy bridge');
  ok(sim.includes('activeListCached:true') && render.includes('activeListCached:true'), 'sleeping hooks use cached active lists');

  ok(!profile.includes('src/core/kelo-runtime-bootstrap.js'), 'Profile no longer boots combat/effects/melee foundations implicitly');
  ok(profile.includes('characterCustomizationLazy:true'), 'Character Customizer is first-use lazy');
  ok(!index.includes('src/ui/character-customizer-ui.js'), 'Character Customizer heavy UI is absent from static boot graph');
  ok(studio.includes("import('./../studio/integration/live-studio-controller.mjs')"), 'Studio remains action-triggered dynamic import');

  ok(!preview.includes('new MutationObserver'), 'Character preview has no permanent global MutationObserver');
  ok(preview.includes('continuousRaf:false'), 'Character preview has no continuous private RAF');
  ok(!selfUi.includes('observer.observe(document.documentElement'), 'Self UI no longer observes the whole document');
  ok(selfUi.includes("observer.observe(root,{childList:true,subtree:true})"), 'Backpack observer is scoped to its owner DOM');

  ok(net.includes('POSE_HEARTBEAT_INTERVAL'), 'Network pose uses change-driven + heartbeat policy');
  ok(net.includes("perf.shouldUpdate('net-peer:'"), 'Peer interpolation consumes KELO_PERF distance scheduler');
  ok(net.includes('perf.shouldRenderActor'), 'Peer render consumes KELO_PERF actor culling');
  ok(net.includes('performanceSnapshot:performanceSnapshot'), 'Network exposes performance telemetry through existing authority API');

  ok(server.includes('AOI_CELL = 512') && server.includes('AOI_HYSTERESIS'), 'Server room owns spatial AOI + hysteresis');
  ok(server.includes('publicStateFor(viewer, index)'), 'Server snapshots are per-viewer AOI');
  ok(!server.includes("JSON.stringify({ t: 'state', players: publicState() })"), 'Periodic server snapshots no longer serialize the full room for everyone');

  ok(perf.includes("root.KeloEvents.emit(name,payload)"), 'PerformanceGovernor publishes visibility through KeloEvents');
  ok(perf.includes("'CLIENT_HIDDEN'") && perf.includes("'CLIENT_VISIBLE'"), 'Visibility lifecycle has stable semantic events');
  ok(perf.includes('simulation:sim') && perf.includes('network:net'), 'Existing performance HUD snapshot aggregates runtime owners');

  ok(atlas.includes("district:'warm-then-evict'"), 'District atlases use warm-then-evict policy');
  ok(atlas.includes("entry?.role==='core'"), 'Core atlases are protected from eviction');
  ok(atlas.includes('runtimeSnapshot'), 'Atlas owner exposes resident/refcount lifecycle telemetry');
}

function reportBootGraph() {
  const index = read('index.html');
  const directScripts = [...index.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(m => m[1]);
  const customizer = directScripts.filter(src => /character-customizer|character-customization|character-content-packs|character-slot-schema/.test(src));
  console.log('INFO direct-script-count', directScripts.length);
  console.log('INFO direct-character-customizer-count', customizer.length);
  console.log('INFO performance-foundation-audit', 'v1.0.0');
}

try {
  auditSimulationLifecycle();
  auditRenderLifecycle();
  auditStaticContracts();
  reportBootGraph();
  console.log('PASS Kelo Performance Foundation audit');
} catch (error) {
  console.error('FAIL Kelo Performance Foundation audit');
  console.error(error && error.stack || error);
  process.exit(1);
}
