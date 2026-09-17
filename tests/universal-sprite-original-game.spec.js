/* KELO-INDEX
 * area: QA / CREATORS / AVATAR
 * owner: Creator sprite original-game E2E
 * keys: SPRITE PREVIEW TRYON LOOK ORIGINAL GAME PLAYWRIGHT MOBILE
 * purpose: Exercise every Tiny Pixel Art preview/try-on/look control and prove the committed body sprite renders in the original game.
 */
const { test, expect } = require('@playwright/test');

const PREVIEW_KEY = 'kelo.universal.look.preview.v1';

async function installFixture(page) {
  // Use a same-origin 404 as an intentionally blank shell so no game loops or
  // production listeners survive while the Creator controls are exercised.
  await page.goto('/__kelo_universal_sprite_test_shell__');
  await page.evaluate(() => {
    document.head.innerHTML = '<meta name="viewport" content="width=device-width,initial-scale=1">';
    document.body.replaceChildren();

    const toast = document.createElement('div');
    toast.id = 'toast';
    document.body.append(toast);

    const modal = document.createElement('section');
    modal.id = 'preview-modal';
    const sheet = document.createElement('div');
    sheet.className = 'preview-sheet';
    const head = document.createElement('div');
    head.className = 'preview-head';
    const subtitle = document.createElement('div');
    subtitle.id = 'preview-subtitle';
    subtitle.textContent = 'sprite · character · pixel';
    const stage = document.createElement('div');
    stage.id = 'preview-stage';
    stage.style.position = 'relative';
    stage.style.display = 'grid';
    stage.style.placeItems = 'center';
    stage.style.width = '390px';
    stage.style.height = '470px';
    stage.style.overflow = 'hidden';
    const image = document.createElement('img');
    image.id = 'fixture-asset';
    image.alt = 'Fixture sprite';
    image.src = '/assets/kelo-hero-body-base-8dir.png';
    image.style.maxWidth = '280px';
    image.style.maxHeight = '360px';
    stage.append(image);
    sheet.append(head, subtitle, stage);
    modal.append(sheet);
    document.body.append(modal);
  });

  await page.locator('#fixture-asset').evaluate((img) => {
    if (img.complete && img.naturalWidth) return;
    return new Promise((resolve, reject) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', reject, { once: true });
    });
  });

  await page.evaluate(async () => {
    const inspector = await import('/src/creators/assets/universal-preview-inspector.mjs');
    const tryon = await import('/src/creators/assets/universal-avatar-tryon.mjs');
    const look = await import('/src/creators/assets/universal-look-builder.mjs');
    inspector.installUniversalPreviewInspector();
    tryon.installUniversalAvatarTryOn();
    look.installUniversalLookBuilder();

    const image = document.getElementById('fixture-asset');
    const asset = {
      id: 'fixture-body-sprite',
      name: 'Fixture Character Body',
      category: 'character',
      contentKind: 'sprite',
      previewKind: 'image',
      previewUrl: image.src,
      slot: 'body',
      columns: 1,
      rows: 1,
    };
    const modal = document.getElementById('preview-modal');
    modal.__keloAsset = asset;
    modal.dispatchEvent(new CustomEvent('kelo:preview-asset', { detail: { asset } }));
  });
}

async function profile(page) {
  return page.locator('#preview-modal').evaluate((modal) => modal.__keloTryonProfile?.profile || null);
}

async function storedLook(page) {
  return page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) || '[]'), PREVIEW_KEY);
}

test('every Tiny Pixel Art control works and a body sprite reaches the original game', async ({ page }) => {
  await installFixture(page);

  const stage = page.locator('#preview-stage');
  const metrics = page.locator('#kelo-preview-metrics');
  const tool = (name) => page.locator(`[data-preview-tool="${name}"]`);

  // Inspector: Fit, -, 100%, +, transparency checker and pixel-perfect.
  await expect(metrics).toContainText('ajustado');
  await tool('actual').click();
  await expect(metrics).toContainText('100%');
  await tool('plus').click();
  await expect(metrics).toContainText('135%');
  await tool('minus').click();
  await expect(metrics).toContainText('100%');
  await tool('fit').click();
  await expect(metrics).toContainText('ajustado');

  await tool('checker').click();
  await expect(stage).toHaveClass(/kelo-checker/);
  await tool('checker').click();
  await expect(stage).not.toHaveClass(/kelo-checker/);

  // Pixel mode starts on automatically for sprite/pixel previews; prove both directions.
  await expect(stage).toHaveClass(/kelo-crisp/);
  await tool('pixel').click();
  await expect(stage).not.toHaveClass(/kelo-crisp/);
  await tool('pixel').click();
  await expect(stage).toHaveClass(/kelo-crisp/);

  // Try-on: Probar, slot, scale, rotate, front/back, reset and drag.
  const tryon = (name) => page.locator(`[data-tryon="${name}"]`);
  await tryon('toggle').click();
  await expect(stage).toHaveClass(/kelo-tryon-active/);
  await expect(page.locator('.kelo-tryon-canvas')).toBeVisible();

  let p = await profile(page);
  expect(p.slot).toBe('body');
  expect(p.scale).toBeCloseTo(0.78, 4);
  expect(p.layer).toBe('front');

  await tryon('bigger').click();
  p = await profile(page);
  expect(p.scale).toBeGreaterThan(0.78);
  const biggerScale = p.scale;
  await tryon('smaller').click();
  p = await profile(page);
  expect(p.scale).toBeLessThan(biggerScale);

  await tryon('rotate').click();
  expect((await profile(page)).rotation).toBe(15);
  await tryon('layer').click();
  expect((await profile(page)).layer).toBe('back');
  await expect(tryon('layer')).toHaveText('Detrás');

  await tryon('slot').click();
  expect((await profile(page)).slot).toBe('generic');
  await tryon('reset').click();
  p = await profile(page);
  expect(p.slot).toBe('body');
  expect(p.scale).toBeCloseTo(0.78, 4);
  expect(p.rotation).toBe(0);
  expect(p.layer).toBe('front');

  const canvas = page.locator('.kelo-tryon-canvas');
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const beforeDrag = await profile(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 34, box.y + box.height / 2 + 22, { steps: 4 });
  await page.mouse.up();
  const afterDrag = await profile(page);
  expect(afterDrag.x).toBeGreaterThan(beforeDrag.x);
  expect(afterDrag.y).toBeGreaterThan(beforeDrag.y);

  // Deliberately adjust again. Add must store this LIVE transform, not asset defaults.
  await tryon('bigger').click();
  await tryon('rotate').click();
  await tryon('layer').click();
  const adjusted = await profile(page);
  await page.locator('[data-look="add"]').click();
  let look = await storedLook(page);
  expect(look).toHaveLength(1);
  expect(look[0].profile.slot).toBe('body');
  expect(look[0].profile.scale).toBeCloseTo(adjusted.scale, 8);
  expect(look[0].profile.rotation).toBe(adjusted.rotation);
  expect(look[0].profile.layer).toBe(adjusted.layer);
  expect(look[0].profile.x).toBeCloseTo(adjusted.x, 8);
  expect(look[0].profile.y).toBeCloseTo(adjusted.y, 8);
  await expect(page.locator('.kelo-look-count')).toHaveText('1/8');

  // Look preview opens/closes and decodes the committed piece.
  await page.locator('[data-look="toggle"]').click();
  await expect(stage).toHaveClass(/kelo-look-active/);
  await expect(page.locator('.kelo-look-canvas')).toBeVisible();
  await page.locator('[data-look="toggle"]').click();
  await expect(stage).not.toHaveClass(/kelo-look-active/);

  // Quitar removes current slot; Vaciar clears all committed pieces.
  await page.locator('[data-look="remove"]').click();
  expect(await storedLook(page)).toHaveLength(0);
  await expect(page.locator('.kelo-look-count')).toHaveText('0/8');

  await page.locator('[data-look="add"]').click();
  expect(await storedLook(page)).toHaveLength(1);
  await page.locator('[data-look="clear"]').click();
  expect(await storedLook(page)).toHaveLength(0);
  await expect(page.locator('.kelo-look-count')).toHaveText('0/8');

  // Leave one body sprite committed, then enter the ORIGINAL game at index.html.
  await page.locator('[data-look="add"]').click();
  look = await storedLook(page);
  expect(look).toHaveLength(1);
  expect(look[0].profile.slot).toBe('body');

  await page.goto('/index.html');
  await expect.poll(async () => page.evaluate(() => Boolean(window.KeloUniversalLookRuntime)), { timeout: 15000 }).toBe(true);
  await expect.poll(async () => page.evaluate(() => window.KeloUniversalLookRuntime?.snapshot()?.installed), { timeout: 15000 }).toBe(true);

  const runtime = await page.evaluate(() => window.KeloUniversalLookRuntime.snapshot());
  expect(runtime.itemCount).toBe(1);
  expect(runtime.bodyActive).toBe(true);
  expect(runtime.loadErrors).toBe(0);

  // The game render loop must actually consume and draw the custom body.
  await expect.poll(async () => page.evaluate(() => window.KeloUniversalLookRuntime?.snapshot()?.drawCount || 0), { timeout: 15000 }).toBeGreaterThan(0);
});