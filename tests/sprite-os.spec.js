/* KELO-INDEX
 * area: QA / CREATORS / SPRITE OS
 * owner: Sprite OS E2E
 * keys: EXTERNAL SEARCH FILTER PAGING PREVIEW SIMILAR TRYON WYSIWYG USE GAME PLAYWRIGHT MOBILE
 * purpose: Exercise the external-only Sprite OS controls and prove adjusted try-on state reaches the original game runtime.
 */
const { test, expect } = require('@playwright/test');

const PREVIEW_KEY='kelo.universal.look.preview.v1';
const RUNTIME_KEY='kelo.universal.look.runtime.v1';

async function mockExternalSpriteCatalog(page){
  await page.addInitScript(()=>{
    window.__spriteOsOpened=[];
    window.open=(url)=>{window.__spriteOsOpened.push(String(url));return null;};
  });
  await page.route('**/data/external-asset-providers.json*',async route=>{
    const origin=new URL(route.request().url()).origin;
    await route.fulfill({contentType:'application/json',body:JSON.stringify({version:13,policy:{allowedLicenses:['CC0-1.0']},providers:[{
      id:'spritecook',name:'SpriteCook Test',mode:'live-index',enabled:true,verified:true,license:'CC0-1.0',attributionRequired:false,
      indexUrl:'https://sprite.test/index.json',assetBaseUrl:`${origin}/`,sourceUrl:'https://sprite.test/source'
    }]})});
  });
  await page.route('https://sprite.test/index.json',async route=>{
    const examples=Array.from({length:50},(_,i)=>({
      slug:`archer-${i}`,title:`Dark Archer ${i}`,category:'character',previewPath:'assets/kelo-hero-body-base-8dir.png',
      sourceUrl:`https://sprite.test/assets/${i}`,prompt:'dark archer pixel character eight direction',settings:[]
    }));
    await route.fulfill({contentType:'application/json',body:JSON.stringify({examples})});
  });
}

async function liveProfile(page){
  return page.locator('#preview-modal').evaluate(modal=>modal.__keloTryonProfile?.profile||null);
}

test('Sprite OS external search, controls, WYSIWYG try-on and original-game use work',async({page})=>{
  await mockExternalSpriteCatalog(page);
  await page.goto('/sprite-os.html');

  await expect(page.locator('#status-meta')).toContainText('fuentes');
  await expect(page.locator('#providers')).toContainText('SpriteCook Test');
  await expect(page.locator('body')).not.toContainText('Kelo Content Packs');
  await expect(page.locator('.card')).toHaveCount(48);
  await expect(page.locator('.card').first()).toContainText('LISTO');

  // Readiness filter buttons must filter actual cards, not only change styling.
  await page.locator('[data-tier="ready"]').click();
  await expect(page.locator('.card')).toHaveCount(48);
  await page.locator('[data-tier="external"]').click();
  await expect(page.locator('#grid .empty')).toBeVisible();
  await page.locator('[data-tier="all"]').click();
  await expect(page.locator('.card')).toHaveCount(48);

  // Provider filter and hibernated paging: page 1 keeps 48; page 2 materializes only 2.
  await page.locator('[data-provider="spritecook"]').click();
  await expect(page.locator('.card')).toHaveCount(48);
  await expect(page.locator('#next')).toBeEnabled();
  await page.locator('#next').click();
  await expect(page.locator('#page')).toHaveText('Página 2');
  await expect(page.locator('.card')).toHaveCount(2);
  await page.locator('#prev').click();
  await expect(page.locator('#page')).toHaveText('Página 1');
  await expect(page.locator('.card')).toHaveCount(48);

  // Search button and Enter path both drive the real federated query.
  await page.locator('#search').fill('archer');
  await page.locator('#go').click();
  await expect(page.locator('.card')).toHaveCount(48);
  await page.locator('#search').fill('archer 0');
  await page.locator('#search').press('Enter');
  await expect(page.locator('.card')).toHaveCount(5);

  // Preview triggers the auto-compiler passport.
  await page.locator('.card').first().locator('[data-open]').first().click();
  await expect(page.locator('#preview-modal')).toBeVisible();
  await expect(page.locator('#passport')).toContainText('compatibilidad');
  await expect(page.locator('#passport')).toContainText('slot automático');
  await expect(page.locator('#passport')).toContainText('CC0-1.0');
  await expect(page.locator('#use')).toBeEnabled();

  // Source opens the exact external origin without importing it silently.
  await page.locator('#source').click();
  await expect.poll(()=>page.evaluate(()=>window.__spriteOsOpened.at(-1)||'')).toContain('https://sprite.test/assets/0');

  // Similar-assets button must derive a broader semantic query and execute it.
  await page.locator('#similar').click();
  await expect(page.locator('#preview-modal')).toBeHidden();
  await expect(page.locator('#search')).toHaveValue('dark archer');
  await expect(page.locator('.card')).toHaveCount(48);
  await expect(page.locator('.card').first()).toBeVisible();

  // Reopen, activate try-on and change the sprite exactly as a creator would.
  await page.locator('.card').first().locator('[data-open]').first().click();
  await expect(page.locator('#preview-modal')).toBeVisible();
  const tryon=name=>page.locator(`[data-tryon="${name}"]`);
  await expect(tryon('toggle')).toBeVisible();
  await tryon('toggle').click();
  await expect(page.locator('#preview-stage')).toHaveClass(/kelo-tryon-active/);
  await expect(page.locator('.kelo-tryon-canvas')).toBeVisible();

  const before=await liveProfile(page);
  expect(before.slot).toBe('body');
  await tryon('bigger').click();
  await tryon('rotate').click();
  await tryon('layer').click();
  const adjusted=await liveProfile(page);
  expect(adjusted.scale).toBeGreaterThan(before.scale);
  expect(adjusted.rotation).toBe(15);
  expect(adjusted.layer).toBe('back');

  // Drag is part of WYSIWYG state too.
  const canvas=page.locator('.kelo-tryon-canvas');
  const box=await canvas.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+28,box.y+box.height/2+18,{steps:4});
  await page.mouse.up();
  const dragged=await liveProfile(page);
  expect(dragged.x).not.toBeCloseTo(adjusted.x,8);
  expect(dragged.y).not.toBeCloseTo(adjusted.y,8);

  // One tap must persist the LIVE adjusted profile in both transport stores.
  await page.locator('#use').click();
  await page.waitForURL(/\/index\.html\?spriteOs=1/, {timeout:10000});
  const stored=await page.evaluate(({previewKey,runtimeKey})=>({
    preview:JSON.parse(sessionStorage.getItem(previewKey)||'[]'),
    runtime:JSON.parse(localStorage.getItem(runtimeKey)||'[]'),
    passport:JSON.parse(localStorage.getItem('kelo.sprite.os.last-passport.v1')||'null')
  }),{previewKey:PREVIEW_KEY,runtimeKey:RUNTIME_KEY});
  expect(stored.preview).toHaveLength(1);
  expect(stored.runtime).toHaveLength(1);
  expect(stored.runtime[0].profile.slot).toBe('body');
  expect(stored.runtime[0].profile.scale).toBeCloseTo(dragged.scale,8);
  expect(stored.runtime[0].profile.rotation).toBe(dragged.rotation);
  expect(stored.runtime[0].profile.layer).toBe(dragged.layer);
  expect(stored.runtime[0].profile.x).toBeCloseTo(dragged.x,8);
  expect(stored.runtime[0].profile.y).toBeCloseTo(dragged.y,8);
  expect(stored.runtime[0].spritePassport.license).toBe('CC0-1.0');
  expect(stored.passport.schema).toBe('sprite-os-passport/v1');

  // The original renderer must consume and draw the Sprite OS body.
  await expect.poll(()=>page.evaluate(()=>Boolean(window.KeloUniversalLookRuntime)),{timeout:15000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.KeloUniversalLookRuntime?.snapshot()?.drawCount||0),{timeout:15000}).toBeGreaterThan(0);
  const runtime=await page.evaluate(()=>window.KeloUniversalLookRuntime.snapshot());
  expect(runtime.itemCount).toBe(1);
  expect(runtime.bodyActive).toBe(true);
  expect(runtime.loadErrors).toBe(0);
});
