/* KELO-INDEX
 * area: QA
 * keys: MELEE VISUAL TEST HIT MISS DIRECTION GAMEPLAY DECOUPLING MOBILE
 * hace: valida en Node el contrato visual melee, sus 4 direcciones y que no mute gameplay
 * online: prueba eventos semánticos; no introduce autoridad visual sobre daño/cooldown
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
  constructor() { this.width = 128; this.height = 128; this.naturalWidth = 128; this.naturalHeight = 128; this.decoding = 'async'; }
  set src(value) { this._src = value; setTimeout(() => { if (this.onload) this.onload(); }, 0); }
  get src() { return this._src; }
}
class FakeAudio { addEventListener() {} load() {} cloneNode() { return this; } play() { return Promise.resolve(); } }

async function main() {
  let clock = 1000;
  const sandbox = {
    console, URLSearchParams,
    performance: { now: () => clock },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Image: FakeImage, Audio: FakeAudio, AudioContext: FakeAudioContext,
    location: { search: '' }, innerWidth: 390, innerHeight: 844,
    document: { readyState: 'loading', addEventListener() {}, body: null }
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
    'src/visuals/sequence-system.js',
    'src/visuals/melee-visual-manifest.js',
    'src/visuals/melee-combat-visuals.js'
  ].forEach(rel => run(rel, sandbox));

  const manifest = sandbox.KELO_MELEE_VISUAL_MANIFEST;
  assert(manifest, 'melee manifest must boot');
  assert.strictEqual(manifest.attackDurationMs, 330, 'attack duration drifted');
  assert.strictEqual(manifest.impactAtMs, 150, 'impact timing drifted');
  assert.strictEqual(Object.keys(manifest.attackClips).length, 4, 'four directional attack clips required');
  assert.strictEqual(Object.keys(manifest.reactionClips).length, 4, 'four directional reaction clips required');
  assert.strictEqual(Object.keys(manifest.slashAssets).length, 4, 'four directional slash assets required');
  assert(sandbox.KeloScreenFX.get('impact_melee_light'), 'light melee shake missing');
  assert(sandbox.KeloScreenFX.get('flash_melee_light'), 'light melee flash missing');

  const directions = {
    right: { x: 1, y: 0 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 }
  };

  for (const [face, dir] of Object.entries(directions)) {
    clock += 250;
    const actor = { id: 'actor_' + face, x: 100, y: 100, radius: 20, _face: 'down' };
    const target = { id: 'target_' + face, x: 100 + dir.x * 80, y: 100 + dir.y * 80, radius: 20, _face: 'down' };
    const before = { x: actor.x, y: actor.y, targetX: target.x, targetY: target.y };
    const attack = sandbox.KeloMeleeVisuals.playAttack({
      attackId: 'dir_' + face, actor, targetActor: target, direction: dir, confirmedHit: false, visualStartedAt: clock
    });
    assert(attack, 'attack must start for ' + face);
    assert.strictEqual(attack.face, face, 'direction mapping failed for ' + face);
    assert.strictEqual(actor.x, before.x, 'visual attack moved actor x for ' + face);
    assert.strictEqual(actor.y, before.y, 'visual attack moved actor y for ' + face);
    assert.strictEqual(target.x, before.targetX, 'miss moved target x for ' + face);
    assert.strictEqual(target.y, before.targetY, 'miss moved target y for ' + face);
    sandbox.KeloAnimation.update(0.08);
    sandbox.KeloSequence.update(0.08);
    const transform = sandbox.KeloAnimation.sampleTransform(actor);
    assert(transform, 'body transform missing for ' + face);
    assert.strictEqual(transform.clipId, manifest.attackClips[face], 'wrong attack clip for ' + face);
    assert(sandbox.KeloFX.metrics().active > 0, 'slash FX did not spawn for ' + face);
  }

  clock += 400;
  const attacker = { id: 'hit_attacker', x: 200, y: 200, radius: 20, _face: 'right' };
  const victim = { id: 'hit_victim', x: 285, y: 200, radius: 20, _face: 'left' };
  const beforeHit = { ax: attacker.x, ay: attacker.y, vx: victim.x, vy: victim.y };
  const hitPayload = {
    attackId: 'confirmed_hit_1', actor: attacker, targetActor: victim,
    direction: { x: 1, y: 0 }, confirmedHit: true, visualStartedAt: clock - 200,
    gameplay: { damage: 18, range: 150, cooldown: 0.7 }
  };
  assert(sandbox.KeloMeleeVisuals.playAttack(hitPayload), 'confirmed attack must start');
  assert(sandbox.KeloMeleeVisuals.playHit(hitPayload), 'confirmed hit must present');
  sandbox.KeloAnimation.update(0.05);
  sandbox.KeloSequence.update(0.01);
  const reaction = sandbox.KeloAnimation.sampleTransform(victim);
  assert(reaction && reaction.channel === 'reaction', 'confirmed hit must trigger reaction channel');
  assert.strictEqual(attacker.x, beforeHit.ax, 'hit visual mutated attacker x');
  assert.strictEqual(attacker.y, beforeHit.ay, 'hit visual mutated attacker y');
  assert.strictEqual(victim.x, beforeHit.vx, 'hit reaction mutated victim x');
  assert.strictEqual(victim.y, beforeHit.vy, 'hit reaction mutated victim y');
  assert.strictEqual(sandbox.KELO_MELEE_VISUAL_AUDIT.hitsPresented, 1, 'hit audit count wrong');
  assert.strictEqual(sandbox.KELO_MELEE_VISUAL_AUDIT.missesPresented, 4, 'miss audit count wrong');

  const hitSparks = sandbox.KeloFXRegistry.get('melee_hit_sparks_light_01');
  assert(hitSparks && hitSparks.space === 'WORLD' && hitSparks.layer === 'foregroundFX', 'finishing hit FX must survive victim render removal');

  const pvp = source('src/systems/pvp-world.js');
  assert(pvp.includes("t.hp=Math.max(0,(t.hp==null?100:t.hp)-18)"), 'basic damage authority changed');
  assert(pvp.includes('state.basicCooldown=.7'), 'basic cooldown authority changed');
  assert(pvp.includes("dist(localPlayer,t)>150"), 'basic range authority changed');
  assert(pvp.includes("emitVisual('MELEE_ATTACK_STARTED'"), 'PvP must emit semantic melee attack event');
  assert(pvp.includes("emitVisual('MELEE_HIT_CONFIRMED'"), 'PvP must emit semantic confirmed hit event');
  assert(pvp.includes("if(r.ok)emitVisual('MELEE_HIT_CONFIRMED'"), 'miss must never emit confirmed hit visual');

  const index = source('index.html');
  const core = index.indexOf('src/visuals/sequence-system.js');
  const manifestAt = index.indexOf('src/visuals/melee-visual-manifest.js');
  const runtimeAt = index.indexOf('src/visuals/melee-combat-visuals.js');
  assert(core >= 0 && manifestAt > core && runtimeAt > manifestAt, 'melee visual load order invalid');
  assert(index.includes('src/systems/pvp-world.js?v=4'), 'PvP cache bust missing');

  ['up', 'down', 'left', 'right'].forEach(face => {
    assert(fs.existsSync(path.join(ROOT, 'assets/fx/melee/sword-light-slash-' + face + '.svg')), 'slash SVG missing: ' + face);
  });

  await new Promise(resolve => setTimeout(resolve, 5));
  const missing = sandbox.KeloAssetRegistry.metrics().missing;
  assert.strictEqual(missing.length, 0, 'melee assets reported missing: ' + JSON.stringify(missing));

  console.log('PASS melee visual contract audit');
  console.log(JSON.stringify({
    version: manifest.version,
    attackDurationMs: manifest.attackDurationMs,
    anticipationMs: manifest.anticipationMs,
    impactAtMs: manifest.impactAtMs,
    recoveryMs: manifest.recoveryMs,
    attackClips: Object.keys(manifest.attackClips).length,
    reactionClips: Object.keys(manifest.reactionClips).length,
    slashAssets: Object.keys(manifest.slashAssets).length,
    attacksStarted: sandbox.KELO_MELEE_VISUAL_AUDIT.attacksStarted,
    hitsPresented: sandbox.KELO_MELEE_VISUAL_AUDIT.hitsPresented,
    missesPresented: sandbox.KELO_MELEE_VISUAL_AUDIT.missesPresented,
    gameplayAuthorityUnchanged: true
  }, null, 2));
}

main().catch(error => { console.error(error && error.stack || error); process.exit(1); });
