/* KELO-INDEX
 * area: TEST / PERFORMANCE / 4G BOOT
 * owner: 4G Progressive Boot Gate
 * keys: IPHONE 4G PLAYABLE FIRST STAGES GAME LOOP SERVICES
 * purpose: prove the game loop becomes playable after the visual minimum while world/UI/services are still progressive.
 */
const { test, expect } = require('@playwright/test');

const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const BASE_URL=process.env.KELO_PAGES||'http://127.0.0.1:4173/';

test('4G profile releases playable core before world, UI and services complete',async({browser})=>{
  const page=await browser.newPage({
    baseURL:BASE_URL,
    viewport:{width:390,height:844},
    deviceScaleFactor:2,
    isMobile:true,
    hasTouch:true,
    userAgent:IPHONE_UA
  });

  await page.addInitScript(()=>{
    window.__KELO_4G_PLAYABLE_SNAPSHOT__=null;
    addEventListener('kelo:progressive-boot:playable',()=>{
      const s=window.KELO_PROGRESSIVE_BOOT?.getState?.();
      window.__KELO_4G_PLAYABLE_SNAPSHOT__={
        gameLoopStarted:window.__keloGameLoopStarted===true,
        bootReady:window.__keloBootReady===true,
        status:s?.status||null,
        loadedStages:Array.isArray(s?.loadedStages)?s.loadedStages.slice():[],
        profile:s?.profile||null,
        playableMs:s?.playableMs??null
      };
    },{once:true});
  });

  const response=await page.goto('./?guest=1&keloNetwork=4g&progressiveBootTest=1',{
    waitUntil:'domcontentloaded',
    timeout:45000
  });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  await page.waitForFunction(()=>window.__KELO_4G_PLAYABLE_SNAPSHOT__!==null,null,{timeout:20000});
  const playable=await page.evaluate(()=>window.__KELO_4G_PLAYABLE_SNAPSHOT__);

  expect(playable.bootReady).toBe(true);
  expect(playable.gameLoopStarted).toBe(true);
  expect(playable.loadedStages).toEqual(['visual']);
  expect(playable.profile.tier).toBe('4g');
  expect(playable.profile.lookahead).toBeGreaterThanOrEqual(3);
  expect(playable.playableMs).toBeGreaterThanOrEqual(0);

  await page.waitForFunction(()=>{
    const s=window.KELO_PROGRESSIVE_BOOT?.getState?.();
    return s?.status==='complete'&&window.KELO_MODULE_LOADER&&window.KeloUpdateGate;
  },null,{timeout:45000});

  const complete=await page.evaluate(()=>{
    const s=window.KELO_PROGRESSIVE_BOOT.getState();
    return {
      status:s.status,
      loadedStages:s.loadedStages,
      failures:s.failures,
      retryCount:s.retryCount,
      fileCount:s.files.length,
      playableMs:s.playableMs,
      completeMs:s.completeMs,
      moduleLoader:window.KELO_MODULE_LOADER?.version||null,
      updateGate:window.KeloUpdateGate?.getState?.().version||null
    };
  });

  expect(complete.status).toBe('complete');
  expect(complete.loadedStages).toEqual(['visual','legacy','environment','ui','services']);
  expect(complete.failures).toEqual([]);
  expect(complete.fileCount).toBeGreaterThan(40);
  expect(complete.completeMs).toBeGreaterThanOrEqual(complete.playableMs);
  expect(complete.moduleLoader).toBeTruthy();
  expect(complete.updateGate).toBeTruthy();

  await page.screenshot({path:'test-results/4g-progressive-boot-pass.png',fullPage:true});
  await page.close();
});
