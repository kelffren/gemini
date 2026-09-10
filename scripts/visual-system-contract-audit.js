/* KELO-INDEX
 * area: QA
 * keys: VISUAL TEST CONTRACT DECOUPLING ANIMATION VFX PROJECTILE SFX SEQUENCE ONLINE
 * hace: prueba contratos modulares estables sin fijar cache-bust versions ni ownership legacy
 * online: comprueba relay semántico sanitizado y separación gameplay/presentation
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
function source(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function run(rel, sandbox) { vm.runInContext(source(rel), sandbox, { filename: rel }); }

class FakeParam { setValueAtTime() {} exponentialRampToValueAtTime() {} }
class FakeOscillator { constructor() { this.frequency = new FakeParam(); this.type = 'sine'; } connect() {} start() {} stop() {} }
class FakeGain { constructor() { this.gain = new FakeParam(); } connect() {} }
class FakeAudioContext {
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
  createOscillator() { return new FakeOscillator(); }
  createGain() { return new FakeGain(); }
  resume() { return Promise.resolve(); }
}
class FakeImage {
  constructor() { this.width = 64; this.height = 64; this.naturalWidth = 64; this.naturalHeight = 64; this.decoding = 'async'; }
  set src(value) { this._src = value; setTimeout(() => { if (this.onload) this.onload(); }, 0); }
  get src() { return this._src; }
}
class FakeAudio { addEventListener() {} load() {} cloneNode() { return this; } play() { return Promise.resolve(); } }

async function main() {
  const sandbox = {
    console, URLSearchParams, performance: { now: () => 1000 },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Image: FakeImage, Audio: FakeAudio, AudioContext: FakeAudioContext,
    location: { search: '' }, innerWidth: 390, innerHeight: 844,
    document: { readyState: 'loading', hidden: false, addEventListener() {}, body: null },
    addEventListener() {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  [
    'src/visuals/visual-system.js',
    'src/visuals/visual-manifests.js',
    'src/visuals/asset-registry.js',
    'src/visuals/animation-system.js',
    'src/visuals/fx-system.js',
    'src/visuals/sequence-system.js'
  ].forEach(rel => run(rel, sandbox));

  assert(sandbox.KeloAssetRegistry.get('hero_default_sheet'), 'asset registry exposes stable IDs');
  assert(sandbox.KeloAnimationRegistry.get('cast_magic_01'), 'animation registry exposes reusable clips');
  assert(sandbox.KeloFXRegistry.get('fire_explosion_medium'), 'FX registry exposes reusable impacts');
  assert(sandbox.KeloProjectileVisualRegistry.get('projectile_fire_orb_01'), 'projectile visual registry exposes pilot');
  assert(sandbox.KeloSequenceRegistry.get('sequence_fire_cast_01'), 'sequence registry exposes pilot');
  assert(sandbox.KeloSFXRegistry.get('fire_cast_01'), 'SFX registry exposes pilot');
  assert(sandbox.KeloAnchors && sandbox.KeloAnchors.get, 'semantic actor anchors are available');

  const actor = { id: 'audit_actor', x: 100, y: 100, radius: 20, _face: 'right' };
  const center = sandbox.KeloAnchors.get(actor, 'center');
  assert(center && Number.isFinite(center.x) && Number.isFinite(center.y), 'generic center anchor resolves without skin-specific data');

  const animId = sandbox.KeloAnimation.play(actor, 'cast_magic_01');
  assert(animId, 'AnimationClip plays independently from gameplay ability runtime');
  sandbox.KeloAnimation.update(0.05);
  assert(sandbox.KeloAnimation.sampleTransform(actor), 'animation produces presentation transform only');

  const fxId = sandbox.KeloFX.spawn('fire_explosion_medium', { origin: { x: 120, y: 100 }, visual: { seed: 7, scale: 1 } });
  assert(fxId, 'FX spawns independently from gameplay');
  const projectileId = sandbox.KeloProjectileVisuals.preview('projectile_fire_orb_01', { origin: { x: 100, y: 100 }, direction: { x: 1, y: 0 }, gameplay: { speed: 420, range: 300 }, visual: { seed: 8 } });
  assert(projectileId, 'ProjectileVisual previews independently from authoritative projectile');
  assert.strictEqual(sandbox.KeloSFX.play('fire_cast_01', { actor }), true, 'SFX plays independently');

  const seqId = sandbox.KeloSequence.play('sequence_debug_explosion_reuse', { actor, origin: { x: 100, y: 100 }, visual: { seed: 9 } });
  assert(seqId, 'Sequence plays without AbilityEngine');
  sandbox.KeloSequence.update(0.2);
  assert(sandbox.KeloFX.metrics().active >= 1, 'sequence dispatches reusable FX');

  sandbox.ABILITIES = [{ id: 1, key: 'fireball', visualProfileId: 'ability_visual_fireball_01' }];
  sandbox.KeloAbilities = {
    registry: {
      getById(id) { return sandbox.ABILITIES.find(d => d.id === Number(id)) || null; },
      getByKey(key) { return sandbox.ABILITIES.find(d => d.key === key) || null; }
    },
    hotbar: { slots: [] }, bus: { on() {} }
  };
  run('src/visuals/ability-visuals.js', sandbox);
  assert(sandbox.KeloAbilityVisuals.hasProfile('fireball'), 'optional ability visual profile resolves');

  const stoneSource = source('src/abilities/stone-system.js');
  ['KeloAnimation','KeloFX','KeloSequence','KeloVisualProfile'].forEach(token => assert(!stoneSource.includes(token), 'StoneSystem stays decoupled from visual runtime: ' + token));

  const engineC = source('engine-c.js');
  assert(engineC.includes('KeloVisualSystem.update(dt)'), 'central engine owns visual update');
  const orderedLayers = ['groundFX','belowActor','worldFX','foregroundFX','screenFX'];
  let last = -1;
  orderedLayers.forEach(layer => { const at = engineC.indexOf("'" + layer + "'"); assert(at > last, 'explicit visual layer order broken at ' + layer); last = at; });

  const integration = source('src/visuals/visual-integration.js');
  assert(integration.includes('renderAvatar.__keloVisualBridge'), 'actor render bridge remains idempotent');
  assert(!integration.includes('const _render = render') && !integration.includes('render = function'), 'visual integration does not create another global render wrapper');

  const net = source('engine-net.js');
  const server = source('server/index.js');
  assert(net.includes("t: 'visual:event'") && net.includes('VISUAL_EVENT_ALLOWLIST'), 'client transports allowlisted semantic visual events');
  assert(server.includes("msg.t==='visual:event'") && server.includes('sanitizeVisualContext'), 'server sanitizes visual relay context');
  assert(server.includes('VISUAL_EVENT_ALLOWLIST') && server.includes('server-visual-relay-v2-aoi'), 'server visual relay is allowlisted and AOI-scoped');

  const index = source('index.html');
  const coreAt = index.indexOf('src/visuals/visual-system.js');
  const abilityAt = index.indexOf('src/abilities/kelo-ability-boot.js');
  const resolverAt = index.indexOf('src/visuals/ability-visuals.js');
  const netAt = index.indexOf('engine-net.js');
  const finalAt = index.indexOf('src/visuals/visual-integration.js');
  assert(coreAt > 0 && coreAt < abilityAt && abilityAt < resolverAt && resolverAt < netAt && finalAt > netAt, 'visual load order preserves core -> gameplay -> resolver/network -> final bridge');

  console.log('PASS visual system contract audit');
  console.log(JSON.stringify({
    animation: sandbox.KeloAnimation.metrics(),
    fx: sandbox.KeloFX.metrics(),
    projectile: sandbox.KeloProjectileVisuals.metrics(),
    sequence: sandbox.KeloSequence.metrics(),
    semanticAnchor: center,
    decoupledStoneSystem: true,
    semanticOnlineRelay: true
  }, null, 2));
}

main().catch(error => { console.error(error && error.stack || error); process.exit(1); });
