const { test, expect, devices } = require('@playwright/test');
const iphone=devices['iPhone 13'];
test.use({userAgent:iphone.userAgent,viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:iphone.deviceScaleFactor,isMobile:true,hasTouch:true});

test('current main restored Creator Hub opens World and keeps Hub gone',async({page})=>{
  test.setTimeout(140000);
  const pageErrors=[]; page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
  await page.goto('./?mapEditor=1&hubRestoreAudit=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_ADMIN_KEYS,null,{timeout:30000});
  await page.evaluate(async()=>{
    const keys=window.KELO_ADMIN_KEYS; keys.installRemoteAdapter?.(null); keys.installScopeProvider?.(null);
    for(let i=0;i<50;i++){
      const actor=String(keys.playerId?.()||window.localPlayer?.id||'local_pioneer');
      if(!keys.can?.('world.edit',actor)){try{await keys.request?.('admin-key:bootstrap-local-root',{actorId:actor,ownerId:actor,developer:true});}catch{} keys.syncInventory?.();}
      if(keys.can?.('world.edit',actor))break;
      await new Promise(r=>setTimeout(r,120));
    }
  });
  const imported=await page.evaluate(async()=>{
    const mod=await import('./src/creators/ui/creator-hub.mjs?v=world-editor-20260924-2');
    return {hasOpen:typeof mod.openCreatorHub==='function',keys:Object.keys(mod)};
  });
  console.log('[HUB_IMPORT]',JSON.stringify(imported)); expect(imported.hasOpen).toBe(true);
  await page.evaluate(async()=>{const mod=await import('./src/creators/ui/creator-hub.mjs?v=world-editor-20260924-2');await mod.openCreatorHub({root:window});});
  const hub=page.locator('#kelo-creators-hub'); await expect(hub).toBeVisible({timeout:15000});
  await expect(hub.locator('[data-workspace="scene-kit"]')).toHaveCount(1);
  const world=hub.locator('[data-workspace="world"]'); await expect(world).toBeVisible();
  await world.dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true,button:0});
  const studio=page.locator('#kelo-studio-live'); await expect(studio).toBeVisible({timeout:20000});
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading','1',{timeout:50000});
  await expect(hub).toHaveCount(0,{timeout:10000});
  expect(await page.evaluate(()=>document.body.classList.contains('kelo-studio-active'))).toBe(true);
  expect(pageErrors).toEqual([]);
});