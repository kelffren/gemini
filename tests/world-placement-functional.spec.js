/* KELO-INDEX
 * area: TEST / WORLD EDITOR / FUNCTIONAL PLACEMENT
 * owner: World editor acceptance
 * purpose: prove the visible mobile Creator flow can open World, preview a tree, place it on the live canvas, and expose the new entity in Explorer
 */
const { test, expect, devices } = require('@playwright/test');
const fs = require('fs');

test.use({
  userAgent: devices['iPhone 13'].userAgent,
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

async function objectCount(studio) {
  const text = await studio.locator('.ks-status').textContent().catch(() => '');
  const match = String(text || '').match(/(\d+)\s+objects?/i);
  return match ? Number(match[1]) : 0;
}

async function openWorld(page) {
  // The game intentionally has a long global boot graph. For this acceptance test
  // we only need the first response committed, then we wait on the exact runtime
  // capabilities required to open World. DOMContentLoaded is not an editor contract.
  await page.goto('./?guest=1&mapEditor=1&worldPlacementFunctional=1', {
    waitUntil: 'commit',
    timeout: 15_000,
  });

  await page.waitForFunction(() => !!(document.querySelector('#kelo-creators-hub') || window.KELO_CREATORS_LAUNCHER), null, { timeout: 45_000 });

  const hub = page.locator('#kelo-creators-hub');
  if (!(await hub.isVisible())) {
    const quick = page.locator('#kw-quick-actions-toggle');
    if (await quick.isVisible()) await quick.tap();
    const menu = page.locator('#lx-side-menu');
    await expect(menu).toBeVisible({ timeout: 20_000 });
    await menu.tap();
    const creators = page.locator('#lx-create-studio');
    await expect(creators).toBeVisible({ timeout: 20_000 });
    await creators.tap();
  }
  console.log('WORLD_FLOW: creators hub requested');
  await expect(hub).toBeVisible({ timeout: 20_000 });

  const world = hub.locator('[data-workspace="world"]');
  await expect(world).toBeVisible({ timeout: 10_000 });
  await world.tap();
  console.log('WORLD_FLOW: world tapped');

  const studio = page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({ timeout: 20_000 });
  await expect(studio.locator('.ks-status')).toBeVisible({ timeout: 30_000 });
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading', '1', { timeout: 40_000 });
  await expect(hub).toHaveCount(0, { timeout: 10_000 });
  console.log('WORLD_FLOW: editor interactive');
  return studio;
}

test('mobile World editor places a real asset into the map', async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync('test-results', { recursive: true });

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e?.stack || e)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  const studio = await openWorld(page);
  const beforeObjects = await objectCount(studio);
  const beforeExplorer = await studio.locator('[data-entity]').count();

  const asset = studio.locator('[data-pane="assets"] [data-asset]:visible').filter({ hasText: /tree|árbol|arbol|roble|pino|oak|pine/i }).first();
  if (!(await asset.isVisible())) {
    const editAssets = studio.locator('[data-act="edit-assets"]:visible').first();
    await expect(editAssets).toBeVisible({ timeout: 10_000 });
    await editAssets.tap();
  }
  console.log('WORLD_FLOW: asset sheet opened');
  await expect(asset).toBeVisible({ timeout: 20_000 });
  const assetId = await asset.getAttribute('data-asset');
  expect(assetId).toBeTruthy();
  const thumbnail = asset.locator('canvas').first();
  await expect(thumbnail).toBeVisible();
  await expect.poll(() => thumbnail.evaluate(canvas => {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    return data.some((value, index) => index % 4 === 3 && value > 10);
  })).toBeTruthy();
  await asset.tap();
  console.log('WORLD_FLOW: tree selected', assetId);
  await expect(studio).toHaveAttribute('data-active-asset', String(assetId), { timeout: 5_000 });

  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const tap = {
    x: Math.max(50, Math.min(box.width - 50, box.width * 0.52)),
    y: Math.max(140, Math.min(box.height - 170, box.height * 0.46)),
  };
  await canvas.tap({ position: tap });
  console.log('WORLD_FLOW: canvas tapped');

  await page.waitForFunction(previous => {
    const status = document.querySelector('#kelo-studio-live .ks-status')?.textContent || '';
    const match = status.match(/(\d+)\s+objects?/i);
    return !!(match && Number(match[1]) > previous);
  }, beforeObjects, { timeout: 20_000 });

  const afterObjects = await objectCount(studio);
  expect(afterObjects).toBeGreaterThan(beforeObjects);
  await expect.poll(async () => studio.locator('[data-entity]').count(), { timeout: 15_000 })
    .toBeGreaterThan(beforeExplorer);

  const save = studio.locator('[data-act="save"]:visible').first();
  await expect(save).toBeVisible({ timeout: 10_000 });
  await save.tap();
  const savedStatus = await studio.locator('.ks-status').textContent();
  const afterExplorer = await studio.locator('[data-entity]').count();
  await expect.poll(() => page.evaluate(() => window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor')?.some(p => p.assetId === document.querySelector('#kelo-studio-live')?.dataset.activeAsset) || false)).toBeTruthy();

  await studio.locator('[data-act="close"]').tap();
  await expect(studio).toHaveCount(0);
  await page.evaluate(async () => {
    const { createWorldWorkspaceManifest } = await import('./src/creators/workspaces/world-workspace.mjs');
    await createWorldWorkspaceManifest().open({ root: window });
  });
  await expect(studio).toBeVisible();
  await expect.poll(() => page.evaluate(id => window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor')?.some(p => p.assetId === id) || false, assetId)).toBeTruthy();
  await studio.locator('[data-act="close"]').tap();
  await expect(studio).toHaveCount(0);

  // KELO-INDEX TEST/MOBILE ocho segundos de joystick tras cerrar World detectan locks y freezes tardíos.
  const beforeWalk = await page.evaluate(() => ({ x: localPlayer.x, y: localPlayer.y }));
  const walkBox = await canvas.boundingBox();
  const sx = walkBox.width * .20, sy = walkBox.height * .68, ex = sx + 95, pointerId = 88;
  await canvas.dispatchEvent('pointerdown', { pointerId, pointerType: 'touch', isPrimary: true, clientX: sx, clientY: sy, buttons: 1, button: 0, pressure: .5, bubbles: true });
  await canvas.dispatchEvent('pointermove', { pointerId, pointerType: 'touch', isPrimary: true, clientX: ex, clientY: sy, buttons: 1, pressure: .5, bubbles: true });
  await page.waitForTimeout(8000);
  const evaluateAt = Date.now();
  const afterWalk = await page.evaluate(() => ({ x: localPlayer.x, y: localPlayer.y, width: document.querySelector('#game-canvas')?.width }));
  expect(Date.now() - evaluateAt).toBeLessThan(400);
  expect(Math.hypot(afterWalk.x - beforeWalk.x, afterWalk.y - beforeWalk.y)).toBeGreaterThan(8);
  expect(afterWalk.width).toBeGreaterThan(0);
  await canvas.dispatchEvent('pointerup', { pointerId, pointerType: 'touch', isPrimary: true, clientX: ex, clientY: sy, buttons: 0, button: 0, pressure: 0, bubbles: true });

  await page.screenshot({ path: 'test-results/world-placement-functional.png', fullPage: true });
  fs.writeFileSync('test-results/world-placement-functional.json', JSON.stringify({
    assetId,
    beforeObjects,
    afterObjects,
    beforeExplorer,
    afterExplorer,
    tap,
    status: savedStatus,
    walk: { before: beforeWalk, after: afterWalk },
    pageErrors,
    consoleErrors,
  }, null, 2));

  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter(row => /CREATOR_WORLD_STUDIO_MOUNT_FAILED|WORLD_EDIT_NOT_READY|WORLD_EDITOR_OPEN_TIMEOUT/.test(row))).toEqual([]);
});
