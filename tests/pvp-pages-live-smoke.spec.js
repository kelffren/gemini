/* KELO-INDEX
 * area: TEST / PVP / PAGES
 * owner: Playwright validation only
 * keys: PVP PAGES LIVE QUICK-ACTIONS FIRST-USE MOBILE IPHONE LAZY-LOAD
 * purpose: valida la ruta real visible Quick Actions -> PVP contra servidor local en PR y contra GitHub Pages después del deploy
 * do-not: NO force click, NO llamada directa a enterPvPWorld, NO mutar gameplay
 */
const {test,expect}=require('@playwright/test');

const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const TARGET=process.env.KELO_PVP_TEST_URL||'http://127.0.0.1:4173/?guest=1&pvpPagesSmoke=local';

test('visible Quick Actions -> PVP first-use smoke',async({browser})=>{
  const errors=[];
  const page=await browser.newPage({
    viewport:{width:390,height:844},
    deviceScaleFactor:2,
    isMobile:true,
    hasTouch:true,
    userAgent:IPHONE_UA
  });
  page.on('pageerror',e=>errors.push(String(e&&e.message||e)));
  await page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!(
    document.documentElement.dataset.keloGuestPlay==='1'&&
    typeof localPlayer!=='undefined'&&localPlayer&&
    window.KELO_MODULE_LOADER&&
    document.getElementById('game-canvas')&&
    document.getElementById('kw-quick-actions-toggle')&&
    document.getElementById('lx-side-pvp')
  ),{timeout:30000});

  await expect(page.locator('#kelo-account-auth')).toBeHidden({timeout:15000});
  await expect(page.locator('#game-canvas')).toBeVisible({timeout:15000});
  const quick=page.locator('#kw-quick-actions-toggle');
  await expect(quick).toBeVisible({timeout:15000});
  await quick.click();
  await expect(quick).toHaveAttribute('aria-expanded','true',{timeout:5000});

  const pvp=page.locator('#lx-side-pvp');
  await expect(pvp).toBeVisible({timeout:5000});
  const before=await page.evaluate(()=>({
    needs:window.KELO_MODULE_LOADER.needs('pvp'),
    ready:window.KELO_MODULE_LOADER.isReady('pvp'),
    version:window.KELO_MODULE_LOADER.version,
    guest:document.documentElement.dataset.keloGuestPlay||null
  }));
  expect(before.guest).toBe('1');
  expect(before.needs).toBe(true);
  expect(before.ready).toBe(false);

  await pvp.click();
  await page.waitForFunction(()=>!!(
    window.KELO_MODULE_LOADER?.isReady?.('pvp')&&
    window.KeloPvPWorld&&
    typeof window.enterPvPWorld==='function'&&
    window.KELO_PVP_COMBAT_LOADER_AUDIT?.ready===true&&
    window.KeloPvPWorld.state?.mode==='pvp'&&
    window.KeloPvPWorld.state?.combatEnabled===true
  ),{timeout:30000});

  const after=await page.evaluate(()=>({
    needs:window.KELO_MODULE_LOADER.needs('pvp'),
    ready:window.KELO_MODULE_LOADER.isReady('pvp'),
    mode:window.KeloPvPWorld.state.mode,
    combatEnabled:window.KeloPvPWorld.state.combatEnabled,
    diagnostics:window.KELO_MODULE_LOADER.diagnostics(),
    combatLoader:{
      ready:window.KELO_PVP_COMBAT_LOADER_AUDIT?.ready===true,
      combatReady:window.KELO_PVP_COMBAT_LOADER_AUDIT?.combatReady===true,
      predictionReady:window.KELO_PVP_COMBAT_LOADER_AUDIT?.predictionReady===true
    }
  }));
  console.log('PVP_PAGES_LIVE_SMOKE',JSON.stringify({target:TARGET,before,after,errors},null,2));
  expect(errors).toEqual([]);
  expect(after.needs).toBe(false);
  expect(after.ready).toBe(true);
  expect(after.mode).toBe('pvp');
  expect(after.combatEnabled).toBe(true);
  expect(after.combatLoader.ready).toBe(true);
  expect(after.combatLoader.combatReady).toBe(true);
  expect(after.combatLoader.predictionReady).toBe(true);
  await page.close();
});
