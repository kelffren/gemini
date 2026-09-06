/* KELO-INDEX
 * area: QA
 * keys: LIVE MOBILE VISUAL ANIMATION VFX PROJECTILE SEQUENCE FIREBALL REMOTE DECOUPLING
 * hace: valida en Pages que las piezas visuales son independientes y que Fireball conserva gameplay sin resolver visual
 * online: simula el mismo evento semántico que recibe un peer; no falsifica autoridad gameplay
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
fs.mkdirSync('artifacts', { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: chrome, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
const httpErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(`PAGEERROR: ${e.stack || e.message}`));
page.on('requestfailed', r => failedRequests.push({ url: r.url(), error: r.failure()?.errorText || 'failed' }));
page.on('response', r => { if (r.status() >= 400) httpErrors.push({ status: r.status(), url: r.url() }); });

await page.route(/\/(engine-c\.js|engine-net\.js|src\/abilities\/abilityData\.js|src\/visuals\/[^?]+\.js)(\?|$)/, route => {
  const u = new URL(route.request().url());
  u.searchParams.set('visual-audit-bust', `${Date.now()}-${Math.random()}`);
  route.continue({ url: u.toString() });
});

await page.goto(`${base}?visualLab=1&visual-live-audit=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForFunction(() => window.KELO_VISUAL_AUDIT?.integrationReady === true && window.KeloAbilities?.hotbar?.slots, null, { timeout: 15000 });
await page.waitForTimeout(500);

const boot = await page.evaluate(() => {
  const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
  const fireSlot = window.KeloAbilities.hotbar.slots.findIndex(slot => slot?.abilityKey === 'fireball');
  const layout = p && window.KELO_AVATAR_PRESENTATION?.get(p, p._face || 'down');
  return {
    title: document.title,
    fireSlot,
    lab: !!document.getElementById('kelo-visual-lab'),
    audit: JSON.parse(JSON.stringify(window.KELO_VISUAL_AUDIT)),
    api: {
      asset: !!window.KeloAssetRegistry,
      animation: !!window.KeloAnimation,
      fx: !!window.KeloFX,
      projectile: !!window.KeloProjectileVisuals,
      sfx: !!window.KeloSFX,
      sequence: !!window.KeloSequence,
      profile: !!window.KeloAbilityVisuals,
      anchors: !!window.KeloAnchors,
      eventBus: !!window.KeloVisualEventBus
    },
    player: p ? { x: p.x, y: p.y, radius: p.radius, face: p._face } : null,
    layout
  };
});
if (!boot.title.includes('V6.26')) throw new Error(`stale LIVE title ${boot.title}`);
if (boot.fireSlot < 0) throw new Error('Fireball starter slot missing');
if (!boot.lab) throw new Error('Visual Lab did not activate with query flag');
for (const [key, value] of Object.entries(boot.api)) if (!value) throw new Error(`missing public visual API ${key}`);
if (!boot.audit.actorBridgeWrapped || !boot.audit.integrationReady) throw new Error(`visual integration unavailable ${JSON.stringify(boot.audit)}`);
if (!boot.layout || boot.layout.footRootY - boot.layout.physicsRootY !== 10) throw new Error('foot-root contract drifted before visual test');

const independent = await page.evaluate(() => {
  const p = window.localPlayer || localPlayer;
  const before = { x: p.x, y: p.y, radius: p.radius };
  const animationId = KeloAnimation.play(p, 'cast_magic_01', { force: true });
  const fxId = KeloFX.spawn('fire_explosion_medium', { origin: { x: p.x + 70, y: p.y }, visual: { seed: 101, scale: 1 } });
  const projectileId = KeloProjectileVisuals.preview('projectile_fire_orb_01', { origin: KeloAnchors.get(p, 'castOrigin'), direction: { x: 1, y: 0 }, gameplay: { speed: 260, range: 180 }, visual: { seed: 102 } });
  const sequenceId = KeloSequence.play('sequence_debug_explosion_reuse', { actor: p, actorId: p.id, origin: { x: p.x - 70, y: p.y }, visual: { seed: 103 } });
  const sfxPlayed = KeloSFX.play('fire_cast_01', { actor: p });
  KeloScreenFX.flash('flash_warm_small');
  return { before, animationId, fxId, projectileId, sequenceId, sfxPlayed };
});
for (const key of ['animationId','fxId','projectileId','sequenceId']) if (!independent[key]) throw new Error(`independent ${key} failed`);
if (!independent.sfxPlayed) throw new Error('independent SFX failed');
await page.waitForTimeout(160);
const afterIndependent = await page.evaluate(() => {
  const p = window.localPlayer || localPlayer;
  return {
    player: { x: p.x, y: p.y, radius: p.radius },
    audit: JSON.parse(JSON.stringify(window.KELO_VISUAL_AUDIT)),
    animation: KeloAnimation.metrics(), fx: KeloFX.metrics(), projectile: KeloProjectileVisuals.metrics(), sequence: KeloSequence.metrics()
  };
});
if (afterIndependent.player.x !== independent.before.x || afterIndependent.player.y !== independent.before.y || afterIndependent.player.radius !== independent.before.radius) throw new Error('visual animation mutated gameplay pose/physics');
if (!(afterIndependent.fx.active > 0 && afterIndependent.projectile.active > 0)) throw new Error(`independent visuals not active ${JSON.stringify(afterIndependent)}`);
await page.screenshot({ path: 'artifacts/visual-lab-independent-mobile.png', fullPage: false, scale: 'device' });

const disabledGameplay = await page.evaluate((fireSlot) => {
  const p = window.localPlayer || localPlayer;
  const slot = KeloAbilities.hotbar.slots[fireSlot];
  KeloAbilityVisuals.setEnabled(false);
  slot.cooldown = 0; p.mana = p.maxMana || 100;
  const colorDisabled = slot.definition.visuals?.color;
  const manaBefore = p.mana;
  const result = KeloAbilities.engine.cast({ slotIndex: fireSlot, direction: { x: 1, y: 0 } });
  return { result, manaBefore, manaAfter: p.mana, cooldown: slot.cooldown, colorDisabled, auditEnabled: KELO_VISUAL_AUDIT.abilityResolverEnabled };
}, boot.fireSlot);
if (!disabledGameplay.result?.valid) throw new Error(`Fireball gameplay failed with visual resolver disabled ${JSON.stringify(disabledGameplay)}`);
if (!(disabledGameplay.manaAfter < disabledGameplay.manaBefore && disabledGameplay.cooldown > 0)) throw new Error(`Fireball gameplay did not spend resource/start cooldown ${JSON.stringify(disabledGameplay)}`);
if (disabledGameplay.colorDisabled === 'rgba(0,0,0,0)') throw new Error('legacy fallback was not restored when visual resolver disabled');
if (disabledGameplay.auditEnabled !== false) throw new Error('visual audit did not record disabled resolver');

const enabledFireball = await page.evaluate((fireSlot) => {
  const p = window.localPlayer || localPlayer;
  const slot = KeloAbilities.hotbar.slots[fireSlot];
  KeloAbilityVisuals.setEnabled(true);
  slot.cooldown = 0; p.mana = p.maxMana || 100;
  const result = KeloAbilities.engine.cast({ slotIndex: fireSlot, direction: { x: 1, y: 0 } });
  return { result, colorEnabled: slot.definition.visuals?.color, profile: KeloAbilityVisuals.resolveProfile(slot.abilityId, slot.abilityKey)?.id || null };
}, boot.fireSlot);
if (!enabledFireball.result?.valid || enabledFireball.profile !== 'ability_visual_fireball_01') throw new Error(`Fireball profile integration failed ${JSON.stringify(enabledFireball)}`);
if (enabledFireball.colorEnabled !== 'rgba(0,0,0,0)') throw new Error(`legacy Fireball primitive not masked during new visual ownership: ${enabledFireball.colorEnabled}`);
await page.waitForTimeout(120);
const fireballRuntime = await page.evaluate(() => ({ audit: JSON.parse(JSON.stringify(KELO_VISUAL_AUDIT)), projectile: KeloProjectileVisuals.metrics(), sequence: KeloSequence.metrics(), animation: KeloAnimation.metrics() }));
if (!(fireballRuntime.projectile.active > 0 || fireballRuntime.sequence.active > 0 || fireballRuntime.animation.active > 0)) throw new Error(`Fireball emitted no modular visuals ${JSON.stringify(fireballRuntime)}`);

const remote = await page.evaluate(() => {
  const remoteActor = { id: 'remote_visual_audit', name: 'Remote Audit', x: localPlayer.x - 80, y: localPlayer.y + 70, vx: 0, vy: 0, radius: 20, hp: 100, maxHp: 100, _face: 'right', _gait: 'idle', gear: { bodyColor: '#777', armorColor: '#aaa', weaponColor: '#fff' } };
  if (window.keloNet?.peers) window.keloNet.peers[remoteActor.id] = remoteActor;
  const context = { actor: remoteActor, actorId: remoteActor.id, castId: 'cast_remote_audit_1', abilityId: 1, abilityKey: 'fireball', origin: { x: remoteActor.x, y: remoteActor.y }, direction: { x: 1, y: 0 }, gameplay: { speed: 300, range: 180, radius: 16 }, visual: { seed: 555, scale: 1 }, remote: true, networkReplay: true, confirmed: true };
  KeloVisualEventBus.emit('CAST_CONFIRMED', context);
  KeloVisualEventBus.emit('PROJECTILE_SPAWNED', { ...context, projectileId: 'p_remote_audit_1' });
  return { animation: KeloAnimation.metrics(), projectile: KeloProjectileVisuals.metrics(), sequence: KeloSequence.metrics() };
});
if (!(remote.projectile.active > 0 && (remote.animation.active > 0 || remote.sequence.active > 0))) throw new Error(`remote semantic event did not enter same visual path ${JSON.stringify(remote)}`);
await page.waitForTimeout(100);
await page.screenshot({ path: 'artifacts/visual-fireball-remote-mobile.png', fullPage: false, scale: 'device' });

const final = await page.evaluate(() => {
  const p = window.localPlayer || localPlayer;
  document.getElementById('kelo-visual-lab')?.remove();
  return {
    audit: JSON.parse(JSON.stringify(window.KELO_VISUAL_AUDIT)),
    presentation: window.KELO_AVATAR_PRESENTATION?.get(p, p._face || 'down'),
    movement: window.KELO_MOVEMENT_AUDIT ? JSON.parse(JSON.stringify(window.KELO_MOVEMENT_AUDIT)) : null,
    profile: KeloAbilityVisuals.resolveProfile(1, 'fireball')?.id,
    visualLabApiStillAvailable: !!window.KeloVisualLab,
    stoneSystemVisualKnowledge: ['KeloAnimation','KeloFX','KeloSequence'].some(k => Object.prototype.hasOwnProperty.call(window.KeloStones || {}, k))
  };
});
if (final.audit.missingAssets.length) throw new Error(`unexpected missing visual assets ${JSON.stringify(final.audit.missingAssets)}`);
if (!final.presentation || final.presentation.footRootY - final.presentation.physicsRootY !== 10) throw new Error('foot-root drift after visual runtime');
if (!final.movement || final.movement.version !== 'MOV-plant-audit-v1') throw new Error('movement owner/gait contract missing after visual integration');
if (final.profile !== 'ability_visual_fireball_01') throw new Error('Fireball profile lost');
if (!final.visualLabApiStillAvailable || final.stoneSystemVisualKnowledge) throw new Error(`visual lab/stone decoupling regression ${JSON.stringify(final)}`);

if (consoleErrors.length || failedRequests.length || httpErrors.length) throw new Error(`browser errors ${JSON.stringify({ consoleErrors, failedRequests, httpErrors })}`);
const report = { boot, independent, afterIndependent, disabledGameplay, enabledFireball, fireballRuntime, remote, final, consoleErrors, failedRequests, httpErrors };
fs.writeFileSync('artifacts/visual-system-live-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await context.close();
await browser.close();
