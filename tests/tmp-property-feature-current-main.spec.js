const { test, expect, devices } = require('@playwright/test');
const iphone=devices['iPhone 13'];
test.use({userAgent:iphone.userAgent,viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:iphone.deviceScaleFactor,isMobile:true,hasTouch:true});

test('properties feature exposes complete house runtime',async({page})=>{
  test.setTimeout(90000);
  await page.goto('./?guest=1&propertyFeatureCurrentMain=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_MODULE_LOADER,null,{timeout:30000});
  const result=await page.evaluate(async()=>{
    const ok=await window.KELO_MODULE_LOADER.ensure('properties');
    return {
      ok,
      propertySystem:!!window.KELO_PROPERTY_SYSTEM?.request,
      instances:!!window.KELO_INSTANCES,
      houseAuthority:!!window.KELO_HOUSE_AUTHORITY,
      houses:!!window.KELO_HOUSES,
      houseUi:!!window.KELO_HOUSE_UI,
      loaded:window.KELO_MODULE_LOADER.diagnostics?.().loaded||[]
    };
  });
  console.log('[PROPERTY_FEATURE_CURRENT_MAIN]',JSON.stringify(result));
  expect(result.ok).toBe(true);
  expect(result.propertySystem).toBe(true);
  expect(result.instances).toBe(true);
  expect(result.houseAuthority).toBe(true);
  expect(result.houses).toBe(true);
  expect(result.houseUi).toBe(true);
});

test('World loads only property core and first placement commits',async({page})=>{
  test.setTimeout(120000);
  await page.goto('./?mapEditor=1&propertyCoreWorldAudit=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_ADMIN_KEYS&&!!window.KELO_MODULE_LOADER,null,{timeout:30000});
  await page.evaluate(async()=>{
    const keys=window.KELO_ADMIN_KEYS;
    keys.installRemoteAdapter?.(null); keys.installScopeProvider?.(null);
    for(let i=0;i<50;i++){
      const actor=String(keys.playerId?.()||window.localPlayer?.id||'local_pioneer');
      if(!keys.can?.('world.edit',actor)){
        try{await keys.request?.('admin-key:bootstrap-local-root',{actorId:actor,ownerId:actor,developer:true});}catch{}
        keys.syncInventory?.();
      }
      if(keys.can?.('world.edit',actor))break;
      await new Promise(r=>setTimeout(r,120));
    }
  });
  const opened=await page.evaluate(async()=>{
    const mod=await import('./src/creators/workspaces/world-workspace.mjs?v=property-core-current-main-test');
    const manifest=mod.createWorldWorkspaceManifest();
    const session=await manifest.open({root:window});
    window.__PROPERTY_CORE_WORLD_SESSION=session;
    return !!session;
  });
  expect(opened).toBe(true);
  const studio=page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({timeout:20000});
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading','1',{timeout:45000});

  const result=await page.evaluate(async()=>{
    const live=window.__PROPERTY_CORE_WORLD_SESSION;
    const catalog=live?.studio?.adapter?.assetCatalog?.list?.()||[];
    const asset=catalog.find(x=>/tree|nature|oak|pine|birch/i.test(String(x?.id||'')+' '+String(x?.label||'')))||catalog[0];
    const assetId=String(asset?.id||'');
    const before=live?.studio?.kernel?.document?.entities?.length??-1;
    let commitOk=false,error=null;
    try{
      live.beginPlacement(assetId);
      live.studio.tools.placement.move(256,256,{snap:32});
      await live.studio.tools.placement.commit();
      commitOk=true;
    }catch(e){error=String(e?.message||e);}
    return {
      assetId,before,after:live?.studio?.kernel?.document?.entities?.length??-1,
      commitOk,error,
      propertySystem:!!window.KELO_PROPERTY_SYSTEM?.request,
      houses:!!window.KELO_HOUSES,
      loaded:window.KELO_MODULE_LOADER.diagnostics?.().loaded||[]
    };
  });
  console.log('[PROPERTY_CORE_WORLD_CURRENT_MAIN]',JSON.stringify(result));
  expect(result.propertySystem).toBe(true);
  expect(result.commitOk).toBe(true);
  expect(result.after).toBeGreaterThan(result.before);
  expect(result.loaded).toContain('property-core');
  expect(result.loaded).not.toContain('properties');
});