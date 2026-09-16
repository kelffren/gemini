/* KELO-INDEX
 * area: TEST / STUDIO / MOBILE CONTEXT UI
 * owner: Kelo Studio presentation regression
 * purpose: keep iPhone editor focused on five contextual actions while preserving original command buttons
 */
const { test, expect } = require('@playwright/test');

async function installFixture(page) {
  await page.goto('./', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(async () => {
    document.getElementById('kelo-studio-live')?.remove();
    window.__studioUiHits = Object.create(null);
    const shell = document.createElement('section');
    shell.id = 'kelo-studio-live';
    shell.dataset.compact = 'full';
    shell.dataset.selectionCount = '0';
    shell.innerHTML = `
      <div class="ks-top"><button data-act="save">SAVE</button></div>
      <div class="ks-bottom">
        <div class="ks-deck">
          <div class="ks-deck-head"><div class="ks-active-tool">Selección</div></div>
          <div class="ks-deck-body">
            <section class="ks-deck-section"><div class="ks-edit-primary">
              <button class="on" data-mode="select">SELECT</button>
              <button data-act="edit-assets">EDIT</button>
              <button data-act="delete">BORRAR</button>
            </div></section>
            <section class="ks-deck-section"><div class="ks-history-actions">
              <button data-act="undo">UNDO</button>
              <button data-act="rotate">ROTAR</button>
              <button data-act="duplicate">DUPLICAR</button>
            </div></section>
            <section class="ks-deck-section"><div class="ks-mode-actions">
              <button data-mode="terrain">GROUND</button>
            </div></section>
          </div>
        </div>
        <div class="ks-status">Studio listo</div>
      </div>`;
    document.body.append(shell);
    shell.querySelectorAll('[data-act],[data-mode]').forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.act || button.dataset.mode;
        window.__studioUiHits[key] = (window.__studioUiHits[key] || 0) + 1;
      });
    });
    const module = await import('./src/studio/ui/studio-mobile-ui-polish.mjs?v=studio-context-test-1');
    window.__studioUiPolish = module.installStudioMobileUiPolish({ root: window });
    window.__studioUiPolish.refresh();
  });
}

test('mobile canvas context exposes only five useful actions and delegates to originals', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installFixture(page);

  const bar = page.locator('.ks-mobile-context-actions');
  await expect(bar).toBeVisible();
  await expect(bar.locator('button')).toHaveCount(5);
  await expect(bar.locator('button')).toHaveText(['SELECT', 'EDIT', 'UNDO', 'GROUND', 'MÁS']);

  const heights = await bar.locator('button').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  expect(heights.every(height => height >= 44)).toBe(true);
  await expect(page.locator('.ks-deck-body')).toBeHidden();

  await bar.getByRole('button', { name: 'GROUND' }).click();
  expect(await page.evaluate(() => window.__studioUiHits.terrain || 0)).toBe(1);

  const more = bar.getByRole('button', { name: 'Mostrar herramientas avanzadas' });
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.ks-deck-body')).toBeVisible();
});

test('selection context swaps shortcuts without duplicating editor logic', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installFixture(page);

  await page.locator('#kelo-studio-live').evaluate(shell => { shell.dataset.selectionCount = '1'; });
  const bar = page.locator('.ks-mobile-context-actions');
  await expect(bar.locator('button')).toHaveCount(5);
  await expect(bar.locator('button')).toHaveText(['SELECT', 'ROTAR', 'DUPLICAR', 'BORRAR', 'MÁS']);

  await bar.getByRole('button', { name: 'BORRAR' }).click();
  await bar.getByRole('button', { name: 'DUPLICAR' }).click();
  expect(await page.evaluate(() => ({
    deleteHits: window.__studioUiHits.delete || 0,
    duplicateHits: window.__studioUiHits.duplicate || 0,
  }))).toEqual({ deleteHits: 1, duplicateHits: 1 });

  expect(await page.locator('.ks-deck [data-act="delete"]').count()).toBe(1);
  expect(await page.locator('.ks-deck [data-act="duplicate"]').count()).toBe(1);
});
