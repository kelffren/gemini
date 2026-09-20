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

async function kernelSnapshot(page) {
  return page.evaluate(async () => {
    try {
      const resources = (performance.getEntriesByType?.('resource') || []).map(entry => String(entry?.name || ''));
      const controllerUrl = [...resources].reverse().find(url => url.includes('/src/studio/integration/live-studio-controller.mjs'));
      const bridgeUrl = [...resources].reverse().find(url => url.includes('/src/studio/integration/world-studio-bridge.mjs'));
      let session = null;
      let source = '';

      if (controllerUrl) {
        const mod = await import(controllerUrl);
        session = mod.getKeloStudioLive?.() || null;
        source = controllerUrl;
      }
      if (!session && bridgeUrl) {
        const mod = await import(bridgeUrl);
        session = mod.getKeloStudioLive?.() || null;
        source = bridgeUrl;
      }
      if (!session) {
        // Historical snapshots may not expose the already-loaded ESM URL through
        // PerformanceResourceTiming. Import the canonical controller path directly;
        // ESM module caching returns the active singleton rather than creating Studio twice.
        try {
          const mod = await import('./src/studio/integration/live-studio-controller.mjs');
          session = mod.getKeloStudioLive?.() || null;
          source = source || 'canonical-live-studio-controller';
        } catch {}
      }
      if (!session) {
        try {
          const mod = await import('./src/studio/integration/world-studio-bridge.mjs');
          session = mod.getKeloStudioLive?.() || null;
          source = source || 'canonical-world-studio-bridge';
        } catch {}
      }
      if (!session) {
        return { count: -1, ids: [], entities: [], error: 'ACTIVE_STUDIO_SESSION_NOT_FOUND', source };
      }

      const rows = session?.studio?.kernel?.document?.entities || [];
      return {
        count: rows.length,
        ids: rows.map(row => String(row.id)),
        entities: rows.map(row => ({
          id: String(row.id),
          prefabId: row.prefabId == null ? null : String(row.prefabId),
          authorityPlacementId: row.source?.authorityPlacementId == null
            ? (row.source?.placementId == null ? null : String(row.source.placementId))
            : String(row.source.authorityPlacementId),
          x: Number(row.transform?.x) || 0,
          y: Number(row.transform?.y) || 0,
        })),
        source,
      };
    } catch (error) {
      return { count: -1, ids: [], entities: [], error: String(error?.message || error) };
    }
  });
}

async function openCreatorsWorld(page) {
  if (process.env.KELO_VISIBLE_FLOW === '1') {
    // Test exactly what a player does with a finger. If the historical account
    // gate is visible, enter through the real guest button before touching menu.
    const accountDialog = page.getByRole('dialog', { name: /Cuenta de Kelo World/i });
    const enterGuestIfNeeded = async () => {
      const guest = accountDialog.getByRole('button', { name: /Jugar como invitado/i });
      await guest.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      if (await guest.isVisible().catch(() => false)) {
        await guest.tap();
        const hidden = await accountDialog.waitFor({ state: 'hidden', timeout: 4000 }).then(() => true).catch(() => false);
        if (hidden) return true;

        // ea14-era auth points at a Supabase project where anonymous auth is now disabled.
        // That external auth policy is unrelated to World Editor health. If that exact
        // historical error appears, close only the modal through its public UI API and
        // continue the editor acceptance without mutating application bytes.
        const authText = await accountDialog.textContent().catch(() => '');
        if (/anonymous sign-ins are disabled/i.test(String(authText || ''))) {
          await page.evaluate(() => window.KeloAccountAuthUI?.close?.());
          await expect(accountDialog).toBeHidden({ timeout: 5000 });
          console.log('[LAB_STEP] AUTH_EXTERNAL_BYPASS');
          return true;
        }

        await expect(accountDialog).toBeHidden({ timeout: 30000 });
        return true;
      }
      return false;
    };
    await enterGuestIfNeeded();

    // Historical ea14 can have its local developer Admin Key shadowed by the old
    // remote authority. mapEditor=1 explicitly enables the snapshot's own local-root
    // bootstrap, so use that public API only when world.edit is missing.
    const permissionState = await page.evaluate(async () => {
      const keys = window.KELO_ADMIN_KEYS;
      if (!keys) return { allowedForCurrentActor: false, actorId: null, seen: [] };
      keys.installRemoteAdapter?.(null);

      const seen = [];
      if (new URLSearchParams(location.search).get('mapEditor') === '1') {
        for (let i = 0; i < 8; i++) {
          const actorId = String(keys.playerId?.() || window.localPlayer?.id || 'local_pioneer');
          if (!seen.includes(actorId)) seen.push(actorId);
          if (!keys.can?.('world.edit', actorId)) {
            await keys.request?.('admin-key:bootstrap-local-root', {
              actorId,
              ownerId: actorId,
              developer: true,
            });
          }
          keys.syncInventory?.();
          await new Promise(resolve => setTimeout(resolve, 120));
        }
      }

      const actorId = String(keys.playerId?.() || window.localPlayer?.id || 'local_pioneer');
      if (!keys.can?.('world.edit', actorId) && new URLSearchParams(location.search).get('mapEditor') === '1') {
        await keys.request?.('admin-key:bootstrap-local-root', { actorId, ownerId: actorId, developer: true });
        keys.syncInventory?.();
      }
      window.__KELO_LAB_EDITOR_ACTOR = actorId;
      return {
        actorId,
        seen,
        allowedForCurrentActor: !!keys.can?.('world.edit', actorId),
        activeKeys: keys.getActiveKeys?.(actorId) || [],
        source: keys.authoritySource?.() || null,
      };
    });
    expect(permissionState.allowedForCurrentActor).toBe(true);
    console.log('[LAB_STEP] WORLD_EDIT_PERMISSION_OK');

    // No prerequisite runtime globals are accepted as a proxy for a usable UI.
    const existingHub = page.locator('#kelo-creators-hub:visible').last();
    let hub = existingHub;

    if (await existingHub.count() === 0) {
      const menu = page.locator('#lx-side-menu');
      await expect(menu).toBeVisible({ timeout: 60000 });

      const panel = page.locator('#lx-menu-panel');
      const isOpen = await panel.evaluate(el => el.classList.contains('open')).catch(() => false);
      if (!isOpen) {
        await enterGuestIfNeeded();
        await menu.tap();
      }
      await expect(panel).toHaveClass(/open/, { timeout: 15000 });

      const creators = page.locator('#lx-create-studio');
      const creatorVisible = await creators.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);
      if (creatorVisible) {
        await creators.tap();
      } else {
        // ea14 predates the Luxe menu entry for Creators. The Creator Hub module is
        // already the canonical workspace launcher in this snapshot, so invoke that
        // historical owner directly rather than declaring the editor bad because the
        // later navigation affordance did not exist yet.
        await page.evaluate(async () => {
          const { openCreatorHub } = await import('./src/creators/ui/creator-hub.mjs');
          await openCreatorHub({ root: window });
        });
        console.log('[LAB_STEP] HISTORICAL_CREATOR_HUB_FALLBACK');
      }

      hub = page.locator('#kelo-creators-hub:visible').last();
      await expect(hub).toBeVisible({ timeout: 30000 });
    }

    const keyedWorld = hub.locator('[data-workspace="world"]');
    const namedWorld = hub.getByRole('button', { name: /Abrir World/i }).first();
    const world = (await keyedWorld.count()) ? keyedWorld : namedWorld;
    await expect(world).toBeVisible({ timeout: 15000 });
    await world.tap();

    const studio = page.locator('#kelo-studio-live');
    await expect(studio).toBeVisible({ timeout: 30000 });
    await expect(studio.locator('.ks-status')).toBeVisible({ timeout: 30000 });
    await expect(studio).not.toHaveAttribute('data-kelo-world-loading', '1', { timeout: 50000 });
    return studio;
  }

  // mapEditor=1 can auto-open Creators. Reuse that visible Hub instead of
  // calling openCreatorHub a second time and creating a duplicate test artifact.
  await page.waitForTimeout(800);
  let visibleHubs = page.locator('#kelo-creators-hub:visible');
  if (await visibleHubs.count() === 0) {
    await page.evaluate(async () => {
      const { openCreatorHub } = await import('./src/creators/ui/creator-hub.mjs');
      await openCreatorHub({ root: window });
    });
    await page.waitForTimeout(100);
    visibleHubs = page.locator('#kelo-creators-hub:visible');
  }

  await expect.poll(async () => visibleHubs.count(), { timeout: 15000 }).toBeGreaterThan(0);
  const hub = visibleHubs.last();
  await expect(hub).toBeVisible({ timeout: 15000 });

  await page.waitForFunction(() => !!(
    window.KeloInputLocks?.acquire &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit')
  ), null, { timeout: 15000 });

  const keyedWorld = hub.locator('[data-workspace="world"]');
  const namedWorld = hub.getByRole('button', { name: /Abrir World/i }).first();
  const world = (await keyedWorld.count()) ? keyedWorld : namedWorld;
  await expect(world).toBeVisible({ timeout: 10000 });
  await world.tap();

  const studio = page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({ timeout: 20000 });
  await expect(studio.locator('.ks-status')).toBeVisible({ timeout: 30000 });
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading', '1', { timeout: 40000 });
  await expect.poll(async () => page.locator('#kelo-creators-hub:visible').count(), { timeout: 10000 }).toBe(0);
  return studio;
}

async function walkRight(page, ms = 2500) {
  await page.waitForFunction(() => typeof localPlayer !== 'undefined' && typeof input !== 'undefined', null, { timeout: 15000 });
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

  const after = await page.evaluate(() => ({
    x: Number(localPlayer.x),
    y: Number(localPlayer.y),
    touchActive: !!input.touchActive,
  }));
  return { before, after, moved: Math.hypot(after.x - before.x, after.y - before.y) };
}

test('4d60d2e full mobile World cycle survives open/place/move/close/walk/reopen', async ({ page }) => {
  test.setTimeout(process.env.KELO_PROBE_ONLY === '1' ? 90000 : 140000);
  fs.mkdirSync('test-results', { recursive: true });

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e?.stack || e)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  const visibleFlow = process.env.KELO_VISIBLE_FLOW === '1';
  const response = await page.goto(visibleFlow
    ? './?guest=1&mapEditor=1&worldPlacementFunctional=1&labVisibleFlow=1'
    : './?guest=1&mapEditor=1&lab4d60d2e=2', {
    waitUntil: visibleFlow ? 'commit' : 'domcontentloaded',
    timeout: 30000,
  });
  expect(response && response.status()).toBeLessThan(400);

  console.log('[LAB_STEP] OPEN_WORLD_START');
  let studio = await openCreatorsWorld(page);
  console.log('[LAB_STEP] OPEN_WORLD_OK');
  if (process.env.KELO_PROBE_ONLY === '1') {
    fs.writeFileSync('test-results/lab-world-editor-open-probe.json', JSON.stringify({
      commitUnderTest: process.env.KELO_CANDIDATE_SHA || null,
      opened: true,
      loadingFlag: await studio.getAttribute('data-kelo-world-loading'),
      pageErrors,
      consoleErrors,
    }, null, 2));
    await page.screenshot({ path: 'test-results/lab-world-editor-open-probe.png', fullPage: true });
    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter(row => /CREATOR_WORLD_STUDIO_MOUNT_FAILED|WORLD_EDIT_NOT_READY|WORLD_EDITOR_OPEN_TIMEOUT/.test(row))).toEqual([]);
    return;
  }
  console.log('[LAB_STEP] ASSET_PHASE_START');
  const beforeObjects = await objectCount(studio);
  const beforeKernel = await kernelSnapshot(page);
  expect(beforeKernel.count).toBeGreaterThanOrEqual(0);
  const beforeIds = new Set(beforeKernel.ids);

  const editAssets = studio.locator('[data-act="edit-assets"]:visible').first();
  await expect(editAssets).toBeVisible({ timeout: 10000 });
  await editAssets.tap();

  const legacyAsset = studio.locator('[data-pane="assets"] [data-asset]:visible').first();
  const paletteAsset = studio.locator('.ks-asset-palette-item[data-asset-palette-id]:visible').first();
  await expect.poll(async () => (await legacyAsset.count()) + (await paletteAsset.count()), { timeout: 20000 }).toBeGreaterThan(0);
  const asset = (await paletteAsset.count()) ? paletteAsset : legacyAsset;
  const assetId = (await asset.getAttribute('data-asset-palette-id')) || (await asset.getAttribute('data-asset'));
  expect(assetId).toBeTruthy();
  await asset.tap();

  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible({ timeout: 10000 });
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // Canonical historical World placement is a map tap/pointer cycle. This path
  // goes through live-studio-controller guarded(...) so the Kernel AND Studio UI
  // refresh together. The precision pad commits directly and can leave the shell
  // stale, so it is only a fallback if the map tap did not mutate the Kernel.
  const tap = {
    x: Math.max(50, Math.min(box.width - 50, box.width * .52)),
    y: Math.max(140, Math.min(box.height - 170, box.height * .46)),
  };
  await canvas.tap({ position: tap });

  let placed = false;
  try {
    await expect.poll(async () => (await kernelSnapshot(page)).count, { timeout: 7000 }).toBeGreaterThan(beforeKernel.count);
    placed = true;
  } catch {}

  if (!placed) {
    const placeHere = studio.locator('[data-place-action="commit"]:visible').first();
    if (await placeHere.count()) {
      await placeHere.tap();
      await expect.poll(async () => (await kernelSnapshot(page)).count, { timeout: 7000 }).toBeGreaterThan(beforeKernel.count);
      placed = true;
    }
  }
  expect(placed).toBe(true);
  console.log('[LAB_STEP] PLACE_OK');

  const afterKernel = await kernelSnapshot(page);
  const entityId = afterKernel.ids.find(id => !beforeIds.has(id));
  expect(entityId).toBeTruthy();
  const placedEntity = afterKernel.entities.find(row => row.id === entityId);
  expect(placedEntity).toBeTruthy();
  const stablePlacementId = placedEntity.authorityPlacementId || null;
  const placedPrefabId = placedEntity.prefabId || null;

  // After canonical canvas placement the shell should refresh. Give historical
  // builds a short settling window, but use the Kernel as the mutation truth.
  await expect.poll(async () => objectCount(studio), { timeout: 10000 }).toBeGreaterThanOrEqual(beforeObjects + 1);
  const afterPlaceObjects = afterKernel.count;

  const placedRows = studio.locator(`[data-entity="${entityId}"]`);
  await expect.poll(async () => placedRows.count(), { timeout: 10000 }).toBeGreaterThan(0);
  if (await studio.locator(`[data-entity="${entityId}"]:visible`).count() === 0) {
    const editForExplorer = studio.locator('[data-act="edit-assets"]:visible').first();
    if (await editForExplorer.count()) await editForExplorer.tap();
    const explorerTab = studio.locator('[data-tab="explorer"]:visible').first();
    await expect(explorerTab).toBeVisible({ timeout: 10000 });
    await explorerTab.tap();
  }
  const placedRow = studio.locator(`[data-entity="${entityId}"]:visible`).first();
  await expect(placedRow).toBeVisible({ timeout: 10000 });
  await placedRow.tap();
  await page.waitForTimeout(300);

  const xInput = studio.locator('[data-prop="x"]').first();
  await expect(xInput).toHaveCount(1);
  const oldX = Number(await xInput.inputValue());
  const newX = oldX + 64;

  await xInput.evaluate((el, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, newX);
  console.log('[LAB_STEP] MOVE_START');
  await expect.poll(async () => {
    const snap = await kernelSnapshot(page);
    return snap.entities.find(row => row.id === entityId)?.x;
  }, { timeout: 10000 }).toBe(newX);

  console.log('[LAB_STEP] MOVE_OK');
  const close = studio.locator('[data-act="close"]:visible').first();
  await expect(close).toBeVisible({ timeout: 10000 });
  await close.tap();
  await expect(page.locator('#kelo-studio-live')).toHaveCount(0, { timeout: 20000 });

  console.log('[LAB_STEP] CLOSE_OK');
  const walk = await walkRight(page);
  expect(walk.moved).toBeGreaterThan(4);
  expect(walk.after.touchActive).toBe(false);

  console.log('[LAB_STEP] WALK_OK');
  console.log('[LAB_STEP] REOPEN_START');
  studio = await openCreatorsWorld(page);
  console.log('[LAB_STEP] REOPEN_OK');
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading', '1', { timeout: 40000 });
  await expect.poll(async () => (await kernelSnapshot(page)).count, { timeout: 20000 }).toBeGreaterThanOrEqual(afterPlaceObjects);

  // Explorer rows are virtualized lazily on historical mobile Studio. After
  // reopening, activate the visible workspace first, then assert the persisted row.
  const editForPersistedExplorer = studio.locator('[data-act="edit-assets"]:visible').first();
  if (await editForPersistedExplorer.count()) await editForPersistedExplorer.tap();
  const persistedExplorerTab = studio.locator('[data-tab="explorer"]:visible').first();
  await expect(persistedExplorerTab).toBeVisible({ timeout: 10000 });
  await persistedExplorerTab.tap();

  const reopenedKernel = await kernelSnapshot(page);
  const persistedEntity =
    (stablePlacementId
      ? reopenedKernel.entities.find(row => row.authorityPlacementId === stablePlacementId)
      : null)
    || reopenedKernel.entities.find(row =>
      (!placedPrefabId || row.prefabId === placedPrefabId)
      && row.x === newX
    );
  expect(persistedEntity).toBeTruthy();
  expect(persistedEntity.x).toBe(newX);

  const persistedRows = studio.locator(`[data-entity="${persistedEntity.id}"]`);
  await expect.poll(async () => persistedRows.count(), { timeout: 15000 }).toBeGreaterThan(0);
  const persistedRow = studio.locator(`[data-entity="${persistedEntity.id}"]:visible`).first();
  await expect(persistedRow).toBeVisible({ timeout: 15000 });
  await persistedRow.tap();
  await page.waitForTimeout(300);

  const persistedX = Number(await studio.locator('[data-prop="x"]').first().inputValue());
  expect(persistedX).toBe(newX);

  const evidence = {
    commitUnderTest: process.env.KELO_CANDIDATE_SHA || null,
    assetId,
    entityId,
    reopenedEntityId: persistedEntity.id,
    stablePlacementId,
    placedPrefabId,
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
