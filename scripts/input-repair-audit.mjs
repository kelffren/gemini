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
    typeof renderActionBar === 'function' &&
    !!window.KeloHubShell &&
    !!document.getElementById('kh-trigger')
  ), null, { timeout: 30_000 });

  const abilityBarContract = await page.evaluate(() => {
    const bar = document.getElementById('action-bar-container');
    try { renderActionBar(); } catch (error) { return { renderError: String(error?.message || error) }; }
    const slots = bar ? Array.from(bar.querySelectorAll('.stone-slot')) : [];
    const visible = slots.filter((slot) => {
      const style = getComputedStyle(slot), rect = slot.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    });
    return {
      actionBarPresent: !!bar,
      actionBarClass: !!bar?.classList.contains('action-bar'),
      bodySocialMode: document.body.classList.contains('social-mode'),
      slotCount: slots.length,
      visibleSlotCount: visible.length
    };
  });
  if (abilityBarContract.renderError) throw new Error(`renderActionBar failed: ${abilityBarContract.renderError}`);
  if (!abilityBarContract.actionBarPresent || !abilityBarContract.actionBarClass) throw new Error(`Ability bar contract missing: ${JSON.stringify(abilityBarContract)}`);
  if (!abilityBarContract.bodySocialMode || abilityBarContract.slotCount !== 5 || abilityBarContract.visibleSlotCount !== 0) {
    throw new Error(`Expected 5 mounted but hidden social ability slots: ${JSON.stringify(abilityBarContract)}`);
  }

  const combatBarContract = await page.evaluate(() => {
    const bar = document.getElementById('action-bar-container');
    document.body.classList.remove('social-mode');
    const slots = bar ? Array.from(bar.querySelectorAll('.stone-slot')) : [];
    const visible = slots.filter((slot) => {
      const style = getComputedStyle(slot), rect = slot.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
    });
    const rect = bar?.getBoundingClientRect();
    const result = {
      slotCount: slots.length,
      visibleSlotCount: visible.length,
      bottomGap: rect ? window.innerHeight - rect.bottom : null
    };
    document.body.classList.add('social-mode');
    result.restoredSocialHidden = bar ? getComputedStyle(bar).display === 'none' : false;
    return result;
  });
  if (combatBarContract.slotCount !== 5 || combatBarContract.visibleSlotCount !== 5) {
    throw new Error(`Expected 5 visible combat ability slots: ${JSON.stringify(combatBarContract)}`);
  }
  if (combatBarContract.bottomGap == null || combatBarContract.bottomGap < 0 || combatBarContract.bottomGap > 30 || !combatBarContract.restoredSocialHidden) {
    throw new Error(`Ability bar layout contract failed: ${JSON.stringify(combatBarContract)}`);
  }

  const snapshot = () => page.evaluate(() => ({
    x: localPlayer.x, y: localPlayer.y, vx: localPlayer.vx, vy: localPlayer.vy,
    normX: input.normX, normY: input.normY, touchActive: input.touchActive
  }));
  const before = await snapshot();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 70, y: 650, radiusX: 2, radiusY: 2, force: 1, id: 77 }]
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 130, y: 650, radiusX: 2, radiusY: 2, force: 1, id: 77 }]
  });
  await page.waitForTimeout(450);
  const moving = await snapshot();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(350);
  const stopped = await snapshot();
  const moved = Math.hypot(moving.x - before.x, moving.y - before.y);
  if (moved < 8 || !(moving.normX > 0.2)) throw new Error(`Real touch movement failed: moved=${moved.toFixed(2)} normX=${moving.normX}`);
  if (stopped.touchActive || Math.hypot(stopped.vx, stopped.vy) > 5) throw new Error(`Touch release failed: ${JSON.stringify(stopped)}`);

  const collapsed = await page.evaluate(() => ({
    hub: !!document.getElementById('kh-trigger'),
    oldMenu: getComputedStyle(document.getElementById('lx-side-menu')).display,
    oldPvp: getComputedStyle(document.getElementById('lx-side-pvp')).display,
    oldShop: getComputedStyle(document.getElementById('lx-shop')).display,
    chatTab: getComputedStyle(document.getElementById('kh-chat-tab')).display,
    chatOpacity: Number(getComputedStyle(document.getElementById('kh-chat-tab')).opacity)
  }));
  if (!collapsed.hub || collapsed.oldMenu !== 'none' || collapsed.oldPvp !== 'none' || collapsed.oldShop !== 'none') {
    throw new Error(`Kelo Hub did not collapse legacy chrome: ${JSON.stringify(collapsed)}`);
  }
  if (collapsed.chatTab === 'none' || collapsed.chatOpacity > 0.65) {
    throw new Error(`Minimized chat is not discreet enough: ${JSON.stringify(collapsed)}`);
  }

  await page.locator('#kh-trigger').click();
  await page.waitForFunction(() => document.getElementById('kh-panel')?.classList.contains('open') === true);
  const hubOpen = await page.evaluate(() => ({
    open: document.getElementById('kh-panel')?.classList.contains('open') === true,
    hidden: document.getElementById('kh-panel')?.getAttribute('aria-hidden'),
    expanded: document.getElementById('kh-trigger')?.getAttribute('aria-expanded'),
    categories: document.querySelectorAll('#kh-panel .kh-section').length,
    visibleItems: document.querySelectorAll('#kh-panel .kh-section.open .kh-item').length
  }));
  if (!hubOpen.open || hubOpen.hidden !== 'false' || hubOpen.expanded !== 'true' || hubOpen.categories < 3 || hubOpen.visibleItems < 2) {
    throw new Error(`Kelo Hub open contract failed: ${JSON.stringify(hubOpen)}`);
  }

  await page.locator('#kh-close').click();
  await page.waitForFunction(() => document.getElementById('kh-panel')?.classList.contains('open') === false);

  await page.locator('#kh-chat-tab').click();
  await page.waitForFunction(() => document.getElementById('lx-chat-drawer')?.classList.contains('open') === true);
  const chatOpen = await page.evaluate(() => ({
    drawerOpen: document.getElementById('lx-chat-drawer')?.classList.contains('open') === true,
    tabHidden: document.getElementById('kh-chat-tab')?.classList.contains('hidden') === true,
    inputVisible: !!document.getElementById('lx-in')
  }));
  if (!chatOpen.drawerOpen || !chatOpen.tabHidden || !chatOpen.inputVisible) {
    throw new Error(`Expandable chat open contract failed: ${JSON.stringify(chatOpen)}`);
  }

  await page.locator('#lx-chat-close').click();
  await page.waitForFunction(() => document.getElementById('lx-chat-drawer')?.classList.contains('open') === false);
  const chatClosed = await page.evaluate(() => ({
    drawerOpen: document.getElementById('lx-chat-drawer')?.classList.contains('open') === true,
    tabHidden: document.getElementById('kh-chat-tab')?.classList.contains('hidden') === true,
    tabDisplay: getComputedStyle(document.getElementById('kh-chat-tab')).display
  }));
  if (chatClosed.drawerOpen || chatClosed.tabHidden || chatClosed.tabDisplay === 'none') {
    throw new Error(`Expandable chat close contract failed: ${JSON.stringify(chatClosed)}`);
  }

  if (pageErrors.length) throw new Error(`Page errors during input/hub/chat audit:\n${pageErrors.join('\n')}`);

  console.log(JSON.stringify({
    status: 'PASS',
    abilityBarContract,
    combatBarContract,
    movement: { before, moving, stopped, moved: Number(moved.toFixed(2)) },
    collapsed,
    hubOpen,
    chatOpen,
    chatClosed
  }, null, 2));
} finally {
  await browser.close();
}
