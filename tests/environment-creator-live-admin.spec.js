/* KELO-INDEX
 * area: TEST / ENVIRONMENT / LIVE ADMIN
 * owner: Playwright production-path validation
 * purpose: authenticate with a dedicated admin test account, exercise real Supabase history/publish/realtime/undo, and restore the original world state
 * safety: changes only ambientDensity by one point; cleanup uses revision CAS and never overwrites a newer third-party world revision
 * secrets: credentials come only from KELO_E2E_ADMIN_EMAIL / KELO_E2E_ADMIN_PASSWORD; trace is disabled by workflow
 */
const {test,expect}=require('@playwright/test');

const LIVE_BASE=process.env.KELO_PAGES_URL||'https://kelffren.github.io/gemini/';
const ADMIN_EMAIL=String(process.env.KELO_E2E_ADMIN_EMAIL||'').trim();
const ADMIN_PASSWORD=String(process.env.KELO_E2E_ADMIN_PASSWORD||'');
const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function normalizeState(state={}){
  return {
    biome:state.biome,
    weather:state.weather,
    timeOfDay:state.timeOfDay,
    ambientDensity:Number(state.ambientDensity),
    musicMood:state.musicMood,
    accent:state.accent
  };
}

function liveUrl(client){
  const url=new URL(LIVE_BASE);
  url.searchParams.set('guest','1');
  url.searchParams.set('environmentLiveAdminE2E','1');
  url.searchParams.set('client',client);
  url.searchParams.set('_e2e',`${Date.now()}-${client}`);
  return url.toString();
}

async function newIPhoneContext(browser){
  return browser.newContext({
    viewport:{width:390,height:844},
    deviceScaleFactor:2,
    isMobile:true,
    hasTouch:true,
    userAgent:IPHONE_UA,
    serviceWorkers:'block'
  });
}

async function openLiveClient(page,client){
  const response=await page.goto(liveUrl(client),{waitUntil:'domcontentloaded',timeout:45000});
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(()=>window.KELO_WORLD_ENVIRONMENT_SYNC?.audit?.ready===true&&window.KELO_WORLD_ENVIRONMENT_SYNC?.revision>0&&window.KELO_ENVIRONMENT_RUNTIME?.revision>0,null,{timeout:45000});
  await page.waitForFunction(()=>window.KELO_WORLD_ENVIRONMENT_SYNC?.connected===true,null,{timeout:20000});
  return page.evaluate(()=>({
    syncVersion:window.KELO_WORLD_ENVIRONMENT_SYNC?.version||null,
    runtimeVersion:window.KELO_ENVIRONMENT_RUNTIME?.version||null,
    revision:window.KELO_WORLD_ENVIRONMENT_SYNC?.revision||0,
    state:window.KELO_WORLD_ENVIRONMENT_SYNC?.envelope?.state||null
  }));
}

async function installAdminBridge(page){
  return page.evaluate(async({email,password})=>{
    const sessionUrl=new URL('src/online/kelo-supabase-browser-session.mjs',document.baseURI).href;
    const bridgeUrl=new URL('src/creators/definition/creator-test-bridge.mjs',document.baseURI).href;
    const [{createKeloSupabaseBrowserSession},{installCreatorTestBridge}]=await Promise.all([import(sessionUrl),import(bridgeUrl)]);
    const session=createKeloSupabaseBrowserSession({root:window});
    await session.signInWithPassword(email,password);
    if(!session.accessToken)throw new Error('LIVE_E2E_AUTH_TOKEN_MISSING');
    const bridge=installCreatorTestBridge(window,{contentSession:{accessToken:session.accessToken}});
    window.__KELO_LIVE_ADMIN_SESSION=session;
    window.__KELO_LIVE_ADMIN_BRIDGE=bridge;
    const history=await bridge.history(5);
    return {bridgeVersion:bridge.version,historyCount:history.length,history};
  },{email:ADMIN_EMAIL,password:ADMIN_PASSWORD});
}

async function snapshot(page){
  return page.evaluate(()=>({
    revision:window.KELO_WORLD_ENVIRONMENT_SYNC?.revision||0,
    envelope:window.KELO_WORLD_ENVIRONMENT_SYNC?.envelope||null,
    runtimeRevision:window.KELO_ENVIRONMENT_RUNTIME?.revision||0,
    runtimeState:window.KELO_ENVIRONMENT_RUNTIME?.state||null,
    approved:window.KELO_ENVIRONMENT_RUNTIME?.approved||null,
    temporary:window.KELO_ENVIRONMENT_RUNTIME?.temporary===true
  }));
}

async function cleanupAdminClient(page,checkpoint){
  return page.evaluate(async cp=>{
    const sync=window.KELO_WORLD_ENVIRONMENT_SYNC;
    const bridge=window.__KELO_LIVE_ADMIN_BRIDGE;
    const session=window.__KELO_LIVE_ADMIN_SESSION;
    const normalize=state=>({biome:state?.biome,weather:state?.weather,timeOfDay:state?.timeOfDay,ambientDensity:Number(state?.ambientDensity),musicMood:state?.musicMood,accent:state?.accent});
    const same=(a,b)=>JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
    try{if(bridge?.active)bridge.restore?.('live-admin-e2e-finally');}catch{}
    let result={restored:false,conflict:false,revision:Number(sync?.revision||0)};
    try{
      if(sync&&session?.accessToken&&cp.initialRevision>0){
        await sync.refresh({source:'live-admin-e2e-finally'});
        const currentRevision=Number(sync.revision||0),currentState=sync.envelope?.state||null;
        if(!same(currentState,cp.initialState)){
          if(cp.publishedRevision>0&&currentRevision===cp.publishedRevision){
            await sync.rollback(cp.initialRevision,{accessToken:session.accessToken,expectedRevision:currentRevision,source:'live-admin-e2e-finally'});
            await sync.refresh({source:'live-admin-e2e-finally-verify'});
            result={restored:same(sync.envelope?.state,cp.initialState),conflict:false,revision:Number(sync.revision||0)};
          }else{
            result={restored:false,conflict:true,revision:currentRevision};
          }
        }else result={restored:false,conflict:false,revision:currentRevision};
      }
    }finally{
      try{await session?.signOut?.();}catch{}
    }
    return result;
  },checkpoint);
}

test('LIVE admin: history + temporary draft + real publish + second-client convergence + safe undo',async({browser})=>{
  test.skip(!ADMIN_EMAIL||!ADMIN_PASSWORD,'Dedicated LIVE admin credentials are required');

  const [contextA,contextB]=await Promise.all([newIPhoneContext(browser),newIPhoneContext(browser)]);
  const [pageA,pageB]=await Promise.all([contextA.newPage(),contextB.newPage()]);
  const errors={a:[],b:[]};
  pageA.on('pageerror',error=>errors.a.push(String(error?.message||error)));
  pageB.on('pageerror',error=>errors.b.push(String(error?.message||error)));

  const checkpoint={initialRevision:0,initialState:null,publishedRevision:0};
  let cleanup={restored:false,conflict:false,revision:0};
  try{
    const [bootA,bootB]=await Promise.all([openLiveClient(pageA,'admin'),openLiveClient(pageB,'observer')]);
    expect(bootA.syncVersion).toContain('kelo-world-environment-sync-v4');
    expect(bootB.syncVersion).toContain('kelo-world-environment-sync-v4');
    expect(normalizeState(bootA.state)).toEqual(normalizeState(bootB.state));

    checkpoint.initialRevision=bootA.revision;
    checkpoint.initialState=normalizeState(bootA.state);

    const auth=await installAdminBridge(pageA);
    expect(auth.bridgeVersion).toContain('kelo-creator-test-bridge-v9');
    expect(auth.historyCount).toBeGreaterThan(0);
    expect(auth.history[0].revision).toBeGreaterThan(0);

    const targetDensity=checkpoint.initialState.ambientDensity>=100?99:checkpoint.initialState.ambientDensity+1;
    const testState={...checkpoint.initialState,ambientDensity:targetDensity,notes:'LIVE admin Playwright reversible probe'};
    await pageA.evaluate(async fields=>window.__KELO_LIVE_ADMIN_BRIDGE.run('ENVIRONMENT',{name:'LIVE Admin Playwright Probe',fields}),testState);

    let a=await snapshot(pageA),b=await snapshot(pageB);
    expect(a.temporary).toBe(true);
    expect(a.runtimeState.ambientDensity).toBe(targetDensity);
    expect(normalizeState(a.approved)).toEqual(checkpoint.initialState);
    expect(b.revision).toBe(checkpoint.initialRevision);
    expect(normalizeState(b.runtimeState)).toEqual(checkpoint.initialState);
    await expect(pageA.locator('#kelo-environment-runtime-test-apply')).toBeVisible();

    await pageA.locator('#kelo-environment-runtime-test-apply').click();
    await pageA.waitForFunction(initial=>window.KELO_WORLD_ENVIRONMENT_SYNC?.revision>initial&&window.KELO_ENVIRONMENT_RUNTIME?.temporary===false,checkpoint.initialRevision,{timeout:20000});
    a=await snapshot(pageA);
    checkpoint.publishedRevision=a.revision;
    expect(checkpoint.publishedRevision).toBeGreaterThan(checkpoint.initialRevision);
    expect(a.runtimeRevision).toBe(a.revision);
    expect(a.runtimeState.ambientDensity).toBe(targetDensity);
    await expect(pageA.locator('#kelo-environment-runtime-world-undo')).toBeVisible();

    await pageB.waitForFunction(({revision,density})=>window.KELO_WORLD_ENVIRONMENT_SYNC?.revision>=revision&&Number(window.KELO_ENVIRONMENT_RUNTIME?.state?.ambientDensity)===density,{revision:checkpoint.publishedRevision,density:targetDensity},{timeout:20000});
    b=await snapshot(pageB);
    expect(b.revision).toBe(checkpoint.publishedRevision);
    expect(b.runtimeState.ambientDensity).toBe(targetDensity);

    await pageA.locator('#kelo-environment-runtime-world-undo').click();
    await pageA.waitForFunction(published=>window.KELO_WORLD_ENVIRONMENT_SYNC?.revision>published,checkpoint.publishedRevision,{timeout:20000});
    a=await snapshot(pageA);
    expect(a.revision).toBeGreaterThan(checkpoint.publishedRevision);
    expect(normalizeState(a.runtimeState)).toEqual(checkpoint.initialState);
    expect(normalizeState(a.approved)).toEqual(checkpoint.initialState);

    await pageB.waitForFunction(({revision,state})=>{
      const current=window.KELO_ENVIRONMENT_RUNTIME?.state||{};
      return window.KELO_WORLD_ENVIRONMENT_SYNC?.revision>revision&&current.biome===state.biome&&current.weather===state.weather&&current.timeOfDay===state.timeOfDay&&Number(current.ambientDensity)===Number(state.ambientDensity)&&current.musicMood===state.musicMood&&current.accent===state.accent;
    },{revision:checkpoint.publishedRevision,state:checkpoint.initialState},{timeout:20000});
    b=await snapshot(pageB);
    expect(normalizeState(b.runtimeState)).toEqual(checkpoint.initialState);

    const finalHistory=await pageA.evaluate(()=>window.__KELO_LIVE_ADMIN_BRIDGE.history(8));
    expect(finalHistory.some(entry=>entry.revision===checkpoint.publishedRevision&&entry.action==='publish')).toBe(true);
    expect(finalHistory.some(entry=>entry.revision>a.revision-2&&entry.action==='rollback')).toBe(true);
    expect(errors.a).toEqual([]);
    expect(errors.b).toEqual([]);

    console.log('LIVE_ENVIRONMENT_ADMIN_E2E_PASS',JSON.stringify({initialRevision:checkpoint.initialRevision,publishedRevision:checkpoint.publishedRevision,restoredRevision:a.revision,observerRevision:b.revision}));
  }finally{
    try{cleanup=await cleanupAdminClient(pageA,checkpoint);}catch(error){console.error('LIVE_ENVIRONMENT_ADMIN_E2E_CLEANUP_ERROR',String(error?.message||error));}
    console.log('LIVE_ENVIRONMENT_ADMIN_E2E_CLEANUP',JSON.stringify(cleanup));
    await Promise.allSettled([contextA.close(),contextB.close()]);
  }

  expect(cleanup.conflict,'A newer third-party world revision appeared during the LIVE test; cleanup intentionally refused to overwrite it').toBe(false);
});
