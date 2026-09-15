/* KELO-INDEX
 * area: QA / BUG RECOVERY
 * owner: /bugs Bug Intelligence support tooling
 * keys: RECOVERY PROFILE PLAYWRIGHT TRACE NETWORK BOOT MOVEMENT WORLD FREEZE EVIDENCE EXIT-CODE LEGACY-HISTORY
 * purpose: clasifica un checkout como PASS/FAIL/SKIP con perfiles deterministas reutilizables por CI y git bisect y deja trace/network evidence
 * public-api: CLI --profile=boot|movement|world|full --base=<url>
 * consumes: @playwright/test chromium, KELO_PAGES, recoveryLab runtime diagnostics
 * state-owned: recovery-artifacts only
 * online: N/A; QA local/cloud only
 * do-not: no modifica gameplay, no escribe bug lifecycle, no convierte un fallo de infraestructura en bug de producto
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const requireFromRepo=createRequire(path.join(process.cwd(),'package.json'));
let chromium;
try{({chromium}=requireFromRepo('@playwright/test'));}
catch(error){
  console.error('[recovery-profile] Playwright unavailable:',error?.message||error);
  process.exit(125);
}

const args=Object.fromEntries(process.argv.slice(2).map(raw=>{
  const clean=raw.replace(/^--/,'');
  const i=clean.indexOf('=');
  return i<0?[clean,'1']:[clean.slice(0,i),clean.slice(i+1)];
}));
const profile=String(args.profile||process.env.KELO_RECOVERY_PROFILE||'boot');
const allowed=new Set(['boot','movement','world','full']);
if(!allowed.has(profile)){
  console.error('[recovery-profile] invalid profile:',profile);
  process.exit(125);
}
const base=String(args.base||process.env.KELO_PAGES||'http://127.0.0.1:4173/');
const artifactDir=path.resolve(args.artifacts||process.env.KELO_RECOVERY_ARTIFACTS||'recovery-artifacts');
fs.mkdirSync(artifactDir,{recursive:true});

const report={
  schema:6,profile,base,startedAt:new Date().toISOString(),gitHead:null,result:'RUNNING',reason:null,
  steps:[],console:[],pageErrors:[],requestFailures:[],httpErrors:[],crashed:false,recovery:null,trace:null,
  compatibility:{worldProbe:null,authBridge:null,creatorHub:null,aclBridge:null}
};
try{report.gitHead=(await import('node:child_process')).execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
const shortHead=()=>String(report.gitHead||'unknown').slice(0,12);
const step=(name,data={})=>{const row={at:new Date().toISOString(),name,...data};report.steps.push(row);console.log('[recovery-profile]',name,JSON.stringify(data));return row;};
const save=()=>fs.writeFileSync(path.join(artifactDir,`profile-${profile}-${shortHead()}.json`),JSON.stringify(report,null,2));
const sanitizeUrl=raw=>{
  try{
    const url=new URL(String(raw));
    for(const key of [...url.searchParams.keys()]){
      if(!['aiGuest','guest','recoveryLab','recoveryHud','recoveryFlow','creators','creator','bug','freezeLab'].includes(key))url.searchParams.delete(key);
    }
    return `${url.origin}${url.pathname}${url.search}`;
  }catch{return String(raw||'').slice(0,500);}
};

function targetUrl(extra={}){
  const url=new URL(base);
  for(const [key,value] of Object.entries({aiGuest:'1',guest:'1',recoveryLab:'1',recoveryHud:'0',recoveryFlow:profile,...extra})){
    if(value!=null)url.searchParams.set(key,String(value));
  }
  return url.href;
}
function infrastructureError(error){
  const text=String(error?.message||error||'');
  return /Executable doesn't exist|browserType\.launch|ENOENT|ECONNREFUSED|ERR_CONNECTION_REFUSED|Target page, context or browser has been closed before navigation/i.test(text);
}

let browser=null,context=null,page=null,traceStarted=false;
async function makePage(){
  browser=await chromium.launch({headless:true});
  context=await browser.newContext({
    viewport:{width:390,height:844},
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    isMobile:true,hasTouch:true,deviceScaleFactor:2
  });
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  traceStarted=true;
  page=await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  page.on('console',msg=>{if(['error','warning'].includes(msg.type()))report.console.push({type:msg.type(),text:msg.text().slice(0,500)});});
  page.on('pageerror',error=>report.pageErrors.push(String(error?.message||error).slice(0,800)));
  page.on('requestfailed',request=>{
    if(report.requestFailures.length>=120)return;
    report.requestFailures.push({method:request.method(),url:sanitizeUrl(request.url()),error:String(request.failure()?.errorText||'REQUEST_FAILED').slice(0,400)});
  });
  page.on('response',response=>{
    if(response.status()<400||report.httpErrors.length>=120)return;
    report.httpErrors.push({status:response.status(),method:response.request().method(),url:sanitizeUrl(response.url())});
  });
  page.on('crash',()=>{report.crashed=true;step('PAGE_CRASH');});
}
async function ping(label='PING'){
  const t0=Date.now();
  const value=await page.evaluate(()=>({now:performance.now(),hidden:document.hidden,ready:document.readyState}));
  const ms=Date.now()-t0;
  step(label,{ms,...value});
  if(ms>2000)throw new Error(`EVENT_LOOP_FREEZE_${ms}MS`);
  return ms;
}
async function readPlayer(){
  return page.evaluate(()=>{
    try{
      const p=window.eval('localPlayer');
      return p?{x:Number(p.x),y:Number(p.y),vx:Number(p.vx)||0,vy:Number(p.vy)||0}:null;
    }catch{return null;}
  });
}
async function captureRecovery(){
  try{report.recovery=await page.evaluate(()=>window.KELO_RECOVERY_MESH?.report?.()||window.KELO_FREEZE_LOCATOR?.report?.()||null);}catch{}
}
async function bootCheck({navigate=true}={}){
  if(navigate){
    step('BOOT_NAVIGATE',{url:targetUrl()});
    await page.goto(targetUrl(),{waitUntil:'domcontentloaded',timeout:30000});
  }
  await page.waitForSelector('#game-canvas',{state:'attached',timeout:12000});
  await page.waitForFunction(()=>{
    try{
      const p=window.eval('localPlayer');
      return !!p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y));
    }catch{return false;}
  },null,{timeout:15000});
  const player=await readPlayer();
  const state=await page.evaluate(()=>({
    canvasW:document.getElementById('game-canvas')?.width||0,canvasH:document.getElementById('game-canvas')?.height||0,
    bootReady:!!globalThis.__keloBootReady
  }));
  Object.assign(state,player||{});
  step('BOOT_READY',state);
  if(!player||!state.bootReady||!state.canvasW||!state.canvasH)throw new Error('BOOT_NOT_READY');
  await ping('BOOT_EVENT_LOOP_PING');
}
async function movementCheck(){
  const before=await readPlayer();
  if(!before)throw new Error('MOVEMENT_PLAYER_UNAVAILABLE');
  step('MOVEMENT_START',before);
  await page.keyboard.down('d');
  const deadline=Date.now()+8000;
  while(Date.now()<deadline){await new Promise(r=>setTimeout(r,500));await ping('MOVEMENT_PING');}
  await page.keyboard.up('d');
  const after=await readPlayer();
  if(!after)throw new Error('MOVEMENT_PLAYER_LOST');
  const distance=Math.hypot(after.x-before.x,after.y-before.y);
  step('MOVEMENT_END',{...after,distance});
  if(!(distance>2))throw new Error(`MOVEMENT_STALLED_${distance.toFixed(2)}`);
}

async function bridgeHistoricalAccess(){
  const guest=page.getByRole('button',{name:/Jugar como invitado|Play as guest/i}).first();
  const guestVisible=await guest.isVisible({timeout:1200}).catch(()=>false);
  if(guestVisible){
    report.compatibility.authBridge='legacy-guest-button';
    step('AUTH_GUEST_GATE_FOUND');
    await guest.click({timeout:5000});
    await guest.waitFor({state:'hidden',timeout:8000}).catch(()=>{});
    await page.waitForTimeout(350);
    await ping('AUTH_GUEST_EVENT_LOOP_PING');
    step('AUTH_GUEST_ENTERED');
  }else{
    report.compatibility.authBridge='query-or-session';
  }

  const hub=page.locator('#kelo-creators-hub');
  const hubVisible=await hub.isVisible({timeout:1200}).catch(()=>false);
  if(!hubVisible){
    step('CREATOR_HUB_DIRECT_OPEN');
    await page.evaluate(async()=>{
      const mod=await import('./src/creators/ui/creator-hub.mjs');
      if(typeof mod.openCreatorHub!=='function')throw new Error('OPEN_CREATOR_HUB_MISSING');
      await mod.openCreatorHub({root:window});
    });
    report.compatibility.creatorHub='direct-module-open';
  }else{
    report.compatibility.creatorHub='already-open';
  }
  await hub.waitFor({state:'visible',timeout:10000});
  step('CREATOR_HUB_READY',{mode:report.compatibility.creatorHub});
}

async function installForensicWorldAclBridge(){
  const state=await page.evaluate(()=>{
    const keys=window.KELO_ADMIN_KEYS;
    const globalDescriptor=Object.getOwnPropertyDescriptor(window,'KELO_ADMIN_KEYS');
    const result={
      keys:!!keys,
      can:typeof keys?.can==='function',
      method:null,
      worldEditReady:!!window.KELO_WORLD_EDIT?.ready,
      inputLocks:!!window.KeloInputLocks?.acquire&&!!window.KeloInputLocks?.release,
      globalDescriptor:globalDescriptor?{writable:!!globalDescriptor.writable,configurable:!!globalDescriptor.configurable,setter:typeof globalDescriptor.set==='function'}:null
    };
    if(!keys||typeof keys.can!=='function')return result;
    const original=keys.can.bind(keys);
    const forensicCan=(capability,...rest)=>String(capability)==='world.edit'?true:original(capability,...rest);

    // Historical KELO_ADMIN_KEYS is frozen: `can` is read-only/non-configurable.
    // Do not mutate it or proxy a non-configurable property. Build a separate facade
    // preserving every other descriptor and replace only the global reference.
    try{
      const facade=Object.create(Object.getPrototypeOf(keys));
      for(const key of Reflect.ownKeys(keys)){
        if(key==='can')continue;
        const descriptor=Object.getOwnPropertyDescriptor(keys,key);
        if(descriptor)Object.defineProperty(facade,key,descriptor);
      }
      Object.defineProperty(facade,'can',{value:forensicCan,enumerable:true,writable:false,configurable:false});
      try{
        window.KELO_ADMIN_KEYS=facade;
      }catch{}
      if(window.KELO_ADMIN_KEYS!==facade&&globalDescriptor?.configurable){
        Object.defineProperty(window,'KELO_ADMIN_KEYS',{...globalDescriptor,value:facade});
      }
      result.replaced=window.KELO_ADMIN_KEYS===facade;
      if(result.replaced&&window.KELO_ADMIN_KEYS?.can?.('world.edit','forensic_probe')){
        result.method='facade-replacement';
        return result;
      }
    }catch(error){
      result.facadeError=String(error?.message||error);
    }
    return result;
  });
  report.compatibility.aclBridge=state.method||'failed';
  step('FORENSIC_ACL_BRIDGE',state);
  if(!state.method)throw new Error(`FORENSIC_WORLD_EDIT_PERMISSION_SHIM_FAILED:${JSON.stringify(state)}`);
  return state;
}

async function openWorldDirectForensic(){
  const preflight=await installForensicWorldAclBridge();
  report.compatibility.worldProbe='forensic-direct-entrypoint';
  step('WORLD_FORENSIC_DIRECT_START',preflight);
  await page.evaluate(()=>{
    window.__KELO_FORENSIC_WORLD_OPEN__={startedAt:performance.now(),phase:'import',done:false,error:null};
    Promise.resolve()
      .then(()=>import('./src/creators/ui/creator-hub.mjs'))
      .then(mod=>{try{mod.closeCreatorHub?.();}catch{}return import('./src/studio/integration/live-studio-controller.mjs');})
      .then(mod=>{
        const marker=window.__KELO_FORENSIC_WORLD_OPEN__;
        marker.phase='open';
        if(typeof mod.openKeloStudioLive!=='function')throw new Error('OPEN_KELO_STUDIO_LIVE_MISSING');
        return mod.openKeloStudioLive({root:window});
      })
      .then(()=>{const marker=window.__KELO_FORENSIC_WORLD_OPEN__;marker.phase='done';marker.done=true;})
      .catch(error=>{const marker=window.__KELO_FORENSIC_WORLD_OPEN__;marker.phase='error';marker.done=true;marker.error=String(error?.stack||error?.message||error);});
    return true;
  });
  step('WORLD_FORENSIC_DIRECT_DISPATCHED');
}

async function worldCheck({navigate=true}={}){
  if(navigate){
    const url=targetUrl({creators:'1',recoveryFlow:'world-open',bug:'BUG-0003',freezeLab:'1'});
    step('WORLD_NAVIGATE',{url});
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  }

  await bridgeHistoricalAccess();

  // Prefer the real user path when the current/historical ACL exposes it. When the
  // historical card is NO ACCESS, bypass only world.edit inside this isolated probe
  // and call the exact Studio entrypoint. That keeps ACL out of the regression variable.
  const world=page.locator('[data-workspace="world"], [aria-label="Abrir World"]').first();
  const actionable=await world.isVisible({timeout:2200}).catch(()=>false);
  let variant='';
  if(actionable){
    variant=await world.evaluate(el=>el.matches('[data-workspace="world"]')?'modern':'legacy-aria');
    report.compatibility.worldProbe=variant;
    step('WORLD_CARD_FOUND',{variant});
    await world.click({timeout:5000,force:true,noWaitAfter:true});
    step('WORLD_TAP',{variant});
  }else{
    variant='legacy-direct';
    step('WORLD_CARD_NOT_ACTIONABLE',{reason:'historical-acl-or-no-button'});
    await openWorldDirectForensic();
  }

  try{
    await page.waitForSelector('#kelo-studio-live',{state:'attached',timeout:10000});
  }catch(error){
    let marker=null;
    try{marker=await page.evaluate(()=>window.__KELO_FORENSIC_WORLD_OPEN__||null);}catch{}
    step('WORLD_SHELL_MOUNT_FAILED',{variant,marker});
    if(marker?.error)throw new Error(`WORLD_DIRECT_OPEN_ERROR:${marker.error}`);
    throw error;
  }
  step('WORLD_SHELL_MOUNTED',{variant});

  // Preserve the modern readiness contract. For legacy commits, use the status text
  // they actually exposed: initial "WORLD LIVE · loading" -> final stable WORLD LIVE state.
  await page.waitForFunction(({probeVariant})=>{
    const live=document.getElementById('kelo-studio-live');
    if(!live)return false;
    const status=String(live.querySelector('.ks-status')?.textContent||'').trim();
    if(probeVariant==='modern'){
      return live.dataset?.keloWorldLoading!=='1'&&Boolean(status);
    }
    if(!status)return false;
    if(!/^WORLD LIVE\s*·/i.test(status))return false;
    return !/(?:loading|booting world runtime|loading draft|catalog|canvas|controls|hud|start)/i.test(status);
  },{probeVariant:variant},{timeout:30000});

  const ready=await page.evaluate(({probeVariant})=>{
    const live=document.getElementById('kelo-studio-live');
    return {
      variant:probeVariant,
      loading:live?.dataset?.keloWorldLoading||null,
      status:String(live?.querySelector('.ks-status')?.textContent||'').trim(),
      buttons:live?.querySelectorAll('button')?.length||0,
      direct:window.__KELO_FORENSIC_WORLD_OPEN__||null
    };
  },{probeVariant:variant});
  step('WORLD_READY',ready);

  for(let i=0;i<3;i++){
    await new Promise(r=>setTimeout(r,500));
    await ping(`WORLD_PING_${i+1}`);
  }

  const select=page.locator('#kelo-studio-live button').filter({hasText:/SELECT/i}).first();
  if(await select.count()){
    await select.click({timeout:3000});
    step('WORLD_SAFE_CONTROL_CLICK',{control:'SELECT',variant});
    await ping('WORLD_POST_CLICK_PING');
  }
}

let exitCode=0;
try{
  await makePage();
  if(profile==='boot')await bootCheck();
  if(profile==='movement'){await bootCheck();await movementCheck();}
  if(profile==='world')await worldCheck();
  if(profile==='full'){await bootCheck();await movementCheck();await worldCheck({navigate:true});}
  if(report.crashed)throw new Error('PAGE_CRASH');
  await captureRecovery();
  report.result='PASS';step('PROFILE_PASS');
}catch(error){
  await captureRecovery();
  report.result=infrastructureError(error)?'SKIP':'FAIL';
  report.reason=String(error?.stack||error?.message||error).slice(0,4000);
  exitCode=report.result==='SKIP'?125:1;
  step(`PROFILE_${report.result}`,{reason:String(error?.message||error)});
  try{if(page&&!page.isClosed())await page.screenshot({path:path.join(artifactDir,`failure-${profile}-${shortHead()}.png`),fullPage:true});}catch{}
}finally{
  if(traceStarted&&context){
    const tracePath=path.join(artifactDir,`trace-${profile}-${shortHead()}.zip`);
    try{await context.tracing.stop({path:tracePath});report.trace=tracePath;}catch(error){report.traceError=String(error?.message||error).slice(0,500);}
  }
  report.finishedAt=new Date().toISOString();
  try{save();}catch(error){console.error('[recovery-profile] failed to save report',error);}
  try{await context?.close();}catch{}
  try{await browser?.close();}catch{}
}
process.exit(exitCode);