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

test('World manifest opens Studio and clears loading shell', async ({ page }) => {
  test.setTimeout(70000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e?.stack || e)));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const response = await page.goto('./?mapEditor=1&labWorldBisect=1', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  expect(response && response.status()).toBeLessThan(400);

  await page.waitForFunction(() => !!window.KELO_ADMIN_KEYS, null, { timeout: 30000 });

  const permission = await page.evaluate(async () => {
    const keys = window.KELO_ADMIN_KEYS;
    keys.installRemoteAdapter?.(null);
    keys.installScopeProvider?.(null);
    let actor = '';
    let stable = 0;
    const seen = [];
    for (let i = 0; i < 50; i++) {
      actor = String(keys.playerId?.() || window.localPlayer?.id || 'local_pioneer');
      if (!seen.includes(actor)) seen.push(actor);
      if (!keys.can?.('world.edit', actor)) {
        try {
          await keys.request?.('admin-key:bootstrap-local-root', {
            actorId: actor,
            ownerId: actor,
            developer: true,
          });
        } catch {}
        keys.syncInventory?.();
      }
      if (keys.can?.('world.edit', actor)) stable++;
      else stable = 0;
      if (stable >= 4) break;
      await new Promise(r => setTimeout(r, 150));
    }
    return { actor, allowed: !!keys.can?.('world.edit', actor), seen };
  });
  expect(permission.allowed).toBe(true);

  const result = await page.evaluate(async () => {
    const timeout = new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 35000));
    const open = (async () => {
      try {
        // Close any existing Studio/Hub so every candidate starts from a clean launch.
        try {
          const ctrl = await import('./src/studio/integration/live-studio-controller.mjs');
          await ctrl.closeKeloStudioLive?.({ root: window });
        } catch {}
        document.getElementById('kelo-creators-hub')?.remove?.();
        document.getElementById('kelo-world-launch-curtain')?.remove?.();

        const mod = await import('./src/creators/workspaces/world-workspace.mjs');
        const manifest = mod.createWorldWorkspaceManifest();
        const session = await manifest.open({ root: window });
        await new Promise(r => setTimeout(r, 400));

        const studio = document.getElementById('kelo-studio-live');
        return {
          timeout: false,
          session: !!session,
          shell: !!studio,
          connected: !!studio?.isConnected,
          loading: studio?.getAttribute?.('data-kelo-world-loading') || null,
          status: studio?.querySelector?.('.ks-status')?.textContent || null,
          bodyText: studio?.textContent?.slice(0, 500) || null,
        };
      } catch (error) {
        const studio = document.getElementById('kelo-studio-live');
        return {
          timeout: false,
          error: String(error?.message || error),
          stack: String(error?.stack || ''),
          shell: !!studio,
          loading: studio?.getAttribute?.('data-kelo-world-loading') || null,
          status: studio?.querySelector?.('.ks-status')?.textContent || null,
        };
      }
    })();
    return Promise.race([open, timeout]);
  });

  console.log('[WORLD_BISECT_RESULT]', JSON.stringify(result));
  expect(result.timeout).toBe(false);
  expect(result.error || null).toBe(null);
  expect(result.session).toBe(true);
  expect(result.shell).toBe(true);
  expect(result.connected).toBe(true);
  expect(result.loading).not.toBe('1');

  const studio = page.locator('#kelo-studio-live');
  await expect(studio).toHaveAttribute('data-kelo-mobile-polish', '3');

  const contextBar = studio.locator('.ks-mobile-context-actions:visible');
  await expect(contextBar).toBeVisible({ timeout: 5000 });

  const editProxy = contextBar.locator('[data-kelo-proxy="act:edit-assets"]');
  await expect(editProxy).toBeVisible({ timeout: 5000 });

  const more = contextBar.locator('.ks-mobile-more');
  await expect(more).toHaveText('MÁS');
  await more.tap();
  await expect(studio).toHaveAttribute('data-mobile-advanced', '1');
  await expect(more).toHaveText('MENOS');
  await more.tap();
  await expect(studio).toHaveAttribute('data-mobile-advanced', '0');
  await expect(more).toHaveText('MÁS');

  // Give the observer several turns. If the old feedback loop returns,
  // Playwright will hang here instead of reaching the assertion.
  await page.waitForTimeout(750);
  await expect(contextBar).toBeVisible();
  expect(errors.filter(e => /WORLD_EDITOR_OPEN_TIMEOUT|CREATOR_WORLD_STUDIO_MOUNT_FAILED/.test(e))).toEqual([]);
});
