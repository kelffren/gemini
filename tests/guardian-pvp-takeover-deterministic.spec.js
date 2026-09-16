/* KELO-INDEX
 * area: TEST / GUARDIAN / PVP TAKEOVER DETERMINISTIC
 * owner: Playwright validation only
 * keys: GUARDIAN PVP TAKEOVER TWO CLIENT WORKER EPOCH SEQUENCE STANDBY SECRETLESS
 * purpose: prueba en Pages publicado el host/Worker/adaptador PvP real con dos clientes y un control-plane test-only en memoria
 * online: el runtime PvP es producción; solo Guardian lease/transport se sustituye antes de cargar el feature para poder ejecutar el gate en cada page_build sin secretos
 * do-not: NO modificar runtime productivo, NO economía/inventario, NO service role, NO segundo gameplay loop
 */
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const LIVE_BASE=process.env.KELO_PAGES_URL||'https://kelffren.github.io/gemini/';
const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ROOM='pvp-deterministic-takeover';
const METRICS_PATH=path.resolve('test-results/guardian-pvp-takeover-deterministic-metrics.json');

function urlFor(label){
  const u=new URL(LIVE_BASE);
  u.searchParams.set('guest','1');
  u.searchParams.set('guardianTakeoverDeterministic','1');
  u.searchParams.set('_device',label);
  u.searchParams.set('_probe',`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return u.toString();
}

const guardianStub=()=>{
  const q=new URLSearchParams(location.search),label=q.get('_device')||'x';
  if(!q.has('guardianTakeoverDeterministic'))return;
  const nodeId='guardian_test_'+label.replace(/[^A-Za-z0-9_-]/g,'_');
  const bus=new BroadcastChannel('kelo-guardian-pvp-takeover-v1');
  let master={nodeId:'guardian_test_a',epoch:1,expiresAt:Date.now()+25000};
  let masterActive=nodeId===master.nodeId,enabled=true;
  const stats={sent:0,received:0};
  const emit=()=>window.dispatchEvent(new CustomEvent('kelo:guardian-state',{detail:api.state()}));
  bus.onmessage=event=>{
    const m=event.data||{};
    if(m.fromNodeId===nodeId)return;
    if(m.kind==='to-master'&&masterActive){stats.received++;window.dispatchEvent(new CustomEvent('kelo:guardian-data',{detail:{fromNodeId:m.fromNodeId,payload:m.payload,authoritative:false,transport:'test-control-plane'}}));}
    else if(m.kind==='broadcast'&&m.fromNodeId===master.nodeId){stats.received++;window.dispatchEvent(new CustomEvent('kelo:guardian-data',{detail:{fromNodeId:m.fromNodeId,payload:m.payload,authoritative:false,transport:'test-control-plane'}}));}
  };
  const setMaster=(nextNodeId,epoch)=>{
    master={nodeId:String(nextNodeId),epoch:Number(epoch)||0,expiresAt:Date.now()+25000};
    masterActive=nodeId===master.nodeId;emit();return api.state();
  };
  const api={
    version:'guardian-test-control-plane-v1',
    state:()=>Object.freeze({
      version:'guardian-test-control-plane-v1',nodeId,enabled,platform:'ios',ios:true,connected:true,
      role:masterActive?'master-host':'donor-ready',masterEligible:true,masterActive,standbyAssigned:false,standby:null,
      masterLeaseExpiresAt:masterActive?master.expiresAt:null,network:{masterEpoch:master.epoch,masterNodeId:master.nodeId},
      master:Object.freeze({...master}),preferences:Object.freeze({enabled:true,allowRelay:true,allowAssets:true,allowCompute:false,allowGpuAssets:false}),
      dataPlane:Object.freeze({mode:'test-control-plane',supported:true,masterNodeId:master.nodeId,masterEpoch:master.epoch,peerCount:1,openPeerCount:1,connectedToMaster:!masterActive,bytesSent:stats.sent,bytesReceived:stats.received}),
      lastError:null,backgroundContinuousGuaranteed:false
    }),
    activate:async()=>{enabled=true;emit();return api.state();},deactivate:async()=>{enabled=false;emit();return api.state();},
    toggle:async()=>{enabled=!enabled;emit();return api.state();},refresh:async()=>api.state(),heartbeat:async()=>api.state(),
    startMasterHost:async()=>setMaster(nodeId,master.epoch+1),claimStandbyHost:async()=>{throw new Error('GUARDIAN_STANDBY_NOT_ASSIGNED');},stopMasterHost:async()=>{masterActive=false;emit();return api.state();},
    updatePreferences:()=>api.state(),capabilities:()=>({platform:'ios',deviceClass:'phone',visibility:'visible',online:true,webrtc:true}),
    gpuCapability:async()=>({webgpu:false,gpuTier:'none',gpuCapacityUnits:0,gpuProbeReady:true}),ensureGpuAssetWorker:async()=>null,
    transport:()=>api.state().dataPlane,
    sendToMaster:payload=>{if(!enabled||masterActive)return false;stats.sent++;bus.postMessage({kind:'to-master',fromNodeId:nodeId,payload});return true;},
    broadcast:payload=>{if(!enabled||!masterActive)return 0;stats.sent++;bus.postMessage({kind:'broadcast',fromNodeId:nodeId,payload});return 1;},
    __setMaster:setMaster,
    __close:()=>bus.close()
  };
  Object.defineProperty(window,'KeloGuardian',{value:Object.freeze(api),configurable:false,writable:false});
  Object.defineProperty(window,'KELO_GUARDIAN_AUDIT',{value:Object.freeze({testOnly:true,serverSelectedStandby:true,clientGameplayAuthority:false,clientRewardAuthority:false})});
  queueMicrotask(emit);
};

async function setupPage(context,label){
  const page=await context.newPage();
  await page.routeWebSocket('**/*',ws=>ws.close({code:1012,reason:'guardian-deterministic-central-offline'}));
  await page.goto(urlFor(label),{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.KELO_MODULE_LOADER&&window.KELO_FEATURE_REGISTRY&&window.KeloGuardian?.version==='guardian-test-control-plane-v1',{timeout:20000});
  const loaded=await page.evaluate(async()=>{
    const ok=await window.KELO_MODULE_LOADER.ensure('pvp');
    const files=window.KELO_FEATURE_REGISTRY.get('guardian')?.files||[];
    return{ok,registry:window.KELO_FEATURE_REGISTRY.version,standbyRuntime:files.some(item=>String(item?.src||'').includes('guardian-hot-mirror.js?v=2-server-standby'))};
  });
  expect(loaded.ok).toBe(true);
  expect(loaded.standbyRuntime).toBe(true);
  await page.waitForFunction(()=>window.KeloGuardianPvPHost&&window.KeloGuardianPvPNetAdapter&&window.KELO_GUARDIAN_PVP_HOST_AUDIT?.isolatedWorker===true,{timeout:20000});
  return page;
}

async function send(page,intent){return page.evaluate(intent=>window.KeloNetAuthority.sendCombatIntent(Object.assign({moveX:0,moveY:0,aimX:1,aimY:0,phase:'none',clientTime:Date.now()},intent)),intent);}
async function snap(page){return page.evaluate(()=>window.KeloGuardianPvPHost.latestSnapshot());}

async function enterRoom(page){
  await page.evaluate(room=>window.KeloGuardianPvPHost.start(room),ROOM);
  expect(await send(page,{action:'enter_pvp'})).toBeTruthy();
}

test('Pages deterministic: two clients preserve safe PvP state across Guardian epoch takeover',async({browser})=>{
  test.setTimeout(120000);
  fs.mkdirSync(path.dirname(METRICS_PATH),{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:IPHONE_UA,serviceWorkers:'block'});
  await context.addInitScript(guardianStub);
  let a=null,b=null;
  const metrics={version:2,liveBase:LIVE_BASE,room:ROOM,startedAt:new Date().toISOString(),transport:'test-control-plane',productHostWorkerAdapter:true,standbyRuntimeRegistry:true};
  try{
    a=await setupPage(context,'a');
    b=await setupPage(context,'b');
    await enterRoom(a);
    await b.evaluate(room=>window.KeloGuardianPvPHost.start(room),ROOM);
    expect(await send(b,{action:'enter_pvp'})).toBeTruthy();

    await b.waitForFunction(()=>Object.keys(window.KeloGuardianPvPHost.latestSnapshot()?.players||{}).length>=2,{timeout:15000});
    expect(await send(b,{action:'input',phase:'held',moveX:.75})).toBeTruthy();
    await b.waitForTimeout(550);
    expect(await send(b,{action:'input',phase:'held',moveX:0})).toBeTruthy();
    await b.waitForTimeout(100);
    await send(b,{action:'ability',phase:'cast',abilityKey:'fireball',direction:{x:1,y:0}});
    await b.waitForTimeout(100);

    const actorId=await b.evaluate(()=>window.KeloGuardianPvPHost.actorId());
    const before=await snap(b),localBefore=before?.players?.[actorId];
    expect(localBefore).toBeTruthy();
    expect(Number(before.epoch)).toBe(1);
    metrics.before={epoch:before.epoch,serverTick:before.serverTick,seq:before.seq,actorId,player:{x:localBefore.x,y:localBefore.y,hp:localBefore.hp,mana:localBefore.mana,ackSequence:localBefore.ackSequence},projectiles:Array.isArray(before.projectiles)?before.projectiles.length:0};

    const failureAt=Date.now();
    await a.close({runBeforeUnload:false});
    await b.evaluate(()=>window.KeloGuardian.__setMaster('guardian_test_b',2));

    await b.waitForFunction(tick=>{
      const h=window.KeloGuardianPvPHost.state(),s=window.KeloGuardianPvPHost.latestSnapshot();
      return h.masterActive&&h.workerReady&&Number(s?.epoch)===2&&Number(s?.serverTick)>=Number(tick);
    },Number(before.serverTick)||0,{timeout:15000});

    const recoveredAt=Date.now(),after=await snap(b),localAfter=after?.players?.[actorId],host=await b.evaluate(()=>window.KeloGuardianPvPHost.state());
    expect(localAfter).toBeTruthy();
    const positionDrift=Math.hypot(Number(localAfter.x)-Number(localBefore.x),Number(localAfter.y)-Number(localBefore.y));
    const hpDrift=Math.abs(Number(localAfter.hp)-Number(localBefore.hp));
    const manaDrift=Math.abs(Number(localAfter.mana)-Number(localBefore.mana));
    expect(Number(after.serverTick)).toBeGreaterThanOrEqual(Number(before.serverTick));
    expect(positionDrift).toBeLessThanOrEqual(8);
    expect(hpDrift).toBeLessThanOrEqual(.01);
    expect(manaDrift).toBeLessThanOrEqual(2);
    expect(Array.isArray(after.projectiles)?after.projectiles.length:0).toBe(0);
    expect(host.stats.takeoversRestored).toBeGreaterThanOrEqual(1);

    const ack=Number(localAfter.ackSequence)||0;
    expect(await send(b,{action:'input',phase:'held',moveX:-.25})).toBeTruthy();
    await b.waitForFunction(({actorId,ack})=>Number(window.KeloGuardianPvPHost.latestSnapshot()?.players?.[actorId]?.ackSequence||0)>ack,{actorId,ack},{timeout:10000});
    expect(await send(b,{action:'input',phase:'held',moveX:0})).toBeTruthy();
    const final=await snap(b),net=await b.evaluate(()=>window.KeloGuardianPvPNetAdapter.state());
    expect(net.centralOnline).toBe(false);
    expect(net.mode).toBe('guardian-temporary');

    metrics.after={epoch:after.epoch,serverTick:final.serverTick,outageMs:recoveredAt-failureAt,positionDrift,hpDrift,manaDrift,projectilesAfterTakeover:Array.isArray(after.projectiles)?after.projectiles.length:0,takeoversRestored:host.stats.takeoversRestored,playersRestored:host.stats.playersRestored,ackBeforeResume:ack,ackAfterResume:Number(final.players?.[actorId]?.ackSequence)||0,centralOnline:net.centralOnline,mode:net.mode};
    metrics.passed=true;
    fs.writeFileSync(METRICS_PATH,JSON.stringify(metrics,null,2));
    console.log('GUARDIAN_PVP_TAKEOVER_DETERMINISTIC_OK',JSON.stringify(metrics.after));
  }catch(error){metrics.passed=false;metrics.error=String(error?.stack||error);fs.writeFileSync(METRICS_PATH,JSON.stringify(metrics,null,2));throw error;}
  finally{try{await b?.evaluate(()=>window.KeloGuardian?.__close?.());}catch(_){}await context.close();}
});
