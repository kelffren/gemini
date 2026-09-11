const { test, expect } = require('@playwright/test');
const path = require('node:path');

const root = process.cwd();
const systemCss = path.join(root, 'src/ui/kelo-interface-system.css');
const compatCss = path.join(root, 'src/ui/kelo-interface-compat.css');
const runtimeJs = path.join(root, 'src/ui/kelo-interface-runtime.js');

async function loadSharedInterface(page, body) {
  await page.setContent(`<!doctype html><html><head></head><body>${body}</body></html>`);
  await page.addStyleTag({ path: systemCss });
  await page.addStyleTag({ path: compatCss });
}

async function metric(page, selector) {
  return page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      width: rect.width,
      height: rect.height,
      fontFamily: style.fontFamily,
      fontSize: parseFloat(style.fontSize),
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth) || 0,
      backgroundColor: style.backgroundColor,
    };
  });
}

test('shared UI chrome renders with safe computed targets and system software typography', async ({ page }) => {
  await loadSharedInterface(page, `
    <section id="kelo-luxe"><button id="menuClose" class="lx-menu-close">×</button></section>
    <section id="kelo-account-auth"><button id="authPrimary" class="ka-primary">Entrar</button></section>
    <section id="kelo-creators-hub"><button id="creatorClose" class="kc-close">Cerrar</button></section>
    <section id="kelo-profile-18"><button id="profilePrimary" class="kap-primary">Continuar</button></section>
    <section id="kelo-market-v1" class="km-panel"><button id="marketClose" class="km-close">×</button></section>
    <section id="kelo-warehouse" class="kw-panel"><button id="warehouseClose" class="kw-close">×</button></section>
    <section id="kelo-arena-panel"><button id="arenaClose" class="ka-close">×</button></section>
    <section id="kelo-boutique"><button id="boutiqueClose" class="lx-b-close">×</button></section>
    <section id="kelo-house-panel"><button id="housePrimary" class="hi-btn primary">Entrar</button></section>
  `);

  for (const selector of ['#menuClose','#authPrimary','#creatorClose','#profilePrimary','#marketClose','#warehouseClose','#arenaClose','#boutiqueClose','#housePrimary']) {
    const m = await metric(page, selector);
    expect(m.height, `${selector} should have a comfortable touch target`).toBeGreaterThanOrEqual(44);
    expect(m.fontFamily.toLowerCase(), `${selector} should not use ornamental serif software typography`).not.toContain('georgia');
    expect(m.fontFamily.toLowerCase()).not.toContain('times new roman');
    expect(m.fontSize, `${selector} should remain readable`).toBeGreaterThanOrEqual(11);
  }

  await page.locator('#marketClose').focus();
  await page.evaluate(() => document.querySelector('#marketClose').setAttribute('data-test-focused','1'));
  const focusStyle = await page.locator('#marketClose').evaluate((el) => {
    el.matches(':focus-visible') || el.focus({ focusVisible: true });
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) || 0 };
  });
  expect(focusStyle.style).not.toBe('none');
  expect(focusStyle.width).toBeGreaterThanOrEqual(2);
});

test('Asset Repairer defaults to a calm task path and reveals advanced tools on demand', async ({ page }) => {
  await loadSharedInterface(page, `
    <section id="kelo-asset-repairer">
      <header class="kar-top">
        <div class="kar-title"><small>old subtitle</small></div>
        <div class="kar-step"><span>1</span><span>2</span><span>3</span><span>4</span></div>
        <div class="kar-actions">
          <button class="kar-btn" data-act="reset">RESET</button>
          <button class="kar-btn" data-act="undo">UNDO</button>
          <button class="kar-btn primary" data-act="open">OPEN</button>
          <button class="kar-btn" data-repair-close>CLOSE</button>
        </div>
      </header>
      <aside class="kar-tools">
        <div class="kar-kicker">TOOLS</div>
        <button class="kar-tool" data-tool="auto"><b>✦</b><strong>AUTO</strong><small>auto</small></button>
        <button class="kar-tool" data-tool="align"><b>↕</b><strong>ALIGN</strong><small>align</small></button>
        <button class="kar-tool" data-tool="background"><b>◇</b><strong>BG</strong><small>bg</small></button>
        <button class="kar-tool" data-tool="edges"><b>◈</b><strong>EDGES</strong><small>edges</small></button>
        <button class="kar-tool" data-tool="pivot"><b>⌖</b><strong>PIVOT</strong><small>pivot</small></button>
        <button class="kar-tool" data-tool="scale"><b>⤢</b><strong>SCALE</strong><small>scale</small></button>
        <button class="kar-tool" data-tool="seams"><b>⌗</b><strong>SEAMS</strong><small>seams</small></button>
      </aside>
      <main><div class="kar-stage-head"><h2>WORKSPACE</h2></div></main>
      <button class="kar-btn primary" data-act="export" disabled>EXPORT</button>
    </section>
  `);
  await page.addScriptTag({ path: runtimeJs });
  await expect(page.locator('#kelo-asset-repairer')).toHaveAttribute('data-kui-enhanced','true');

  await expect(page.locator('[data-act="open"]')).toHaveText('Open Asset');
  await expect(page.locator('[data-tool="auto"] strong')).toHaveText('Auto Repair');
  await expect(page.locator('[data-tool="align"] strong')).toHaveText('Align Frames');
  await expect(page.locator('[data-kui-more-tools]')).toHaveText('More Tools');
  await expect(page.locator('[data-tool="background"]')).toBeHidden();
  await expect(page.locator('[data-tool="seams"]')).toBeHidden();
  await expect(page.locator('[data-tool="auto"]')).toBeDisabled();
  await expect(page.locator('[data-act="reset"]')).toBeDisabled();

  await page.locator('[data-kui-more-tools]').click();
  await expect(page.locator('[data-tool="background"]')).toBeVisible();
  await expect(page.locator('[data-tool="seams"]')).toBeVisible();
  await expect(page.locator('[data-kui-more-tools]')).toHaveAttribute('aria-expanded','true');

  await page.locator('[data-act="export"]').evaluate((el) => { el.disabled = false; });
  await page.evaluate(() => window.KELO_INTERFACE_RUNTIME.scan());
  await expect(page.locator('#kelo-asset-repairer')).toHaveAttribute('data-kui-has-asset','true');
  await expect(page.locator('[data-tool="auto"]')).toBeEnabled();
  await expect(page.locator('[data-act="reset"]')).toBeEnabled();

  const primary = await metric(page, '[data-act="open"]');
  expect(primary.height).toBeGreaterThanOrEqual(40);
  expect(primary.fontFamily.toLowerCase()).not.toContain('georgia');
});
