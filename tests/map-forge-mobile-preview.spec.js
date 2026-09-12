/* KELO-INDEX
 * area: TEST / MAP FORGE / MOBILE PREVIEW
 * owner: Map Forge mobile browser smoke
 * purpose: verify Hub launch is independent from generation readiness, plus real preview, visible sprite/scene requirements, reversible exterior handoff, camera focus and session restoration at 390x844
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('Map Forge opens from Creator Hub before a stalled first generation settles', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  const response = await page.goto('./?offline=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(() => !!(
    window.KeloInputLocks?.acquire &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit')
  ), null, { timeout: 15000 });

  await page.evaluate(async () => {
    const { openCreatorHub } = await import('./src/creators/ui/creator-hub.mjs');
    await openCreatorHub({ root: window });
  });
  await expect(page.locator('#kelo-creators-hub')).toBeVisible();
  await expect(page.locator('#kelo-creators-hub [data-workspace="map-forge"]')).toBeEnabled();

  await page.evaluate(() => {
    window.__KELO_TEST_REAL_WORKER__ = window.Worker;
    window.Worker = class StalledMapForgeWorker {
      constructor(){ this.onmessage = null; this.onerror = null; }
      postMessage(){}
      terminate(){}
    };
  });

  await page.locator('#kelo-creators-hub [data-workspace="map-forge"]').click();
  await expect(page.locator('#kelo-map-forge')).toBeVisible({ timeout: 2000 });
  await expect(page.locator('#kelo-creators-hub')).toHaveCount(0, { timeout: 2000 });
  await expect(page.locator('#kelo-map-forge .kmf-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'GENERANDO…' })).toBeVisible();

  await page.getByRole('button', { name: 'CERRAR', exact: true }).click();
  await page.evaluate(() => {
    if(window.__KELO_TEST_REAL_WORKER__)window.Worker = window.__KELO_TEST_REAL_WORKER__;
    delete window.__KELO_TEST_REAL_WORKER__;
  });
  expect(pageErrors).toEqual([]);
});

test('Map Forge real preview exposes scene and sprite requirements, hides before handoff and restores the same candidate', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  fs.mkdirSync('test-results', { recursive: true });

  const response = await page.goto('./?mapEditor=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  expect(response.status()).toBeLessThan(400);

  await page.waitForFunction(() => !!(
    window.KELO_WORLD_BUILDER?.renderSnapshotPreview &&
    window.KELO_PROPERTY_SYSTEM?.drawPlacements &&
    window.KELO_PROPERTY_CATALOG &&
    window.KeloCamera?.focus &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit')
  ), null, { timeout: 15000 });

  await page.evaluate(async () => {
    const { bootKeloCreators } = await import('./src/creators/creator-entry.mjs');
    const platform = await bootKeloCreators({ root: window });
    window.__KELO_TEST_MAP_FORGE_WORKSPACE__ = await platform.openWorkspace('map-forge');
  });

  const forge = page.locator('#kelo-map-forge');
  await expect(forge).toBeVisible();
  await expect(page.getByRole('button', { name: 'VER EN MAPA EXTERIOR' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'SPRITES NECESARIOS' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'PLAN DE ESCENAS' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'COPIAR COLA DE ARTE' })).toBeVisible();
  await expect(page.locator('#kelo-map-forge .kmf-scene-row')).toHaveCount(await page.locator('#kelo-map-forge .kmf-scene-row').count());
  expect(await page.locator('#kelo-map-forge .kmf-scene-row').count()).toBeGreaterThan(0);
  expect(await page.locator('#kelo-map-forge .kmf-sprite-row').count()).toBeGreaterThan(0);
  await expect(page.locator('#kelo-map-forge .kmf-badge.arrival')).toContainText('LLEGADA');

  await page.waitForFunction(() => {
    const status = document.querySelector('#kelo-map-forge [data-preview-assets]');
    return Number(status?.dataset.previewAssets || 0) > 0;
  }, null, { timeout: 15000 });

  const before = await page.evaluate(async () => {
    const selected = window.__KELO_TEST_MAP_FORGE_WORKSPACE__?.selected;
    return selected ? {
      seed: selected.metadata.seed,
      layoutHash: selected.metadata.layoutHash,
      bounds: selected.worldBounds,
      spawn: selected.spawnPoints?.[0] || null,
      propertyCatalogVersion: window.KELO_PROPERTY_CATALOG?.version || null,
      propertyPreviewRenderer: typeof window.KELO_PROPERTY_SYSTEM?.drawPlacements === 'function',
      snapshotPreviewRenderer: typeof window.KELO_WORLD_BUILDER?.renderSnapshotPreview === 'function',
      spriteManifestVersion: selected.spriteManifest?.version || null,
      uniqueSprites: selected.spriteManifest?.uniqueSprites || 0,
      spriteInstances: selected.spriteManifest?.totalInstances || 0,
      sceneBuildPlanCount: selected.sceneBuildPlan?.length || 0,
      arrivalScenes: (selected.sceneBuildPlan || []).filter(scene => scene.sceneType === 'arrival').length
    } : null;
  });
  expect(before).not.toBeNull();
  expect(before.propertyPreviewRenderer).toBe(true);
  expect(before.snapshotPreviewRenderer).toBe(true);
  expect(before.spriteManifestVersion).toBe('map-forge-sprite-manifest-v1');
  expect(before.uniqueSprites).toBeGreaterThan(0);
  expect(before.spriteInstances).toBeGreaterThan(0);
  expect(before.sceneBuildPlanCount).toBeGreaterThan(0);
  expect(before.arrivalScenes).toBe(1);
  await page.screenshot({ path: 'test-results/map-forge-real-preview-390x844.png', fullPage: true });

  await page.getByRole('button', { name: 'VER EN MAPA EXTERIOR' }).click();
  await expect(forge).toHaveCount(0, { timeout: 1000 });
  await expect(page.locator('.kmf-exterior-status, .kmf-return')).toBeVisible({ timeout: 1500 });
  await expect(page.getByRole('button', { name: 'VOLVER A MAP FORGE' })).toBeVisible({ timeout: 15000 });

  const exterior = await page.evaluate(async () => {
    const selected = window.__KELO_TEST_MAP_FORGE_WORKSPACE__?.selected;
    const runtime = window.KELO_WORLD_BUILDER?.snapshot?.();
    const camera = window.KeloCamera?.snapshot?.();
    const placements = window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor') || [];
    return {
      seed: selected?.metadata?.seed ?? null,
      layoutHash: selected?.metadata?.layoutHash ?? null,
      bounds: selected?.worldBounds || null,
      viewKind: runtime?.view?.kind || null,
      cellCount: Object.keys(runtime?.cells || {}).length,
      placementCount: placements.length,
      camera: camera ? { x: camera.x, y: camera.y, targetX: camera.targetX, targetY: camera.targetY } : null
    };
  });

  expect(exterior.viewKind).toBe('preview');
  expect(exterior.cellCount).toBeGreaterThan(5000);
  expect(exterior.placementCount).toBeGreaterThan(0);
  expect(exterior.seed).toBe(before.seed);
  expect(exterior.layoutHash).toBe(before.layoutHash);
  expect(exterior.camera).not.toBeNull();
  const b = exterior.bounds;
  expect(exterior.camera.targetX).toBeGreaterThanOrEqual(b.x);
  expect(exterior.camera.targetX).toBeLessThanOrEqual(b.x + b.w);
  expect(exterior.camera.targetY).toBeGreaterThanOrEqual(b.y);
  expect(exterior.camera.targetY).toBeLessThanOrEqual(b.y + b.h);
  await page.screenshot({ path: 'test-results/map-forge-exterior-preview-390x844.png', fullPage: true });

  await page.getByRole('button', { name: 'VOLVER A MAP FORGE' }).click();
  await expect(forge).toBeVisible({ timeout: 10000 });
  const after = await page.evaluate(async () => {
    const selected = window.__KELO_TEST_MAP_FORGE_WORKSPACE__?.selected;
    return selected ? { seed: selected.metadata.seed, layoutHash: selected.metadata.layoutHash } : null;
  });
  expect(after).toEqual({ seed: before.seed, layoutHash: before.layoutHash });
  await expect(page.getByRole('button', { name: 'VER EN MAPA EXTERIOR' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'SPRITES NECESARIOS' })).toBeVisible();
  await page.screenshot({ path: 'test-results/map-forge-restored-390x844.png', fullPage: true });

  expect(pageErrors).toEqual([]);
});
