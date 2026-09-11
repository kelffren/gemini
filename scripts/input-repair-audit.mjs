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

  const abilityBarContract = await page.evaluate(() => {
    const bar = document.getElementById('action-bar-container');
    const renderActionBarSafe = (() => {
      try { renderActionBar(); return true; } catch (error) { return String(error?.message || error); }
    })();
    const slots = bar ? Array.from(bar.querySelectorAll('.stone-slot')) : [];
    const visibleSlots = slots.filter((slot) => {
      const style = getComputedStyle(slot);
      const rect = slot.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    });
    const rect = bar ? bar.getBoundingClientRect() : null;
    return {
      actionBarPresent: !!bar,
      actionBarClass: !!bar && bar.classList.contains('action-bar'),
      bodySocialMode: document.body.classList.contains('social-mode'),
      slotCount: slots.length,
      visibleSlotCount: visibleSlots.length,
      barDisplay: bar ? getComputedStyle(bar).display : null,
      barPointerEvents: bar ? getComputedStyle(bar).pointerEvents : null,
      barRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      menuSheetPresent: !!document.getElementById('menu-sheet'),
      renderActionBarSafe
    };
  });
  if (!abilityBarContract.actionBarPresent) throw new Error('Missing active #action-bar-container');
  if (!abilityBarContract.actionBarClass) throw new Error('Ability bar is missing active .action-bar Luxe contract');
  if (abilityBarContract.menuSheetPresent) throw new Error('Unexpected legacy #menu-sheet is present');
  if (abilityBarContract.renderActionBarSafe !== true) {
    throw new Error(`renderActionBar failed: ${abilityBarContract.renderActionBarSafe}`);
  }
  if (!abilityBarContract.bodySocialMode) {
    throw new Error(`Expected initial social-mode body: ${JSON.stringify(abilityBarContract)}`);
  }
  if (abilityBarContract.slotCount !== 5 || abilityBarContract.visibleSlotCount !== 0) {
    throw new Error(`Expected 5 mounted but hidden social ability slots: ${JSON.stringify(abilityBarContract)}`);
  }
  console.log('ABILITY_BAR_SOCIAL_MEASUREMENT ' + JSON.stringify(abilityBarContract));

  const combatBarContract = await page.evaluate(() => {
    const bar = document.getElementById('action-bar-container');
    document.body.classList.remove('social-mode');
    const slots = bar ? Array.from(bar.querySelectorAll('.stone-slot')) : [];
    const visibleSlots = slots.filter((slot) => {
      const style = getComputedStyle(slot);
      const rect = slot.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    });
    const rect = bar ? bar.getBoundingClientRect() : null;
    const result = {
      slotCount: slots.length,
      visibleSlotCount: visibleSlots.length,
      barDisplay: bar ? getComputedStyle(bar).display : null,
      barPointerEvents: bar ? getComputedStyle(bar).pointerEvents : null,
      barRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      viewportHeight: window.innerHeight,
      bottomGap: rect ? window.innerHeight - rect.bottom : null
    };
    document.body.classList.add('social-mode');
    result.restoredSocialHidden = bar ? getComputedStyle(bar).display === 'none' : false;
    return result;
  });
  if (combatBarContract.slotCount !== 5 || combatBarContract.visibleSlotCount !== 5) {
    throw new Error(`Expected 5 visible combat ability slots: ${JSON.stringify(combatBarContract)}`);
  }
  if (combatBarContract.bottomGap == null || combatBarContract.bottomGap < 0 || combatBarContract.bottomGap > 30) {
    throw new Error(`Ability bar is not anchored to the bottom safe area: ${JSON.stringify(combatBarContract)}`);
  }
  if (!combatBarContract.restoredSocialHidden) {
    throw new Error(`Ability bar did not hide again after restoring social-mode: ${JSON.stringify(combatBarContract)}`);
  }
  console.log('ABILITY_BAR_COMBAT_LAYOUT ' + JSON.stringify(combatBarContract));

  const snapshot = () => page.evaluate(() => ({
    x: localPlayer.x,
    y: localPlayer.y,
    vx: localPlayer.vx,
    vy: localPlayer.vy,
    normX: input.normX,
    normY: input.normY,
    touchActive: input.touchActive
  }));

  const inspectPoint = (x, y) => page.evaluate(({ x, y }) => {
    return document.elementsFromPoint(x, y).slice(0, 12).map((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        id: el.id || null,
        className: typeof el.className === 'string' ? el.className : null,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        position: style.position,
        zIndex: style.zIndex,
        rect: {
          x: Number(rect.x.toFixed(1)),
          y: Number(rect.y.toFixed(1)),
          width: Number(rect.width.toFixed(1)),
          height: Number(rect.height.toFixed(1))
        }
      };
    });
  }, { x, y });

  await page.evaluate(() => {
    window.__KELO_REAL_TOUCH_AUDIT = [];
    const capture = (e) => {
      window.__KELO_REAL_TOUCH_AUDIT.push({
        type: e.type,
        target: {
          tag: e.target?.tagName || null,
          id: e.target?.id || null,
          className: typeof e.target?.className === 'string' ? e.target.className : null
        },
        x: e.clientX,
        y: e.clientY,
        pointerType: e.pointerType || null,
        defaultPrevented: e.defaultPrevented
      });
    };
    window.addEventListener('pointerdown', capture, { capture: true, once: true });
  });

  const start = { x: 70, y: 650 };
  const end = { x: 130, y: 650 };
  const hitStack = await inspectPoint(start.x, start.y);
  const before = await snapshot();

  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: start.x, y: start.y, radiusX: 2, radiusY: 2, force: 1, id: 77 }]
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: end.x, y: end.y, radiusX: 2, radiusY: 2, force: 1, id: 77 }]
  });
  await page.waitForTimeout(450);
  const moving = await snapshot();
  const realTouchEvents = await page.evaluate(() => window.__KELO_REAL_TOUCH_AUDIT || []);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(350);
  const stopped = await snapshot();

  const moved = Math.hypot(moving.x - before.x, moving.y - before.y);
  const measurement = {
    abilityBarContract,
    combatBarContract,
    start,
    end,
    hitStack,
    realTouchEvents,
    before,
    moving,
    stopped,
    moved: Number(moved.toFixed(2))
  };
  console.log('REAL_TOUCH_HIT_TEST ' + JSON.stringify({ hitStack, realTouchEvents }));
  console.log('MOVEMENT_MEASUREMENT ' + JSON.stringify(measurement));

  if (moved < 8) throw new Error(`Real hit-tested touch did not move player enough: ${moved.toFixed(2)}px; target=${JSON.stringify(realTouchEvents[0]?.target || null)}; stack=${JSON.stringify(hitStack)}`);
  if (!(moving.normX > 0.2)) throw new Error(`processInput did not receive real touch direction: normX=${moving.normX}`);
  if (stopped.touchActive) throw new Error('touchEnd did not release touch state');
  if (Math.hypot(stopped.vx, stopped.vy) > 5) {
    throw new Error(`Player did not stop after touchEnd: speed=${Math.hypot(stopped.vx, stopped.vy).toFixed(2)}`);
  }

  await page.locator('#lx-side-menu').click();
  await page.waitForFunction(() => document.getElementById('lx-menu-panel')?.classList.contains('open') === true);
  const menuOpen = await page.evaluate(() => ({
    open: document.getElementById('lx-menu-panel')?.classList.contains('open') === true,
    hidden: document.getElementById('lx-menu-panel')?.getAttribute('aria-hidden'),
    expanded: document.getElementById('lx-side-menu')?.getAttribute('aria-expanded')
  }));
  if (!menuOpen.open || menuOpen.hidden !== 'false' || menuOpen.expanded !== 'true') {
    throw new Error(`Luxe MENU did not open correctly: ${JSON.stringify(menuOpen)}`);
  }

  await page.locator('#lx-menu-close').click();
  await page.waitForFunction(() => document.getElementById('lx-menu-panel')?.classList.contains('open') === false);
  const menuClosed = await page.evaluate(() => ({
    open: document.getElementById('lx-menu-panel')?.classList.contains('open') === true,
    hidden: document.getElementById('lx-menu-panel')?.getAttribute('aria-hidden'),
    expanded: document.getElementById('lx-side-menu')?.getAttribute('aria-expanded')
  }));
  if (menuClosed.open || menuClosed.hidden !== 'true' || menuClosed.expanded !== 'false') {
    throw new Error(`Luxe MENU did not close correctly: ${JSON.stringify(menuClosed)}`);
  }
  console.log('MENU_MEASUREMENT ' + JSON.stringify({ menuOpen, menuClosed }));

  if (pageErrors.length) {
    throw new Error(`Page errors during input/menu/ability audit:\n${pageErrors.join('\n')}`);
  }

  console.log(JSON.stringify({ status: 'PASS', ...measurement, menuOpen, menuClosed }, null, 2));
} finally {
  await browser.close();
}
