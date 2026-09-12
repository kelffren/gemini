/* KELO-INDEX
 * area: TEST / MAP FORGE / IOS ENTRY
 * owner: Map Forge iPhone entry smoke
 * purpose: reproduce the exact visible MENÚ → CREATORS → Map Forge touch path on the deployed game
 */
const { test, expect } = require('@playwright/test');

async function tapExactPath(page, screenshotName) {
  const menu = page.locator('#lx-side-menu');
  await expect(menu).toBeVisible({ timeout: 10000 });
  await menu.tap();

  const creators = page.locator('#lx-create-studio');
  await expect(creators).toBeVisible({ timeout: 10000 });
  await creators.tap();

  const hub = page.locator('#kelo-creators-hub');
  await expect(hub).toBeVisible({ timeout: 10000 });

  const mapForge = hub.getByRole('button', { name: 'Abrir Map Forge', exact: true });
  await expect(mapForge).toBeVisible();
  await expect(mapForge).toBeEnabled();

  const hitTest = await mapForge.evaluate(node => {
    const r = node.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      x,
      y,
      cardTag: node.tagName,
      hitTag: hit?.tagName || null,
      hitWorkspace: hit?.closest?.('[data-workspace]')?.dataset?.workspace || null,
      hitInsideCard: !!hit && (hit === node || node.contains(hit)),
      pointerEvents: getComputedStyle(node).pointerEvents,
      disabled: !!node.disabled,
    };
  });
  expect(hitTest.pointerEvents).not.toBe('none');
  expect(hitTest.disabled).toBe(false);
  expect(hitTest.hitInsideCard).toBe(true);
  expect(hitTest.hitWorkspace).toBe('map-forge');

  await mapForge.tap();

  await expect(page.locator('#kelo-map-forge')).toBeVisible({ timeout: 10000 });
  await expect(hub).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('#kelo-map-forge .kmf-canvas')).toBeVisible({ timeout: 5000 });

  await page.screenshot({ path: `test-results/${screenshotName}`, fullPage: true });
}

function collectErrors(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  return { pageErrors, consoleErrors };
}

// This test is intentionally UI-only after setup: no direct openCreatorHub/openWorkspace calls.
test('iPhone exact MENÚ to CREATORS to Map Forge tap path', async ({ page }) => {
  const { pageErrors, consoleErrors } = collectErrors(page);

  const response = await page.goto('./?mapEditor=1&iosMapForgeEntry=1', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  expect(response.status()).toBeLessThan(400);

  await page.waitForFunction(() => !!(
    window.KeloInputLocks?.acquire &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit', window.KELO_ADMIN_KEYS?.playerId?.())
  ), null, { timeout: 15000 });

  await tapExactPath(page, 'map-forge-ios-exact-entry.png');
  expect(pageErrors).toEqual([]);
  if (consoleErrors.length) console.log('IOS_ENTRY_CONSOLE_ERRORS', JSON.stringify(consoleErrors));
});

// Reproduces the user's visible state without mapEditor=1. The auth modal is closed only as
// test setup because the user's screenshot proves their real session is already past that gate.
// From MENÚ onward every interaction is a real iPhone/WebKit touch.
test('iPhone normal game URL past auth gate opens Map Forge with visible taps', async ({ page }) => {
  const { pageErrors, consoleErrors } = collectErrors(page);

  let response = await page.goto('./?mapEditor=1&seedCreatorPermission=1', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(() => !!window.KELO_ADMIN_KEYS?.can?.('world.edit', window.KELO_ADMIN_KEYS?.playerId?.()), null, { timeout: 15000 });

  response = await page.goto('./?iosMapForgeNormalEntry=1', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  expect(response.status()).toBeLessThan(400);
  expect(new URL(page.url()).searchParams.has('mapEditor')).toBe(false);

  await page.waitForFunction(() => !!(
    window.KeloInputLocks?.acquire &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit', window.KELO_ADMIN_KEYS?.playerId?.()) &&
    window.KeloAccountAuthUI?.close
  ), null, { timeout: 15000 });

  await page.evaluate(() => window.KeloAccountAuthUI.close());
  await expect(page.locator('#kelo-account-auth')).toBeHidden();

  await tapExactPath(page, 'map-forge-ios-normal-game-entry.png');
  expect(pageErrors).toEqual([]);
  if (consoleErrors.length) console.log('IOS_NORMAL_ENTRY_CONSOLE_ERRORS', JSON.stringify(consoleErrors));
});
