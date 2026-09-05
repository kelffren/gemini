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
  const failedRequests = [];
  const httpErrors = [];

  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(`PAGEERROR: ${e.stack || e.message}`));
  page.on('requestfailed', r => failedRequests.push({ url: r.url(), error: r.failure()?.errorText || 'failed' }));
  page.on('response', r => { if (r.status() >= 400) httpErrors.push({ status: r.status(), url: r.url() }); });

  // The hero renderer and PNG are under active locomotion research. Bust only these resources
  // so the audit never evaluates a stale sprite/renderer while leaving the rest of Pages intact.
  await page.route(/\/(engine-ab\.js|assets\/hero\.PNG)(\?|$)/, route => {
    const u = new URL(route.request().url());
    u.searchParams.set('hero-audit-bust', `${Date.now()}-${Math.random()}`);
    route.continue({ url: u.toString() });
  });

  await page.goto(`${base}?hero-live-audit=${name}-${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000
  });

  await page.waitForFunction(() => {
    const a = window.KELO_HERO_SPRITE_AUDIT;
    return !!(a && a.loaded && (a.processed || a.error));
  }, null, { timeout: 10000 });

  const result = await page.evaluate(() => {
    const a = window.KELO_HERO_SPRITE_AUDIT ? JSON.parse(JSON.stringify(window.KELO_HERO_SPRITE_AUDIT)) : null;
    const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
    const presentation = p && window.KELO_AVATAR_PRESENTATION ? window.KELO_AVATAR_PRESENTATION.get(p, p._face || 'down') : null;
    const c = document.getElementById('game-canvas');
    return {
      title: document.title,
      audit: a,
      presentation,
      player: p ? { x: p.x, y: p.y, radius: p.radius, face: p._face || null } : null,
      canvas: c ? { width: c.width, height: c.height, cssWidth: c.clientWidth, cssHeight: c.clientHeight } : null,
      dpr: window.devicePixelRatio || 1
    };
  });

  await page.screenshot({ path: `artifacts/hero-${name}.png`, fullPage: false, scale: 'device' });

  if (!result.audit) throw new Error(`${name}: hero audit missing`);
  if (result.audit.version !== 'hero-preprocess-audit-v3') throw new Error(`${name}: unexpected hero audit ${result.audit.version}`);
  if (!result.audit.loaded || !result.audit.processed || result.audit.error) throw new Error(`${name}: hero preprocessing failed ${JSON.stringify(result.audit)}`);
  if (!Array.isArray(result.audit.croppedOpaquePixelCountByFrame) || result.audit.croppedOpaquePixelCountByFrame.length !== 16) throw new Error(`${name}: crop buckets invalid`);
  if (!(result.audit.lateralComparedPixelCount > 0)) throw new Error(`${name}: lateral row comparison missing`);
  for (const k of ['row1VsRow2RgbaSimilarityPct', 'row1VsMirroredRow2RgbaSimilarityPct']) {
    const v = result.audit[k];
    if (!(v >= 0 && v <= 100)) throw new Error(`${name}: ${k} out of range: ${v}`);
  }
  if (result.audit.visibleAlphaMutationAfterIdle !== (result.audit.whiteKnockoutOpaquePixelCount > 0)) throw new Error(`${name}: alpha mutation semantics inconsistent`);
  if (!result.presentation || result.presentation.colliderRadius !== result.player?.radius) throw new Error(`${name}: presentation/collider contract unavailable`);
  if (consoleErrors.length || failedRequests.length || httpErrors.length) {
    throw new Error(`${name}: browser errors ${JSON.stringify({ consoleErrors, failedRequests, httpErrors })}`);
  }

  await context.close();
  return { name, ...result, consoleErrors, failedRequests, httpErrors };
}

const mobile = await runViewport('mobile', {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
});

const desktop = await runViewport('desktop', {
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false
});

const report = { mobile, desktop };
fs.writeFileSync('artifacts/hero-live-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await browser.close();
