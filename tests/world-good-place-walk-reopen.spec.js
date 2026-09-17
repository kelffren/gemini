const { test, expect, devices } = require('@playwright/test');

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

async function ensureCreatorsHub(page) {
  const hub = page.locator('#kelo-creators-hub');
  if (await hub.isVisible().catch(() => false)) return hub;

  const menu = page.locator('#lx-side-menu');
  await expect(menu).toBeVisible({ timeout: 30_000 });
  await menu.tap();
  const panel = page.locator('#lx-menu-panel');
  await expect(panel).toHaveClass(/open/, { timeout: 10_000 });
  const creators = page.locator('#lx-create-studio');
  await expect(creators).toBeVisible({ timeout: 20_000 });
  await creators.tap();
  await expect(hub).toBeVisible({ timeout: 20_000 });
  return hub;
}

async function openWorld(page) {
  const hub = await ensureCreatorsHub(page);
  const world = hub.locator('[data-workspace="world"]');
  await expect(world).toBeVisible({ timeout: 15_000 });
  await expect(world).toBeEnabled({ timeout: 15_000 });
  await world.tap();

  const studio = page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({ timeout: 20_000 });
  await expect(studio.locator('.ks-status')).toBeVisible({ timeout: 35_000 });
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading', '1', { timeout: 45_000 });
  await expect(hub).toHaveCount(0, { timeout: 10_000 });
  return studio;
}

async function placeOne(page, studio) {
  const before = await objectCount(studio);
  const editAssets = studio.locator('[data-act="edit-assets"]:visible').first();
  await expect(editAssets).toBeVisible({ timeout: 15_000 });
  await editAssets.tap();
  const asset = studio.locator('[data-pane="assets"] [data-asset]:visible').first();
  await expect(asset).toBeVisible({ timeout: 20_000 });
  const assetId = await asset.getAttribute('data-asset');
  expect(assetId).toBeTruthy();
  await asset.tap();
  await expect(studio).toHaveAttribute('data-active-asset', String(assetId), { timeout: 5_000 });

  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await canvas.tap({
    position: {
      x: Math.max(50, Math.min(box.width - 50, box.width * 0.52)),
      y: Math.max(140, Math.min(box.height - 170, box.height * 0.46)),
    },
  });

  await page.waitForFunction(previous => {
    const status = document.querySelector('#kelo-studio-live .ks-status')?.textContent || '';
    const match = status.match(/(\d+)\s+objects?/i);
    return !!(match && Number(match[1]) > previous);
  }, before, { timeout: 20_000 });

  const after = await objectCount(studio);
  expect(after).toBeGreaterThan(before);
  const save = studio.locator('[data-act="save"]:visible').first();
  if (await save.count()) await save.tap();
  return { before, after, assetId };
}

async function walkAfterClosing(page) {
  const before = await page.evaluate(() => ({
    x: typeof localPlayer !== 'undefined' && localPlayer ? Number(localPlayer.x) : null,
    y: typeof localPlayer !== 'undefined' && localPlayer ? Number(localPlayer.y) : null,
  }));
  expect(before.x).not.toBeNull();
  expect(before.y).not.toBeNull();

  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const sx = box.x + box.width * 0.20;
  const sy = box.y + box.height * 0.70;

  const pointer = async (type, x, y) => page.evaluate(({ type, x, y }) => {
    const c = document.getElementById('game-canvas');
    if (!c) throw new Error('NO_CANVAS');
    c.dispatchEvent(new PointerEvent(type, {
      pointerId: 9,
      pointerType: 'touch',
      isPrimary: true,
      clientX: x,
      clientY: y,
      buttons: type === 'pointerup' ? 0 : 1,
      pressure: type === 'pointerup' ? 0 : 0.5,
      bubbles: true,
    }));
  }, { type, x, y });

  await pointer('pointerdown', sx, sy);
  for (let i = 0; i < 14; i++) {
    await pointer('pointermove', sx + 88, sy);
    await page.waitForTimeout(170);
  }
  await pointer('pointerup', sx + 88, sy);

  const after = await page.evaluate(() => ({ x: Number(localPlayer.x), y: Number(localPlayer.y) }));
  const distance = Math.hypot(after.x - before.x, after.y - before.y);
  expect(distance).toBeGreaterThan(10);
  return { before, after, distance };
}

test('GOOD baseline opens, places, closes, walks, and reopens World editor', async ({ page }) => {
  test.setTimeout(180_000);
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e?.stack || e)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  const response = await page.goto('./?guest=1&mapEditor=1&goodBaselineProof=2', {
    waitUntil: 'commit',
    timeout: 20_000,
  });
  expect(response && response.status()).toBeLessThan(400);

  await page.waitForFunction(() => !!(
    document.getElementById('kelo-creators-hub') ||
    document.getElementById('lx-side-menu')
  ), null, { timeout: 45_000 });

  const first = await openWorld(page);
  const placement = await placeOne(page, first);

  const close = first.locator('[data-act="close"]:visible').first();
  await expect(close).toBeVisible({ timeout: 10_000 });
  await close.tap();
  await expect(page.locator('#kelo-studio-live')).toHaveCount(0, { timeout: 15_000 });

  const walking = await walkAfterClosing(page);

  const second = await openWorld(page);
  await expect(second).toBeVisible();
  await expect(second).not.toHaveAttribute('data-kelo-world-loading', '1');
  await expect(second.locator('.ks-status')).toBeVisible();

  console.log(JSON.stringify({ ok: true, placement, walking, reopened: true }));
  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter(row => /CREATOR_WORLD_STUDIO_MOUNT_FAILED|WORLD_EDIT_NOT_READY|WORLD_EDITOR_OPEN_TIMEOUT/.test(row))).toEqual([]);
});
