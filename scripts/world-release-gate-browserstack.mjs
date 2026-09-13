/* KELO-INDEX
 * area: CI / WORLD RELEASE GATE / REAL IOS
 * owner: World Creator release validation
 * purpose: run the World open/reopen regression directly on BrowserStack real iOS without Playwright Test's desktop context defaults
 */
import fs from 'node:fs';
import { webkit } from 'playwright';

const required = ['BROWSERSTACK_USERNAME', 'BROWSERSTACK_ACCESS_KEY', 'KELO_PAGES'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const outputDir = 'test-results';
fs.mkdirSync(outputDir, { recursive: true });

const isLocal = process.env.KELO_RELEASE_STAGE === 'PR_CANDIDATE_REAL_IPHONE';
const localIdentifier = process.env.BROWSERSTACK_LOCAL_IDENTIFIER || '';
const candidateSha = process.env.KELO_CANDIDATE_SHA || process.env.GITHUB_SHA || 'unknown';
const baseURL = process.env.KELO_PAGES;

if (isLocal && !localIdentifier) {
  throw new Error('PR candidate gate requires BROWSERSTACK_LOCAL_IDENTIFIER');
}

const caps = {
  browserName: 'safari',
  osVersion: '26',
  deviceName: 'iPhone 14 Pro',
  realMobile: 'true',
  name: `KELO World release gate ${candidateSha.slice(0, 12)}`,
  build: process.env.BROWSERSTACK_BUILD_NAME || `KeloWorld-${process.env.GITHUB_RUN_ID || Date.now()}`,
  project: process.env.BROWSERSTACK_PROJECT_NAME || 'KeloWorld',
  'browserstack.username': process.env.BROWSERSTACK_USERNAME,
  'browserstack.accessKey': process.env.BROWSERSTACK_ACCESS_KEY,
  'browserstack.local': isLocal ? 'true' : 'false',
};
if (isLocal) caps['browserstack.localIdentifier'] = localIdentifier;

const wsEndpoint = `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`;
const evidence = {
  candidateSha,
  stage: process.env.KELO_RELEASE_STAGE || 'UNKNOWN',
  baseURL,
  device: 'iPhone 14 Pro',
  osVersion: '26',
  browserName: 'safari',
  startedAt: new Date().toISOString(),
  passed: false,
};

let browser;
let context;
let page;
const pageErrors = [];
const consoleErrors = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function visible(locator, timeout, label) {
  await locator.waitFor({ state: 'visible', timeout });
  assert(await locator.isVisible(), `${label} is not visible`);
}

try {
  // Intentionally use raw Playwright instead of @playwright/test's page/context fixture.
  // Playwright Test >=1.50 injects reducedMotion="no-preference" by default. BrowserStack
  // physical iOS expects the device's native value and rejects that emulation before a
  // page opens. Raw browser.newContext() leaves device media preferences untouched.
  browser = await webkit.connect({ wsEndpoint });
  context = await browser.newContext({ baseURL });
  page = await context.newPage();

  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // mapEditor=1 is the repository's explicit offline/dev editor authorization path.
  // It suppresses the account modal and bootstraps the local root admin scopes on a
  // clean real device, so this regression tests World/Studio rather than login state.
  const response = await page.goto('./?mapEditor=1&world-ios-reopen=1', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  assert(response, 'World navigation returned no response');
  assert(response.status() < 400, `World navigation returned HTTP ${response.status()}`);

  await page.waitForFunction(() => !!(
    window.KeloInputLocks?.acquire &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit')
  ), null, { timeout: 15000 });

  await page.evaluate(async () => {
    const { openCreatorHub } = await import('./src/creators/ui/creator-hub.mjs');
    await openCreatorHub({ root: window });
  });

  let hub = page.locator('#kelo-creators-hub');
  await visible(hub, 10000, 'Creator Hub');
  await hub.locator('[data-workspace="world"]').click();

  const studio = page.locator('#kelo-studio-live');
  await visible(studio, 15000, 'World Studio');
  assert(await hub.count() === 0, 'Creator Hub remained mounted after opening World Studio');

  // Reproduce the iOS stale-session failure mode: the Studio DOM shell disappears
  // while the module-level Studio session still believes it is active.
  await page.evaluate(() => document.getElementById('kelo-studio-live')?.remove());
  assert(await studio.count() === 0, 'Failed to remove Studio shell for stale-session regression');

  await page.evaluate(async () => {
    const { openCreatorHub } = await import(`./src/creators/ui/creator-hub.mjs?ios-reopen=${Date.now()}`);
    await openCreatorHub({ root: window });
  });

  hub = page.locator('#kelo-creators-hub');
  await visible(hub, 10000, 'Creator Hub after stale session');
  await hub.locator('[data-workspace="world"]').click();

  const recovered = page.locator('#kelo-studio-live');
  await visible(recovered, 15000, 'Recovered World Studio');
  assert(await page.locator('#kelo-creators-hub').count() === 0, 'Creator Hub remained mounted after World recovery');
  const position = await recovered.evaluate(el => getComputedStyle(el).position);
  assert(position === 'fixed', `Recovered Studio expected position=fixed, received ${position}`);

  await page.screenshot({ path: `${outputDir}/world-editor-ios-recovered.png`, fullPage: true });

  assert(pageErrors.length === 0, `Page errors: ${pageErrors.join(' | ')}`);
  const guardedConsoleErrors = consoleErrors.filter(row => /CREATOR_WORLD_STUDIO_MOUNT_FAILED|WORLD_EDIT_NOT_READY/.test(row));
  assert(guardedConsoleErrors.length === 0, `Guarded console errors: ${guardedConsoleErrors.join(' | ')}`);

  evidence.passed = true;
  evidence.finishedAt = new Date().toISOString();
  evidence.pageErrors = pageErrors;
  evidence.consoleErrors = consoleErrors;
  fs.writeFileSync(`${outputDir}/world-release-gate-evidence.json`, JSON.stringify(evidence, null, 2));
  console.log(`VERIFIED ${evidence.stage}: World opened and recovered on real iPhone Safari. SHA ${candidateSha}`);
} catch (error) {
  evidence.finishedAt = new Date().toISOString();
  evidence.error = String(error?.stack || error);
  evidence.pageErrors = pageErrors;
  evidence.consoleErrors = consoleErrors;
  fs.writeFileSync(`${outputDir}/world-release-gate-evidence.json`, JSON.stringify(evidence, null, 2));
  if (page) {
    await page.screenshot({ path: `${outputDir}/world-release-gate-failure.png`, fullPage: true }).catch(() => {});
  }
  throw error;
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
}
