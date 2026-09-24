const { test, expect } = require('@playwright/test');

test('appearance lazy feature boots schema runtime and UI',async({page})=>{
  test.setTimeout(90000);
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('./?guest=1&appearanceLazyAudit=1',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.KELO_MODULE_LOADER,null,{timeout:30000});
  const result=await page.evaluate(async()=>{
    const ok=await window.KELO_MODULE_LOADER.ensure('appearance');
    const api=window.KeloCharacterCustomization;
    const state=api?.getState?.()||null;
    return {
      ok,
      schema:!!window.KeloCharacterSlotSchema,
      runtime:!!api,
      ui:!!window.KeloCharacterCustomizer,
      slots:Array.isArray(api?.slots)?api.slots.length:0,
      state,
      canUndo:api?.canUndo?.()??null,
      loaded:window.KELO_MODULE_LOADER.diagnostics?.().loaded||[]
    };
  });
  console.log('[APPEARANCE_LAZY_FIX]',JSON.stringify({result,errors}));
  expect(result.ok).toBe(true);
  expect(result.schema).toBe(true);
  expect(result.runtime).toBe(true);
  expect(result.ui).toBe(true);
  expect(result.slots).toBeGreaterThan(0);
  expect(result.state).toBeTruthy();
  expect(errors.filter(e=>/CHARACTER_SLOT_SCHEMA_NOT_LOADED/i.test(e))).toEqual([]);
});