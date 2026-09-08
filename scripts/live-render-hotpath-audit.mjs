import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
fs.mkdirSync('artifacts', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

async function runViewport(name, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(`PAGEERROR: ${e.stack || e.message}`));

  await page.route(/\/engine-h\.js(\?|$)/, route => {
    const u = new URL(route.request().url());
    u.searchParams.set('render-hotpath-audit-bust', `${Date.now()}-${Math.random()}`);
    route.continue({ url: u.toString() });
  });

  let ready = false;
  for (let attempt = 0; attempt < 18 && !ready; attempt++) {
    await page.goto(`${base}?render-hotpath-audit=${name}-${Date.now()}-${attempt}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    ready = await page.evaluate(() => window.KELO_HD_RENDER?.hotPathAuditVersion === 'legacy-plaza-intercept-v1');
    if (!ready) await page.waitForTimeout(5000);
  }
  if (!ready) throw new Error(`${name}: deployed engine-h instrumentation did not become LIVE`);

  await page.waitForFunction(() => window.KELO_HD_RENDER?.legacyPlazaPatchedFrames > 0, null, { timeout: 10000 });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => ({
    title: document.title,
    mode: window.KELO_HD_RENDER?.mode || null,
    auditVersion: window.KELO_HD_RENDER?.hotPathAuditVersion || null,
    patchedFrames: Number(window.KELO_HD_RENDER?.legacyPlazaPatchedFrames) || 0,
    interceptHits: Number(window.KELO_HD_RENDER?.legacyPlazaInterceptHits) || 0,
    interceptFrames: Number(window.KELO_HD_RENDER?.legacyPlazaInterceptFrames) || 0,
    renderHooks: window.KeloRender?.snapshot ? window.KeloRender.snapshot() : null,
    decorationReset: window.KELO_WORLD_DECORATION_RESET === true,
    canvas: (() => {
      const c = document.getElementById('game-canvas');
      return c ? { width:c.width, height:c.height, cssWidth:c.clientWidth, cssHeight:c.clientHeight } : null;
    })()
  }));

  await page.screenshot({ path:`artifacts/render-hotpath-${name}.png`, fullPage:false, scale:'device' });
  await context.close();

  if (!(result.patchedFrames > 0)) throw new Error(`${name}: legacy patch did not execute`);
  if (!result.renderHooks?.beforeFrame?.some(h => h.owner === 'engine-h:legacy-plaza-fillrect')) {
    throw new Error(`${name}: expected KeloRender legacy hook missing`);
  }
  return { name, ...result, consoleErrors };
}

const mobile = await runViewport('mobile', {
  viewport:{ width:390, height:844 },
  deviceScaleFactor:2,
  isMobile:true,
  hasTouch:true
});

const desktop = await runViewport('desktop', {
  viewport:{ width:1280, height:720 },
  deviceScaleFactor:1,
  isMobile:false,
  hasTouch:false
});

const report = {
  version:'live-render-hotpath-audit-v1',
  mobile,
  desktop,
  totalPatchedFrames:mobile.patchedFrames + desktop.patchedFrames,
  totalInterceptHits:mobile.interceptHits + desktop.interceptHits,
  totalInterceptFrames:mobile.interceptFrames + desktop.interceptFrames
};

fs.writeFileSync('artifacts/render-hotpath-live-audit.json', JSON.stringify(report, null, 2));
console.log('LEGACY_PLAZA_INTERCEPT_MEASUREMENT', JSON.stringify(report));
await browser.close();
