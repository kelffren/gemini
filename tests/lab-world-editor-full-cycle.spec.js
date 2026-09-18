/* KELO-INDEX
 * area: TEST / LAB / WORLD EDITOR FULL CYCLE
 * owner: temporary verification for 4d60d2e
 * purpose: prove open -> place -> move -> close -> walk -> reopen on mobile without leaving Studio stuck loading
 */
const { test, expect, devices } = require('@playwright/test');
const fs = require('fs');

const iphone = devices['iPhone 13'];
test.use({
  userAgent: iphone.userAgent,
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  deviceScaleFactor: iphone.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

async function objectCount(studio) {
  const text = await studio.locator('.ks-status').textContent().catch(() => '');
  const match = String(text || '').match(/(\d+)\s+objects?/i);
  return match ? Number(match[1]) : 0;
}

async function openCreatorsWorld(page) {
  await page.waitForFunction(() => !!(
    window.KeloGuestPlay?.active?.() &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit') &&
    window.KELO_LUXE?.toggleMenu &&
    window.KELO_CREATORS_LAUNCHER
  ), null, { timeout: 45000 });

  const menu = page.locator('#lx-side-menu');
  await expect(menu).toBeVisible({ timeout: 20000 });

  const panel = page.locator('#lx-menu-panel');
  if (!(await panel.evaluate(el => el.classList.contains('open')).catch(() => false))) {
    await menu.tap();
  }
  await expect(panel).toHaveClass(/open/, { timeout: 10000 });

  const creators = page.locator('#lx-create-studio');
  await expect(creators).toBeVisible({ timeout: 20000 });
  await creators.tap();

  const hub = page.locator('#kelo-creators-hub');
  await expect(hub).toBeVisible({ timeout: 20000 });
  const world = hub.locator('[data-workspace="world"]');
  await expect(world).toBeVisible({ timeout: 10000 });
  await world.tap();

  const studio = page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({ timeout: 20000 });
  await expect(studio.locator('.ks-status')).toBeVisible({ timeout: 30000 });
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading', '1', { timeout: 40000 });
  await expect(hub).toHaveCount(0, { timeout: 10000 });
  return studio;
}

async function walkRight(page, ms = 2500) {
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible({ timeout: 10000 });
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const before = await page.evaluate(() => ({ x: Number(localPlayer.x), y: Number(localPlayer.y) }));
  const sx = Math.max(34, box.width * .20);
  const sy = Math.min(box.height - 100, box.height * .68);
  const ex = Math.min(sx + 92, box.width * .49);
  const pointerId = 901;

  await canvas.dispatchEvent('pointerdown', {
    pointerId, pointerType: 'touch', isPrimary: true,
    clientX: sx, clientY: sy, buttons: 1, button: 0, pressure: .5,
    bubbles: true, cancelable: true,
  });
  for (let i = 1; i <= 6; i++) {
    await canvas.dispatchEvent('pointermove', {
      pointerId, pointerType: 'touch', isPrimary: true,
      clientX: sx + (ex - sx) * i / 6, clientY: sy,
      buttons: 1, button: 0, pressure: .5, bubbles: true, cancelable: true,
    });
    await page.waitForTimeout(35);
  }
  const started = Date.now();
  while (Date.now() - started < ms) {
    await canvas.dispatchEvent('pointermove', {
      pointerId, pointerType: 'touch', isPrimary: true,
      clientX: ex, clientY: sy, buttons: 1, button: 0, pressure: .5,
      bubbles: true, cancelable: true,
    });
    await page.waitForTimeout(250);
  }
  await canvas.dispatchEvent('pointerup', {
    pointerId, pointerType: 'touch', isPrimary: true,
    clientX: ex, clientY: sy, buttons: 0, button: 0, pressure: 0,
    bubbles: true, cancelable: true,
  });
  await page.waitForTimeout(200);

  const after = await page.evaluate(() => ({ x: Number(localPlayer.x), y: Number(localPlayer.y), touchActive: !!input.touchActive }));
  return { before, after, moved: Math.hypot(after.x - before.x, after.y - before.y) };
}

test('4d60d2e full mobile World cycle survives open/place/move/close/walk/reopen', async ({ page }) => {
  test.setTimeout(180000);
  fs.mkdirSync('test-results', { recursive: true });

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e?.stack || e)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  const response = await page.goto('./?guest=1&mapEditor=1&lab4d60d2e=1', {
    waitUntil: 'commit',
    timeout: 15000,
  });
  expect(response && response.status()).toBeLessThan(400);

  let studio = await openCreatorsWorld(page);
  const beforeObjects = await objectCount(studio);

  const editAssets = studio.locator('[data-act="edit-assets"]:visible').first();
  await expect(editAssets).toBeVisible({ timeout: 10000 });
  await editAssets.tap();

  const asset = studio.locator('[data-pane="assets"] [data-asset]:visible').first();
  await expect(asset).toBeVisible({ timeout: 20000 });
  const assetId = await asset.getAttribute('data-asset');
  expect(assetId).toBeTruthy();
  await asset.tap();

  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await canvas.tap({
    position: {
      x: Math.max(50, Math.min(box.width - 50, box.width * .52)),
      y: Math.max(140, Math.min(box.height - 170, box.height * .46)),
    },
  });

  await expect.poll(async () => objectCount(studio), { timeout: 20000 }).toBeGreaterThan(beforeObjects);
  const afterPlaceObjects = await objectCount(studio);

  const explorerRows = studio.locator('[data-entity]');
  await expect.poll(async () => explorerRows.count(), { timeout: 15000 }).toBeGreaterThan(0);
  const placedRow = explorerRows.last();
  const entityId = await placedRow.getAttribute('data-entity');
  expect(entityId).toBeTruthy();
  await placedRow.click({ force: true });

  await page.waitForTimeout(300);
  const xInput = studio.locator('[data-prop="x"]').first();
  await expect(xInput).toHaveCount(1);
  const oldX = Number(await xInput.inputValue());
  const newX = oldX + 64;

  await xInput.evaluate((el, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, newX);

  await expect.poll(async () => Number(await studio.locator('[data-prop="x"]').first().inputValue()), { timeout: 10000 }).toBe(newX);

  const close = studio.locator('[data-act="close"]:visible').first();
  await expect(close).toBeVisible({ timeout: 10000 });
  await close.tap();
  await expect(page.locator('#kelo-studio-live')).toHaveCount(0, { timeout: 15000 });

  const walk = await walkRight(page);
  expect(walk.moved).toBeGreaterThan(4);
  expect(walk.after.touchActive).toBe(false);

  studio = await openCreatorsWorld(page);
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading', '1', { timeout: 40000 });
  await expect.poll(async () => objectCount(studio), { timeout: 20000 }).toBeGreaterThanOrEqual(afterPlaceObjects);

  const persistedRow = studio.locator(`[data-entity="${entityId}"]`);
  await expect(persistedRow).toHaveCount(1, { timeout: 15000 });
  await persistedRow.click({ force: true });
  await page.waitForTimeout(300);

  const persistedX = Number(await studio.locator('[data-prop="x"]').first().inputValue());
  expect(persistedX).toBe(newX);

  const evidence = {
    commitUnderTest: '4d60d2e713b8fe853583309657448a983c688455',
    assetId,
    entityId,
    beforeObjects,
    afterPlaceObjects,
    oldX,
    newX,
    persistedX,
    walkedPixels: walk.moved,
    loadingFlag: await studio.getAttribute('data-kelo-world-loading'),
    pageErrors,
    consoleErrors,
  };
  fs.writeFileSync('test-results/lab-world-editor-full-cycle.json', JSON.stringify(evidence, null, 2));
  await page.screenshot({ path: 'test-results/lab-world-editor-full-cycle.png', fullPage: true });

  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter(row => /CREATOR_WORLD_STUDIO_MOUNT_FAILED|WORLD_EDIT_NOT_READY|WORLD_EDITOR_OPEN_TIMEOUT/.test(row))).toEqual([]);
});
