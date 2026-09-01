import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const expected = process.env.EXPECTED_BUILD || 'V5.39';
fs.mkdirSync('artifacts', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
});
const page = await context.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(`PAGEERROR: ${err.message}`));

let title = '';
let loaded = false;
for (let attempt = 1; attempt <= 24; attempt++) {
  const url = `${base}?audit=${Date.now()}-${attempt}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    title = await page.title();
    if (title.includes(expected)) { loaded = true; break; }
  } catch (err) {
    console.log(`attempt ${attempt}: ${err.message}`);
  }
  await page.waitForTimeout(10000);
}

await page.waitForTimeout(4000);
const state = await page.evaluate(() => ({
  title: document.title,
  audit: window.KELO_PLAZA_AUDIT || null,
  tileset: window.KELO_PLAZA_TILESET || null,
  canvas: (() => {
    const c = document.getElementById('game-canvas');
    if (!c) return null;
    return { width: c.width, height: c.height, cssWidth: c.clientWidth, cssHeight: c.clientHeight };
  })()
}));

await page.screenshot({ path: 'artifacts/live-mobile.png', fullPage: false });
fs.writeFileSync('artifacts/report.json', JSON.stringify({ loaded, title, state, consoleErrors }, null, 2));
console.log(JSON.stringify({ loaded, title, state, consoleErrors }, null, 2));
await browser.close();

if (!loaded) throw new Error(`Live page never reached ${expected}`);
if (!state.audit?.ready) throw new Error('Plaza audit flag is not ready');
if (!state.audit?.assetLoaded) throw new Error('Production tileset did not load');
if (state.audit?.fallbackActive) throw new Error('Fallback remained active');
if (consoleErrors.some(x => /Kelo plaza|tileset load|invalid tileset/i.test(x))) throw new Error('Tileset console error detected');
