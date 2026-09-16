/* KELO-INDEX
 * area: TEST / GUARDIAN / PVP TAKEOVER LIVE
 * owner: Playwright validation only
 * keys: GUARDIAN PVP TAKEOVER TWO DEVICE WEBRTC MASTER EPOCH LEASE FENCING STANDBY WORKER IPHONE LIVE
 * purpose: valida contra Pages+Supabase reales que un segundo dispositivo de la misma cuenta queda cercado por la lease viva y solo toma el Master tras su expiración, preservando una sala PvP temporal
 * online: usa login real, Guardian RPC real y DataChannel WebRTC real; bloquea solo el WebSocket PvP central para probar deliberadamente el fallback Guardian
 * do-not: NO service role, NO imprimir secretos, NO mutar economía/inventario, NO mockear Guardian dentro del runtime
 */
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');

const LIVE_BASE=process.env.KELO_PAGES_URL||'https://kelffren.github.io/gemini/';
const ADMIN_EMAIL=process.env.KELO_GUARDIAN_TEST_ADMIN_EMAIL||'';
const ADMIN_PASSWORD=process.env.KELO_GUARDIAN_TEST_ADMIN_PASSWORD||'';
const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const METRICS_PATH=path.resolve('test-results/guardian-pvp-takeover-metrics.json');
const ROOM='pvp-live-takeover';

function liveUrl(attempt,label){
  const url=new URL(LIVE_BASE);
  url.searchParams.set('guardianPvpTakeover','1');
  url.searchParams.set('_device',label);
  url.searchParams.set('_deployProbe',`${Date.now()}-${attempt}`);
  return url.toString();
}

async function makeDevice(browser,label){
  const context=await browser.newContext({
    viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,
    userAgent:IPHONE_UA,serviceWorkers:'block'
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error?.message||error)));

  // Guardian uses Supabase HTTPS RPC + WebRTC. Blocking page WebSockets forces
  // the normal central PvP transport offline without touching either Guardian plane.
  await page.routeWebSocket('**/*',ws=>ws.close({code:1012,reason:'guardian-takeover-central-outage'}));

  let published=null;
  for(let attempt=1;attempt<=6;attempt++){
    await page.goto(liveUrl(attempt,label),{waitUntil:'domcontentloaded',timeout:45000});
    try{
      await page.waitForFunction(()=>window.KeloOnlineAuth&&window.KELO_MODULE_LOADER&&window.KELO_FEATURE_REGISTRY,{timeout:20000});
      published=await page.evaluate(()=>{
        const guardianFiles=window.KELO_FEATURE_REGISTRY?.get?.('guardian')?.files||[];
        return{
          auth:window.KeloOnlineAuth?.version||null,
          loader:window.KELO_MODULE_LOADER?.version||null,
          registry:window.KELO_FEATURE_REGISTRY?.version||null,
          features:Array.isArray(window.KELO_MODULE_LOADER?.features)?window.KELO_MODULE_LOADER.features.slice():[],
          guardianStandby:guardianFiles.some(item=>String(item?.src||'').includes('guardian-system.js?v=4-server-standby'))&&guardianFiles.some(item=>String(item?.src||'').includes('guardian-hot-mirror.js?v=2-server-standby'))
        };
      });
      if(published.features.includes('pvp')&&published.guardianStandby===true)break;
    }catch(_){/* Pages may still be converging to the latest main build. */}
    await page.waitForTimeout(4000);
  }
  if(!published?.features?.includes('pvp')||published?.guardianStandby!==true){
    throw new Error(`GUARDIAN_STANDBY_RUNTIME_NOT_PUBLISHED:${label}:${JSON.stringify(published)}`);
  }
  return{label,context,page,errors,published};
}

async function signIn(device){
  const state=await device.page.evaluate(async({email,password})=>{
    await window.KeloOnlineAuth.signInWithPassword(email,password);
    await window.KeloOnlineAuth.ready(10000);
    return window.KeloOnlineAuth.state();
  },{email:ADMIN_EMAIL,password:ADMIN_PASSWORD});
  expect(state.authenticated,`${device.label} must authenticate`).toBe(true);
  expect(state.profileRequired,`${device.label} Guardian test account profile must be complete`).toBe(false);
  return state;
}

async function loadGuardianPvp(device){
  const result=await device.page.evaluate(async()=>{
    const ok=await window.KELO_MODULE_LOADER.ensure('pvp');
    return{
      ok,
      ready:window.KELO_MODULE_LOADER.isReady('pvp'),
      host:window.KeloGuardianPvPHost?.version||null,
      guardian:window.KeloGuardian?.version||null,
      standbyAudit:window.KELO_GUARDIAN_AUDIT?.serverSelectedStandby===true,
      adapter:window.KeloGuardianPvPNetAdapter?.version||null,
      workerAudit:window.KELO_GUARDIAN_PVP_HOST_AUDIT||null,
      failures:window.KELO_MODULE_LOADER.diagnostics().failures
    };
  });
  expect(result.ok).toBe(true);
  expect(result.ready).toBe(true);
  expect(result.standbyAudit).toBe(true);
  expect(result.workerAudit?.isolatedWorker).toBe(true);
  expect(result.failures).toEqual({});
  return result;
}

async function guardianState(device){return device.page.evaluate(()=>window.KeloGuardian.state());}
async function hostState(device){return device.page.evaluate(()=>window.KeloGuardianPvPHost.state());}
async function fullSnapshot(device){return device.page.evaluate(()=>window.KeloGuardianPvPHost.latestSnapshot());}

async function activate(device){
  return device.page.evaluate(async()=>{
    window.KeloGuardian.updatePreferences({enabled:true,allowRelay:true,allowAssets:true,allowCompute:false,allowGpuAssets:false});
    await window.KeloGuardian.activate();
    return window.KeloGuardian.state();
  });
}

async function startMaster(device){
  return device.page.evaluate(async()=>{
    await window.KeloGuardian.startMasterHost();
    return window.KeloGuardian.state();
  });
}

async function observeMaster(device,nodeId,epoch){
  await device.page.waitForFunction(({nodeId,epoch})=>{
    const s=window.KeloGuardian?.state?.();
    return s?.master?.nodeId===nodeId&&Number(s?.master?.epoch)===Number(epoch);
  },{nodeId,epoch},{timeout:15000});
}

async function sendIntent(device,intent){
  return device.page.evaluate(intent=>window.KeloNetAuthority.sendCombatIntent(Object.assign({
    moveX:0,moveY:0,aimX:1,aimY:0,phase:'none',clientTime:Date.now()
  },intent)),intent);
}

async function bestEffortCleanup(device){
  if(!device?.page||device.page.isClosed())return;
  await device.page.evaluate(async()=>{
    try{window.KeloGuardianPvPHost?.stop?.();}catch(_){}
    try{if(window.KeloGuardian?.state?.().masterActive)await window.KeloGuardian.stopMasterHost();}catch(_){}
    try{if(window.KeloGuardian?.state?.().enabled)await window.KeloGuardian.deactivate();}catch(_){}
  }).catch(()=>{});
}

test('LIVE two-device Guardian PvP: Master A hard-fails and B resumes same room only after lease expiry',async({browser})=>{
  test.setTimeout(180000);
  expect(ADMIN_EMAIL,'KELO_GUARDIAN_TEST_ADMIN_EMAIL secret').not.toBe('');
  expect(ADMIN_PASSWORD,'KELO_GUARDIAN_TEST_ADMIN_PASSWORD secret').not.toBe('');
  fs.mkdirSync(path.dirname(METRICS_PATH),{recursive:true});

  let a=null,b=null;
  const metrics={version:3,room:ROOM,liveBase:LIVE_BASE,startedAt:new Date().toISOString(),sameAuthorizedAccount:true,nodeScopedFencing:true,serverSelectedStandbyRuntime:true,centralWebSocketForcedOffline:true};
  try{
    [a,b]=await Promise.all([makeDevice(browser,'master-a'),makeDevice(browser,'candidate-b')]);
    metrics.published={a:a.published,b:b.published};

    await Promise.all([signIn(a),signIn(b)]);
    metrics.runtime={a:await loadGuardianPvp(a),b:await loadGuardianPvp(b)};

    const [enabledA,enabledB]=await Promise.all([activate(a),activate(b)]);
    expect(enabledA.nodeId).not.toBe(enabledB.nodeId);
    metrics.nodes={a:enabledA.nodeId,b:enabledB.nodeId};

    const masterA=await startMaster(a);
    expect(masterA.masterActive).toBe(true);
    const oldEpoch=Number(masterA.master?.epoch||0);
    expect(oldEpoch).toBeGreaterThan(0);
    metrics.oldEpoch=oldEpoch;

    // Force B to refresh the control plane immediately, then let the normal
    // Guardian signaling loop establish the actual ordered DataChannel.
    await b.page.evaluate(()=>window.KeloGuardian.heartbeat());
    await observeMaster(b,masterA.nodeId,oldEpoch);
    await b.page.waitForFunction(()=>window.KeloGuardian?.state?.().dataPlane?.connectedToMaster===true,{timeout:20000});
    await a.page.waitForFunction(()=>Number(window.KeloGuardian?.state?.().dataPlane?.openPeerCount||0)>=1,{timeout:20000});
    metrics.webrtcBeforeFailure={a:(await guardianState(a)).dataPlane,b:(await guardianState(b)).dataPlane};

    await a.page.evaluate(room=>window.KeloGuardianPvPHost.start(room),ROOM);
    await b.page.evaluate(room=>window.KeloGuardianPvPHost.start(room),ROOM);
    await a.page.waitForFunction(()=>window.KeloGuardianPvPHost?.state?.().workerReady===true,{timeout:15000});

    expect(await sendIntent(a,{action:'enter_pvp'})).toBeTruthy();
    expect(await sendIntent(b,{action:'enter_pvp'})).toBeTruthy();
    await b.page.waitForFunction(()=>Object.keys(window.KeloGuardianPvPHost?.latestSnapshot?.()?.players||{}).length>=2,{timeout:15000});

    // Give B a non-default authoritative position and spend mana so takeover
    // validates more than an empty/default room.
    expect(await sendIntent(b,{action:'input',phase:'held',moveX:0.8})).toBeTruthy();
    await b.page.waitForTimeout(650);
    expect(await sendIntent(b,{action:'input',phase:'held',moveX:0})).toBeTruthy();
    await b.page.waitForTimeout(120);
    await sendIntent(b,{action:'ability',phase:'cast',abilityKey:'fireball',direction:{x:1,y:0}});
    await b.page.waitForTimeout(120);

    const actorId=await b.page.evaluate(()=>window.KeloGuardianPvPHost.actorId());
    const before=await fullSnapshot(b);
    const localBefore=before?.players?.[actorId];
    expect(localBefore,'B must exist in authoritative snapshot before takeover').toBeTruthy();
    expect(Number(before.epoch)).toBe(oldEpoch);

    // Renew A immediately before the hard failure. This guarantees the test
    // exercises node fencing instead of accidentally racing an almost-expired lease.
    await a.page.evaluate(()=>window.KeloGuardian.heartbeat());
    await b.page.evaluate(()=>window.KeloGuardian.heartbeat());
    const guardianBefore=await guardianState(b);
    const leaseExpiresAt=Number(guardianBefore.master?.expiresAt||0);
    const leaseRemainingMs=leaseExpiresAt>Date.now()?leaseExpiresAt-Date.now():0;
    expect(leaseRemainingMs,'Master A lease should still be live before hard failure').toBeGreaterThan(5000);
    // Gate must recover no later than one server lease window plus transport margin.
    const maxOutageMs=Math.max(12000,Math.min(32000,leaseRemainingMs+6000));
    metrics.before={
      actorId,epoch:before.epoch,serverTick:before.serverTick,seq:before.seq,
      player:{x:localBefore.x,y:localBefore.y,hp:localBefore.hp,mana:localBefore.mana,ackSequence:localBefore.ackSequence},
      projectiles:Array.isArray(before.projectiles)?before.projectiles.length:0,
      leaseExpiresAt,leaseRemainingMs,maxOutageMs,
      standbyAssigned:guardianBefore.standbyAssigned===true,
      standbyAssignmentEpoch:Number(guardianBefore.standby?.assignmentEpoch)||0
    };

    const failureAt=Date.now();
    // Hard failure: do not run Guardian stop/deactivate. Heartbeat and Worker die with A.
    await a.page.close({runBeforeUnload:false});

    // Critical fencing assertion: B is the same authorized account but a different
    // node. It MUST be rejected while A's lease is still valid.
    let firstClaimError=null,preExpiryBlocked=false;
    try{await startMaster(b);}catch(error){firstClaimError=String(error?.message||error);preExpiryBlocked=firstClaimError.includes('GUARDIAN_MASTER_BUSY');}
    expect(preExpiryBlocked,`B must be fenced while A lease is live; got: ${firstClaimError||'claim unexpectedly succeeded'}`).toBe(true);
    const stillOldMaster=await guardianState(b);
    expect(stillOldMaster.masterActive).toBe(false);
    expect(stillOldMaster.master?.nodeId).toBe(masterA.nodeId);
    expect(Number(stillOldMaster.master?.epoch||0)).toBe(oldEpoch);

    let promotionError=firstClaimError,newMaster=null,busyRejects=preExpiryBlocked?1:0,masterAcquiredAt=0;
    const promotionDeadline=failureAt+maxOutageMs;
    while(Date.now()<promotionDeadline){
      try{
        newMaster=await startMaster(b);
        if(newMaster.masterActive&&Number(newMaster.master?.epoch||0)>oldEpoch){masterAcquiredAt=Date.now();break;}
      }catch(error){
        promotionError=String(error?.message||error);
        if(promotionError.includes('GUARDIAN_MASTER_BUSY'))busyRejects++;
      }
      await b.page.waitForTimeout(500);
    }
    expect(newMaster?.masterActive,`B promotion failed: ${promotionError||'no master'}`).toBe(true);
    const newEpoch=Number(newMaster.master?.epoch||0);
    expect(newEpoch).toBeGreaterThan(oldEpoch);
    const leaseWaitMs=masterAcquiredAt-failureAt;
    expect(busyRejects).toBeGreaterThan(0);
    expect(leaseWaitMs).toBeGreaterThanOrEqual(Math.max(0,leaseRemainingMs-2500));
    metrics.fencing={preExpiryBlocked,busyRejects,firstClaimError:firstClaimError?firstClaimError.slice(0,160):null,leaseWaitMs};

    await b.page.waitForFunction(({epoch,tick})=>{
      const h=window.KeloGuardianPvPHost?.state?.(),s=window.KeloGuardianPvPHost?.latestSnapshot?.();
      return h?.masterActive&&h?.workerReady&&Number(s?.epoch)===Number(epoch)&&Number(s?.serverTick)>=Number(tick);
    },{epoch:newEpoch,tick:Number(before.serverTick)||0},{timeout:maxOutageMs});
    const firstRecoveredAt=Date.now();
    const after=await fullSnapshot(b);
    const hostAfter=await hostState(b);
    const localAfter=after?.players?.[actorId];
    expect(localAfter,'B must survive takeover in authoritative snapshot').toBeTruthy();

    const positionDrift=Math.hypot(Number(localAfter.x)-Number(localBefore.x),Number(localAfter.y)-Number(localBefore.y));
    const hpDrift=Math.abs(Number(localAfter.hp)-Number(localBefore.hp));
    const manaDrift=Math.abs(Number(localAfter.mana)-Number(localBefore.mana));
    const outageMs=firstRecoveredAt-failureAt;

    expect(Number(after.serverTick)).toBeGreaterThanOrEqual(Number(before.serverTick));
    expect(positionDrift).toBeLessThanOrEqual(8);
    expect(hpDrift).toBeLessThanOrEqual(0.01);
    expect(manaDrift).toBeLessThanOrEqual(2);
    expect(Array.isArray(after.projectiles)?after.projectiles.length:0).toBe(0);
    expect(hostAfter.stats.takeoversRestored).toBeGreaterThanOrEqual(1);
    expect(hostAfter.stats.playersRestored).toBeGreaterThanOrEqual(1);

    const ackBeforeResume=Number(localAfter.ackSequence)||0;
    expect(await sendIntent(b,{action:'input',phase:'held',moveX:-0.25})).toBeTruthy();
    await b.page.waitForFunction(({actorId,ack})=>Number(window.KeloGuardianPvPHost?.latestSnapshot?.()?.players?.[actorId]?.ackSequence||0)>Number(ack),{actorId,ack:ackBeforeResume},{timeout:10000});
    expect(await sendIntent(b,{action:'input',phase:'held',moveX:0})).toBeTruthy();

    const netAfter=await b.page.evaluate(()=>window.KeloGuardianPvPNetAdapter.state());
    const finalSnapshot=await fullSnapshot(b);
    expect(netAfter.centralOnline).toBe(false);
    expect(netAfter.mode).toBe('guardian-temporary');
    expect(outageMs).toBeLessThanOrEqual(maxOutageMs);

    metrics.after={
      newEpoch,outageMs,leaseWaitMs,serverTick:finalSnapshot.serverTick,seq:finalSnapshot.seq,
      positionDrift,hpDrift,manaDrift,
      projectilesAfterTakeover:Array.isArray(after.projectiles)?after.projectiles.length:0,
      ackBeforeResume,ackAfterResume:Number(finalSnapshot.players?.[actorId]?.ackSequence)||0,
      takeoversRestored:hostAfter.stats.takeoversRestored,
      playersRestored:hostAfter.stats.playersRestored,
      transientActionsReset:hostAfter.stats.transientActionsReset,
      projectilesReset:hostAfter.stats.projectilesReset,
      centralOnline:netAfter.centralOnline,mode:netAfter.mode,
      pageErrorsB:b.errors
    };
    metrics.passed=true;
    fs.writeFileSync(METRICS_PATH,JSON.stringify(metrics,null,2));
    console.log('GUARDIAN_PVP_TAKEOVER_LIVE_OK',JSON.stringify(metrics.after));
  }catch(error){
    metrics.passed=false;metrics.error=String(error?.stack||error);metrics.pageErrors={a:a?.errors||[],b:b?.errors||[]};
    fs.writeFileSync(METRICS_PATH,JSON.stringify(metrics,null,2));
    throw error;
  }finally{
    await bestEffortCleanup(b);
    await bestEffortCleanup(a);
    await Promise.allSettled([a?.context?.close(),b?.context?.close()]);
  }
});
