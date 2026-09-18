/* KELO-INDEX
 * area: QA / EVERGREEN / RUNTIME COMPATIBILITY
 * owner: Evergreen Runtime Compatibility CI
 * keys: PLAYWRIGHT WEBKIT IOS FEATURE DETECTION FALLBACK
 * purpose: validate the real runtime capability and provider-adapter modules inside WebKit mobile profile
 * online: local static CI fixture only
 * do-not: NO production mutation, NO UA-based feature expectations
 */
const {test,expect}=require('@playwright/test');

test('WebKit mobile profile keeps Evergreen core compatible with explicit fallbacks',async({page})=>{
  await page.goto('/tests/evergreen-runtime-probe.html');
  await expect(page.locator('#status')).toHaveText('ready');
  const report=await page.evaluate(()=>window.__KELO_EVERGREEN_RUNTIME_PROBE__);

  expect(report.schemaVersion).toBe(1);
  expect(report.plan.compatible).toBe(true);
  expect(report.plan.mode).not.toBe('unsupported');
  expect(report.snapshot.byId['es-modules'].supported).toBe(true);
  expect(report.snapshot.byId.promise.supported).toBe(true);
  expect(report.snapshot.byId.url.supported).toBe(true);
  expect(report.snapshot.byId.fetch.supported).toBe(true);
  expect(report.snapshot.byId['canvas-2d'].supported).toBe(true);
  expect(report.selectedProvider).toBe('memory-fallback');
  expect(report.viewport.width).toBe(393);
  await page.evaluate(()=>{
    window.__KELO_TOUCH_PROBE__=0;
    window.addEventListener('touchstart',()=>{window.__KELO_TOUCH_PROBE__+=1;},{once:true});
  });
  await page.touchscreen.tap(24,24);
  expect(await page.evaluate(()=>window.__KELO_TOUCH_PROBE__)).toBe(1);
});
