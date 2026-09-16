/* KELO-INDEX
 * area: TEST / MAIN STABILITY / MOBILE
 * owner: Main Stability Gate
 * keys: MOBILE IPHONE-UA TOUCH BOOT GUEST MOVEMENT RUNTIME SMOKE PR-BYTES FREEZE 8S EVALUATE-LATENCY
 * purpose: unskippable CI smoke for the exact PR bytes using an iPhone-sized touch context and the mandatory sustained-walk freeze firewall
 * do-not: NO BrowserStack-only skip, NO LIVE hardcode, NO direct mutation that bypasses human input for movement, NO short movement-only proof
 */
const { test, expect } = require('@playwright/test');

const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const BASE_URL=process.env.KELO_PAGES||'http://127.0.0.1:4173/';
const SUSTAINED_WALK_MS=8000;
const EVALUATE_BUDGET_MS=400;

async function position(page){
  return page.evaluate(()=>({
    x:Number(localPlayer.x),
    y:Number(localPlayer.y),
    vx:Number(localPlayer.vx),
    vy:Number(localPlayer.vy),
    touchActive:!!input.touchActive
  }));
}

async function sampledPosition(page){
  const started=Date.now();
  const value=await position(page);
  return {value,latencyMs:Date.now()-started};
}

async function touchMoveRightForEightSeconds(page){
  const canvas=page.locator('#game-canvas');
  const box=await canvas.boundingBox();
  expect(box).not.toBeNull();
  const sx=Math.max(34,box.width*.20);
  const sy=Math.min(box.height-100,box.height*.68);
  const ex=Math.min(sx+92,box.width*.49);
  const pointerId=701;
  await canvas.dispatchEvent('pointerdown',{pointerId,pointerType:'touch',isPrimary:true,clientX:sx,clientY:sy,buttons:1,button:0,pressure:.5,bubbles:true,cancelable:true});
  for(let i=1;i<=6;i++){
    await canvas.dispatchEvent('pointermove',{pointerId,pointerType:'touch',isPrimary:true,clientX:sx+(ex-sx)*i/6,clientY:sy,buttons:1,button:0,pressure:.5,bubbles:true,cancelable:true});
    await page.waitForTimeout(35);
  }

  const started=Date.now();
  const samples=[];
  while(Date.now()-started<SUSTAINED_WALK_MS){
    await page.waitForTimeout(500);
    await canvas.dispatchEvent('pointermove',{pointerId,pointerType:'touch',isPrimary:true,clientX:ex,clientY:sy,buttons:1,button:0,pressure:.5,bubbles:true,cancelable:true});
    const sample=await sampledPosition(page);
    samples.push(sample);
    expect(sample.latencyMs).toBeLessThanOrEqual(EVALUATE_BUDGET_MS);
    expect(sample.value.touchActive).toBe(true);
  }

  const held=samples.at(-1)?.value||await position(page);
  await canvas.dispatchEvent('pointerup',{pointerId,pointerType:'touch',isPrimary:true,clientX:ex,clientY:sy,buttons:0,button:0,pressure:0,bubbles:true,cancelable:true});
  await page.waitForTimeout(150);
  return {held,samples,durationMs:Date.now()-started};
}

test('exact PR bytes boot and sustain 8s movement in iPhone-sized touch context',async({browser})=>{
  const page=await browser.newPage({baseURL:BASE_URL,viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:IPHONE_UA});
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error&&error.stack||error)));

  const response=await page.goto('./?guest=1&mainStability=1',{waitUntil:'domcontentloaded',timeout:45000});
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  await page.waitForFunction(()=>!!(
    window.__keloBootReady===true &&
    document.documentElement.dataset.keloGuestPlay==='1' &&
    document.getElementById('game-canvas') &&
    typeof localPlayer!=='undefined' &&
    typeof input!=='undefined' &&
    window.KELO_MODULE_LOADER &&
    window.KeloUpdateGate
  ),null,{timeout:30000});

  await expect(page.locator('#game-canvas')).toBeVisible({timeout:10000});
  await expect(page.locator('#kelo-account-auth')).toBeHidden({timeout:10000});

  const before=await position(page);
  const walk=await touchMoveRightForEightSeconds(page);
  const after=await position(page);
  const moved=Math.hypot(walk.held.x-before.x,walk.held.y-before.y);
  const maxEvaluateLatency=Math.max(...walk.samples.map(sample=>sample.latencyMs));

  expect(walk.durationMs).toBeGreaterThanOrEqual(SUSTAINED_WALK_MS);
  expect(walk.samples.length).toBeGreaterThanOrEqual(8);
  expect(moved).toBeGreaterThan(8);
  expect(walk.held.touchActive).toBe(true);
  expect(after.touchActive).toBe(false);
  expect(maxEvaluateLatency).toBeLessThanOrEqual(EVALUATE_BUDGET_MS);
  expect(pageErrors).toEqual([]);

  const runtime=await page.evaluate(()=>({
    bootReady:window.__keloBootReady===true,
    guest:document.documentElement.dataset.keloGuestPlay,
    moduleLoader:window.KELO_MODULE_LOADER?.version||null,
    updateGate:window.KeloUpdateGate?.getState?.().version||null,
    width:innerWidth,
    height:innerHeight,
    touchPoints:navigator.maxTouchPoints,
    ua:navigator.userAgent
  }));
  expect(runtime.bootReady).toBe(true);
  expect(runtime.guest).toBe('1');
  expect(runtime.moduleLoader).toBeTruthy();
  expect(runtime.updateGate).toBeTruthy();
  expect(runtime.width).toBeLessThanOrEqual(600);
  expect(runtime.ua).toMatch(/iPhone/i);

  await page.screenshot({path:'test-results/main-stability-mobile-pass.png',fullPage:true});
  await page.close();
});
