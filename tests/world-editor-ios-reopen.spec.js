/* KELO-INDEX
 * area: TEST / WORLD EDITOR / REAL IOS REOPEN
 * owner: World Creator mobile launch regression
 * purpose: reproduce the stale Studio-session black screen, prove World remounts on real iPhone Safari, preserve BUG-0003/A10 black-box milestones as evidence, and emulate iPhone identity locally without inheriting the global Pixel profile or forcing the WebKit binary
 */
const { test, expect, devices } = require('@playwright/test');
const fs = require('fs');

const isBrowserStack = Boolean(
  process.env.BROWSERSTACK_USERNAME ||
  process.env.BROWSERSTACK_ACCESS_KEY ||
  process.env.BROWSERSTACK_BUILD_NAME
);
if (!isBrowserStack) {
  const iphone = devices['iPhone 13'];
  test.use({
    userAgent: iphone.userAgent,
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: iphone.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
  });
}

const BLACK_BOX_KEY = 'kelo:bug-observability:v1';
const BUILD = 'world-bridge-20260915-21';

async function readWorldTrace(page) {
  return page.evaluate(key => {
    try {
      const rows = JSON.parse(sessionStorage.getItem(key) || '[]');
      return Array.isArray(rows) ? rows.filter(row => row?.flow === 'world-open' && row?.bugId === 'BUG-0003') : [];
    } catch {
      return [];
    }
  }, BLACK_BOX_KEY);
}

function writeWorldTrace(name, rows) {
  fs.writeFileSync(`test-results/${name}.json`, JSON.stringify(rows, null, 2));
}

test('World recovers a stale Studio session instead of leaving iOS on a black page', async ({ page }) => {
  test.setTimeout(100000);
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', msg => { if(msg.type()==='error')consoleErrors.push(msg.text()); });
  fs.mkdirSync('test-results', { recursive: true });
  await page.addInitScript(key => { try { sessionStorage.removeItem(key); } catch {} }, BLACK_BOX_KEY);

  try {
    const response = await page.goto('./?guest=1&mapEditor=1&world-ios-reopen=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
    expect(response && response.status()).toBeLessThan(400);
    const mobileIdentity = await page.evaluate(() => ({
      ua: navigator.userAgent,
      touchPoints: navigator.maxTouchPoints,
      width: innerWidth,
      height: innerHeight,
      dpr: devicePixelRatio,
    }));
    expect(mobileIdentity.ua).toContain('iPhone');
    expect(mobileIdentity.touchPoints).toBeGreaterThan(0);
    expect(mobileIdentity.width).toBeLessThanOrEqual(430);

    await page.evaluate(async build => {
      const { openCreatorHub } = await import(`./src/creators/ui/creator-hub.mjs?v=${build}`);
      await openCreatorHub({ root: window });
    }, BUILD);
    const hub = page.locator('#kelo-creators-hub');
    await expect(hub).toBeVisible({ timeout: 10000 });

    await page.waitForFunction(() => !!(
      window.KeloInputLocks?.acquire &&
      window.KELO_ADMIN_KEYS?.can?.('world.edit')
    ), null, { timeout: 10000 });
    const creatorContracts = await page.evaluate(async build => {
      // Read the platform from the exact Creator Hub module instance already opened.
      // Importing creator-entry under a different query string would create a second
      // ESM identity and falsely report platform=null — precisely what A10 avoids.
      const { getCreatorHub } = await import(`./src/creators/ui/creator-hub.mjs?v=${build}`);
      const platform = getCreatorHub()?.platform || null;
      const actorId = platform?.permission?.actorId?.();
      return {
        inputLocks: !!window.KeloInputLocks?.acquire,
        platform: !!platform,
        actorId: actorId || null,
        worldEdit: !!platform?.permission?.can?.('world.edit', actorId),
      };
    }, BUILD);
    expect(creatorContracts.inputLocks).toBeTruthy();
    expect(creatorContracts.platform).toBeTruthy();
    expect(creatorContracts.worldEdit).toBeTruthy();

    await hub.locator('[data-workspace="world"]').click();
    const studio = page.locator('#kelo-studio-live');
    await expect(studio).toBeVisible({ timeout: 15000 });
    await expect(studio).not.toHaveAttribute('data-kelo-world-loading', '1', { timeout: 25000 });
    await expect(hub).toHaveCount(0);

    // A10 gate: survive the historical 8 s collision point and remain alive for
    // a full 15 s after the shell is interactive, with map hydration completed.
    await page.waitForTimeout(15100);
    const firstTrace = await readWorldTrace(page);
    writeWorldTrace('world-editor-black-box-first-open', firstTrace);
    const firstMilestones = firstTrace.map(row => row.milestone);
    expect(firstMilestones).toContain('A10_CHROME_READY');
    expect(firstMilestones).toContain('A10_CORE_READY');
    expect(firstMilestones).toContain('A10_IMPORT_START');
    expect(firstMilestones).toContain('A10_IMPORT_SNAPSHOT_READY');
    expect(firstMilestones).toContain('A10_DOCUMENT_SET_START');
    expect(firstMilestones).toContain('A10_DOCUMENT_SET_DONE');
    expect(firstMilestones).toContain('A10_MAP_READY');
    expect(firstMilestones).toContain('CONTROLLER_OPEN_RESOLVED');
    expect(firstMilestones).toContain('EDITOR_READY');
    expect(firstMilestones).toContain('SURVIVED_1000MS');
    expect(firstMilestones).toContain('SURVIVED_5000MS');
    expect(firstMilestones).toContain('SURVIVED_10000MS');
    expect(firstMilestones).toContain('SURVIVED_15000MS');
    await expect(studio).toBeVisible();

    await page.evaluate(() => document.getElementById('kelo-studio-live')?.remove());
    await expect(studio).toHaveCount(0);

    await page.evaluate(async build => {
      const { openCreatorHub } = await import(`./src/creators/ui/creator-hub.mjs?v=${build}`);
      await openCreatorHub({ root: window });
    }, BUILD);
    await expect(page.locator('#kelo-creators-hub')).toBeVisible({ timeout: 10000 });
    await page.locator('#kelo-creators-hub [data-workspace="world"]').click();

    const recovered = page.locator('#kelo-studio-live');
    await expect(recovered).toBeVisible({ timeout: 15000 });
    await expect(recovered).not.toHaveAttribute('data-kelo-world-loading', '1', { timeout: 25000 });
    await expect(page.locator('#kelo-creators-hub')).toHaveCount(0);
    await expect(recovered).toHaveCSS('position', 'fixed');
    await page.screenshot({ path: 'test-results/world-editor-ios-recovered.png', fullPage: true });

    const recoveredTrace = await readWorldTrace(page);
    writeWorldTrace('world-editor-black-box-reopen', recoveredTrace);
    expect(recoveredTrace.filter(row => row.milestone === 'EDITOR_READY').length).toBeGreaterThanOrEqual(2);
    expect(recoveredTrace.filter(row => row.milestone === 'A10_MAP_READY').length).toBeGreaterThanOrEqual(2);
    expect(recoveredTrace.some(row => row.milestone === 'FAIL')).toBeFalsy();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter(row => /CREATOR_WORLD_STUDIO_MOUNT_FAILED|WORLD_EDIT_NOT_READY/.test(row))).toEqual([]);
  } finally {
    let finalTrace = [];
    try { finalTrace = await readWorldTrace(page); } catch {}
    writeWorldTrace('world-editor-black-box-final', finalTrace);
  }
});
