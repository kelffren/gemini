/* KELO-INDEX
 * area: TEST / WORLD EDITOR / REAL IOS REOPEN
 * owner: World Creator mobile launch regression
 * purpose: reproduce the stale Studio-session black screen and prove World remounts on real iPhone Safari
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');

// Local runs emulate a phone. BrowserStack real iOS must own viewport/touch/mobile
// capabilities; forcing Playwright emulation onto a physical iPhone causes its
// context validation to reject media/device defaults before the page even opens.
const isBrowserStack = Boolean(
  process.env.BROWSERSTACK_USERNAME ||
  process.env.BROWSERSTACK_ACCESS_KEY ||
  process.env.BROWSERSTACK_BUILD_NAME
);
if (!isBrowserStack) {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
}

test('World recovers a stale Studio session instead of leaving iOS on a black page', async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', msg => { if(msg.type()==='error')consoleErrors.push(msg.text()); });
  fs.mkdirSync('test-results', { recursive: true });

  // mapEditor=1 is the explicit local editor authorization mode. A clean browser
  // has no account session or stored admin key, so the regression must enter through
  // this sanctioned path rather than accidentally testing the login modal.
  const response = await page.goto('./?mapEditor=1&world-ios-reopen=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  expect(response && response.status()).toBeLessThan(400);
  await page.waitForFunction(() => !!(
    window.KeloInputLocks?.acquire &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit')
  ), null, { timeout: 15000 });

  await page.evaluate(async () => {
    const { openCreatorHub } = await import('./src/creators/ui/creator-hub.mjs');
    await openCreatorHub({ root: window });
  });
  const hub = page.locator('#kelo-creators-hub');
  await expect(hub).toBeVisible({ timeout: 10000 });
  await hub.locator('[data-workspace="world"]').click();
  const studio = page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({ timeout: 15000 });
  await expect(hub).toHaveCount(0);

  // Reproduce the Safari failure mode: DOM shell disappears while the module-level
  // Studio session is still cached as active.
  await page.evaluate(() => document.getElementById('kelo-studio-live')?.remove());
  await expect(studio).toHaveCount(0);

  await page.evaluate(async () => {
    const { openCreatorHub } = await import(`./src/creators/ui/creator-hub.mjs?ios-reopen=${Date.now()}`);
    await openCreatorHub({ root: window });
  });
  await expect(page.locator('#kelo-creators-hub')).toBeVisible({ timeout: 10000 });
  await page.locator('#kelo-creators-hub [data-workspace="world"]').click();

  const recovered = page.locator('#kelo-studio-live');
  await expect(recovered).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#kelo-creators-hub')).toHaveCount(0);
  await expect(recovered).toHaveCSS('position', 'fixed');
  await page.screenshot({ path: 'test-results/world-editor-ios-recovered.png', fullPage: true });

  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter(row => /CREATOR_WORLD_STUDIO_MOUNT_FAILED|WORLD_EDIT_NOT_READY/.test(row))).toEqual([]);
});
