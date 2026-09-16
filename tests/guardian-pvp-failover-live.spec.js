/* KELO-INDEX
 * area: TEST / GUARDIAN / PVP FAILOVER LIVE
 * owner: Guardian PvP failover validation only
 * keys: GUARDIAN PVP FAILOVER MASTER A B EPOCH LEASE WEBRTC TAKEOVER SNAPSHOT POSITION IOS
 * purpose: valida A->B con dos nodos autenticados, caída abrupta del Master, nueva lease/epoch y continuidad segura del snapshot PvP
 * do-not: NO cuentas reales, NO imprimir tokens, NO conceder economía/recompensas, NO bypass del lease backend
 */
const {test,expect,chromium}=require('@playwright/test');

const REQUIRED=[
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'KELO_GUARDIAN_TEST_ADMIN_EMAIL',
  'KELO_GUARDIAN_TEST_ADMIN_PASSWORD',
  'KELO_GUARDIAN_TEST_DONOR_EMAIL',
  'KELO_GUARDIAN_TEST_DONOR_PASSWORD'
];
const LIVE_BASE=process.env.KELO_PAGES_URL||'https://kelffren.github.io/gemini/';
const REAL_IOS=process.env.KELO_FAILOVER_REAL_IOS==='1';
const MAX_FAILOVER_MS=Math.max(8000,Number(process.env.KELO_GUARDIAN_FAILOVER_MAX_MS)||45000);
const MAX_POSITION_DRIFT_PX=Math.max(1,Number(process.env.KELO_GUARDIAN_FAILOVER_MAX_DRIFT_PX)||12);
const SESSION_KEY='kelo.supabase.session.v1';
const NODE_KEY='kelo.guardian.node.v1';

function missingSecrets(){return REQUIRED.filter(key=>!process.env[key]);}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function labUrl(role){
  const url=new URL(LIVE_BASE);
  url.searchParams.set('guardianPvpFailoverLab','1');
  url.searchParams.set('role',role);
  url.searchParams.set('_failoverProbe',`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return url.toString();
}
async function jsonRequest(url,{method='GET',headers={},body}={}){
  const response=await fetch(url,{method,headers:{Accept:'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();
  let payload=null;try{payload=text?JSON.parse(text):null;}catch{payload=null;}
  if(!response.ok)throw new Error(String(payload?.message||payload?.error_description||payload?.error||`HTTP_${response.status}`));
  return payload;
}
async function signIn(email,password){
  const base=String(process.env.SUPABASE_URL).replace(/\/+$/,'');
  const key=String(process.env.SUPABASE_PUBLISHABLE_KEY);
  const payload=await jsonRequest(`${base}/auth/v1/token?grant_type=password`,{
    method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:{email,password}
  });
  expect(payload?.access_token).toBeTruthy();
  expect(payload?.refresh_token).toBeTruthy();
  expect(payload?.user?.id).toBeTruthy();
  return payload;
}
async function rpc(session,name,args={}){
  const base=String(process.env.SUPABASE_URL).replace(/\/+$/,'');
  const key=String(process.env.SUPABASE_PUBLISHABLE_KEY);
  return jsonRequest(`${base}/rest/v1/rpc/${encodeURIComponent(name)}`,{
    method:'POST',headers:{apikey:key,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json',Prefer:'return=representation'},body:args
  });
}
function metricScript(){
  if(window.__KELO_GUARDIAN_FAILOVER_METRICS__)return;
  const m=window.__KELO_GUARDIAN_FAILOVER_METRICS__={snapshots:[],takeovers:[],rejects:[],guardian:[],peerCloses:[],installedAt:Date.now()};
  const slimPlayers=players=>Object.fromEntries(Object.entries(players||{}).map(([id,p])=>[id,{x:Number(p.x)||0,y:Number(p.y)||0,hp:Number(p.hp)||0,mana:Number(p.mana)||0,ackSequence:Number(p.ackSequence)||0}]));
  window.addEventListener('kelo:guardian-pvp-snapshot',event=>{const s=event.detail?.snapshot||{};m.snapshots.push({at:Date.now(),epoch:Number(s.epoch)||0,seq:Number(s.seq)||0,serverTick:Number(s.serverTick)||0,players:slimPlayers(s.players)});if(m.snapshots.length>600)m.snapshots.shift();});
  window.addEventListener('kelo:guardian-pvp-takeover',event=>{const d=event.detail||{};m.takeovers.push({at:Date.now(),previousEpoch:Number(d.previousEpoch)||0,newEpoch:Number(d.newEpoch)||0,playersRestored:Number(d.playersRestored)||0,sourceSnapshotSeq:Number(d.sourceSnapshotSeq)||0,transientActionsReset:d.transientActionsReset===true,projectilesReset:d.projectilesReset===true});});
  window.addEventListener('kelo:guardian-pvp-reject',event=>{const d=event.detail||{};m.rejects.push({at:Date.now(),epoch:Number(d.epoch)||0,sequence:Number(d.sequence)||0,ackSequence:Number(d.ackSequence)||0,code:String(d.code||'')});});
  window.addEventListener('kelo:guardian-state',event=>{const s=event.detail||{};m.guardian.push({at:Date.now(),masterActive:!!s.masterActive,masterNodeId:s.master?.nodeId||null,masterEpoch:Number(s.master?.epoch)||0,connectedToMaster:!!s.dataPlane?.connectedToMaster,openPeerCount:Number(s.dataPlane?.openPeerCount)||0});if(m.guardian.length>600)m.guardian.shift();});
  window.addEventListener('kelo:guardian-peer-close',event=>m.peerCloses.push({at:Date.now(),nodeId:event.detail?.nodeId||null,reason:event.detail?.reason||null}));
}
async function primeContext(context,session,role){
  await context.addInitScript(({session,role,SESSION_KEY,NODE_KEY})=>{
    try{localStorage.setItem(SESSION_KEY,JSON.stringify(session));localStorage.removeItem(NODE_KEY);sessionStorage.setItem('kelo.guardian.failover.role',role);}catch(_){}
  },{session,role,SESSION_KEY,NODE_KEY});
}
async function loadGuardianLab(page,role){
  await page.goto(labUrl(role),{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.KELO_MODULE_LOADER&&window.KeloSimulation&&window.KeloOnlineAuth,{timeout:25000});
  await page.waitForFunction(()=>window.KeloOnlineAuth?.state?.().authenticated===true,{timeout:20000});
  await page.evaluate(async()=>{
    await window.KELO_MODULE_LOADER.ensure('guardian');
    if(!window.KeloGuardianPvPHost){
      await new Promise((resolve,reject)=>{
        const s=document.createElement('script');s.src='src/systems/guardian-pvp-host.js?v=3-worker';s.onload=resolve;s.onerror=()=>reject(new Error('GUARDIAN_PVP_HOST_LOAD_FAILED'));document.head.appendChild(s);
      });
    }
  });
  await page.waitForFunction(()=>window.KeloGuardian&&window.KeloGuardianPvPHost&&window.KELO_GUARDIAN_PVP_HOST_AUDIT?.isolatedWorker===true,{timeout:20000});
  await page.evaluate(metricScript);
  await page.evaluate(()=>window.KeloGuardian.activate());
  await page.waitForFunction(()=>window.KeloGuardian.state().enabled&&window.KeloGuardian.state().connected,{timeout:20000});
  return page.evaluate(()=>({nodeId:window.KeloGuardian.state().nodeId,guardianVersion:window.KeloGuardian.version,hostVersion:window.KeloGuardianPvPHost.version}));
}
async function waitForMasterView(page,nodeId,epoch,timeout=20000){
  await page.waitForFunction(({nodeId,epoch})=>{
    const s=window.KeloGuardian?.state?.()||{};return String(s.master?.nodeId||'')===String(nodeId)&&Number(s.master?.epoch||0)===Number(epoch);
  },{nodeId,epoch},{timeout});
}
async function waitForDirectPeer(page,masterSide,timeout=25000){
  await page.waitForFunction(masterSide?()=>Number(window.KeloGuardian?.state?.().dataPlane?.openPeerCount||0)>=1:()=>window.KeloGuardian?.state?.().dataPlane?.connectedToMaster===true,null,{timeout});
}
async function startRoom(page,roomId){return page.evaluate(roomId=>window.KeloGuardianPvPHost.start(roomId),roomId);}
async function submit(page,intent){return page.evaluate(intent=>window.KeloGuardianPvPHost.submitIntent(intent),intent);}
async function latestMetric(page){return page.evaluate(()=>{const m=window.__KELO_GUARDIAN_FAILOVER_METRICS__;return{snapshots:m.snapshots.slice(),takeovers:m.takeovers.slice(),rejects:m.rejects.slice(),guardian:m.guardian.slice(),peerCloses:m.peerCloses.slice()};});}
function distance(a,b){return Math.hypot((Number(a?.x)||0)-(Number(b?.x)||0),(Number(a?.y)||0)-(Number(b?.y)||0));}

const missing=missingSecrets();
test.skip(missing.length>0,`Guardian failover LIVE requires: ${missing.join(', ')}`);

test('Guardian PvP LIVE: Master A disappears and B resumes same room on a new epoch',async({browser})=>{
  test.setTimeout(Math.max(120000,MAX_FAILOVER_MS+90000));
  const adminSession=await signIn(process.env.KELO_GUARDIAN_TEST_ADMIN_EMAIL,process.env.KELO_GUARDIAN_TEST_ADMIN_PASSWORD);
  const donorSession=await signIn(process.env.KELO_GUARDIAN_TEST_DONOR_EMAIL,process.env.KELO_GUARDIAN_TEST_DONOR_PASSWORD);
  expect(adminSession.user.id).not.toBe(donorSession.user.id);

  let localBrowser=null,contextA=null,contextB=null,pageA=null,pageB=null,nodeA=null,nodeB=null;
  const roomId=`failover-${Date.now().toString(36)}`;
  let oldEpoch=0,newEpoch=0;
  try{
    if(REAL_IOS){
      contextA=await browser.newContext();
      localBrowser=await chromium.launch({headless:true});
      contextB=await localBrowser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    }else{
      contextA=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      contextB=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    }
    await primeContext(contextA,adminSession,'master-a');
    await primeContext(contextB,donorSession,'candidate-b');
    pageA=await contextA.newPage();pageB=await contextB.newPage();
    const [a,b]=await Promise.all([loadGuardianLab(pageA,'master-a'),loadGuardianLab(pageB,'candidate-b')]);
    nodeA=a.nodeId;nodeB=b.nodeId;expect(nodeA).toBeTruthy();expect(nodeB).toBeTruthy();expect(nodeA).not.toBe(nodeB);

    const masterA=await pageA.evaluate(()=>window.KeloGuardian.startMasterHost());
    oldEpoch=Number(masterA.master?.epoch||masterA.network?.masterEpoch||0);
    expect(oldEpoch).toBeGreaterThan(0);
    await pageB.evaluate(()=>window.KeloGuardian.heartbeat());
    await Promise.all([waitForMasterView(pageA,nodeA,oldEpoch),waitForMasterView(pageB,nodeA,oldEpoch)]);
    await Promise.all([waitForDirectPeer(pageA,true),waitForDirectPeer(pageB,false)]);

    await Promise.all([startRoom(pageA,roomId),startRoom(pageB,roomId)]);
    await pageA.waitForFunction(()=>window.KeloGuardianPvPHost.state().workerReady===true,null,{timeout:15000});

    expect(await submit(pageA,{sequence:1,action:'enter_pvp',phase:'none',moveX:0,moveY:0,aimX:1,aimY:0,clientTime:Date.now()})).toBe(1);
    expect(await submit(pageB,{sequence:1,action:'enter_pvp',phase:'none',moveX:0,moveY:0,aimX:-1,aimY:0,clientTime:Date.now()})).toBe(1);
    expect(await submit(pageA,{sequence:2,action:'input',phase:'held',moveX:0,moveY:0,aimX:1,aimY:0,clientTime:Date.now()})).toBe(2);
    expect(await submit(pageB,{sequence:2,action:'input',phase:'held',moveX:0,moveY:0,aimX:-1,aimY:0,clientTime:Date.now()})).toBe(2);

    await pageB.waitForFunction(epoch=>{
      const rows=window.__KELO_GUARDIAN_FAILOVER_METRICS__?.snapshots||[],last=[...rows].reverse().find(x=>x.epoch===epoch);return !!(last&&Object.keys(last.players||{}).length>=2&&Object.values(last.players||{}).some(p=>p.ackSequence>=2));
    },oldEpoch,{timeout:20000});
    const bActorId=await pageB.evaluate(()=>window.KeloGuardianPvPHost.actorId());
    const pre=await latestMetric(pageB),lastOld=[...pre.snapshots].reverse().find(s=>s.epoch===oldEpoch&&s.players?.[bActorId]);
    expect(lastOld).toBeTruthy();

    const failureAt=Date.now();
    // Close the entire A context. Guardian's lease is deliberately NOT released through stopMasterHost().
    // This models a tab/device disappearing and forces B to wait for server lease expiry.
    await contextA.close();contextA=null;pageA=null;

    let blockedInputs=0,claimErrors=0,masterAcquiredAt=0;
    const deadline=Date.now()+MAX_FAILOVER_MS;
    while(Date.now()<deadline){
      const state=await pageB.evaluate(async()=>{await window.KeloGuardian.heartbeat();return window.KeloGuardian.state();});
      if(!state.masterActive){
        const sent=await submit(pageB,{sequence:3,action:'input',phase:'held',moveX:0,moveY:0,aimX:-1,aimY:0,clientTime:Date.now()});
        if(!sent)blockedInputs++;
        try{await pageB.evaluate(()=>window.KeloGuardian.startMasterHost());}catch(_){claimErrors++;}
      }
      const next=await pageB.evaluate(()=>window.KeloGuardian.state());
      if(next.masterActive&&Number(next.master?.epoch||0)>oldEpoch){newEpoch=Number(next.master.epoch);masterAcquiredAt=Date.now();break;}
      await sleep(500);
    }
    expect(newEpoch,'B must acquire a strictly newer Master epoch').toBeGreaterThan(oldEpoch);

    await pageB.waitForFunction(epoch=>window.KeloGuardianPvPHost.state().workerReady===true&&Number(window.KeloGuardianPvPHost.state().masterEpoch)===epoch,newEpoch,{timeout:15000});
    await pageB.waitForFunction(epoch=>(window.__KELO_GUARDIAN_FAILOVER_METRICS__?.snapshots||[]).some(s=>s.epoch===epoch),newEpoch,{timeout:15000});

    // Retry the first post-takeover input only until the new worker accepts it. Sequence 3 is exactly last ACK + 1.
    let postAccepted=false;
    for(let i=0;i<12&&!postAccepted;i++){
      postAccepted=(await submit(pageB,{sequence:3,action:'input',phase:'held',moveX:0,moveY:0,aimX:-1,aimY:0,clientTime:Date.now()}))===3;
      if(!postAccepted)await sleep(250);
    }
    expect(postAccepted).toBe(true);
    await pageB.waitForFunction(({epoch,actorId})=>{
      const rows=window.__KELO_GUARDIAN_FAILOVER_METRICS__?.snapshots||[],last=[...rows].reverse().find(s=>s.epoch===epoch);return Number(last?.players?.[actorId]?.ackSequence||0)>=3;
    },{epoch:newEpoch,actorId:bActorId},{timeout:12000});

    const post=await latestMetric(pageB),firstNew=post.snapshots.find(s=>s.epoch===newEpoch),takeover=post.takeovers.find(t=>t.newEpoch===newEpoch);
    expect(firstNew).toBeTruthy();expect(takeover).toBeTruthy();
    const beforePlayer=lastOld.players[bActorId],afterPlayer=firstNew.players[bActorId];
    expect(afterPlayer).toBeTruthy();
    const positionDriftPx=distance(beforePlayer,afterPlayer);
    const failoverMs=firstNew.at-failureAt,snapshotGapMs=firstNew.at-lastOld.at,leaseAcquireMs=masterAcquiredAt-failureAt;
    const result={
      mode:REAL_IOS?'real-ios-master-a-to-local-chromium-b':'two-context-live',roomId,oldEpoch,newEpoch,failoverMs,snapshotGapMs,leaseAcquireMs,positionDriftPx,
      blockedInputsDuringOutage:blockedInputs,claimErrors,rejects:post.rejects.length,playersRestored:takeover.playersRestored,
      transientActionsReset:takeover.transientActionsReset,projectilesReset:takeover.projectilesReset,peerCloseEvents:post.peerCloses.length,
      persistentAuthority:false,economyAuthority:false
    };
    console.log('GUARDIAN_PVP_FAILOVER_LIVE',JSON.stringify(result));
    expect(failoverMs).toBeLessThanOrEqual(MAX_FAILOVER_MS+15000);
    expect(positionDriftPx).toBeLessThanOrEqual(MAX_POSITION_DRIFT_PX);
    expect(takeover.playersRestored).toBeGreaterThanOrEqual(1);
    expect(takeover.transientActionsReset).toBe(true);
    expect(takeover.projectilesReset).toBe(true);
    expect(blockedInputs).toBeGreaterThanOrEqual(1);
  }finally{
    if(pageB)try{await pageB.evaluate(()=>window.KeloGuardianPvPHost?.stop?.());}catch(_){}
    if(pageB)try{await pageB.evaluate(()=>window.KeloGuardian?.stopMasterHost?.());}catch(_){}
    if(pageB)try{await pageB.evaluate(()=>window.KeloGuardian?.deactivate?.());}catch(_){}
    if(contextA)try{await contextA.close();}catch(_){}
    if(contextB)try{await contextB.close();}catch(_){}
    if(localBrowser)try{await localBrowser.close();}catch(_){}
    // Server-side best-effort cleanup covers the intentionally crashed A node.
    if(nodeA)try{await rpc(adminSession,'guardian_master_stop',{p_node_id:nodeA});}catch{}
    if(nodeA)try{await rpc(adminSession,'guardian_disable',{p_node_id:nodeA});}catch{}
    if(nodeB)try{await rpc(donorSession,'guardian_master_stop',{p_node_id:nodeB});}catch{}
    if(nodeB)try{await rpc(donorSession,'guardian_disable',{p_node_id:nodeB});}catch{}
  }
});
