/* KELO-INDEX
 * area: TEST / STUDIO / SCENE PAINTER MOBILE
 * owner: Kelo Studio Paint Copies regression gate
 * keys: STUDIO PAINT COPIES SCENE PAINTER IPHONE MOBILE GRID TOUCH UNDO DOM MUTATION FREEZE
 * purpose: open the real World Studio mobile boot, require Scene Painter in the early phone wave, exercise the real touch input path, Grid 3x2 + one Undo, and stress descendant DOM mutations
 * do-not: Chromium iPhone emulation is not physical iPhone/Safari verification; BUG-0003 still requires real-device evidence
 */
const { test, expect, devices } = require('@playwright/test');
const fs = require('fs');

const iphone = devices['iPhone 13'];
const BASE_URL = process.env.KELO_PAGES || 'http://127.0.0.1:4173/';

// Resolve the exact versioned World bridge already loaded by World workspace.
// Importing the unversioned bridge creates a different ES-module instance and
// therefore cannot see the live controller/session owned by the versioned chain.
async function liveStudioState(page, fn, arg) {
  return page.evaluate(async ({ source, arg }) => {
    const bridgeUrl = performance.getEntriesByType('resource')
      .map(entry => String(entry.name || ''))
      .find(name => name.includes('/src/studio/integration/world-studio-bridge.mjs?v='));
    if (!bridgeUrl) throw new Error('SCENE_PAINTER_VERSIONED_BRIDGE_URL_MISSING');
    const bridge = await import(bridgeUrl);
    const session = bridge.getKeloStudioLive()?.studio;
    if (!session) throw new Error('SCENE_PAINTER_LIVE_STUDIO_SESSION_MISSING');
    const callback = (0, eval)(`(${source})`);
    return callback(session, arg);
  }, { source: fn.toString(), arg });
}

test.use({
  baseURL: BASE_URL,
  userAgent: iphone.userAgent,
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  deviceScaleFactor: iphone.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

test('Scene Painter is early on phone and Grid touch commits as one Undo without DOM storm', async ({ page }) => {
  test.setTimeout(120000);
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

  // Regression target: this used to be hidden behind the 22s productivity UI
  // and 45s optional-build wave. It now has to exist promptly after Studio is interactive.
  await page.waitForFunction(async () => {
    try {
      const bridgeUrl = performance.getEntriesByType('resource')
        .map(entry => String(entry.name || ''))
        .find(name => name.includes('/src/studio/integration/world-studio-bridge.mjs?v='));
      if (!bridgeUrl) return false;
      const bridge = await import(bridgeUrl);
      return !!bridge.getKeloStudioLive()?.studio?.tools?.paintCopies;
    } catch { return false; }
  }, null, { timeout: 12000, polling: 150 });

  const sourceState = await liveStudioState(page, async session => {
    const { createPlaceEntityCommand } = await import('./src/studio/document/document-commands.mjs');
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
  await expect(button).toHaveCount(1, { timeout: 3000 });
  await expect(button).toBeEnabled();
  await button.click();

  const panel = studio.locator('.ks-scene-painter');
  await expect(panel).toBeVisible({ timeout: 3000 });
  await panel.locator('[data-pattern="grid"]').click();
  const cols = panel.locator('[data-setting="columns"]');
  const rows = panel.locator('[data-setting="rows"]');
  await cols.fill('3');
  await cols.dispatchEvent('change');
  await rows.fill('2');
  await rows.dispatchEvent('change');
  await panel.locator('[data-ksp="toggle"]').click();
  await expect(button).toHaveClass(/on/);

  const beforeTouch = await liveStudioState(page, session => ({
    entities: session.kernel.document.entities.length,
    undoDepth: session.kernel.history.undoDepth,
    pattern: session.tools.paintCopies.state().pattern,
  }));
  expect(beforeTouch.pattern).toBe('grid');

  // Center of viewport is outside Studio chrome. This uses Chromium's mobile
  // touch pipeline -> Pointer Events -> Studio input router -> Scene Painter.
  await page.touchscreen.tap(195, 390);

  await expect.poll(async () => liveStudioState(page, session => session.kernel.document.entities.length), {
    timeout: 6000,
    intervals: [50, 100, 200],
  }).toBe(beforeTouch.entities + 6);

  const afterTouch = await liveStudioState(page, session => ({
    entities: session.kernel.document.entities.length,
    undoDepth: session.kernel.history.undoDepth,
    pattern: session.tools.paintCopies.state().pattern,
  }));
  expect(afterTouch.entities - beforeTouch.entities).toBe(6);
  expect(afterTouch.undoDepth - beforeTouch.undoDepth).toBe(1);

  await liveStudioState(page, async session => { await session.kernel.undo(); return true; });
  const afterUndo = await liveStudioState(page, session => ({
    entities: session.kernel.document.entities.length,
    buttonCount: document.querySelectorAll('#kelo-studio-live [data-ext-paint-copies]').length,
    panelCount: document.querySelectorAll('#kelo-studio-live .ks-scene-painter').length,
  }));
  expect(afterUndo.entities).toBe(sourceState.entityCount);
  expect(afterUndo.buttonCount).toBe(1);
  expect(afterUndo.panelCount).toBe(1);

  const stress = await page.evaluate(async () => {
    const shell = document.getElementById('kelo-studio-live');
    const started = performance.now();
    for (let i = 0; i < 400; i++) {
      const probe = document.createElement('i');
      probe.dataset.paintCopiesStress = String(i);
      shell.appendChild(probe);
      probe.remove();
    }
    await new Promise(resolve => requestAnimationFrame(resolve));
    return {
      durationMs: performance.now() - started,
      buttonCount: shell.querySelectorAll('[data-ext-paint-copies]').length,
      panelCount: shell.querySelectorAll('.ks-scene-painter').length,
    };
  });
  expect(stress.durationMs).toBeLessThan(1500);
  expect(stress.buttonCount).toBe(1);
  expect(stress.panelCount).toBe(1);

  await page.waitForTimeout(3000);
  const pingStarted = Date.now();
  const alive = await liveStudioState(page, session => ({
    studio: !!document.getElementById('kelo-studio-live'),
    toolLoaded: !!session.tools.paintCopies,
    pattern: session.tools.paintCopies.state().pattern,
    buttonCount: document.querySelectorAll('#kelo-studio-live [data-ext-paint-copies]').length,
  }));
  const pingLatencyMs = Date.now() - pingStarted;
  expect(pingLatencyMs).toBeLessThanOrEqual(400);
  expect(alive).toEqual({ studio: true, toolLoaded: true, pattern: 'grid', buttonCount: 1 });

  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter(row => /STUDIO_PAINT_COPIES|CREATOR_WORLD_STUDIO_MOUNT_FAILED|WORLD_EDIT_NOT_READY/.test(row))).toEqual([]);
  await page.screenshot({ path: 'test-results/studio-scene-painter-mobile-pass.png', fullPage: true });
});
