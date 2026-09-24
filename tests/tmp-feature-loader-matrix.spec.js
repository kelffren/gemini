const { test, expect } = require('@playwright/test');

const cases=[
  {feature:'mounts',surfaces:['KeloMounts','KeloMountPanel']},
  {feature:'bag',surfaces:['KeloBackpack','KeloBackpackUI']},
  {feature:'market',surfaces:['KeloMarketEscrow','KeloMarketUI']},
  {feature:'titles',surfaces:['KeloTitles']},
  {feature:'appearance',surfaces:['KeloCharacterCustomization','KeloCharacterCustomizer']},
  {feature:'guardian',surfaces:['KeloGuardian']},
  {feature:'social',surfaces:['KeloNobility']},
];

for(const row of cases){
  test(`lazy feature ${row.feature} exposes its runtime surfaces`,async({page})=>{
    test.setTimeout(90000);
    const errors=[];
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(`./?featureLoaderMatrix=${encodeURIComponent(row.feature)}`,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>!!window.KELO_MODULE_LOADER,null,{timeout:30000});
    const result=await page.evaluate(async({feature,surfaces})=>{
      let ok=false,error=null;
      try{ok=await window.KELO_MODULE_LOADER.ensure(feature);}catch(e){error=String(e?.message||e);}
      await new Promise(r=>setTimeout(r,250));
      return {
        feature,ok,error,
        surfaces:Object.fromEntries(surfaces.map(name=>[name,!!window[name]])),
        loaded:window.KELO_MODULE_LOADER.diagnostics?.().loaded||[]
      };
    },row);
    console.log('[FEATURE_LOADER_MATRIX]',JSON.stringify({result,errors}));
    expect(result.ok).toBe(true);
    for(const name of row.surfaces)expect(result.surfaces[name],`${row.feature} missing ${name}`).toBe(true);
  });
}