const { test, expect, devices } = require('@playwright/test');
const iphone=devices['iPhone 13'];
test.use({userAgent:iphone.userAgent,viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:iphone.deviceScaleFactor,isMobile:true,hasTouch:true});

async function grantWorld(page){
  await page.waitForFunction(()=>!!window.KELO_ADMIN_KEYS,null,{timeout:30000});
  return page.evaluate(async()=>{
    const keys=window.KELO_ADMIN_KEYS; keys.installRemoteAdapter?.(null); keys.installScopeProvider?.(null);
    for(let i=0;i<50;i++){
      const actor=String(keys.playerId?.()||window.localPlayer?.id||'local_pioneer');
      if(!keys.can?.('world.edit',actor)){try{await keys.request?.('admin-key:bootstrap-local-root',{actorId:actor,ownerId:actor,developer:true});}catch{} keys.syncInventory?.();}
      if(keys.can?.('world.edit',actor))return true;
      await new Promise(r=>setTimeout(r,120));
    }
    return false;
  });
}

test('full Creator Hub hands off to World without loading full house stack',async({page})=>{
  test.setTimeout(140000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e?.stack||e)));
  await page.goto('./?mapEditor=1&hubAudit=1',{waitUntil:'domcontentloaded',timeout:30000});
  expect(await grantWorld(page)).toBe(true);
  await page.evaluate(async()=>{const mod=await import('./src/creators/ui/creator-hub.mjs?v=world-editor-20260924-2');await mod.openCreatorHub({root:window});});
  const hub=page.locator('#kelo-creators-hub');await expect(hub).toBeVisible({timeout:15000});
  await expect(hub.locator('[data-workspace="scene-kit"]')).toHaveCount(1);
  const world=hub.locator('[data-workspace="world"]');await expect(world).toBeVisible();
  await world.dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true,button:0});
  const studio=page.locator('#kelo-studio-live');await expect(studio).toBeVisible({timeout:20000});
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading','1',{timeout:50000});
  const hubDiag=await page.evaluate(()=>({
    hubs:[...document.querySelectorAll('#kelo-creators-hub')].map(el=>({seq:el.dataset.keloHubSeq||null,module:el.dataset.keloHubModule||null,display:getComputedStyle(el).display,connected:el.isConnected})),
    shared:window.__KELO_CREATOR_HUB_SINGLETON_V1__?.hub?.dataset?.keloHubSeq||null,
    opening:!!window.__KELO_CREATOR_HUB_OPENING_V1__,
    resources:performance.getEntriesByType('resource').map(x=>x.name).filter(x=>x.includes('creator-hub.mjs'))
  }));
  console.log('[HUB_DUPLICATE_DIAG]',JSON.stringify(hubDiag));
  await expect(hub).toHaveCount(0,{timeout:10000});
  const state=await page.evaluate(()=>({
    active:document.body.classList.contains('kelo-studio-active'),
    propertySystem:!!window.KELO_PROPERTY_SYSTEM?.request,
    instances:!!window.KELO_INSTANCES,
    houseUi:!!window.KELO_HOUSE_UI,
    status:document.querySelector('#kelo-studio-live .ks-status')?.textContent||null
  }));
  console.log('[CURRENT_MAIN_WORLD]',JSON.stringify({state,errors}));
  expect(state.active).toBe(true);
  expect(state.propertySystem).toBe(true);
  expect(state.instances).toBe(false);
  expect(state.houseUi).toBe(false);
  expect(errors).toEqual([]);
});