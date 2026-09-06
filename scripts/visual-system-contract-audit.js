/* KELO-INDEX
 * area: QA
 * keys: VISUAL TEST CONTRACT DECOUPLING ANIMATION VFX PROJECTILE SFX SEQUENCE ONLINE
 * hace: prueba en Node los contratos modulares y verifica fronteras estáticas del runtime
 * online: comprueba que el relay usa eventos semánticos y que StoneSystem no depende de visuales
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
function source(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function run(rel, sandbox) { vm.runInContext(source(rel), sandbox, { filename: rel }); }

class FakeParam {
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeOscillator {
  constructor() { this.frequency = new FakeParam(); this.type = 'sine'; }
  connect() {} start() {} stop() {}
}
class FakeGain {
  constructor() { this.gain = new FakeParam(); }
  connect() {}
}
class FakeAudioContext {
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
  createOscillator() { return new FakeOscillator(); }
  createGain() { return new FakeGain(); }
  resume() { return Promise.resolve(); }
}
class FakeImage {
  constructor() { this.width = 64; this.height = 64; this.naturalWidth = 64; this.naturalHeight = 64; this.decoding = 'async'; }
  set src(value) { this._src = value; }
  get src() { return this._src; }
}
class FakeAudio {
  addEventListener() {} load() {} cloneNode() { return this; } play() { return Promise.resolve(); }
}

async function main() {
  const sandbox = {
    console, URLSearchParams, performance: { now: () => 1000 },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Image: FakeImage, Audio: FakeAudio, AudioContext: FakeAudioContext,
    location: { search: '' }, innerWidth: 390, innerHeight: 844,
    document: { readyState: 'loading', addEventListener() {}, body: null }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  run('src/visuals/visual-system.js', sandbox);
  run('src/visuals/visual-manifests.js', sandbox);
  run('src/visuals/asset-registry.js', sandbox);
  run('src/visuals/animation-system.js', sandbox);
  run('src/visuals/fx-system.js', sandbox);
  run('src/visuals/sequence-system.js', sandbox);

  assert(sandbox.KeloAssetRegistry.get('hero_default_sheet'), 'asset registry must expose stable IDs');
  assert(sandbox.KeloAnimationRegistry.get('cast_magic_01'), 'animation registry missing pilot clip');
  assert(sandbox.KeloFXRegistry.get('fire_explosion_medium'), 'FX registry missing reusable impact');
  assert(sandbox.KeloProjectileVisualRegistry.get('projectile_fire_orb_01'), 'projectile visual registry missing pilot');
  assert(sandbox.KeloSequenceRegistry.get('sequence_fire_cast_01'), 'sequence registry missing pilot');
  assert(sandbox.KeloSFXRegistry.get('fire_cast_01'), 'SFX registry missing pilot');

  const actor = { id: 'audit_actor', x: 100, y: 100, radius: 20, _face: 'right' };
  const animId = sandbox.KeloAnimation.play(actor, 'cast_magic_01');
  assert(animId, 'AnimationClip must play without an ability');
  sandbox.KeloAnimation.update(0.12);
  assert(sandbox.KeloAnimation.sampleTransform(actor), 'independent animation must produce presentation transform');

  const fxId = sandbox.KeloFX.spawn('fire_explosion_medium', { origin: { x: 120, y: 100 }, visual: { seed: 7, scale: 1 } });
  assert(fxId, 'FX must spawn without an ability');
  const projectileId = sandbox.KeloProjectileVisuals.preview('projectile_fire_orb_01', { origin: { x: 100, y: 100 }, direction: { x: 1, y: 0 }, gameplay: { speed: 420, range: 300 }, visual: { seed: 8 } });
  assert(projectileId, 'ProjectileVisual must preview without gameplay projectile');
  sandbox.KeloProjectileVisuals.update(0.05);
  assert(sandbox.KeloProjectileVisuals.metrics().active === 1, 'projectile preview should be independently active');
  assert.strictEqual(sandbox.KeloSFX.play('fire_cast_01', { actor }), true, 'SFX must play independently');

  const seqId = sandbox.KeloSequence.play('sequence_debug_explosion_reuse', { actor, origin: { x: 100, y: 100 }, visual: { seed: 9 } });
  assert(seqId, 'Sequence must play without AbilityEngine');
  sandbox.KeloSequence.update(0.2);
  assert(sandbox.KeloFX.metrics().active >= 2, 'sequence must dispatch independent reusable FX');

  const impact = sandbox.KELO_VISUAL_MANIFESTS.sequences.sequence_fire_impact_01.cues.some(c => c.ref === 'fire_explosion_medium');
  const debugReuse = sandbox.KELO_VISUAL_MANIFESTS.sequences.sequence_debug_explosion_reuse.cues.some(c => c.ref === 'fire_explosion_medium');
  assert(impact && debugReuse, 'same FX definition must be reusable by multiple sequences');

  sandbox.ABILITIES = [
    { id: 1, key: 'fireball', visualProfileId: 'ability_visual_fireball_01' },
    { id: 99, key: 'audit_second_ability' }
  ];
  sandbox.KeloAbilities = {
    registry: {
      getById(id) { return sandbox.ABILITIES.find(d => d.id === Number(id)) || null; },
      getByKey(key) { return sandbox.ABILITIES.find(d => d.key === key) || null; }
    },
    hotbar: { slots: [] },
    bus: { on() {} }
  };
  run('src/visuals/ability-visuals.js', sandbox);
  assert(sandbox.KeloAbilityVisuals.hasProfile('fireball'), 'Fireball optional visual profile must resolve');
  sandbox.KeloVisualProfileRegistry.register({ id: 'audit_profile_second', abilityKey: 'audit_second_ability', castSequence: 'sequence_fire_cast_01' });
  assert.strictEqual(sandbox.KeloVisualProfileRegistry.resolve(null, 'audit_second_ability').castSequence, 'sequence_fire_cast_01', 'same animation sequence/clip must be reusable by another ability profile');
  sandbox.KeloAbilityVisuals.setEnabled(false);
  assert.strictEqual(sandbox.KeloAbilityVisuals.enabled, false, 'visual resolver must be independently disableable');
  sandbox.KeloAbilityVisuals.setEnabled(true);

  const missing = await sandbox.KeloAssetRegistry.load('asset_that_does_not_exist');
  assert.strictEqual(missing, null, 'missing asset must degrade without throwing');

  const stoneSource = source('src/abilities/stone-system.js');
  ['KeloAnimation','KeloFX','KeloSequence','KeloVisualProfile'].forEach(token => assert(!stoneSource.includes(token), 'StoneSystem must not know visual runtime: ' + token));

  const abilitySource = source('src/abilities/abilityData.js');
  assert(abilitySource.includes("visualProfileId: 'ability_visual_fireball_01'"), 'ability data should only reference optional visual profile ID');
  assert(abilitySource.includes("visuals: Object.freeze({ color: '#ff6b35', fx: 'fireball' })"), 'legacy visual compatibility must remain during migration');

  const engineC = source('engine-c.js');
  const orderedLayers = ['groundFX','belowActor','worldFX','foregroundFX','screenFX'];
  let last = -1;
  orderedLayers.forEach(layer => { const at = engineC.indexOf("'" + layer + "'"); assert(at > last, 'engine-c explicit visual layer order broken at ' + layer); last = at; });
  assert(engineC.includes('KeloVisualSystem.update(dt)'), 'visual update must enter through central engine owner');

  const integration = source('src/visuals/visual-integration.js');
  assert(integration.includes('renderAvatar.__keloVisualBridge'), 'final actor bridge must be idempotent');
  assert(!integration.includes('const _render = render') && !integration.includes('render = function'), 'visual integration must not add another global render wrapper');

  const net = source('engine-net.js');
  const server = source('server/index.js');
  assert(net.includes("t: 'visual:event'") && net.includes('VISUAL_EVENT_ALLOWLIST'), 'client must transport semantic visual events');
  assert(server.includes("msg.t === 'visual:event'") && server.includes('sanitizeVisualContext'), 'server must sanitize visual relay');
  assert(!server.includes('visual:event') || server.includes('no resuelve gameplay'), 'server visual relay must be documented non-authoritative for gameplay');

  const index = source('index.html');
  const coreAt = index.indexOf('src/visuals/visual-system.js');
  const abilityAt = index.indexOf('src/abilities/kelo-ability-boot.js');
  const resolverAt = index.indexOf('src/visuals/ability-visuals.js');
  const netAt = index.indexOf('engine-net.js?v=96');
  const finalAt = index.indexOf('src/visuals/visual-integration.js');
  assert(coreAt > 0 && coreAt < abilityAt && abilityAt < resolverAt && resolverAt < netAt && finalAt > netAt, 'visual load order must preserve gameplay then resolver/network then final actor bridge');
  assert(index.includes('src/visuals/visual-lab.js'), 'Visual Lab must be loaded behind query flag');

  console.log('PASS visual system contract audit');
  console.log(JSON.stringify({
    assets: sandbox.KeloAssetRegistry.metrics(),
    animation: sandbox.KeloAnimation.metrics(),
    fx: sandbox.KeloFX.metrics(),
    projectile: sandbox.KeloProjectileVisuals.metrics(),
    sequence: sandbox.KeloSequence.metrics(),
    profile: sandbox.KeloVisualProfileRegistry.resolve(1, 'fireball').id,
    decoupledStoneSystem: true,
    semanticOnlineRelay: true
  }, null, 2));
}

main().catch(error => { console.error(error && error.stack || error); process.exit(1); });
