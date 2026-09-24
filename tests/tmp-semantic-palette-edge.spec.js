const { test, expect } = require('@playwright/test');

function fixtureSource(){
  return `
    const prefabStore=new Map();
    const toolStore=new Map();
    const makeCatalog=rows=>({list:()=>rows});
    const makeSession=rows=>{
      const prefabs={
        has:id=>prefabStore.has(String(id)),
        register:p=>{prefabStore.set(String(p.id),p);return p;},
        resolve:id=>prefabStore.get(String(id))||null,
        size:()=>prefabStore.size
      };
      const kernel={
        prefabs,
        document:{navigation:{collisions:{}},zones:[],settings:{tileSize:16}},
        spatial:{queryRect:()=>[]},
        input:{register:()=>()=>{},push:()=>{},pop:()=>{}},
        tools:{register:t=>{toolStore.set(t.id,t);return t;},get:id=>toolStore.get(id)||null},
        selection:{set:()=>{}},
        execute:async()=>true
      };
      return {studio:{kernel,tools:{},adapter:{assetCatalog:makeCatalog(rows)}},snapSize:16,setMode:()=>{}};
    };
    window.__makeSemanticSession=makeSession;
  `;
}

test.beforeEach(async({page})=>{
  await page.goto('./',{waitUntil:'domcontentloaded'});
  await page.evaluate(src=>{(0,eval)(src)},fixtureSource());
});

test('refresh hot-swaps palette and keeps active brush state',async({page})=>{
  const result=await page.evaluate(async()=>{
    const bridge=await import('./src/studio/integration/library-build-bridge.mjs?v=semantic-edge-test');
    const seeder=await import('./src/studio/adapters/catalog-prefab-seeder.mjs?v=semantic-edge-test');
    const rows=[
      {id:'personal:a:1',sourceId:'a',placeable:true,label:'A1',width:32,height:32,category:'nature'},
      {id:'personal:a:2',sourceId:'a',placeable:true,label:'A2',width:32,height:32,category:'nature'},
      {id:'personal:b:1',sourceId:'b',placeable:true,label:'B1',width:32,height:32,category:'nature'},
      {id:'personal:b:2',sourceId:'b',placeable:true,label:'B2',width:32,height:32,category:'nature'}
    ];
    const session=window.__makeSemanticSession(rows);
    seeder.seedCatalogPrefabs({prefabRegistry:session.studio.kernel.prefabs,assetCatalog:session.studio.adapter.assetCatalog});
    const tool=await bridge.ensureLibraryPaletteBrush(session,{root:window});
    tool.configurePalette(rows.slice(0,2),{activate:true,smartContext:false,avoidOverlap:false,minSpacing:0,radius:0,snap:1});
    const before={active:tool.state().active,palette:tool.getPalette().map(x=>x.id)};
    const refreshed=await bridge.refreshPersonalAssetPalette({root:window,session,assetIds:['b']});
    const after={active:tool.state().active,palette:tool.getPalette().map(x=>x.id),previewCount:tool.state().previewCount,refreshed};
    return{before,after};
  });
  console.log('[SEMANTIC_HOTSWAP]',JSON.stringify(result));
  expect(result.before.active).toBe(true);
  expect(result.after.active).toBe(true);
  expect(result.after.palette).toEqual(['personal:b:1','personal:b:2']);
});

test('refresh with only one available template does not destroy current palette',async({page})=>{
  const result=await page.evaluate(async()=>{
    const bridge=await import('./src/studio/integration/library-build-bridge.mjs?v=semantic-edge-test');
    const seeder=await import('./src/studio/adapters/catalog-prefab-seeder.mjs?v=semantic-edge-test');
    const rows=[
      {id:'personal:a:1',sourceId:'a',placeable:true,label:'A1',width:32,height:32,category:'nature'},
      {id:'personal:a:2',sourceId:'a',placeable:true,label:'A2',width:32,height:32,category:'nature'},
      {id:'personal:solo:1',sourceId:'solo',placeable:true,label:'Solo',width:32,height:32,category:'nature'}
    ];
    const session=window.__makeSemanticSession(rows);
    seeder.seedCatalogPrefabs({prefabRegistry:session.studio.kernel.prefabs,assetCatalog:session.studio.adapter.assetCatalog});
    const tool=await bridge.ensureLibraryPaletteBrush(session,{root:window});
    tool.configurePalette(rows.slice(0,2),{activate:true,smartContext:false,avoidOverlap:false,minSpacing:0,radius:0,snap:1});
    const before=tool.getPalette().map(x=>x.id);
    let error=null,out=null;
    try{out=await bridge.refreshPersonalAssetPalette({root:window,session,assetIds:['solo']});}
    catch(e){error=String(e?.message||e);}
    return{before,after:tool.getPalette().map(x=>x.id),active:tool.state().active,error,out};
  });
  console.log('[SEMANTIC_SINGLE_VARIANT]',JSON.stringify(result));
  expect(result.error).toBeNull();
  expect(result.active).toBe(true);
  expect(result.after).toEqual(result.before);
});