import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const expected = process.env.EXPECTED_BUILD || 'V5.46';
const expectedRegistry = process.env.EXPECTED_REGISTRY || '1.4.1';
fs.mkdirSync('artifacts', { recursive: true });
if (fs.existsSync('assets/tileset-vclean.png')) fs.copyFileSync('assets/tileset-vclean.png', 'artifacts/repo-tileset.png');
else if (fs.existsSync('assets/tileset.png')) fs.copyFileSync('assets/tileset.png', 'artifacts/repo-tileset.png');
if (fs.existsSync('assets/plaza-transitions-v1.png')) fs.copyFileSync('assets/plaza-transitions-v1.png', 'artifacts/repo-transitions.png');

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(`PAGEERROR: ${err.message}`));

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
      depthOccluderCount: window.KELO_PLAZA_AUDIT?.depthOccluderCount || 0
    }));
    if (deployed.version === expected && deployed.registryVersion === expectedRegistry && deployed.authoredTransitions && deployed.depthOcclusion && deployed.depthOccluderCount >= 8) { loaded = true; break; }
    console.log(`attempt ${attempt}: deployed visual build ${deployed.version || 'missing'} / registry ${deployed.registryVersion || 'missing'} / authored=${deployed.authoredTransitions} / depth=${deployed.depthOcclusion} (${deployed.depthOccluderCount}), waiting for ${expected} / ${expectedRegistry}`);
  } catch (err) { console.log(`attempt ${attempt}: ${err.message}`); }
  await page.waitForTimeout(10000);
}

await page.waitForTimeout(4000);
const state = await page.evaluate(() => ({
  title: document.title,
  audit: window.KELO_PLAZA_AUDIT || null,
  tileset: window.KELO_PLAZA_TILESET || null,
  depth: window.KELO_PLAZA_DEPTH || null,
  canvas: (() => { const c = document.getElementById('game-canvas'); return c ? { width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight } : null; })()
}));
await page.screenshot({ path: 'artifacts/live-mobile.png', fullPage: false });
fs.writeFileSync('artifacts/report.json', JSON.stringify({ loaded, title, expected, expectedRegistry, state, consoleErrors }, null, 2));
console.log(JSON.stringify({ loaded, title, expected, expectedRegistry, state, consoleErrors }, null, 2));
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
if (!state.depth || state.depth.sourceMode !== 'y-occlusion-overlay-v1') throw new Error('Depth layer state missing or invalid');
if (!state.tileset?.authoredTransitions) throw new Error('Tileset state did not expose authored transitions');
if (!state.tileset?.transitionAssetPath) throw new Error('Transition atlas path missing from tileset state');
if (consoleErrors.some(x => /Kelo plaza|Kelo plaza depth|tileset load|transition atlas|invalid tileset/i.test(x))) throw new Error('Visual atlas/depth console error detected');
