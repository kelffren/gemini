const { test, expect, devices } = require('@playwright/test');

const iphone = devices['iPhone 13'];
test.use({
  userAgent: iphone.userAgent,
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  deviceScaleFactor: iphone.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

async function openDirect(page) {
  await page.goto('./?mapEditor=1&worldPlacementDiag=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !!window.KELO_ADMIN_KEYS, null, { timeout: 30000 });
  const permission = await page.evaluate(async () => {
    const keys = window.KELO_ADMIN_KEYS;
    keys.installRemoteAdapter?.(null);
    keys.installScopeProvider?.(null);
    let actor='';
    for(let i=0;i<50;i++){
      actor=String(keys.playerId?.()||window.localPlayer?.id||'local_pioneer');
      if(!keys.can?.('world.edit',actor)){
        try{await keys.request?.('admin-key:bootstrap-local-root',{actorId:actor,ownerId:actor,developer:true});}catch{}
        keys.syncInventory?.();
      }
      if(keys.can?.('world.edit',actor)) break;
      await new Promise(r=>setTimeout(r,150));
    }
    return {actor,allowed:!!keys.can?.('world.edit',actor)};
  });
  expect(permission.allowed).toBe(true);

  const result = await page.evaluate(async () => {
    const mod = await import('./src/creators/workspaces/world-workspace.mjs');
    const manifest = mod.createWorldWorkspaceManifest();
    const session = await manifest.open({ root: window });
    window.__KELO_PLACEMENT_DIAG_SESSION = session;
    return !!session;
  });
  expect(result).toBe(true);
  const studio = page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({timeout:20000});
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading','1',{timeout:40000});
}

test('diagnose direct placement commit vs pointer path', async ({page}) => {
  test.setTimeout(140000);
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror:'+String(e?.message||e)));
  page.on('console',msg=>{if(msg.type()==='error'||msg.type()==='warning')errors.push(msg.type()+':'+msg.text())});
  await openDirect(page);

  const before = await page.evaluate(async () => {
    const live=window.__KELO_PLACEMENT_DIAG_SESSION||null;
    const catalog=live?.studio?.adapter?.assetCatalog?.list?.()||[];
    const propertyCatalog=window.KELO_PROPERTY_CATALOG?.list?.()||[];
    return {
      live:!!live,
      mode:live?.mode||null,
      entities:live?.studio?.kernel?.document?.entities?.length??-1,
      catalogCount:catalog.length,
      propertyCatalogCount:propertyCatalog.length,
      firstCatalog:catalog.slice(0,8).map(x=>x?.id),
      firstProperty:propertyCatalog.slice(0,8).map(x=>x?.id),
      activeAsset:document.getElementById('kelo-studio-live')?.dataset?.activeAsset||null,
      worldEditReady:!!window.KELO_WORLD_EDIT?.ready,
      worldEditSource:window.KELO_WORLD_EDIT?.authoritySource?.()||null,
      worldEditError:window.KELO_WORLD_EDIT?.lastError||null,
    };
  });
  console.log('[PLACEMENT_DIAG_BEFORE]',JSON.stringify(before));

  const direct = await page.evaluate(async () => {
    const live=window.__KELO_PLACEMENT_DIAG_SESSION||null;
    const studio=live.studio;
    const catalog=studio.adapter.assetCatalog.list?.()||[];
    const preferred=catalog.find(x=>/tree|arbol|oak|pine|birch|nature/i.test(String(x?.id||'')+' '+String(x?.label||'')))||catalog[0];
    const assetId=String(preferred?.id||document.getElementById('kelo-studio-live')?.dataset?.activeAsset||'');
    const out={assetId,before:studio.kernel.document.entities.length,prefab:!!studio.kernel.prefabs.resolve(assetId),property:!!window.KELO_PROPERTY_CATALOG?.get?.(assetId)};
    try{
      live.beginPlacement(assetId);
      out.modeAfterBegin=live.mode;
      out.previewAfterBegin=studio.tools.placement.getPreview?.()||null;
      studio.tools.placement.move(256,256,{snap:32});
      out.previewAfterMove=studio.tools.placement.getPreview?.()||null;
      const row=await studio.tools.placement.commit();
      out.commitOk=true;
      out.row=row;
    }catch(error){
      out.commitOk=false;
      out.error=String(error?.message||error);
      out.stack=String(error?.stack||'');
    }
    out.after=studio.kernel.document.entities.length;
    out.worldEditError=window.KELO_WORLD_EDIT?.lastError||null;
    out.propertyPlacements=window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor')?.length??-1;
    return out;
  });
  console.log('[PLACEMENT_DIAG_DIRECT]',JSON.stringify(direct));
  expect(direct.assetId).toBeTruthy();
  expect(direct.previewAfterBegin).toBeTruthy();
});
