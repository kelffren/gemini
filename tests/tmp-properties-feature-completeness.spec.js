const { test, expect } = require('@playwright/test');

test('properties feature installs every declared runtime surface', async ({ page }) => {
  test.setTimeout(90000);
  const errors=[];
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.goto('./?guest=1&propertiesFeatureAudit=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_MODULE_LOADER,null,{timeout:30000});
  const result=await page.evaluate(async()=>{
    const ok=await window.KELO_MODULE_LOADER.ensure('properties');
    return {
      ok,
      propertySystem:!!window.KELO_PROPERTY_SYSTEM?.request,
      instances:!!window.KELO_INSTANCES,
      houseAuthority:!!window.KELO_HOUSE_AUTHORITY,
      houses:!!window.KELO_HOUSES,
      houseUi:!!window.KELO_HOUSE_UI,
      loader:window.KELO_MODULE_LOADER.diagnostics?.()
    };
  });
  console.log('[PROPERTIES_FEATURE_AUDIT]',JSON.stringify({result,errors}));
  expect(result.ok).toBe(true);
  expect(result.propertySystem).toBe(true);
  expect(result.houseUi).toBe(true);
});
