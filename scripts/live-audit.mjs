import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const expected = process.env.EXPECTED_BUILD || 'V5.44';
fs.mkdirSync('artifacts', { recursive: true });
if (fs.existsSync('assets/tileset.png')) fs.copyFileSync('assets/tileset.png', 'artifacts/repo-tileset.png');

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
    const deployedVersion = await page.evaluate(() => window.KELO_PLAZA_AUDIT?.version || null);
    if (deployedVersion === expected) { loaded = true; break; }
    console.log(`attempt ${attempt}: deployed visual build ${deployedVersion || 'missing'}, waiting for ${expected}`);
  } catch (err) { console.log(`attempt ${attempt}: ${err.message}`); }
  await page.waitForTimeout(10000);
}

await page.waitForTimeout(4000);
const state = await page.evaluate(() => ({
  title: document.title,
  audit: window.KELO_PLAZA_AUDIT || null,
  tileset: window.KELO_PLAZA_TILESET || null,
  canvas: (() => { const c = document.getElementById('game-canvas'); return c ? { width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight } : null; })()
}));
await page.screenshot({ path: 'artifacts/live-mobile.png', fullPage: false });
fs.writeFileSync('artifacts/report.json', JSON.stringify({ loaded, title, expected, state, consoleErrors }, null, 2));
console.log(JSON.stringify({ loaded, title, expected, state, consoleErrors }, null, 2));
await browser.close();

if (!loaded) throw new Error(`Live page never reached visual build ${expected}`);
if (state.audit?.version !== expected) throw new Error(`Visual audit version mismatch: ${state.audit?.version} !== ${expected}`);
if (!state.audit?.ready) throw new Error('Plaza audit flag is not ready');
if (!state.audit?.assetLoaded) throw new Error('Production tileset did not load');
if (state.audit?.fallbackActive) throw new Error('Fallback remained active');
if (consoleErrors.some(x => /Kelo plaza|tileset load|invalid tileset/i.test(x))) throw new Error('Tileset console error detected');
