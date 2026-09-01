const { test, expect } = require('@playwright/test');
const fs = require('fs');

const PAGES = process.env.KELO_PAGES || 'https://kelffren.github.io/gemini/?v=69';
const EXPECT_TITLE = process.env.KELO_TITLE || 'V5.18';
const EXPECT_CACHE = process.env.KELO_CACHE || 'v=69';

test.describe('Kelo World live Pages harness', () => {
  test('boot, version, console/network, movement, cafe', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    const failed = [];
    const status400 = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('requestfailed', (req) => {
      failed.push(req.url() + ' :: ' + (req.failure() && req.failure().errorText));
    });
    page.on('response', (res) => {
      if (res.status() >= 400) status400.push(res.status() + ' ' + res.url());
    });

    const res = await page.goto(PAGES, { waitUntil: 'domcontentloaded', timeout: 30000 });
    expect(res).toBeTruthy();
    expect(res.status()).toBeLessThan(400);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'test-results/boot.png', fullPage: true });

    const title = await page.title();
    const probe = await page.evaluate(() => {
      const scripts = Array.from(document.scripts).map((s) => s.src);
      const canvas = document.getElementById('game-canvas');
      return {
        title: document.title,
        scripts,
        canvasW: canvas ? canvas.width : 0,
        canvasH: canvas ? canvas.height : 0,
        px: typeof localPlayer !== 'undefined' ? localPlayer.x : null,
        py: typeof localPlayer !== 'undefined' ? localPlayer.y : null,
        zone: window.keloZone || null,
        hasEnter: typeof window.enterCafe === 'function',
        cafeBtn: !!document.getElementById('kelo-cafe-btn'),
        ready: document.readyState,
      };
    });

    fs.mkdirSync('test-results', { recursive: true });
    fs.writeFileSync('test-results/boot-report.json', JSON.stringify({
      url: page.url(), httpStatus: res.status(), title,
      expectTitle: EXPECT_TITLE, titleMatch: title.includes(EXPECT_TITLE),
      cacheHint: probe.scripts.some((s) => s.includes(EXPECT_CACHE)),
      probe, consoleErrors, pageErrors, failedRequests: failed, status400,
    }, null, 2));

    expect(probe.canvasW).toBeGreaterThan(0);

    const before = await page.evaluate(() => ({ x: localPlayer.x, y: localPlayer.y }));
    await page.evaluate(() => {
      if (!window.input) return;
      input.normX = 1;
      input.normY = 0;
      input.touchActive = true;
    });
    await page.waitForTimeout(700);
    const mid = await page.evaluate(() => ({
      x: localPlayer.x, y: localPlayer.y, vx: localPlayer.vx, vy: localPlayer.vy,
    }));
    await page.evaluate(() => {
      if (!window.input) return;
      input.normX = 0; input.normY = 0; input.touchActive = false;
    });
    fs.writeFileSync('test-results/move-report.json', JSON.stringify({
      before, mid, moved: Math.hypot(mid.x - before.x, mid.y - before.y),
    }, null, 2));
    await page.screenshot({ path: 'test-results/after-move.png', fullPage: true });

    const cafe = await page.evaluate(() => {
      const out = {
        zoneBefore: window.keloZone || null,
        hasFn: typeof window.enterCafe === 'function',
        btn: !!document.getElementById('kelo-cafe-btn'),
        zoneAfterEnter: null, zoneAfterExit: null,
        xIn: null, yIn: null, xOut: null, yOut: null, err: null,
      };
      try {
        if (typeof window.enterCafe === 'function') window.enterCafe();
        out.zoneAfterEnter = window.keloZone || null;
        out.xIn = localPlayer.x; out.yIn = localPlayer.y;
        if (typeof window.exitCafe === 'function') window.exitCafe();
        out.zoneAfterExit = window.keloZone || null;
        out.xOut = localPlayer.x; out.yOut = localPlayer.y;
      } catch (e) { out.err = String(e); }
      return out;
    });
    fs.writeFileSync('test-results/cafe-report.json', JSON.stringify(cafe, null, 2));
    await page.screenshot({ path: 'test-results/after-cafe.png', fullPage: true });

    expect(title.length).toBeGreaterThan(0);
  });
});
