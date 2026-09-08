import { chromium } from 'playwright';

const url = process.env.AUDIT_URL || 'http://127.0.0.1:4173/';
const executablePath = process.env.CHROME_BIN || undefined;

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error?.message || error)));

try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(() => (
    typeof localPlayer !== 'undefined' &&
    typeof input !== 'undefined' &&
    typeof processInput === 'function' &&
    typeof renderActionBar === 'function'
  ), null, { timeout: 30_000 });

  const legacyContract = await page.evaluate(() => ({
    actionBarPresent: !!document.getElementById('action-bar-container'),
    renderActionBarSafe: (() => {
      try { renderActionBar(); return true; } catch (error) { return String(error?.message || error); }
    })()
  }));
  if (legacyContract.actionBarPresent) throw new Error('Unexpected legacy #action-bar-container is present');
  if (legacyContract.renderActionBarSafe !== true) {
    throw new Error(`renderActionBar is not optional-safe: ${legacyContract.renderActionBarSafe}`);
  }

  const snapshot = () => page.evaluate(() => ({
    x: localPlayer.x,
    y: localPlayer.y,
    vx: localPlayer.vx,
    vy: localPlayer.vy,
    normX: input.normX,
    normY: input.normY,
    touchActive: input.touchActive
  }));

  const dispatchTouchPointer = (type, x, y) => page.evaluate(({ type, x, y }) => {
    const target = document.getElementById('game-canvas');
    if (!target) throw new Error('#game-canvas missing');
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 77,
      pointerType: 'touch',
      isPrimary: true,
      clientX: x,
      clientY: y,
      buttons: type === 'pointerup' ? 0 : 1
    }));
  }, { type, x, y });

  const before = await snapshot();
  await dispatchTouchPointer('pointerdown', 70, 650);
  await dispatchTouchPointer('pointermove', 130, 650);
  await page.waitForTimeout(450);
  const moving = await snapshot();
  await dispatchTouchPointer('pointerup', 130, 650);
  await page.waitForTimeout(350);
  const stopped = await snapshot();

  const moved = Math.hypot(moving.x - before.x, moving.y - before.y);
  const measurement = {
    legacyContract,
    before,
    moving,
    stopped,
    moved: Number(moved.toFixed(2))
  };
  console.log('MOVEMENT_MEASUREMENT ' + JSON.stringify(measurement));

  if (moved < 8) {
    throw new Error(`Pointer input did not move player enough: ${moved.toFixed(2)}px`);
  }
  if (!(moving.normX > 0.2)) {
    throw new Error(`processInput did not receive pointer direction: normX=${moving.normX}`);
  }
  if (stopped.touchActive) throw new Error('pointerup did not release touch state');
  if (Math.hypot(stopped.vx, stopped.vy) > 5) {
    throw new Error(`Player did not stop after pointerup: speed=${Math.hypot(stopped.vx, stopped.vy).toFixed(2)}`);
  }

  if (pageErrors.length) {
    throw new Error(`Page errors during movement audit:\n${pageErrors.join('\n')}`);
  }

  console.log(JSON.stringify({ status: 'PASS', ...measurement }, null, 2));
} finally {
  await browser.close();
}
