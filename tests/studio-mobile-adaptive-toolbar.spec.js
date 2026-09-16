/* KELO-INDEX
 * area: TEST / STUDIO / MOBILE ADAPTIVE TOOLBAR
 * owner: Kelo Studio presentation regression
 * purpose: keep critical mobile actions stable while learning recent and pinned tools
 */
const { test, expect } = require('@playwright/test');

async function installFixture(page,{selectionCount=0,keepFavorites=false}={}){
  await page.goto('./',{waitUntil:'domcontentloaded',timeout:30000});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async ({count,keep})=>{
    document.getElementById('kelo-studio-live')?.remove();
    sessionStorage.removeItem('kelo.studio.mobileToolbar.recents');
    if(!keep)localStorage.removeItem('kelo.studio.mobileToolbar.favorites');
    const shell=document.createElement('section');
    shell.id='kelo-studio-live';shell.dataset.compact='full';shell.dataset.selectionCount=String(count);
    shell.innerHTML=`
      <div class="ks-bottom"><div class="ks-deck">
        <div class="ks-deck-head"><div class="ks-active-tool">SELECT</div></div>
        <div class="ks-deck-body">
          <section><div class="ks-edit-primary">
            <button class="on" data-mode="select">SELECT</button>
            <button data-act="edit-assets">EDIT</button>
            <button data-act="delete">BORRAR</button>
          </div></section>
          <section><div class="ks-history-actions">
            <button data-act="undo">UNDO</button><button data-act="redo">REDO</button>
            <button data-act="rotate">ROTAR</button><button data-act="duplicate">DUPLICAR</button>
            <button data-act="scale-down">-</button><button data-act="scale-reset">100%</button><button data-act="scale-up">+</button>
          </div></section>
          <section><div class="ks-mode-actions">
            <button data-mode="move">MOVE</button><button data-mode="terrain">GROUND</button>
            <button data-mode="path">ROAD</button><button data-mode="collision">COLLISION</button>
          </div></section>
        </div>
      </div></div>`;
    document.body.append(shell);
    const polish=await import('./src/studio/ui/studio-mobile-ui-polish.mjs?v=adaptive-toolbar-polish-test-1');
    window.__toolbarPolish=polish.installStudioMobileUiPolish({root:window});window.__toolbarPolish.refresh();
    const adaptive=await import('./src/studio/ui/studio-mobile-adaptive-toolbar.mjs?v=adaptive-toolbar-test-1');
    window.__adaptiveToolbar=adaptive.installStudioMobileAdaptiveToolbar({root:window});window.__adaptiveToolbar.refresh();
  },{count:selectionCount,keep:keepFavorites});
}

test('canvas starts with familiar defaults and promotes recently used tools',async({page})=>{
  await installFixture(page);
  const bar=page.locator('.ks-mobile-context-actions');
  await expect(bar.locator('button')).toHaveText(['SELECT','EDIT','UNDO','GROUND','MÁS']);

  await page.locator('.ks-deck [data-mode="path"]').click();
  await expect(bar.locator('button')).toHaveText(['SELECT','ROAD','EDIT','UNDO','MÁS']);
  const heights=await bar.locator('button').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));
  expect(heights.every(height=>height>=44)).toBe(true);
});

test('long press pins a tool and pinned favorite outranks later recents',async({page})=>{
  await installFixture(page);
  const bar=page.locator('.ks-mobile-context-actions');
  await page.locator('.ks-deck [data-mode="path"]').click();
  const road=bar.getByRole('button',{name:/ROAD/});
  await road.dispatchEvent('pointerdown',{pointerId:31,pointerType:'touch',isPrimary:true,button:0});
  await page.waitForTimeout(620);
  await road.dispatchEvent('pointerup',{pointerId:31,pointerType:'touch',isPrimary:true,button:0});
  await expect(bar.locator('[data-kelo-proxy="mode:path"]')).toHaveAttribute('data-kelo-pinned','1');
  expect(await page.evaluate(()=>window.__adaptiveToolbar.favorites())).toContain('mode:path');

  await page.locator('.ks-deck [data-mode="collision"]').click();
  await expect(bar.locator('button').nth(1)).toHaveText('ROAD');
  await expect(bar.locator('button').nth(2)).toHaveText('COLLISION');
});

test('selection context preserves SELECT BORRAR and MAS while adapting only safe middle slots',async({page})=>{
  await installFixture(page,{selectionCount:1});
  const bar=page.locator('.ks-mobile-context-actions');
  await expect(bar.locator('button')).toHaveText(['SELECT','ROTAR','DUPLICAR','BORRAR','MÁS']);

  await page.locator('.ks-deck [data-act="scale-up"]').click();
  await expect(bar.locator('button')).toHaveText(['SELECT','ESCALA+','ROTAR','BORRAR','MÁS']);
  await expect(bar.getByRole('button',{name:'BORRAR'})).toHaveAttribute('data-kelo-danger','1');
});

test('favorites persist across a fresh Studio shell while recents stay session-scoped',async({page})=>{
  await installFixture(page);
  await page.evaluate(()=>localStorage.setItem('kelo.studio.mobileToolbar.favorites',JSON.stringify(['mode:collision'])));
  await installFixture(page,{keepFavorites:true});
  const bar=page.locator('.ks-mobile-context-actions');
  await expect(bar.locator('button').nth(1)).toHaveText('COLLISION');
  expect(await page.evaluate(()=>window.__adaptiveToolbar.recents())).toEqual([]);
});
