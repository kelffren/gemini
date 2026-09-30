/* KELO-INDEX
 * area: TEST / WORLD EDITOR / TREE PERSISTENCE
 * owner: World editor acceptance
 * purpose: place a tree, save, leave, reopen, reload, move, save, reload — the same object must survive real local draft storage
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

async function openWorld(page) {
  if (!page.url().includes('treePersist=1')) {
    await page.goto('./?guest=1&mapEditor=1&treePersist=1', { waitUntil: 'commit', timeout: 20_000 });
  }
  await page.waitForFunction(() => !!(document.querySelector('#game-canvas') && (document.querySelector('#kelo-creators-hub') || window.KELO_CREATORS_LAUNCHER || document.querySelector('#lx-side-menu') || document.querySelector('#lx-create-studio'))), null, { timeout: 70_000 });
  const hub = page.locator('#kelo-creators-hub');
  if (!(await hub.isVisible().catch(() => false))) {
    await page.evaluate(() => {
      const create = document.querySelector('#lx-create-studio');
      if (create) create.click();
      else document.querySelector('#lx-side-menu')?.click();
    });
    await page.waitForTimeout(500);
    if (!(await hub.isVisible().catch(() => false))) {
      await page.evaluate(() => document.querySelector('#lx-create-studio')?.click());
    }
  }
  await expect(hub).toBeVisible({ timeout: 25_000 });
  await hub.locator('[data-workspace="world"]').tap();
  const studio = page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({ timeout: 40_000 });
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading', '1', { timeout: 50_000 });
  await expect(studio).toHaveAttribute('data-kelo-studio-interactive', '1', { timeout: 50_000 });
  await expect(hub).toHaveCount(0, { timeout: 15_000 });
  return studio;
}

async function waitHydrated(page) {
  await page.waitForFunction(() => document.querySelector('#kelo-studio-live')?.dataset.keloWorldHydrated === '1', null, { timeout: 20_000 });
}

async function worldPlacements(page) {
  return page.evaluate(() => (window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor') || []).map(p => ({
    id: p.placementId,
    asset: p.assetId,
    x: p.x,
    y: p.y,
  })));
}

async function draftPlacements(page) {
  return page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('kelo_world_edit_authority_v1') || 'null');
    const id = store?.activeDraftByActor?.local_pioneer;
    const draft = id ? store?.drafts?.[id] : null;
    return {
      saved: !!draft?.savedAt,
      savedAt: draft?.savedAt || 0,
      placements: (draft?.snapshot?.placements || []).map(p => ({ id: p.placementId, asset: p.assetId, x: p.x, y: p.y })),
    };
  });
}

test('saved tree survives editor reopen, full reload, and a second move', async ({ page }) => {
  test.setTimeout(300_000);
  fs.mkdirSync('test-results', { recursive: true });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));

  let studio = await openWorld(page);
  await waitHydrated(page);

  let asset = studio.locator('[data-pane="assets"] [data-asset]:visible').filter({ hasText: /tree|árbol|arbol|roble|pino|oak|pine/i }).first();
  if (!(await asset.isVisible().catch(() => false))) {
    const editAssets = studio.locator('[data-act="edit-assets"]:visible').first();
    await expect(editAssets).toBeVisible({ timeout: 10_000 });
    await editAssets.tap();
    asset = studio.locator('[data-pane="assets"] [data-asset]:visible').filter({ hasText: /tree|árbol|arbol|roble|pino|oak|pine/i }).first();
  }
  await expect(asset).toBeVisible({ timeout: 20_000 });
  const assetId = await asset.getAttribute('data-asset');
  expect(assetId).toBeTruthy();
  await asset.tap();
  await expect(studio).toHaveAttribute('data-active-asset', String(assetId), { timeout: 8_000 });

  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await canvas.tap({ position: { x: box.width * 0.52, y: box.height * 0.46 } });
  await expect.poll(async () => (await worldPlacements(page)).some(p => p.asset === assetId)).toBeTruthy();
  const placed = (await worldPlacements(page)).find(p => p.asset === assetId);
  expect(placed?.id).toBeTruthy();

  const save = studio.locator('[data-act="save"]:visible').first();
  await expect(save).toBeVisible();
  await save.tap();
  await expect.poll(async () => {
    const draft = await draftPlacements(page);
    return draft.placements.some(p => p.id === placed.id && p.x === placed.x && p.y === placed.y);
  }).toBeTruthy();
  const saved = await draftPlacements(page);

  await studio.locator('[data-act="close"]').tap();
  await expect(studio).toHaveCount(0);

  studio = await openWorld(page);
  await waitHydrated(page);
  await expect.poll(async () => (await worldPlacements(page)).some(p => p.id === placed.id && p.x === placed.x && p.y === placed.y)).toBeTruthy();
  await expect.poll(() => page.evaluate(id => {
    const status = document.querySelector('#kelo-studio-live .ks-status')?.textContent || '';
    const match = status.match(/(\d+)\s+objects?/i);
    return !!(match && Number(match[1]) >= 1) || !!document.querySelector(`#kelo-studio-live [data-entity="${id}"]`);
  }, placed.id)).toBeTruthy();

  await page.reload({ waitUntil: 'commit' });
  studio = await openWorld(page);
  await waitHydrated(page);
  await expect.poll(async () => (await worldPlacements(page)).some(p => p.id === placed.id && p.x === placed.x && p.y === placed.y)).toBeTruthy();

  await studio.locator('[data-tab="explorer"]').tap();
  const row = studio.locator(`[data-entity="${placed.id}"]`).filter({ visible: true }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.tap();
  await studio.locator('[data-tab="properties"]').tap();
  const nextX = placed.x + 64;
  const xInput = studio.locator('[data-prop="x"]').filter({ visible: true }).first();
  await expect(xInput).toBeVisible({ timeout: 8_000 });
  await xInput.fill(String(nextX));
  await xInput.dispatchEvent('change');
  await expect.poll(async () => (await worldPlacements(page)).find(p => p.id === placed.id)?.x).toBe(nextX);

  await studio.locator('[data-act="save"]:visible').first().tap();
  await expect.poll(async () => (await draftPlacements(page)).placements.some(p => p.id === placed.id && p.x === nextX)).toBeTruthy();

  await page.reload({ waitUntil: 'commit' });
  studio = await openWorld(page);
  await waitHydrated(page);
  await expect.poll(async () => {
    const row = (await worldPlacements(page)).find(p => p.id === placed.id);
    return !!row && row.x === nextX && row.y === placed.y && row.asset === assetId;
  }).toBeTruthy();

  const finalPlacements = await worldPlacements(page);
  const finalDraft = await draftPlacements(page);
  fs.writeFileSync('test-results/world-editor-tree-persistence.json', JSON.stringify({
    assetId,
    placed,
    nextX,
    saved,
    finalPlacements,
    finalDraft,
    pageErrors,
  }, null, 2));
  expect(pageErrors.filter(row => /WORLD_EDIT_NOT_READY|WORLD_EDITOR_OPEN_TIMEOUT|CREATOR_WORLD_STUDIO_MOUNT_FAILED/.test(row))).toEqual([]);
});
