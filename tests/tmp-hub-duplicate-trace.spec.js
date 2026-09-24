const { test, devices } = require('@playwright/test');
const iphone=devices['iPhone 13'];
test.use({userAgent:iphone.userAgent,viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:iphone.deviceScaleFactor,isMobile:true,hasTouch:true});

function snap(){
  return {
    hubs:[...document.querySelectorAll('#kelo-creators-hub')].map(el=>({
      seq:el.dataset.keloHubSeq||null,
      module:el.dataset.keloHubModule||null,
      display:getComputedStyle(el).display,
      connected:el.isConnected
    })),
    shared:window.__KELO_CREATOR_HUB_SINGLETON_V1__?.hub?.dataset?.keloHubSeq||null,
    opening:!!window.__KELO_CREATOR_HUB_OPENING_V1__,
    resources:performance.getEntriesByType('resource').map(x=>x.name).filter(x=>x.includes('creator-hub.mjs')),
    scripts:[...document.scripts].map(s=>s.src).filter(Boolean).filter(s=>s.includes('studio-launcher')||s.includes('creators-lazy-gate')),
    bodyClass:document.body.className
  };
}

test('trace creator hub duplication',async({page})=>{
  test.setTimeout(120000);
  await page.goto('./?mapEditor=1&hubDupTrace=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_ADMIN_KEYS,null,{timeout:30000});
  await page.waitForTimeout(1500);
  const before=await page.evaluate(snap);

  await page.evaluate(async()=>{
    const mod=await import('./src/creators/ui/creator-hub.mjs?v=world-editor-20260924-2');
    await mod.openCreatorHub({root:window});
  });
  await page.waitForTimeout(300);
  const afterOpen=await page.evaluate(snap);

  const hubs=page.locator('#kelo-creators-hub');
  const world=hubs.last().locator('[data-workspace="world"]');
  if(await world.count()){
    await world.dispatchEvent('pointerup',{pointerType:'touch',isPrimary:true,button:0});
    const studio=page.locator('#kelo-studio-live');
    await studio.waitFor({state:'visible',timeout:20000}).catch(()=>{});
    await page.waitForFunction(()=>document.getElementById('kelo-studio-live')?.dataset?.keloWorldLoading!=='1',null,{timeout:50000}).catch(()=>{});
    await page.waitForTimeout(1200);
  }
  const afterWorld=await page.evaluate(snap);
  throw new Error('HUB_DUP_TRACE '+JSON.stringify({before,afterOpen,afterWorld}));
});