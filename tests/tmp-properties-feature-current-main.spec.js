const { test, expect } = require('@playwright/test');
test('properties feature installs complete declared runtime',async({page})=>{
  test.setTimeout(90000);
  await page.goto('./?guest=1&propertiesAudit=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_MODULE_LOADER,null,{timeout:30000});
  const result=await page.evaluate(async()=>{
    const ok=await window.KELO_MODULE_LOADER.ensure('properties');
    return {
      ok,
      propertySystem:!!window.KELO_PROPERTY_SYSTEM?.request,
      instances:!!window.KELO_INSTANCES,
      houses:!!window.KELO_HOUSES,
      houseUi:!!window.KELO_HOUSE_UI,
      diagnostics:window.KELO_MODULE_LOADER.diagnostics?.()
    };
  });
  console.log('[PROPERTIES_COMPLETE]',JSON.stringify(result));
  expect(result.ok).toBe(true);
  expect(result.propertySystem).toBe(true);
  expect(result.instances).toBe(true);
  expect(result.houseUi).toBe(true);
});