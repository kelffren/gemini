const { test, expect } = require('@playwright/test');

test('mounts lazy feature boots its runtime and starter state',async({page})=>{
  test.setTimeout(90000);
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('./?guest=1&mountsLazyAudit=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_MODULE_LOADER,null,{timeout:30000});
  const result=await page.evaluate(async()=>{
    const ok=await window.KELO_MODULE_LOADER.ensure('mounts');
    const defs=window.KeloMountCatalog?.list?.()||[];
    const first=defs[0]||null;
    const snapshot=window.KeloMounts?.snapshot?.()||null;
    const stats=first?window.KeloMounts?.getMountStats?.(first.id)||null:null;
    return {
      ok,
      statsApi:!!window.KeloStats,
      catalog:!!window.KeloMountCatalog,
      equipmentCatalog:!!window.KeloMountEquipmentCatalog,
      runtime:!!window.KeloMounts,
      panel:!!window.KeloMountPanel,
      count:defs.length,
      firstId:first?.id||null,
      snapshot,
      stats,
      loaded:window.KELO_MODULE_LOADER.diagnostics?.().loaded||[]
    };
  });
  console.log('[MOUNTS_LAZY_FIX]',JSON.stringify({result,errors}));
  expect(result.ok).toBe(true);
  expect(result.statsApi).toBe(true);
  expect(result.catalog).toBe(true);
  expect(result.equipmentCatalog).toBe(true);
  expect(result.runtime).toBe(true);
  expect(result.panel).toBe(true);
  expect(result.count).toBeGreaterThan(0);
  expect(result.snapshot).toBeTruthy();
  expect(result.stats).toBeTruthy();
  expect(errors.filter(e=>/KeloMounts missing catalog\/stats dependency/i.test(e))).toEqual([]);
});