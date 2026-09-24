const { test, expect, devices } = require('@playwright/test');
const iphone=devices['iPhone 13'];
test.use({userAgent:iphone.userAgent,viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:iphone.deviceScaleFactor,isMobile:true,hasTouch:true});

async function bootstrapAdmin(page){
  await page.waitForFunction(()=>!!window.KELO_ADMIN_KEYS,null,{timeout:30000});
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
}

test('Creator Hub full restore hands off to interactive World',async({page})=>{
  test.setTimeout(120000);
  await page.goto('./?mapEditor=1&auditBundle=hub',{waitUntil:'domcontentloaded',timeout:30000});
  await bootstrapAdmin(page);
  const api=await page.evaluate(async()=>{
    const mod=await import('./src/creators/ui/creator-hub.mjs?v=audit-bundle');
    await mod.openCreatorHub({root:window});
    return Object.keys(mod);
  });
  expect(api).toContain('openCreatorHub');
  const hub=page.locator('#kelo-creators-hub');
  await expect(hub).toBeVisible();
  await expect(hub.locator('[data-workspace="scene-kit"]')).toHaveCount(1);
  await hub.locator('[data-workspace="world"]').dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true,button:0});
  const studio=page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({timeout:20000});
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading','1',{timeout:45000});
  await expect(hub).toHaveCount(0,{timeout:10000});
});

test('Asset Vault is restored and renders provider catalog',async({page})=>{
  const response=await page.goto('./asset-vault.html',{waitUntil:'domcontentloaded',timeout:30000});
  expect(response?.ok()).toBe(true);
  await expect(page.locator('#search')).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await page.locator('#provider-filters button').count()).toBeGreaterThan(0);
  expect(await page.locator('#explore-grid .card').count()).toBeGreaterThan(0);
  expect((await page.locator('body').innerText()).trim()).not.toBe('SEE_LOCAL');
});

for(const feature of [
  {id:'properties',globals:['KELO_PROPERTY_SYSTEM','KELO_INSTANCES','KELO_HOUSES','KELO_HOUSE_UI']},
  {id:'mounts',globals:['KeloStats','KeloMountCatalog','KeloMountEquipmentCatalog','KeloMounts','KeloMountPanel']},
  {id:'appearance',globals:['KeloCharacterSlotSchema','KeloCharacterCustomization','KeloCharacterCustomizer']}
]){
  test(`lazy ${feature.id} exposes complete runtime`,async({page})=>{
    await page.goto(`./?guest=1&auditBundle=${feature.id}`,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>!!window.KELO_MODULE_LOADER,null,{timeout:30000});
    const result=await page.evaluate(async row=>{
      const ok=await window.KELO_MODULE_LOADER.ensure(row.id);
      return {ok,surfaces:Object.fromEntries(row.globals.map(name=>[name,!!window[name]])),loaded:window.KELO_MODULE_LOADER.diagnostics?.().loaded||[]};
    },feature);
    console.log('[AUDIT_BUNDLE_FEATURE]',JSON.stringify({feature:feature.id,...result}));
    expect(result.ok).toBe(true);
    for(const name of feature.globals)expect(result.surfaces[name],`${feature.id} missing ${name}`).toBe(true);
  });
}

test('World uses property-core only and commits first placement',async({page})=>{
  test.setTimeout(120000);
  await page.goto('./?mapEditor=1&auditBundle=world',{waitUntil:'domcontentloaded',timeout:30000});
  await bootstrapAdmin(page);
  const opened=await page.evaluate(async()=>{
    const mod=await import('./src/creators/workspaces/world-workspace.mjs?v=audit-bundle');
    const session=await mod.createWorldWorkspaceManifest().open({root:window});
    window.__AUDIT_BUNDLE_WORLD=session;
    return !!session;
  });
  expect(opened).toBe(true);
  const studio=page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({timeout:20000});
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading','1',{timeout:45000});
  const result=await page.evaluate(async()=>{
    const live=window.__AUDIT_BUNDLE_WORLD,catalog=live.studio.adapter.assetCatalog.list?.()||[];
    const asset=catalog.find(x=>/tree|nature/i.test(String(x?.id||'')+' '+String(x?.label||'')))||catalog[0];
    const before=live.studio.kernel.document.entities.length;
    live.beginPlacement(asset.id);
    live.studio.tools.placement.move(256,256,{snap:32});
    await live.studio.tools.placement.commit();
    return {before,after:live.studio.kernel.document.entities.length,loaded:window.KELO_MODULE_LOADER.diagnostics?.().loaded||[],houses:!!window.KELO_HOUSES};
  });
  console.log('[AUDIT_BUNDLE_WORLD]',JSON.stringify(result));
  expect(result.after).toBeGreaterThan(result.before);
  expect(result.loaded).toContain('property-core');
  expect(result.loaded).not.toContain('properties');
  expect(result.houses).toBe(false);
});

test('atlas contract has no plaza cache-token violations',async({page})=>{
  await page.goto('./?auditBundle=atlas',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_ATLAS_AUDIT,null,{timeout:30000});
  await page.waitForTimeout(1000);
  const violations=await page.evaluate(()=>window.KELO_ATLAS_AUDIT?.violations||[]);
  expect(violations.filter(v=>/plazaNature|plazaRoundTree|plazaFountainKelo|versioned URL cache token/i.test(typeof v==='string'?v:JSON.stringify(v)))).toEqual([]);
});