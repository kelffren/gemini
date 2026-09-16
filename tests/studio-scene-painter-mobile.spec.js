/* KELO-INDEX
 * area: TEST / STUDIO / SCENE PAINTER MOBILE
 * owner: Kelo Studio Paint Copies regression gate
 * keys: STUDIO PAINT COPIES SCENE PAINTER IPHONE MOBILE GRID UNDO DOM MUTATION FREEZE
 * purpose: open the real World Studio mobile boot, bind to the exact versioned World bridge used by the workspace, exercise Scene Painter UI + Grid batch + Undo, and stress shell DOM mutations without reviving the historical global MutationObserver storm
 * do-not: does not claim physical iPhone/Safari verification; physical-device evidence remains a separate BUG-0003 gate
 */
const { test, expect, devices } = require('@playwright/test');
const fs = require('fs');

const iphone = devices['iPhone 13'];
const BASE_URL = process.env.KELO_PAGES || 'http://127.0.0.1:4173/';

// Keep this aligned with src/creators/workspaces/world-workspace.mjs. The workspace
// intentionally version-tags the bridge so Safari reuses one stable module graph.
const WORLD_BRIDGE_BUILD = 'world-bridge-20260915-22';

test.use({
  baseURL: BASE_URL,
  userAgent: iphone.userAgent,
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  deviceScaleFactor: iphone.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

test('Scene Painter survives mobile lazy boot, Grid 3x2, one Undo and shell mutation stress', async ({ page }) => {
  test.setTimeout(150000);
  fs.mkdirSync('test-results', { recursive: true });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error && error.stack || error)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.addInitScript(() => {
    try {
      localStorage.setItem('kelo.worldSurgery.config.v1', JSON.stringify({ basicTools: true, paintCopies: true }));
    } catch {}
  });

  const response = await page.goto('./?guest=1&mapEditor=1&scenePainterGate=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  expect(response && response.status()).toBeLessThan(400);

  // mapEditor=1 may already mount the Creator Hub. Reuse it instead of creating a duplicate hub.
  let hub = page.locator('#kelo-creators-hub').last();
  const autoHubReady = await hub.isVisible({ timeout: 3500 }).catch(() => false);
  if (!autoHubReady) {
    await page.evaluate(async () => {
      const { openCreatorHub } = await import('./src/creators/ui/creator-hub.mjs');
      await openCreatorHub({ root: window });
    });
    hub = page.locator('#kelo-creators-hub').last();
  }
  await expect(hub).toBeVisible({ timeout: 10000 });
  await page.waitForFunction(() => !!window.KELO_ADMIN_KEYS?.can?.('world.edit'), null, { timeout: 10000 });
  await hub.locator('[data-workspace="world"]').click();

  const studio = page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({ timeout: 20000 });
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading', '1', { timeout: 30000 });

  // IMPORTANT: importing an unversioned bridge creates a different ES-module instance and
  // legitimately sees controllerMod === null. Bind the test to the exact stable build used
  // by World Workspace, and also recognize its stable recovery graph if opening retried.
  await page.evaluate(build => {
    window.__keloScenePainterGateStudio = async () => {
      const tags = [build, `${build}-retry`];
      for (const tag of tags) {
        try {
          const mod = await import(`./src/studio/integration/world-studio-bridge.mjs?v=${tag}`);
          const studioSession = mod.getKeloStudioLive?.()?.studio;
          if (studioSession) return studioSession;
        } catch {}
      }
      return null;
    };
  }, WORLD_BRIDGE_BUILD);

  await page.waitForFunction(async () => {
    try {
      const studioSession = await window.__keloScenePainterGateStudio?.();
      return !!(studioSession?.tools?.paintCopies && window.KELO_WORLD_SURGERY?.enabled?.('paintCopies'));
    } catch { return false; }
  }, null, { timeout: 75000, polling: 250 });

  const sourceState = await page.evaluate(async () => {
    const { createPlaceEntityCommand } = await import('./src/studio/document/document-commands.mjs');
    const session = await window.__keloScenePainterGateStudio?.();
    if (!session) throw new Error('SCENE_PAINTER_LIVE_STUDIO_SESSION_MISSING');
    const id = 'test:scene-painter-source';
    if (!session.kernel.document.entities.some(row => String(row.id) === id)) {
      await session.kernel.execute(createPlaceEntityCommand({
        id,
        prefabId: 'test-scene-source',
        transform: { x: 128, y: 128, rotation: 0, scale: 1 },
        bounds: { w: 32, h: 32 },
      }));
    }
    session.kernel.selection.set(id);
    return {
      id,
      entityCount: session.kernel.document.entities.length,
      undoDepth: session.kernel.history.undoDepth,
      toolLoaded: !!session.tools.paintCopies,
    };
  });
  expect(sourceState.toolLoaded).toBe(true);

  const button = studio.locator('[data-ext-paint-copies]');
  await expect(button).toHaveCount(1, { timeout: 65000 });
  await expect(button).toBeEnabled();
  await button.click();

  const panel = studio.locator('.ks-scene-painter');
  await expect(panel).toBeVisible({ timeout: 5000 });
  await panel.locator('[data-pattern="grid"]').click();
  const cols = panel.locator('[data-setting="columns"]');
  const rows = panel.locator('[data-setting="rows"]');
  await cols.fill('3');
  await cols.dispatchEvent('change');
  await rows.fill('2');
  await rows.dispatchEvent('change');
  await panel.locator('[data-ksp="toggle"]').click();
  await expect(button).toHaveClass(/on/);

  const batch = await page.evaluate(async () => {
    const session = await window.__keloScenePainterGateStudio?.();
    if (!session) throw new Error('SCENE_PAINTER_LIVE_STUDIO_SESSION_MISSING');
    const tool = session.tools.paintCopies;
    const before = {
      entities: session.kernel.document.entities.length,
      undoDepth: session.kernel.history.undoDepth,
    };
    tool.beginAt(320, 320, { snap: 1 });
    const preview = tool.getPreviews();
    const commit = await tool.commit();
    return {
      state: tool.state(),
      previewCount: preview.length,
      committed: commit.rows.length,
      before,
      after: {
        entities: session.kernel.document.entities.length,
        undoDepth: session.kernel.history.undoDepth,
      },
    };
  });
  expect(batch.state.pattern).toBe('grid');
  expect(batch.previewCount).toBe(6);
  expect(batch.committed).toBe(6);
  expect(batch.after.entities - batch.before.entities).toBe(6);
  expect(batch.after.undoDepth - batch.before.undoDepth).toBe(1);

  const undo = await page.evaluate(async expected => {
    const session = await window.__keloScenePainterGateStudio?.();
    if (!session) throw new Error('SCENE_PAINTER_LIVE_STUDIO_SESSION_MISSING');
    await session.kernel.undo();
    return {
      entities: session.kernel.document.entities.length,
      buttonCount: document.querySelectorAll('#kelo-studio-live [data-ext-paint-copies]').length,
      panelCount: document.querySelectorAll('#kelo-studio-live .ks-scene-painter').length,
      expected,
    };
  }, sourceState.entityCount);
  expect(undo.entities).toBe(sourceState.entityCount);
  expect(undo.buttonCount).toBe(1);
  expect(undo.panelCount).toBe(1);

  // Historical failure surface: lots of descendant DOM mutations while Paint Copies is loaded.
  const stress = await page.evaluate(async () => {
    const shell = document.getElementById('kelo-studio-live');
    const started = performance.now();
    for (let i = 0; i < 400; i++) {
      const probe = document.createElement('i');
      probe.dataset.paintCopiesStress = String(i);
      shell.appendChild(probe);
      probe.remove();
    }
    await new Promise(resolve => requestAnimationFrame(() => resolve()));
    return {
      durationMs: performance.now() - started,
      buttonCount: shell.querySelectorAll('[data-ext-paint-copies]').length,
      panelCount: shell.querySelectorAll('.ks-scene-painter').length,
    };
  });
  expect(stress.durationMs).toBeLessThan(1500);
  expect(stress.buttonCount).toBe(1);
  expect(stress.panelCount).toBe(1);

  await page.waitForTimeout(5000);
  const pingStarted = Date.now();
  const alive = await page.evaluate(async () => {
    const session = await window.__keloScenePainterGateStudio?.();
    return {
      studio: !!document.getElementById('kelo-studio-live'),
      toolLoaded: !!session?.tools?.paintCopies,
      pattern: session?.tools?.paintCopies?.state?.().pattern || null,
      buttonCount: document.querySelectorAll('#kelo-studio-live [data-ext-paint-copies]').length,
    };
  });
  const pingLatencyMs = Date.now() - pingStarted;
  expect(pingLatencyMs).toBeLessThanOrEqual(400);
  expect(alive).toEqual({ studio: true, toolLoaded: true, pattern: 'grid', buttonCount: 1 });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter(row => /STUDIO_PAINT_COPIES|CREATOR_WORLD_STUDIO_MOUNT_FAILED|WORLD_EDIT_NOT_READY/.test(row))).toEqual([]);

  await page.screenshot({ path: 'test-results/studio-scene-painter-mobile-pass.png', fullPage: true });
});
