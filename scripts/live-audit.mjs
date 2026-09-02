import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const expected = process.env.EXPECTED_BUILD || 'V5.49';
const expectedRegistry = process.env.EXPECTED_REGISTRY || '1.6.0';
fs.mkdirSync('artifacts', { recursive: true });
if (fs.existsSync('assets/tileset-vclean.png')) fs.copyFileSync('assets/tileset-vclean.png', 'artifacts/repo-tileset.png');
else if (fs.existsSync('assets/tileset.png')) fs.copyFileSync('assets/tileset.png', 'artifacts/repo-tileset.png');
if (fs.existsSync('assets/plaza-transitions-v1.png')) fs.copyFileSync('assets/plaza-transitions-v1.png', 'artifacts/repo-transitions.png');
if (fs.existsSync('assets/rural-soil-v1.png')) fs.copyFileSync('assets/rural-soil-v1.png', 'artifacts/repo-rural-soil.png');

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
const httpErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(`PAGEERROR: ${err.stack || err.message}`));
page.on('requestfailed', req => failedRequests.push({ url:req.url(), error:req.failure()?.errorText || 'failed' }));
page.on('response', res => { if (res.status() >= 400) httpErrors.push({ status:res.status(), url:res.url() }); });

let title = '', loaded = false;
for (let attempt = 1; attempt <= 24; attempt++) {
  try {
    await page.goto(`${base}?audit=${Date.now()}-${attempt}`, { waitUntil: 'networkidle', timeout: 45000 });
    title = await page.title();
    const deployed = await page.evaluate(() => ({
      version: window.KELO_PLAZA_AUDIT?.version || null,
      registryVersion: window.KELO_PLAZA_AUDIT?.registryVersion || null,
      authoredTransitions: window.KELO_PLAZA_AUDIT?.authoredTransitions || false,
      depthOcclusion: window.KELO_PLAZA_AUDIT?.depthOcclusion || false,
      depthOccluderCount: window.KELO_PLAZA_AUDIT?.depthOccluderCount || 0,
      worldReady: window.KELO_WORLD_AUDIT?.ready || false,
      worldVersion: window.KELO_WORLD_AUDIT?.version || null,
      districtCount: window.KELO_WORLD_AUDIT?.districtCount || 0,
      districtStyleMode: window.KELO_WORLD_AUDIT?.districtStyleMode || null,
      styledDistrictCount: window.KELO_WORLD_AUDIT?.styledDistrictCount || 0,
      chunkSize: window.KELO_WORLD_AUDIT?.chunkSize || 0,
      ruralReady: window.KELO_RURAL_GROUND_AUDIT?.ready || false,
      ruralMode: window.KELO_RURAL_GROUND_AUDIT?.renderingMode || null
    }));
    if (deployed.version === expected && deployed.registryVersion === expectedRegistry && deployed.authoredTransitions && deployed.depthOcclusion && deployed.depthOccluderCount >= 8 && deployed.worldReady && deployed.worldVersion === 'world-v1.1' && deployed.districtCount >= 5 && deployed.districtStyleMode === 'district-profile-v1' && deployed.styledDistrictCount >= 5 && deployed.chunkSize === 512 && deployed.ruralReady && deployed.ruralMode === 'authored-nine-slice-v1') { loaded = true; break; }
    console.log(`attempt ${attempt}: build ${deployed.version || 'missing'} / registry ${deployed.registryVersion || 'missing'} / world=${deployed.worldVersion || 'missing'} styles=${deployed.districtStyleMode || 'missing'}, waiting for ${expected}`);
  } catch (err) { console.log(`attempt ${attempt}: ${err.message}`); }
  await page.waitForTimeout(10000);
}

// Reload the confirmed deployment with clean error buckets. This prevents stale-deploy
// retries from contaminating the final diagnostic report.
consoleErrors.length=0; failedRequests.length=0; httpErrors.length=0;
await page.goto(`${base}?audit=final-${Date.now()}`, { waitUntil:'networkidle', timeout:45000 });
await page.waitForTimeout(4000);
const state = await page.evaluate(() => ({
  title: document.title,
  audit: window.KELO_PLAZA_AUDIT || null,
  world: window.KELO_WORLD_AUDIT || null,
  rural: window.KELO_RURAL_GROUND_AUDIT || null,
  tileset: window.KELO_PLAZA_TILESET || null,
  depth: window.KELO_PLAZA_DEPTH || null,
  canvas: (() => { const c = document.getElementById('game-canvas'); return c ? { width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight } : null; })()
}));
await page.screenshot({ path: 'artifacts/live-mobile.png', fullPage: false });

// Capture a deterministic off-plaza frame before the normal game loop can re-center the camera.
const ruralFrame = await page.evaluate(() => {
  if (typeof camera === 'undefined' || typeof localPlayer === 'undefined' || typeof render !== 'function') return null;
  const c = document.getElementById('game-canvas');
  if (!c) return null;
  localPlayer.x = 800; localPlayer.y = 1640;
  camera.x = 800; camera.y = 1640;
  camera.targetX = 800; camera.targetY = 1640;
  render();
  return c.toDataURL('image/png');
});
const ruralCaptureReady = typeof ruralFrame === 'string' && ruralFrame.startsWith('data:image/png;base64,');
if (ruralCaptureReady) fs.writeFileSync('artifacts/live-rural.png', Buffer.from(ruralFrame.split(',')[1], 'base64'));

fs.writeFileSync('artifacts/report.json', JSON.stringify({ loaded, title, expected, expectedRegistry, ruralCaptureReady, state, consoleErrors, failedRequests, httpErrors }, null, 2));
console.log(JSON.stringify({ loaded, title, expected, expectedRegistry, ruralCaptureReady, state, consoleErrors, failedRequests, httpErrors }, null, 2));
await browser.close();

if (!loaded) throw new Error(`Live page never reached visual build ${expected} / registry ${expectedRegistry}`);
if (state.audit?.version !== expected) throw new Error(`Visual audit version mismatch: ${state.audit?.version} !== ${expected}`);
if (state.audit?.registryVersion !== expectedRegistry) throw new Error(`Registry version mismatch: ${state.audit?.registryVersion} !== ${expectedRegistry}`);
if (!state.audit?.ready) throw new Error('Plaza audit flag is not ready');
if (!state.audit?.assetLoaded) throw new Error('Production visual atlases did not load');
if (state.audit?.fallbackActive) throw new Error('Fallback remained active');
if (!state.audit?.authoredTransitions) throw new Error('Authored transition atlas is not active');
if (!state.audit?.depthOcclusion) throw new Error('Depth occlusion layer is not active');
if ((state.audit?.depthOccluderCount || 0) < 8) throw new Error('Depth occluder registry is unexpectedly small');
if (!state.world?.ready || !state.world?.assetLoaded) throw new Error('Chunked world renderer did not become ready');
if (state.world?.version !== 'world-v1.1') throw new Error('District-aware world renderer is not active');
if (state.world?.districtStyleMode !== 'district-profile-v1' || (state.world?.styledDistrictCount || 0) < 5) throw new Error('District ground profiles are missing');
if (state.world?.chunkSize !== 512) throw new Error('Unexpected world chunk size');
if ((state.world?.districtCount || 0) < 5) throw new Error('World district graph is unexpectedly small');
if ((state.world?.worldWidth || 0) < 3600 || (state.world?.worldHeight || 0) < 3200) throw new Error('World bounds regressed');
if (!ruralCaptureReady) throw new Error('Could not capture Distrito Rural');
if (!state.rural?.ready || !state.rural?.assetLoaded || !state.rural?.modularTiles) throw new Error('Modular rural soil renderer is not active');
if (state.rural?.renderingMode !== 'authored-nine-slice-v1' || state.rural?.plotSize !== 96) throw new Error('Unexpected rural plot renderer contract');
if (!state.depth || state.depth.sourceMode !== 'y-occlusion-overlay-v1') throw new Error('Depth layer state missing or invalid');
if (!state.tileset?.authoredTransitions) throw new Error('Tileset state did not expose authored transitions');
if (!state.tileset?.transitionAssetPath) throw new Error('Transition atlas path missing from tileset state');
if (httpErrors.length) throw new Error(`HTTP errors detected: ${JSON.stringify(httpErrors)}`);
if (failedRequests.length) throw new Error(`Failed requests detected: ${JSON.stringify(failedRequests)}`);
if (consoleErrors.length) throw new Error(`Console/page errors detected: ${JSON.stringify(consoleErrors)}`);
