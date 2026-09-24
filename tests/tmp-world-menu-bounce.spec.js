const { test, expect, devices } = require('@playwright/test');
const iphone=devices['iPhone 13'];
test.use({userAgent:iphone.userAgent,viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:iphone.deviceScaleFactor,isMobile:true,hasTouch:true});

test('Creator Hub World launch does not bounce back to previous menu',async({page})=>{
  test.setTimeout(120000);
  const logs=[];
  page.on('console',m=>{if(['error','warning'].includes(m.type()))logs.push({t:Date.now(),type:m.type(),text:m.text()});});
  page.on('pageerror',e=>logs.push({t:Date.now(),type:'pageerror',text:String(e?.stack||e)}));

  await page.goto('./?mapEditor=1&menuBounceDiag=1',{waitUntil:'domcontentloaded',timeout:30000});
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

  const hubModule=await page.evaluate(async()=>{
    const mod=await import('./src/creators/ui/creator-hub.mjs?v=world-editor-20260924-2');
    await mod.openCreatorHub({root:window});
    return true;
  });
  expect(hubModule).toBe(true);

  const hub=page.locator('#kelo-creators-hub');
  await expect(hub).toBeVisible({timeout:10000});
  const world=hub.locator('[data-workspace="world"]');
  await expect(world).toBeVisible({timeout:10000});

  await page.evaluate(()=>{
    window.__MENU_BOUNCE_TRACE=[];
    const snap=label=>{
      const hub=document.getElementById('kelo-creators-hub');
      const studio=document.getElementById('kelo-studio-live');
      const menu=document.getElementById('lx-menu-panel');
      const cs=getComputedStyle;
      window.__MENU_BOUNCE_TRACE.push({
        at:Math.round(performance.now()),label,
        hub:!!hub,hubDisplay:hub?cs(hub).display:null,
        studio:!!studio,studioDisplay:studio?cs(studio).display:null,
        loading:studio?.dataset?.keloWorldLoading??null,
        interactive:studio?.dataset?.keloStudioInteractive??null,
        status:studio?.querySelector?.('.ks-status')?.textContent||null,
        studioActive:document.body.classList.contains('kelo-studio-active'),
        menuOpen:!!menu?.classList?.contains('open'),
        property:!!window.KELO_PROPERTY_SYSTEM?.request
      });
    };
    snap('before-world');
    const obs=new MutationObserver(()=>snap('mutation'));
    obs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','data-kelo-world-loading','data-kelo-studio-interactive']});
    window.__MENU_BOUNCE_OBS=obs;
  });

  await world.tap();
  for(const ms of [250,750,1500,3000,5000,8000]){
    await page.waitForTimeout(ms===250?250:ms-[250,750,1500,3000,5000].filter(x=>x<ms).slice(-1)[0]||ms);
    await page.evaluate(label=>{
      const hub=document.getElementById('kelo-creators-hub'),studio=document.getElementById('kelo-studio-live'),menu=document.getElementById('lx-menu-panel');
      window.__MENU_BOUNCE_TRACE.push({at:Math.round(performance.now()),label,hub:!!hub,hubDisplay:hub?getComputedStyle(hub).display:null,studio:!!studio,studioDisplay:studio?getComputedStyle(studio).display:null,loading:studio?.dataset?.keloWorldLoading??null,interactive:studio?.dataset?.keloStudioInteractive??null,status:studio?.querySelector?.('.ks-status')?.textContent||null,studioActive:document.body.classList.contains('kelo-studio-active'),menuOpen:!!menu?.classList?.contains('open'),property:!!window.KELO_PROPERTY_SYSTEM?.request});
    },'t+'+ms);
  }
  const state=await page.evaluate(()=>{window.__MENU_BOUNCE_OBS?.disconnect?.();return{trace:window.__MENU_BOUNCE_TRACE,body:document.body.className,hubHtml:document.getElementById('kelo-creators-hub')?.outerHTML?.slice(0,500)||null,studio:document.getElementById('kelo-studio-live')?.outerHTML?.slice(0,500)||null};});
  console.log('[MENU_BOUNCE_TRACE]',JSON.stringify(state));
  console.log('[MENU_BOUNCE_ERRORS]',JSON.stringify(logs));

  const studio=page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({timeout:10000});
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading','1');
  await expect(page.locator('#kelo-creators-hub')).toHaveCount(0);
  expect(await page.locator('#lx-menu-panel.open').count()).toBe(0);
});