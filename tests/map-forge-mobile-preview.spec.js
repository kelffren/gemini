/* KELO-INDEX
 * area: TEST / MAP FORGE / MOBILE PREVIEW
 * owner: Map Forge mobile browser smoke
 * purpose: verify live Settlemaker generation, real snapshot preview, reversible exterior handoff, camera focus and session restoration at 390x844
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('Map Forge uses live Settlemaker, hides before handoff and restores the same candidate', async ({ page }) => {
  const pageErrors = [];
  const providerWarnings = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Settlemaker') || text.includes('Map Forge')) providerWarnings.push(`${msg.type()}: ${text}`);
  });
  fs.mkdirSync('test-results', { recursive: true });

  const response = await page.goto('/?mapEditor=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
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
    await platform.openWorkspace('map-forge');
  });

  const forge = page.locator('#kelo-map-forge');
  await expect(forge).toBeVisible();
  await expect(page.getByRole('button', { name: 'VER EN MAPA EXTERIOR' })).toBeEnabled();

  await page.waitForFunction(() => {
    const status = document.querySelector('#kelo-map-forge [data-preview-assets]');
    return Number(status?.dataset.previewAssets || 0) > 0;
  }, null, { timeout: 15000 });

  const before = await page.evaluate(async () => {
    const { getMapForgeWorkspace } = await import('./src/creators/ui/map-forge-workspace.mjs');
    const workspace = getMapForgeWorkspace();
    const selected = workspace?.selected;
    return selected ? {
      seed: selected.metadata.seed,
      layoutHash: selected.metadata.layoutHash,
      bounds: selected.worldBounds,
      spawn: selected.spawnPoints?.[0] || null,
      provider: workspace?.result?.provider || null,
      workerMode: workspace?.worker?.mode || null,
      sourceGenerator: selected.metadata.sourceGenerator || null,
      roadSources: [...new Set((selected.roads || []).map(row => row.source || 'unknown'))],
      propertyCatalogVersion: window.KELO_PROPERTY_CATALOG?.version || null,
      propertyPreviewRenderer: typeof window.KELO_PROPERTY_SYSTEM?.drawPlacements === 'function',
      snapshotPreviewRenderer: typeof window.KELO_WORLD_BUILDER?.renderSnapshotPreview === 'function'
    } : null;
  });
  console.log('MAP_FORGE_GENERATION_EVIDENCE', JSON.stringify({ before, providerWarnings }));
  expect(before).not.toBeNull();
  expect(before.provider, `Settlemaker must be primary; warnings=${providerWarnings.join(' | ')}`).toBe('settlemaker');
  expect(before.workerMode).toBe('settlemaker-cloud');
  expect(before.sourceGenerator).toMatch(/^settlemaker@/);
  expect(before.roadSources).toContain('settlemaker');
  expect(before.propertyPreviewRenderer).toBe(true);
  expect(before.snapshotPreviewRenderer).toBe(true);
  await page.screenshot({ path: 'test-results/map-forge-real-preview-390x844.png', fullPage: true });

  await page.getByRole('button', { name: 'VER EN MAPA EXTERIOR' }).click();
  await expect(forge).toHaveCount(0, { timeout: 1000 });
  await expect(page.locator('.kmf-exterior-status, .kmf-return')).toBeVisible({ timeout: 1500 });
  await expect(page.getByRole('button', { name: 'VOLVER A MAP FORGE' })).toBeVisible({ timeout: 15000 });

  const exterior = await page.evaluate(async () => {
    const { getMapForgeWorkspace } = await import('./src/creators/ui/map-forge-workspace.mjs');
    const selected = getMapForgeWorkspace()?.selected;
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
    const { getMapForgeWorkspace } = await import('./src/creators/ui/map-forge-workspace.mjs');
    const selected = getMapForgeWorkspace()?.selected;
    return selected ? { seed: selected.metadata.seed, layoutHash: selected.metadata.layoutHash } : null;
  });
  expect(after).toEqual({ seed: before.seed, layoutHash: before.layoutHash });
  await expect(page.getByRole('button', { name: 'VER EN MAPA EXTERIOR' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/map-forge-restored-390x844.png', fullPage: true });

  expect(pageErrors).toEqual([]);
});
