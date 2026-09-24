const { test, expect, devices } = require('@playwright/test');
const iphone=devices['iPhone 13'];
test.use({userAgent:iphone.userAgent,viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:iphone.deviceScaleFactor,isMobile:true,hasTouch:true});

test('Creator Hub module exports working public API',async({page})=>{
  await page.goto('./',{waitUntil:'domcontentloaded',timeout:30000});
  const result=await page.evaluate(async()=>{
    try{
      const mod=await import('./src/creators/ui/creator-hub.mjs?v=current-main-matrix');
      return {ok:true,keys:Object.keys(mod),hasOpen:typeof mod.openCreatorHub==='function',hasClose:typeof mod.closeCreatorHub==='function'};
    }catch(error){return{ok:false,error:String(error?.message||error)};}
  });
  console.log('[MATRIX_HUB]',JSON.stringify(result));
  expect(result.hasOpen).toBe(true);
});

test('Asset Vault is a real page, not a placeholder',async({page})=>{
  const response=await page.goto('./asset-vault.html',{waitUntil:'domcontentloaded',timeout:30000});
  const state=await page.evaluate(()=>({title:document.title,body:document.body?.innerText?.trim()?.slice(0,80)||'',htmlLen:document.documentElement.outerHTML.length}));
  console.log('[MATRIX_VAULT]',JSON.stringify(state));
  expect(response?.ok()).toBe(true);
  expect(state.body).not.toBe('SEE_LOCAL');
  expect(state.htmlLen).toBeGreaterThan(10000);
});

test('properties feature actually installs its declared runtime',async({page})=>{
  await page.goto('./?guest=1&currentMainMatrix=properties',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_MODULE_LOADER,null,{timeout:30000});
  const result=await page.evaluate(async()=>{
    let ok=false,error=null;
    try{ok=await window.KELO_MODULE_LOADER.ensure('properties');}catch(e){error=String(e?.message||e);}
    return {
      ok,error,
      propertySystem:!!window.KELO_PROPERTY_SYSTEM?.request,
      instances:!!window.KELO_INSTANCES,
      houses:!!window.KELO_HOUSES,
      houseUi:!!window.KELO_HOUSE_UI,
      loaded:window.KELO_MODULE_LOADER.diagnostics?.().loaded||[]
    };
  });
  console.log('[MATRIX_PROPERTIES]',JSON.stringify(result));
  expect(result.propertySystem).toBe(true);
  expect(result.houseUi).toBe(true);
});

test('World direct editor opens and first placement commits',async({page})=>{
  test.setTimeout(120000);
  await page.goto('./?mapEditor=1&currentMainMatrix=world',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_ADMIN_KEYS,null,{timeout:30000});
  await page.evaluate(async()=>{
    const keys=window.KELO_ADMIN_KEYS; keys.installRemoteAdapter?.(null); keys.installScopeProvider?.(null);
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
    try{
      const mod=await import('./src/creators/workspaces/world-workspace.mjs?v=current-main-matrix');
      const session=await mod.createWorldWorkspaceManifest().open({root:window});
      window.__MATRIX_WORLD_SESSION=session;
      return{ok:!!session,error:null};
    }catch(error){return{ok:false,error:String(error?.message||error)};}
  });
  console.log('[MATRIX_WORLD_OPEN]',JSON.stringify(opened));
  expect(opened.ok).toBe(true);
  const studio=page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({timeout:15000});
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading','1',{timeout:45000});
  const placement=await page.evaluate(async()=>{
    const live=window.__MATRIX_WORLD_SESSION;
    const catalog=live?.studio?.adapter?.assetCatalog?.list?.()||[];
    const asset=catalog[0];
    const out={assetId:asset?.id||null,before:live?.studio?.kernel?.document?.entities?.length??-1,ok:false,error:null};
    try{
      live.beginPlacement(asset.id);live.studio.tools.placement.move(256,256,{snap:32});await live.studio.tools.placement.commit();out.ok=true;
    }catch(e){out.error=String(e?.message||e);}
    out.after=live?.studio?.kernel?.document?.entities?.length??-1;
    return out;
  });
  console.log('[MATRIX_WORLD_PLACE]',JSON.stringify(placement));
  expect(placement.ok).toBe(true);
  expect(placement.after).toBeGreaterThan(placement.before);
});