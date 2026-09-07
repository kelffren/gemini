/* KELO-INDEX
 * area: QA
 * keys: LIVE MOBILE MELEE HIT MISS DIRECTION SCREENSHOT PERFORMANCE PVP
 * hace: valida en Pages el melee visual en móvil, 4 direcciones, hit/miss real y limpieza de FX
 * online: usa la autoridad PvP existente; solo observa la presentación que nace de sus eventos semánticos
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
fs.mkdirSync('artifacts/melee-live', { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
});
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
const httpErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(`PAGEERROR: ${e.stack || e.message}`));
page.on('requestfailed', r => failedRequests.push({ url: r.url(), error: r.failure()?.errorText || 'failed' }));
page.on('response', r => { if (r.status() >= 400) httpErrors.push({ status: r.status(), url: r.url() }); });

await page.route(/\/(src\/systems\/pvp-world\.js|src\/visuals\/(visual-manifests|melee-visual-manifest|melee-combat-visuals|visual-integration)\.js)(\?|$)/, route => {
  const u = new URL(route.request().url());
  u.searchParams.set('melee-live-bust', `${Date.now()}-${Math.random()}`);
  route.continue({ url: u.toString() });
});

await page.goto(`${base}?melee-live-audit=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForFunction(() => /^Kelo World — V6\.39/i.test(document.title), null, { timeout: 30000 });
await page.waitForFunction(() => window.KeloMeleeVisuals && window.KELO_MELEE_VISUAL_AUDIT?.runtimeReady === true && window.KELO_VISUAL_AUDIT?.integrationReady === true, null, { timeout: 20000 });
await page.waitForTimeout(500);

const boot = await page.evaluate(async () => {
  const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
  const m = window.KELO_MELEE_VISUAL_MANIFEST;
  const loaded = {};
  for (const [face, id] of Object.entries(m.slashAssets)) {
    loaded[face] = !!(await window.KeloAssetRegistry.load(id));
  }
  return {
    title: document.title,
    player: p && { id: p.id, x: p.x, y: p.y, radius: p.radius, face: p._face },
    manifest: {
      version: m.version,
      attackDurationMs: m.attackDurationMs,
      anticipationMs: m.anticipationMs,
      swingMs: m.swingMs,
      impactAtMs: m.impactAtMs,
      recoveryMs: m.recoveryMs,
      reactionDurationMs: m.reactionDurationMs,
      slashAssets: Object.keys(m.slashAssets).length
    },
    loaded,
    pvp: window.KeloPvPWorld?.version || null,
    screen: {
      shake: window.KeloScreenFX?.get('impact_melee_light') || null,
      flash: window.KeloScreenFX?.get('flash_melee_light') || null
    },
    audit: JSON.parse(JSON.stringify(window.KELO_MELEE_VISUAL_AUDIT))
  };
});
if (!boot.player) throw new Error('local player unavailable');
if (boot.pvp !== 'pvp-world-v1.6') throw new Error(`stale PvP runtime ${boot.pvp}`);
if (boot.manifest.slashAssets !== 4 || Object.values(boot.loaded).some(v => !v)) throw new Error(`directional slash assets failed ${JSON.stringify(boot.loaded)}`);
if (!boot.screen.shake || boot.screen.shake.amplitude !== 1.65 || boot.screen.shake.duration !== 0.075) throw new Error(`light shake contract missing ${JSON.stringify(boot.screen.shake)}`);
if (!boot.screen.flash || boot.screen.flash.alpha !== 0.025) throw new Error(`light flash contract missing ${JSON.stringify(boot.screen.flash)}`);

const directions = {
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: -1 }
};
const directionResults = [];
for (const [face, dir] of Object.entries(directions)) {
  const started = await page.evaluate(({ face, dir }) => {
    const p = window.localPlayer || localPlayer;
    const before = { x: p.x, y: p.y, radius: p.radius };
    const target = { id: `live_dir_${face}`, x: p.x + dir.x * 82, y: p.y + dir.y * 82, radius: 20, _face: 'down' };
    const result = window.KeloMeleeVisuals.playAttack({
      attackId: `live_dir_${face}_${Date.now()}`,
      actor: p,
      targetActor: target,
      direction: dir,
      confirmedHit: false,
      visualStartedAt: performance.now(),
      source: 'live-direction-audit'
    });
    return { before, result, faceAfter: p._face };
  }, { face, dir });
  if (!started.result || started.result.face !== face) throw new Error(`direction ${face} did not start correctly ${JSON.stringify(started)}`);
  await page.waitForTimeout(88);
  const mid = await page.evaluate(() => {
    const p = window.localPlayer || localPlayer;
    const transform = window.KeloAnimation.sampleTransform(p);
    return {
      player: { x: p.x, y: p.y, radius: p.radius },
      transform,
      fx: window.KeloFX.metrics(),
      sequence: window.KeloSequence.metrics()
    };
  });
  if (mid.player.x !== started.before.x || mid.player.y !== started.before.y || mid.player.radius !== started.before.radius) throw new Error(`direction ${face} mutated gameplay position`);
  if (!mid.transform || mid.transform.channel !== 'action' || !String(mid.transform.clipId).endsWith(`_${face}`)) throw new Error(`direction ${face} body pose missing ${JSON.stringify(mid.transform)}`);
  if (mid.fx.active < 1) throw new Error(`direction ${face} slash was not active at swing frame`);
  await page.screenshot({ path: `artifacts/melee-live/melee-${face}-swing.png`, fullPage: false, scale: 'device' });
  directionResults.push({ face, clipId: mid.transform.clipId, activeFx: mid.fx.active });
  await page.waitForTimeout(280);
}

// Presentation-only hit on a visible social actor: proves reaction, world impact and no coordinate mutation.
const socialHit = await page.evaluate(() => {
  const p = window.localPlayer || localPlayer;
  const target = (typeof simulatedPlayers !== 'undefined' && simulatedPlayers[0]) || null;
  if (!target) return null;
  target.x = p.x + 88;
  target.y = p.y;
  target.hp = Math.max(1, target.hp || 100);
  const before = { px: p.x, py: p.y, tx: target.x, ty: target.y };
  const attackId = `social_hit_${Date.now()}`;
  const payload = {
    attackId,
    actor: p,
    targetActor: target,
    direction: { x: 1, y: 0 },
    confirmedHit: true,
    visualStartedAt: performance.now(),
    gameplay: { damage: 18, range: 150, cooldown: 0.7 },
    source: 'live-social-hit-audit'
  };
  const attack = KeloMeleeVisuals.playAttack(payload);
  const hit = attack ? KeloMeleeVisuals.playHit(payload) : null;
  return { before, attack, hit, targetId: target.id };
});
if (!socialHit?.attack || !socialHit.hit) throw new Error(`social hit presentation failed ${JSON.stringify(socialHit)}`);
await page.waitForTimeout(165);
const socialHitMid = await page.evaluate(() => {
  const p = window.localPlayer || localPlayer;
  const target = simulatedPlayers[0];
  return {
    coords: { px: p.x, py: p.y, tx: target.x, ty: target.y },
    targetTransform: KeloAnimation.sampleTransform(target),
    fx: KeloFX.metrics(),
    audit: JSON.parse(JSON.stringify(KELO_MELEE_VISUAL_AUDIT))
  };
});
if (socialHitMid.coords.px !== socialHit.before.px || socialHitMid.coords.py !== socialHit.before.py || socialHitMid.coords.tx !== socialHit.before.tx || socialHitMid.coords.ty !== socialHit.before.ty) throw new Error('hit presentation mutated coordinates');
if (!socialHitMid.targetTransform || socialHitMid.targetTransform.channel !== 'reaction') throw new Error(`hit reaction not visible ${JSON.stringify(socialHitMid.targetTransform)}`);
if (socialHitMid.audit.hitsPresented < 1) throw new Error('hit audit did not record presentation');
await page.screenshot({ path: 'artifacts/melee-live/melee-social-impact.png', fullPage: false, scale: 'device' });
await page.waitForTimeout(500);

// Real PvP: use the game's existing command boundary through the canvas input path.
await page.evaluate(() => window.enterPvPWorld());
await page.waitForFunction(() => window.KeloPvPWorld?.state?.combatEnabled === true, null, { timeout: 5000 });
await page.waitForTimeout(150);

const hitTap = await page.evaluate(() => {
  const p = window.localPlayer || localPlayer;
  const d = simulatedPlayers[0];
  d.hp = d.maxHp = 100;
  p.x = d.x - 100; p.y = d.y; p.vx = p.vy = 0;
  camera.x = p.x; camera.y = p.y;
  if ('targetX' in camera) camera.targetX = p.x;
  if ('targetY' in camera) camera.targetY = p.y;
  const z = CONFIG.zoom || 1;
  return {
    sx: screenW / 2 + (d.x - camera.x) * z,
    sy: screenH / 2 + (d.y - camera.y) * z,
    hpBefore: d.hp,
    playerBefore: { x: p.x, y: p.y },
    hitCountBefore: KELO_MELEE_VISUAL_AUDIT.hitsPresented
  };
});
await page.mouse.click(hitTap.sx, hitTap.sy);
await page.waitForTimeout(88);
await page.screenshot({ path: 'artifacts/melee-live/melee-pvp-real-swing.png', fullPage: false, scale: 'device' });
await page.waitForTimeout(90);
const hitResult = await page.evaluate(() => {
  const p = window.localPlayer || localPlayer;
  const d = simulatedPlayers[0];
  return {
    hp: d.hp,
    player: { x: p.x, y: p.y },
    targetTransform: KeloAnimation.sampleTransform(d),
    fx: KeloFX.metrics(),
    audit: JSON.parse(JSON.stringify(KELO_MELEE_VISUAL_AUDIT)),
    pvp: JSON.parse(JSON.stringify(KELO_PVP_AUDIT))
  };
});
if (hitResult.hp !== hitTap.hpBefore - 18) throw new Error(`real PvP hit damage drifted ${hitTap.hpBefore} -> ${hitResult.hp}`);
if (hitResult.player.x !== hitTap.playerBefore.x || hitResult.player.y !== hitTap.playerBefore.y) throw new Error('real melee visual displaced authoritative player');
if (hitResult.audit.hitsPresented <= hitTap.hitCountBefore) throw new Error('real PvP hit emitted no confirmed visual');
if (!hitResult.pvp.semanticMeleeVisualEvents || !hitResult.pvp.arenaVisualLayers) throw new Error(`PvP visual bridge audit missing ${JSON.stringify(hitResult.pvp)}`);
await page.screenshot({ path: 'artifacts/melee-live/melee-pvp-real-impact.png', fullPage: false, scale: 'device' });

// Real miss: target is tapped while outside melee range; HP and hit count must not move, but a swing must happen.
await page.waitForTimeout(760);
const missTap = await page.evaluate(() => {
  const p = window.localPlayer || localPlayer;
  const d = simulatedPlayers[0];
  p.x = d.x - 205; p.y = d.y; p.vx = p.vy = 0;
  camera.x = p.x; camera.y = p.y;
  if ('targetX' in camera) camera.targetX = p.x;
  if ('targetY' in camera) camera.targetY = p.y;
  const z = CONFIG.zoom || 1;
  return {
    sx: screenW / 2 + (d.x - camera.x) * z,
    sy: screenH / 2 + (d.y - camera.y) * z,
    hpBefore: d.hp,
    hitCountBefore: KELO_MELEE_VISUAL_AUDIT.hitsPresented,
    missCountBefore: KELO_MELEE_VISUAL_AUDIT.missesPresented,
    attacksBefore: KELO_MELEE_VISUAL_AUDIT.attacksStarted
  };
});
await page.mouse.click(missTap.sx, missTap.sy);
await page.waitForTimeout(92);
const missMid = await page.evaluate(() => ({
  hp: simulatedPlayers[0].hp,
  fx: KeloFX.metrics(),
  audit: JSON.parse(JSON.stringify(KELO_MELEE_VISUAL_AUDIT))
}));
if (missMid.hp !== missTap.hpBefore) throw new Error('out-of-range miss changed HP');
if (missMid.audit.hitsPresented !== missTap.hitCountBefore) throw new Error('miss incorrectly emitted hit presentation');
if (missMid.audit.missesPresented <= missTap.missCountBefore || missMid.audit.attacksStarted <= missTap.attacksBefore) throw new Error('miss did not emit swing presentation');
if (missMid.fx.active < 1) throw new Error('miss swing has no slash FX');
await page.screenshot({ path: 'artifacts/melee-live/melee-pvp-real-miss.png', fullPage: false, scale: 'device' });

// Stress visual throttle + cleanup: no effect should stay alive after the presentation ends.
await page.evaluate(() => {
  const p = window.localPlayer || localPlayer;
  const d = simulatedPlayers[0];
  for (let i = 0; i < 10; i++) {
    KeloMeleeVisuals.playAttack({
      attackId: `stress_${i}_${Date.now()}`,
      actor: p,
      targetActor: d,
      direction: { x: 1, y: 0 },
      confirmedHit: false,
      visualStartedAt: performance.now(),
      source: 'live-stress-audit'
    });
  }
});
await page.waitForTimeout(700);
const final = await page.evaluate(async () => {
  const p = window.localPlayer || localPlayer;
  const d = simulatedPlayers[0];
  const frames = [];
  let last = performance.now();
  for (let i = 0; i < 45; i++) {
    await new Promise(resolve => requestAnimationFrame(t => { frames.push(t - last); last = t; resolve(); }));
  }
  const sorted = frames.slice().sort((a, b) => a - b);
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || 0;
  return {
    player: { x: p.x, y: p.y },
    dummyHp: d.hp,
    animation: KeloAnimation.metrics(),
    fx: KeloFX.metrics(),
    sequence: KeloSequence.metrics(),
    assets: KeloAssetRegistry.metrics(),
    meleeAudit: JSON.parse(JSON.stringify(KELO_MELEE_VISUAL_AUDIT)),
    visualAudit: JSON.parse(JSON.stringify(KELO_VISUAL_AUDIT)),
    frameTiming: {
      samples: frames.length,
      averageMs: frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length),
      p95Ms: p95
    }
  };
});
if (final.fx.active !== 0) throw new Error(`melee FX leaked after cleanup ${JSON.stringify(final.fx)}`);
if (final.sequence.active !== 0) throw new Error(`melee sequence leaked after cleanup ${JSON.stringify(final.sequence)}`);
if (final.assets.missing.length) throw new Error(`missing LIVE assets ${JSON.stringify(final.assets.missing)}`);
if (final.frameTiming.p95Ms > 50) throw new Error(`mobile frame timing p95 too high ${JSON.stringify(final.frameTiming)}`);
if (consoleErrors.length || failedRequests.length || httpErrors.length) throw new Error(`LIVE errors ${JSON.stringify({ consoleErrors, failedRequests, httpErrors })}`);

const report = {
  ok: true,
  url: base,
  title: boot.title,
  viewport: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, touch: true },
  manifest: boot.manifest,
  directions: directionResults,
  realPvpHit: { hpBefore: hitTap.hpBefore, hpAfter: hitResult.hp, damage: hitTap.hpBefore - hitResult.hp },
  realPvpMiss: { hpBefore: missTap.hpBefore, hpAfter: missMid.hp, hitCountUnchanged: missMid.audit.hitsPresented === missTap.hitCountBefore },
  final
};
fs.writeFileSync('artifacts/melee-live/report.json', JSON.stringify(report, null, 2));
console.log('PASS LIVE mobile melee visual audit');
console.log(JSON.stringify(report, null, 2));
await browser.close();
