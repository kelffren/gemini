/* KELO-INDEX
 * area: QA / MOBILE WEBKIT
 * owner: Evergreen branch smoke
 * purpose: prueba el commit de la rama con WebKit móvil local sin confundirlo con BrowserStack real-device
 */
const { test, expect } = require('@playwright/test');

test('V6.69 evergreen branch boots plaza without uncaught errors', async ({ page }) => {
  const pageErrors=[];
  const consoleErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error&&error.message||error)));
  page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});

  await page.goto('/?guest=1',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#game-canvas')).toBeVisible();
  await page.waitForFunction(()=>window.__keloBootReady===true,{timeout:15000});

  const snapshot=await page.evaluate(()=>({
    bootReady:window.__keloBootReady===true,
    stateStore:window.KeloStateStore&&window.KeloStateStore.snapshot&&window.KeloStateStore.snapshot(),
    transitionBridge:window.KeloLegacyTransitionBridge&&window.KeloLegacyTransitionBridge.snapshot&&window.KeloLegacyTransitionBridge.snapshot(),
    camera:!!window.KeloCamera,
    position:!!window.KeloPlayerPosition,
    collision:!!window.KELO_COLLISION
  }));

  expect(snapshot.bootReady).toBe(true);
  expect(snapshot.stateStore).toBeTruthy();
  expect(snapshot.stateStore.schemaVersion).toBe(3);
  expect(snapshot.transitionBridge).toBeTruthy();
  expect(snapshot.transitionBridge.ownersReady).toBe(true);
  expect(snapshot.camera).toBe(true);
  expect(snapshot.position).toBe(true);
  expect(snapshot.collision).toBe(true);

  await page.waitForTimeout(1200);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter(text=>!/favicon/i.test(text))).toEqual([]);
});

test('legacy plot/farm travel is routed through modern position/camera owners', async ({ page }) => {
  await page.goto('/?guest=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__keloBootReady===true,{timeout:15000});

  const result=await page.evaluate(()=>{
    const before=window.KeloLegacyTransitionBridge.snapshot();
    const positionBefore=window.KeloPlayerPosition.snapshot();
    teleportToFarm();
    teleportToPlot();
    const after=window.KeloLegacyTransitionBridge.snapshot();
    const positionAfter=window.KeloPlayerPosition.snapshot();
    return {before,after,positionBefore,positionAfter};
  });

  expect(result.after.farmCalls-result.before.farmCalls).toBe(1);
  expect(result.after.plotCalls-result.before.plotCalls).toBe(1);
  expect(result.after.fallbackCalls-result.before.fallbackCalls).toBe(0);
  expect(result.positionAfter.transitions-result.positionBefore.transitions).toBe(2);
});
