/* KELO-INDEX
 * area: TEST / PVP / LIVE PAGES
 * owner: Playwright validation only
 * keys: PVP LIVE PAGES BUTTON FIRST-USE QUICK-ACTIONS IPHONE SMOKE DEPLOY
 * purpose: valida en GitHub Pages publicado la ruta visible Quick Actions -> PVP -> lazy domain -> mode=pvp sin bypass de UI
 * online: smoke de deployment; no valida autoridad competitiva ni exige servidor de matchmaking para aprobar el enlace del botón
 * do-not: NO force click, NO llamada directa a enterPvPWorld, NO mutar gameplay
 */
const {test,expect}=require('@playwright/test');

const LIVE_BASE=process.env.KELO_PAGES_URL||'https://kelffren.github.io/gemini/';
const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function liveUrl(attempt){
  const url=new URL(LIVE_BASE);
  url.searchParams.set('guest','1');
  url.searchParams.set('pvpLiveSmoke','1');
  url.searchParams.set('_deployProbe',`${Date.now()}-${attempt}`);
  return url.toString();
}

async function openPublishedRuntime(page){
  let snapshot=null;
  for(let attempt=1;attempt<=6;attempt++){
    await page.goto(liveUrl(attempt),{waitUntil:'domcontentloaded',timeout:45000});
    try{
      await page.waitForFunction(()=>window.KELO_MODULE_LOADER&&document.getElementById('game-canvas')&&document.getElementById('kw-quick-actions-toggle')&&document.getElementById('lx-side-pvp'),{timeout:20000});
      snapshot=await page.evaluate(()=>({
        loaderVersion:window.KELO_MODULE_LOADER?.version||null,
        features:Array.isArray(window.KELO_MODULE_LOADER?.features)?window.KELO_MODULE_LOADER.features.slice():[],
        guest:document.documentElement.dataset.keloGuestPlay||null,
        authHidden:document.getElementById('kelo-account-auth')?.hidden||getComputedStyle(document.getElementById('kelo-account-auth')||document.body).display==='none'
      }));
      if(snapshot.features.includes('pvp')&&snapshot.guest==='1')return snapshot;
    }catch(_){/* deployment/CDN may still be converging; retry with a fresh URL */}
    await page.waitForTimeout(5000);
  }
  throw new Error(`LIVE_PVP_RUNTIME_NOT_PUBLISHED ${JSON.stringify(snapshot)}`);
}

async function enterPvpThroughRealControls(page){
  const quick=page.locator('#kw-quick-actions-toggle');
  const pvp=page.locator('#lx-side-pvp');

  await expect(page.locator('#game-canvas')).toBeVisible({timeout:15000});
  await expect(quick).toBeVisible({timeout:15000});

  const before=await page.evaluate(()=>({
    needs:window.KELO_MODULE_LOADER.needs('pvp'),
    ready:window.KELO_MODULE_LOADER.isReady('pvp'),
    pvpWorld:!!window.KeloPvPWorld,
    enter:typeof window.enterPvPWorld==='function',
    diagnostics:window.KELO_MODULE_LOADER.diagnostics()
  }));

  // PvP must remain first-use: the published plaza should not preload its heavy domain.
  expect(before.needs).toBe(true);
  expect(before.ready).toBe(false);

  await quick.click();
  await expect(quick).toHaveAttribute('aria-expanded','true',{timeout:5000});
  await expect(pvp).toBeVisible({timeout:5000});

  const started=Date.now();
  await pvp.click();
  await page.waitForFunction(()=>window.KELO_MODULE_LOADER?.isReady?.('pvp')&&window.KeloPvPWorld&&typeof window.enterPvPWorld==='function'&&window.KELO_PVP_COMBAT_LOADER_AUDIT?.ready===true,{timeout:35000});
  await page.waitForFunction(()=>window.KeloPvPWorld?.state?.mode==='pvp'&&window.KeloPvPWorld?.state?.combatEnabled===true,{timeout:20000});

  const after=await page.evaluate(()=>({
    mode:window.KeloPvPWorld.state.mode,
    combatEnabled:window.KeloPvPWorld.state.combatEnabled,
    needs:window.KELO_MODULE_LOADER.needs('pvp'),
    ready:window.KELO_MODULE_LOADER.isReady('pvp'),
    loader:window.KELO_MODULE_LOADER.diagnostics(),
    combatLoader:window.KELO_PVP_COMBAT_LOADER_AUDIT?{
      ready:window.KELO_PVP_COMBAT_LOADER_AUDIT.ready,
      combatReady:window.KELO_PVP_COMBAT_LOADER_AUDIT.combatReady,
      predictionReady:window.KELO_PVP_COMBAT_LOADER_AUDIT.predictionReady
    }:null
  }));

  console.log('PVP_LIVE_PAGES_SMOKE',JSON.stringify({before,after,firstUseMs:Date.now()-started},null,2));
  expect(after.mode).toBe('pvp');
  expect(after.combatEnabled).toBe(true);
  expect(after.needs).toBe(false);
  expect(after.ready).toBe(true);
  expect(after.combatLoader?.ready).toBe(true);
  expect(after.loader?.failures||{}).toEqual({});
}

test('GitHub Pages LIVE: iPhone visible PVP button enters PvP on first use',async({browser})=>{
  const context=await browser.newContext({
    viewport:{width:390,height:844},
    deviceScaleFactor:2,
    isMobile:true,
    hasTouch:true,
    userAgent:IPHONE_UA,
    serviceWorkers:'block'
  });
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error?.message||error)));

  const published=await openPublishedRuntime(page);
  console.log('PVP_LIVE_PUBLISHED_RUNTIME',JSON.stringify(published));
  await enterPvpThroughRealControls(page);

  // Keep unrelated network/backend availability observable without confusing it with the UI/runtime contract.
  console.log('PVP_LIVE_PAGE_ERRORS',JSON.stringify(pageErrors));
  await context.close();
});
