const { test, expect, devices } = require('@playwright/test');
const iphone=devices['iPhone 13'];
test.use({userAgent:iphone.userAgent,viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:iphone.deviceScaleFactor,isMobile:true,hasTouch:true});

test('plaza runtime atlas URLs satisfy cache-token contract',async({page})=>{
  test.setTimeout(90000);
  const errors=[];
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('./?atlasTokenAudit=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_ATLAS_AUDIT,null,{timeout:30000});
  await page.waitForTimeout(2500);
  const state=await page.evaluate(()=>({
    violations:window.KELO_ATLAS_AUDIT?.violations||[],
    loaded:window.KELO_ATLAS_AUDIT?.loaded||[],
    version:window.KELO_ATLAS_AUDIT?.version||null
  }));
  const relevant=[...errors,...state.violations.map(v=>typeof v==='string'?v:JSON.stringify(v))]
    .filter(x=>/plazaNature|plazaRoundTree|plazaFountainKelo|missing versioned URL cache token/i.test(String(x)));
  console.log('[ATLAS_TOKEN_AUDIT]',JSON.stringify({state,relevant}));
  expect(relevant).toEqual([]);
});