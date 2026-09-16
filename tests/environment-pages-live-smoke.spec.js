/* KELO-INDEX
 * area: TEST / ENVIRONMENT / LIVE PAGES
 * owner: Playwright validation only
 * purpose: verify two independent iPhone clients converge on the same canonical Supabase world environment and attach Realtime
 * security: read-only guest smoke; never publishes, reads admin history or rolls back world state
 */
const {test,expect}=require('@playwright/test');

const LIVE_BASE=process.env.KELO_PAGES_URL||'https://kelffren.github.io/gemini/';
const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function liveUrl(client,attempt=1){
  const url=new URL(LIVE_BASE);
  url.searchParams.set('guest','1');
  url.searchParams.set('environmentLiveSmoke','1');
  url.searchParams.set('client',client);
  url.searchParams.set('_deployProbe',`${Date.now()}-${client}-${attempt}`);
  return url.toString();
}

async function openEnvironmentClient(page,client){
  let last=null;
  for(let attempt=1;attempt<=6;attempt++){
    await page.goto(liveUrl(client,attempt),{waitUntil:'domcontentloaded',timeout:45000});
    try{
      await page.waitForFunction(()=>window.KELO_WORLD_ENVIRONMENT_SYNC?.audit?.ready===true&&window.KELO_WORLD_ENVIRONMENT_SYNC?.revision>0&&window.KELO_ENVIRONMENT_RUNTIME?.revision>0,{timeout:25000});
      await page.waitForFunction(()=>window.KELO_WORLD_ENVIRONMENT_SYNC?.connected===true,{timeout:15000});
      last=await page.evaluate(()=>({
        syncVersion:window.KELO_WORLD_ENVIRONMENT_SYNC?.version||null,
        runtimeVersion:window.KELO_ENVIRONMENT_RUNTIME?.version||null,
        revision:window.KELO_WORLD_ENVIRONMENT_SYNC?.revision||0,
        runtimeRevision:window.KELO_ENVIRONMENT_RUNTIME?.revision||0,
        connected:window.KELO_WORLD_ENVIRONMENT_SYNC?.connected===true,
        envelope:window.KELO_WORLD_ENVIRONMENT_SYNC?.envelope||null,
        state:window.KELO_ENVIRONMENT_RUNTIME?.state||null,
        approved:window.KELO_ENVIRONMENT_RUNTIME?.approved||null,
        temporary:window.KELO_ENVIRONMENT_RUNTIME?.temporary===true,
        audit:window.KELO_WORLD_ENVIRONMENT_SYNC?.audit||null
      }));
      if(last.connected&&last.revision>0&&last.runtimeRevision===last.revision&&last.envelope?.id==='global')return last;
    }catch(_){/* deployment/CDN or backend handshake may still be converging */}
    await page.waitForTimeout(4000);
  }
  throw new Error(`LIVE_ENVIRONMENT_CLIENT_NOT_READY ${client} ${JSON.stringify(last)}`);
}

function comparable(snapshot){
  const state=snapshot?.state||{};
  return {
    revision:snapshot?.revision||0,
    biome:state.biome,
    weather:state.weather,
    timeOfDay:state.timeOfDay,
    ambientDensity:state.ambientDensity,
    musicMood:state.musicMood,
    accent:state.accent
  };
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

test('GitHub Pages LIVE: two iPhones converge on one canonical world environment',async({browser})=>{
  const [contextA,contextB]=await Promise.all([newIPhoneContext(browser),newIPhoneContext(browser)]);
  const [pageA,pageB]=await Promise.all([contextA.newPage(),contextB.newPage()]);
  const errors={a:[],b:[]};
  pageA.on('pageerror',error=>errors.a.push(String(error?.message||error)));
  pageB.on('pageerror',error=>errors.b.push(String(error?.message||error)));

  const [a,b]=await Promise.all([openEnvironmentClient(pageA,'a'),openEnvironmentClient(pageB,'b')]);
  expect(a.syncVersion).toContain('kelo-world-environment-sync-v4');
  expect(b.syncVersion).toContain('kelo-world-environment-sync-v4');
  expect(a.runtimeRevision).toBe(a.revision);
  expect(b.runtimeRevision).toBe(b.revision);
  expect(a.temporary).toBe(false);
  expect(b.temporary).toBe(false);
  expect(comparable(a)).toEqual(comparable(b));

  // A fresh navigation must re-read canonical state instead of trusting browser-local cache.
  const reloaded=await openEnvironmentClient(pageB,'b-reload');
  expect(comparable(reloaded)).toEqual(comparable(a));
  expect(reloaded.connected).toBe(true);

  console.log('ENVIRONMENT_LIVE_TWO_IPHONE_SMOKE',JSON.stringify({a:comparable(a),b:comparable(b),reloaded:comparable(reloaded),audits:{a:a.audit,b:b.audit,reloaded:reloaded.audit},pageErrors:errors},null,2));
  await Promise.all([contextA.close(),contextB.close()]);
});
