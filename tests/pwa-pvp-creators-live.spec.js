/* KELO-INDEX
 * area: TEST / PWA / PVP / CREATORS
 * owner: Main Stability validation only
 * keys: IPHONE PWA SERVICEWORKER CREATORS PVP FIRST-USE LIVE-BUILD QUICK-ACTIONS
 * purpose: reproduce an installed iPhone-like session with an active service worker and verify real visible UI entry into Creators and PvP on the same page.
 * do-not: NO direct KeloCreatorsLazyGate.open, NO direct enterPvPWorld, NO force click
 */
const {test,expect}=require('@playwright/test');

const BASE=process.env.KELO_PAGES||'http://127.0.0.1:4173/';
const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1';
const FAKE_BUILD='abcdef0123456789abcdef0123456789abcdef01';

async function bootInstalledLikePwa(browser){
  const context=await browser.newContext({
    viewport:{width:390,height:844},
    deviceScaleFactor:2,
    isMobile:true,
    hasTouch:true,
    userAgent:IPHONE_UA,
    serviceWorkers:'allow'
  });
  await context.route('**/version.json*',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({sha:FAKE_BUILD,builtAt:new Date().toISOString(),source:'pwa-e2e'})
  }));
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error?.message||error)));
  const url=new URL(BASE);url.searchParams.set('guest','1');url.searchParams.set('pwaE2E','1');
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.KELO_MODULE_LOADER&&window.KELO_LUXE&&document.getElementById('kw-quick-actions-toggle')&&document.getElementById('lx-side-menu')&&document.getElementById('lx-side-pvp'),{timeout:25000});

  await page.evaluate(async()=>{
    const reg=await navigator.serviceWorker.register('./sw.js');
    await reg.update().catch(()=>{});
    await navigator.serviceWorker.ready;
  });
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller)){
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:15000});
    await page.waitForFunction(()=>window.KELO_MODULE_LOADER&&window.KELO_LUXE&&document.getElementById('kw-quick-actions-toggle'),{timeout:25000});
  }
  return {context,page,errors};
}

async function openQuickActions(page){
  const quick=page.locator('#kw-quick-actions-toggle');
  await expect(quick).toBeVisible({timeout:10000});
  if(await quick.getAttribute('aria-expanded')!=='true')await quick.click();
  await expect(quick).toHaveAttribute('aria-expanded','true',{timeout:5000});
}

async function openCreatorsThroughUi(page){
  await openQuickActions(page);
  await expect(page.locator('#lx-side-menu')).toBeVisible({timeout:5000});
  await page.locator('#lx-side-menu').click();
  await expect(page.locator('#lx-menu-panel')).toHaveClass(/open/,{timeout:5000});
  await expect(page.locator('#lx-create-studio')).toBeVisible({timeout:10000});
  await page.locator('#lx-create-studio').click();
  await expect(page.locator('#kelo-creators-hub')).toBeVisible({timeout:35000});
  await page.waitForFunction(()=>window.KeloPWAFreshness?.build&&window.KELO_STUDIO_LAUNCHER,{timeout:10000});
  const state=await page.evaluate(()=>({
    build:window.KeloPWAFreshness?.build||null,
    gate:window.KeloCreatorsLazyGate?.version||null,
    launcher:window.KELO_STUDIO_LAUNCHER?.version||null,
    launcherBuild:document.querySelector('script[data-kelo-creators-first-use="1"]')?.dataset?.keloLiveBuild||null,
    hubVisible:!!document.getElementById('kelo-creators-hub')&&getComputedStyle(document.getElementById('kelo-creators-hub')).display!=='none'
  }));
  expect(state.build).toBe(FAKE_BUILD);
  expect(state.launcherBuild).toBe(FAKE_BUILD.slice(0,16));
  expect(state.hubVisible).toBe(true);
  await page.locator('#kelo-creators-hub .kc-close').click();
  await expect(page.locator('#kelo-creators-hub')).toHaveCount(0,{timeout:10000});
  return state;
}

async function enterPvpThroughUi(page){
  await openQuickActions(page);
  await expect(page.locator('#lx-side-pvp')).toBeVisible({timeout:10000});
  await page.locator('#lx-side-pvp').click();
  await page.waitForFunction(()=>window.KELO_MODULE_LOADER?.isReady?.('pvp')&&window.KeloPvPWorld?.state?.mode==='pvp'&&window.KeloPvPWorld?.state?.combatEnabled===true,{timeout:50000});
  return page.evaluate(()=>({
    build:window.KeloPWAFreshness?.build||null,
    mode:window.KeloPvPWorld?.state?.mode||null,
    combatEnabled:window.KeloPvPWorld?.state?.combatEnabled===true,
    loader:window.KELO_MODULE_LOADER?.diagnostics?.()||null,
    runtime:window.KELO_RUNTIME_BOOTSTRAP_AUDIT||null,
    tagged:Array.from(document.scripts).filter(s=>s.dataset?.keloLiveBuild).map(s=>({src:s.src,build:s.dataset.keloLiveBuild}))
  }));
}

test('installed-like iPhone PWA opens Creators and PvP with active service worker',async({browser})=>{
  test.setTimeout(120000);
  const {context,page,errors}=await bootInstalledLikePwa(browser);
  const creators=await openCreatorsThroughUi(page);
  const pvp=await enterPvpThroughUi(page);

  expect(creators.build).toBe(FAKE_BUILD);
  expect(pvp.build).toBe(FAKE_BUILD);
  expect(pvp.mode).toBe('pvp');
  expect(pvp.combatEnabled).toBe(true);
  expect(pvp.loader?.pvpReady).toBe(true);
  expect(pvp.loader?.failures||{}).toEqual({});
  expect(pvp.runtime?.ready).toBe(true);
  expect(pvp.runtime?.liveBuild).toBe(FAKE_BUILD.slice(0,16));
  expect(pvp.tagged.some(x=>x.build===FAKE_BUILD.slice(0,16)&&/pvp|guardian|abilit|engine-net/.test(x.src))).toBe(true);

  console.log('PWA_PVP_CREATORS_STATE',JSON.stringify({creators,pvp,pageErrors:errors},null,2));
  await context.close();
});
