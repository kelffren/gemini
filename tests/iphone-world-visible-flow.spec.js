/* KELO-INDEX
 * area: TEST / REAL IPHONE / WORLD VISIBLE FLOW
 * owner: BrowserStack iPhone World acceptance
 * purpose: prove the player-visible Menu -> Creators -> World path mounts an interactive Studio and can close/reopen without black-screening
 * acceptance: no programmatic Creator Hub import/open; all launch transitions use visible touch controls
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const isBrowserStack = Boolean(
  process.env.BROWSERSTACK_USERNAME ||
  process.env.BROWSERSTACK_ACCESS_KEY ||
  process.env.BROWSERSTACK_BUILD_NAME
);

test.skip(!isBrowserStack, 'Visible World proof only runs through BrowserStack real iPhone');

async function assertRealIPhone(page) {
  const device = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    width: innerWidth,
    height: innerHeight,
    pathname: location.pathname,
    dpr: devicePixelRatio,
  }));
  expect(device.pathname).toMatch(/\/gemini\/?$/);
  expect(device.userAgent).toMatch(/iPhone|iPod/i);
  expect(device.maxTouchPoints).toBeGreaterThan(0);
  expect(device.width).toBeGreaterThan(250);
  expect(device.width).toBeLessThanOrEqual(600);
  return device;
}

async function openWorldThroughVisibleUI(page, phase) {
  const menu = page.locator('#lx-side-menu');
  await expect(menu).toBeVisible({ timeout: 20_000 });
  await menu.tap();

  const panel = page.locator('#lx-menu-panel');
  await expect(panel).toHaveClass(/open/, { timeout: 10_000 });

  const creators = page.locator('#lx-create-studio');
  await expect(creators).toBeVisible({ timeout: 20_000 });
  await expect(creators).toHaveAttribute('aria-label', /Kelo Creators/i);
  await creators.tap();

  const hub = page.locator('#kelo-creators-hub');
  await expect(hub).toBeVisible({ timeout: 20_000 });

  const world = hub.locator('[data-workspace="world"]');
  await expect(world).toBeVisible({ timeout: 10_000 });
  await expect(world).toContainText(/World/i);

  const startedAt = Date.now();
  await world.tap();

  const studio = page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({ timeout: 15_000 });
  const chromeMs = Date.now() - startedAt;

  // A painted loading curtain is not acceptance. Require the actual Studio status
  // and the world-loading marker to clear before calling the editor interactive.
  await expect(studio.locator('.ks-status')).toBeVisible({ timeout: 25_000 });
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading', '1', { timeout: 30_000 });
  await expect(page.locator('#kelo-creators-hub')).toHaveCount(0, { timeout: 10_000 });

  // Prove touch reaches an actual Studio tool, not just the shell.
  const move = studio.locator('[data-mode="move"]:visible').first();
  await expect(move).toBeVisible({ timeout: 10_000 });
  await move.tap();
  await expect(move).toHaveClass(/on/, { timeout: 5_000 });

  const snapshot = await studio.evaluate(root => ({
    loading: root.dataset.keloWorldLoading || null,
    status: root.querySelector('.ks-status')?.textContent || '',
    activeTool: root.querySelector('.ks-active-tool-value')?.textContent || '',
    position: getComputedStyle(root).position,
    width: root.getBoundingClientRect().width,
    height: root.getBoundingClientRect().height,
  }));

  await page.screenshot({ path: `test-results/iphone-world-visible-${phase}.png`, fullPage: true });
  return { studio, chromeMs, snapshot };
}

test('real iPhone visibly opens World, uses a tool, closes and reopens it', async ({ page }) => {
  test.setTimeout(180_000);
  fs.mkdirSync('test-results', { recursive: true });

  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('requestfailed', req => failedRequests.push(`${req.url()} :: ${req.failure()?.errorText || 'failed'}`));

  const response = await page.goto('./?guest=1&mapEditor=1&iphoneWorldVisible=1', {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  const device = await assertRealIPhone(page);
  await page.waitForFunction(() => !!(
    window.KeloGuestPlay?.active?.() &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit') &&
    window.KELO_LUXE?.toggleMenu &&
    window.KELO_CREATORS_LAUNCHER
  ), null, { timeout: 30_000 });

  const first = await openWorldThroughVisibleUI(page, 'first-open');
  expect(first.snapshot.position).toBe('fixed');
  expect(first.snapshot.width).toBeGreaterThan(250);
  expect(first.snapshot.height).toBeGreaterThan(400);

  // Close through the visible Studio control, then repeat the complete visible
  // launcher path. This targets the historical stale-shell/reopen black screen.
  const close = first.studio.locator('[data-act="close"]:visible').first();
  await expect(close).toBeVisible({ timeout: 10_000 });
  await close.tap();
  await expect(page.locator('#kelo-studio-live')).toHaveCount(0, { timeout: 15_000 });

  const second = await openWorldThroughVisibleUI(page, 'second-open');
  expect(second.snapshot.position).toBe('fixed');
  expect(second.snapshot.width).toBeGreaterThan(250);
  expect(second.snapshot.height).toBeGreaterThan(400);

  const report = {
    device,
    first: { chromeMs: first.chromeMs, snapshot: first.snapshot },
    second: { chromeMs: second.chromeMs, snapshot: second.snapshot },
    pageErrors,
    consoleErrors,
    failedRequests,
  };
  fs.writeFileSync('test-results/iphone-world-visible-report.json', JSON.stringify(report, null, 2));

  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter(row => /CREATOR_WORLD_STUDIO_MOUNT_FAILED|WORLD_EDIT_NOT_READY|WORLD_EDITOR_OPEN_TIMEOUT/.test(row))).toEqual([]);
});
