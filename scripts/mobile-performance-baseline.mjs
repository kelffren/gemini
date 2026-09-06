/* KELO-INDEX
 * area: BUILD
 * keys: MOBILE PERFORMANCE BASELINE PLAYWRIGHT LIVE P95 P99 HTTP CONSOLE
 * hace: recorre Plaza-Commerce-Jardines en LIVE 390x844 y guarda telemetria reproducible sin imponer aun thresholds de FPS
 * online: auditoria LIVE de GitHub Pages
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const durationMs = Math.max(120000, Number(process.env.BASELINE_MS) || 120000);
const expectedVersion = '1.1.0';
const artifactsDir = 'artifacts/mobile-performance';
fs.mkdirSync(artifactsDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
});
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const httpErrors = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => pageErrors.push(error.stack || error.message));
page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'failed' }));
page.on('response', response => { if (response.status() >= 400) httpErrors.push({ status: response.status(), url: response.url() }); });

let liveReady = false;
for (let attempt = 1; attempt <= 24; attempt += 1) {
  try {
    await page.goto(`${base}?perf-baseline-ready=${Date.now()}-${attempt}`, { waitUntil: 'networkidle', timeout: 45000 });
    liveReady = await page.evaluate(expected => {
      const script = [...document.scripts].find(node => node.src.includes('performance-governor.js'));
      return window.KELO_PERF?.version === expected && !!script?.src.includes('performance-governor.js?v=2');
    }, expectedVersion);
    if (liveReady) break;
  } catch (error) {
    console.log(`LIVE readiness attempt ${attempt}: ${error.message}`);
  }
  await page.waitForTimeout(10000);
}
if (!liveReady) throw new Error(`LIVE never reached KELO_PERF ${expectedVersion} with cache v2`);

consoleErrors.length = 0;
pageErrors.length = 0;
failedRequests.length = 0;
httpErrors.length = 0;
await page.goto(`${base}?perf-baseline=final-${Date.now()}`, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(5000);

const initial = await page.evaluate(() => ({
  perf: window.KELO_PERF?.getSnapshot?.() || null,
  canvas: (() => { const c = document.getElementById('game-canvas'); return c ? { width: c.width, height: c.height, cssWidth: c.clientWidth, cssHeight: c.clientHeight } : null; })(),
  heap: performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize, jsHeapSizeLimit: performance.memory.jsHeapSizeLimit } : null
}));
if (initial.perf?.version !== expectedVersion) throw new Error(`Unexpected performance governor version ${initial.perf?.version}`);

const route = [
  { id: 'plaza', x: 1440, y: 1520 },
  { id: 'commerce', x: 2100, y: 1500 },
  { id: 'gardens', x: 1450, y: 2460 },
  { id: 'return-plaza', x: 1440, y: 1520 }
];

await page.evaluate(({ route, durationMs }) => {
  const start = performance.now();
  window.__KELO_PERF_BASELINE_DRIVER = { active: true, route, durationMs, start };
  function drive(now) {
    const driver = window.__KELO_PERF_BASELINE_DRIVER;
    if (!driver?.active) return;
    const progress = Math.min(1, Math.max(0, (now - start) / durationMs));
    const scaled = progress * (route.length - 1);
    const index = Math.min(route.length - 2, Math.floor(scaled));
    const local = Math.min(1, scaled - index);
    const a = route[index];
    const b = route[index + 1];
    const x = a.x + (b.x - a.x) * local;
    const y = a.y + (b.y - a.y) * local;
    if (window.localPlayer) { window.localPlayer.x = x; window.localPlayer.y = y; }
    if (window.camera) {
      window.camera.x = x; window.camera.y = y;
      window.camera.targetX = x; window.camera.targetY = y;
    }
    if (progress < 1) requestAnimationFrame(drive);
    else driver.active = false;
  }
  requestAnimationFrame(drive);
}, { route, durationMs });

const samples = [];
const sampleEveryMs = 15000;
const startedAt = Date.now();
while (Date.now() - startedAt < durationMs) {
  await page.waitForTimeout(Math.min(sampleEveryMs, durationMs - (Date.now() - startedAt)));
  const sample = await page.evaluate(() => {
    const snap = window.KELO_PERF?.getSnapshot?.() || null;
    const telemetry = window.KELO_PERF?.getFrameTelemetry?.() || null;
    return {
      at: performance.now(),
      snap,
      telemetry,
      heap: performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize } : null,
      district: window.KELO_WORLD_AUDIT?.activeDistrictLabel || null,
      player: window.localPlayer ? { x: Math.round(window.localPlayer.x), y: Math.round(window.localPlayer.y) } : null
    };
  });
  samples.push(sample);
}

await page.evaluate(() => { if (window.__KELO_PERF_BASELINE_DRIVER) window.__KELO_PERF_BASELINE_DRIVER.active = false; });
await page.waitForTimeout(1000);

const final = await page.evaluate(() => {
  const resources = performance.getEntriesByType('resource');
  return {
    perf: window.KELO_PERF?.getSnapshot?.() || null,
    telemetry: window.KELO_PERF?.getFrameTelemetry?.() || null,
    world: window.KELO_WORLD_AUDIT || null,
    canvas: (() => { const c = document.getElementById('game-canvas'); return c ? { width: c.width, height: c.height, cssWidth: c.clientWidth, cssHeight: c.clientHeight } : null; })(),
    heap: performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize, jsHeapSizeLimit: performance.memory.jsHeapSizeLimit } : null,
    resources: {
      count: resources.length,
      transferBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
      decodedBodyBytes: resources.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0)
    }
  };
});

const p95Values = samples.map(s => Number(s.telemetry?.p95Ms)).filter(Number.isFinite);
const p99Values = samples.map(s => Number(s.telemetry?.p99Ms)).filter(Number.isFinite);
const worstValues = samples.map(s => Number(s.telemetry?.worstMs)).filter(Number.isFinite);
const summary = {
  governorVersion: final.perf?.version || null,
  durationMs,
  viewport: '390x844@2x',
  sampleCount: samples.length,
  maxWindowP95Ms: p95Values.length ? Math.max(...p95Values) : null,
  maxWindowP99Ms: p99Values.length ? Math.max(...p99Values) : null,
  worstObservedFrameMs: worstValues.length ? Math.max(...worstValues) : null,
  maxFramesOver50InWindow: Math.max(0, ...samples.map(s => Number(s.telemetry?.over50) || 0)),
  maxFramesOver100InWindow: Math.max(0, ...samples.map(s => Number(s.telemetry?.over100) || 0)),
  maxFramesOver120InWindow: Math.max(0, ...samples.map(s => Number(s.telemetry?.over120) || 0)),
  loafSupported: !!final.telemetry?.loafSupported,
  loafCount: Number(final.telemetry?.loafCount) || 0,
  worstLoafMs: Number(final.telemetry?.worstLoafMs) || 0,
  consoleErrorCount: consoleErrors.length,
  pageErrorCount: pageErrors.length,
  failedRequestCount: failedRequests.length,
  httpErrorCount: httpErrors.length,
  transferBytes: final.resources?.transferBytes || 0,
  decodedBodyBytes: final.resources?.decodedBodyBytes || 0
};

await page.screenshot({ path: `${artifactsDir}/live-390x844.png`, fullPage: false });
const report = { summary, route, initial, final, samples, consoleErrors, pageErrors, failedRequests, httpErrors };
fs.writeFileSync(`${artifactsDir}/report.json`, JSON.stringify(report, null, 2));
console.log('MOBILE_PERFORMANCE_BASELINE', JSON.stringify(summary, null, 2));
await browser.close();

if (summary.governorVersion !== expectedVersion) throw new Error('Performance governor version mismatch');
if (!samples.length || summary.maxWindowP95Ms == null || summary.maxWindowP99Ms == null) throw new Error('Performance telemetry did not produce percentile samples');
if (consoleErrors.length || pageErrors.length || failedRequests.length || httpErrors.length) {
  throw new Error(`LIVE runtime errors detected: ${JSON.stringify({ consoleErrors, pageErrors, failedRequests, httpErrors })}`);
}
