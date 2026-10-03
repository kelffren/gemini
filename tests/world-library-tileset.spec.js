/* KELO-INDEX
 * area: QA / WORLD LIBRARY TILESET
 * keys: IPHONE PICKER TILESET GRID VAULT PLACE SAVE REOPEN UNDO REDO
 * purpose: Exercise the real World picker, exact atlas crop and canonical placement/draft lifecycle.
 */
const {test,expect,devices}=require('@playwright/test');
test.use({viewport:{width:390,height:844},userAgent:devices['iPhone 13'].userAgent,isMobile:true,hasTouch:true,serviceWorkers:'block'});

test('World uses a chosen Library tile and retains it after save and reopen',async({page})=>{
  test.setTimeout(90000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.text().includes('draft import deferred'))console.log('TILESET_IMPORT_WARNING',m.text());});
  await page.goto('./?guest=1&mapEditor=1&tilesetQA=1',{waitUntil:'load'});
  await page.evaluate(async()=>{
    const {bootKeloCreators}=await import('./src/creators/creator-entry.mjs');
    const platform=await bootKeloCreators({root:window});
    window.__tilesetPlatform=platform;
  });
  await page.waitForFunction(()=>window.__keloBootReady&&window.KELO_ADMIN_KEYS?.can?.('world.edit'),null,{timeout:20000});
  await page.evaluate(async()=>{window.__tilesetQA=await window.__tilesetPlatform.openWorkspace('world');});
  console.log('TILESET_QA_OPENED');
  await expect(page.locator('#kelo-studio-live')).not.toHaveAttribute('data-kelo-world-loading','1',{timeout:25000});
  await page.waitForFunction(()=>document.querySelector('#kelo-studio-live')?.dataset.keloWorldHydrated==='1',null,{timeout:15000});
  console.log('TILESET_QA_HYDRATED');
  // Inspect the real popup URL, then deliver the same same-origin selection message.
  await page.evaluate(()=>{window.open=url=>{window.__tilesetPickerURL=url;return{focus(){},close(){}};};});
  await page.locator('#kelo-universal-asset-picker-world').click({timeout:10000});
  console.log('TILESET_QA_PICKER_OPEN');
  expect(new URL(await page.evaluate(()=>window.__tilesetPickerURL)).searchParams.get('kind')).toBe('all');
  await page.evaluate(()=>window.postMessage({type:'kelo:asset-picker-selected',context:'world',asset:{
    id:'qa:grass-tiles',name:'QA Grass tiles',provider:'kelo',externalId:'qa-grass-tiles',contentKind:'tileset',license:'KELO-NATIVE',
    previewUrl:new URL('./assets/grass-variation-v1.png',location.href).href,
    downloadUrl:new URL('./assets/grass-variation-v1.png',location.href).href
  }},location.origin));
  const picker=page.locator('#kelo-tileset-picker');await expect(picker).toBeVisible();
  expect(await page.evaluate(()=>window.__tilesetQA.studio.tools.placement.getPreview())).toBeNull();
  await expect(picker).toHaveCSS('pointer-events','auto');
  console.log('TILESET_QA_LAYOUT',await picker.evaluate(e=>({panel:e.getBoundingClientRect().toJSON(),button:e.querySelector('[data-tileset-prepare]').getBoundingClientRect().toJSON(),height:innerHeight,header:document.querySelector('#kelo-studio-live .ks-top')?.getBoundingClientRect().toJSON()})));
  await expect(picker.locator('[data-tileset-prepare]')).toBeInViewport();
  await picker.locator('[data-tileset-prepare]').click({timeout:10000});
  await expect(picker.locator('[data-tile-template]')).toHaveCount(8,{timeout:15000});
  console.log('TILESET_QA_CELLS_READY');
  const chosen=picker.locator('[data-tile-template]').nth(1),templateId=await chosen.getAttribute('data-tile-template');
  await chosen.click({timeout:10000});
  const ghost=await page.evaluate(()=>window.__tilesetQA.studio.tools.placement.getPreview());
  expect(ghost.prefabId).toBe(templateId);
  expect(await page.evaluate(id=>window.__tilesetQA.studio.adapter.assetCatalog.get(id).parts[0].source,templateId)).toEqual({x:32,y:0,w:32,h:32});
  expect(ghost.bounds).toEqual({w:32,h:32});
  console.log('TILESET_QA_CHOSEN');
  const before=await page.evaluate(()=>window.__tilesetQA.studio.kernel.document.entities.length);
  await page.locator('#game-canvas').dispatchEvent('pointerdown',{pointerId:81,pointerType:'touch',isPrimary:true,clientX:180,clientY:300,buttons:1,bubbles:true});
  await page.locator('#game-canvas').dispatchEvent('pointerup',{pointerId:81,pointerType:'touch',isPrimary:true,clientX:180,clientY:300,buttons:0,bubbles:true});
  await expect.poll(()=>page.evaluate(()=>window.__tilesetQA.studio.kernel.document.entities.length)).toBe(before+1);
  await page.evaluate(async()=>{await window.__tilesetQA.studio.kernel.undo();});
  expect(await page.evaluate(()=>window.__tilesetQA.studio.kernel.document.entities.length)).toBe(before);
  await page.evaluate(async()=>{await window.__tilesetQA.studio.kernel.redo();});
  await page.locator('#kelo-studio-live [data-act="save"]').click();
  console.log('TILESET_QA_SAVED');
  await page.waitForTimeout(300);
  await page.screenshot({path:'test-results/world-library-tileset-mobile.png'});
  await page.evaluate(async()=>{await window.__tilesetQA.close();});
  await expect(picker).toHaveCount(0);
  await page.evaluate(async()=>{window.__tilesetQA=await window.KELO_CREATORS_PLATFORM.openWorkspace('world');});
  await page.waitForFunction(()=>document.querySelector('#kelo-studio-live')?.dataset.keloWorldHydrated==='1',null,{timeout:15000});
  expect(await page.evaluate(id=>window.__tilesetQA.studio.kernel.document.entities.some(row=>row.prefabId===id),templateId)).toBe(true);
  expect(errors).toEqual([]);
});
