const { test, expect, devices } = require('@playwright/test');
const iphone=devices['iPhone 13'];
test.use({userAgent:iphone.userAgent,viewport:{width:390,height:844},screen:{width:390,height:844},deviceScaleFactor:iphone.deviceScaleFactor,isMobile:true,hasTouch:true});

test('asset vault restored page boots and renders library shell',async({page})=>{
  test.setTimeout(90000);
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.stack||e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const response=await page.goto('./asset-vault.html',{waitUntil:'domcontentloaded',timeout:30000});
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/Biblioteca Universal de Contenido/i);
  await expect(page.locator('#search')).toBeVisible();
  await expect(page.locator('#provider-filters')).toBeVisible();
  await expect(page.locator('#explore-grid')).toBeVisible();
  await expect(page.locator('#runtime')).toBeVisible();
  await page.waitForTimeout(1800);
  const state=await page.evaluate(()=>({
    bodyText:document.body.innerText.slice(0,220),
    providerButtons:document.querySelectorAll('#provider-filters button').length,
    cards:document.querySelectorAll('#explore-grid .card').length,
    seeLocal:document.body.innerText.trim()==='SEE_LOCAL'
  }));
  console.log('[ASSET_VAULT_RESTORE]',JSON.stringify({state,errors}));
  expect(state.seeLocal).toBe(false);
  expect(state.providerButtons).toBeGreaterThan(0);
  const unexpected=errors.filter(e=>!/ambientcg\.com|blocked by CORS policy|Failed to load resource: net::ERR_FAILED|Failed to fetch|network/i.test(e));
  expect(unexpected).toEqual([]);
});