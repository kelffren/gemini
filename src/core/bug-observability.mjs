/* KELO-INDEX
 * area: CORE / BUG OBSERVABILITY
 * owner: Bug observability runtime
 * purpose: milestones, error capture and opt-in freeze boundary diagnostics without owning gameplay
 * public-api: createBugObserver(), installBugErrorCapture(), installFreezeLocator()
 * consumes: sessionStorage, PerformanceObserver, DOM state, input timestamps
 * state-owned: diagnostic session timeline only
 * online: N/A; diagnostic evidence stays local unless an explicit reporter/agent exports it
 * do-not: never mutate gameplay/editor authority or enable heavy diagnostics unless explicitly requested
 */

const DEFAULT_KEY='kelo:bug-observability:v1';
const FREEZE_LOCATOR_VERSION='freeze-locator-v1.0.0';

function safeStorage(root){
  try{return root?.sessionStorage||null;}catch{return null;}
}
function now(){return new Date().toISOString();}
function trim(value,max=500){const s=String(value??'');return s.length>max?s.slice(0,max)+'…':s;}
function perfNow(root){try{return Number(root?.performance?.now?.())||Date.now();}catch{return Date.now();}}
function queryEnabled(root){
  try{
    const q=new URLSearchParams(root?.location?.search||'');
    return q.get('freezeLab')==='1'||q.get('freeze')==='1'||q.get('debugFreeze')==='1';
  }catch{return false;}
}

export function createBugObserver({root=globalThis,flow='unknown',bugId=null,version=null,storageKey=DEFAULT_KEY,maxEvents=80}={}){
  const storage=safeStorage(root);
  const read=()=>{
    try{const parsed=JSON.parse(storage?.getItem(storageKey)||'[]');return Array.isArray(parsed)?parsed:[];}catch{return [];}
  };
  const write=events=>{try{storage?.setItem(storageKey,JSON.stringify(events.slice(-maxEvents)));}catch{}};
  const mark=(milestone,data={})=>{
    const event={at:now(),flow,bugId,version,milestone:trim(milestone,80),data:{}};
    for(const [k,v] of Object.entries(data||{}))event.data[trim(k,80)]=trim(v,300);
    const events=read();events.push(event);write(events);
    try{root.dispatchEvent?.(new CustomEvent('kelo:bug-milestone',{detail:event}));}catch{}
    return event;
  };
  const fail=(error,phase='UNHANDLED')=>mark('FAIL',{phase,name:error?.name||'Error',message:error?.message||error,stack:error?.stack||''});
  return Object.freeze({mark,fail,read,clear(){try{storage?.removeItem(storageKey);}catch{}},last(){const e=read();return e[e.length-1]||null;}});
}

export function installBugErrorCapture({root=globalThis,observer=createBugObserver({root,flow:'global'})}={}){
  if(root.__keloBugErrorCaptureInstalled)return observer;
  root.__keloBugErrorCaptureInstalled=true;
  try{root.addEventListener('error',event=>observer.fail(event.error||event.message,'window.error'));}catch{}
  try{root.addEventListener('unhandledrejection',event=>observer.fail(event.reason,'unhandledrejection'));}catch{}
  return observer;
}

export function installFreezeLocator({
  root=globalThis,
  flow='world-open',
  bugId='BUG-0003',
  version=FREEZE_LOCATOR_VERSION,
  force=false,
  tickMs=250,
  stallMs=700,
  severeStallMs=2000,
  stuckMs=3500
}={}){
  if(!force&&!queryEnabled(root))return null;
  if(root.__keloFreezeLocator)return root.__keloFreezeLocator;

  const observer=createBugObserver({root,flow,bugId,version,maxEvents:120});
  const previous=observer.last();
  installBugErrorCapture({root,observer});

  const doc=root?.document||null;
  const startedAt=perfNow(root);
  let lastTick=startedAt;
  let lastInputAt=startedAt;
  let lastInput='none';
  let maxGap=0;
  let stallCount=0;
  let resourceCount=0;
  let lastResource='none';
  let shellState='missing';
  let statusText='boot';
  let statusChangedAt=startedAt;
  let stuckMarkedFor='';
  let timer=0;
  let hud=null;
  let resourceObserver=null;
  let longTaskObserver=null;
  let destroyed=false;

  const relevantResource=name=>/\/src\/(studio|creators)\//.test(String(name||''));
  const shortResource=name=>{
    const raw=String(name||'');
    const i=raw.indexOf('/src/');
    return trim(i>=0?raw.slice(i+1):raw,180);
  };
  const mark=(milestone,data={})=>observer.mark(milestone,data);

  function getShellSnapshot(){
    const shell=doc?.getElementById?.('kelo-studio-live')||null;
    if(!shell)return {state:'missing',status:'no studio shell'};
    const status=String(shell.querySelector?.('[data-kelo-world-launch-status], .ks-status')?.textContent||'').trim();
    const loading=shell.dataset?.keloWorldLoading==='1';
    const hasStatus=!!shell.querySelector?.('.ks-status');
    return {state:loading?'loading':hasStatus?'ready':'mounted',status:status||'(empty status)'};
  }

  function ensureHud(){
    if(hud?.isConnected||!doc?.body||typeof doc.createElement!=='function')return hud;
    hud=doc.createElement('aside');
    hud.id='kelo-freeze-locator';
    hud.setAttribute('data-kelo-debug-ui','freeze-locator');
    hud.setAttribute('aria-live','polite');
    hud.style.cssText='position:fixed;top:max(6px,env(safe-area-inset-top));right:6px;z-index:2147483646;pointer-events:none;max-width:min(82vw,330px);padding:7px 9px;border-radius:10px;border:1px solid rgba(231,197,106,.5);background:rgba(0,0,0,.76);color:#f7e7b4;font:700 10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere;text-align:left';
    doc.body.append(hud);
    return hud;
  }

  function renderHud(gap=0){
    ensureHud();
    if(!hud)return;
    const elapsed=((perfNow(root)-startedAt)/1000).toFixed(1);
    const inputAge=((perfNow(root)-lastInputAt)/1000).toFixed(1);
    const stuckAge=((perfNow(root)-statusChangedAt)/1000).toFixed(1);
    hud.textContent=`FREEZE LOCATOR · ${bugId}\n${shellState.toUpperCase()} · ${statusText}\nlast module: ${lastResource}\nloop ${Math.round(gap)}ms / max ${Math.round(maxGap)}ms · stalls ${stallCount}\ninput ${lastInput} ${inputAge}s ago · status age ${stuckAge}s · t+${elapsed}s`;
  }

  function sampleDom(){
    const next=getShellSnapshot();
    if(next.state!==shellState){
      shellState=next.state;
      mark('SHELL_STATE',{state:shellState,status:next.status});
    }
    if(next.status!==statusText){
      statusText=next.status;
      statusChangedAt=perfNow(root);
      stuckMarkedFor='';
      mark('STATUS_CHANGE',{state:shellState,status:statusText,lastResource});
    }
    const age=perfNow(root)-statusChangedAt;
    if(shellState==='loading'&&age>=stuckMs&&stuckMarkedFor!==statusText){
      stuckMarkedFor=statusText;
      mark('STATUS_STUCK',{status:statusText,stuckMs:Math.round(age),lastResource,maxGap:Math.round(maxGap)});
    }
  }

  function tick(){
    if(destroyed)return;
    const t=perfNow(root);
    const gap=t-lastTick;
    lastTick=t;
    maxGap=Math.max(maxGap,gap);
    if(gap>=stallMs){
      stallCount++;
      mark(gap>=severeStallMs?'EVENT_LOOP_SEVERE_STALL':'EVENT_LOOP_STALL',{gapMs:Math.round(gap),status:statusText,lastResource,shellState});
    }
    sampleDom();
    renderHud(gap);
  }

  const onInput=event=>{
    lastInputAt=perfNow(root);
    const target=event?.target;
    const label=target?.getAttribute?.('aria-label')||target?.textContent||target?.id||target?.tagName||event?.type||'input';
    lastInput=trim(`${event?.type||'input'}:${String(label).trim().replace(/\s+/g,' ')}`,80);
  };

  try{
    for(const type of ['pointerdown','touchstart','click'])root.addEventListener?.(type,onInput,{capture:true,passive:true});
  }catch{}

  try{
    if(typeof root.PerformanceObserver==='function'){
      resourceObserver=new root.PerformanceObserver(list=>{
        const relevant=list.getEntries().filter(entry=>relevantResource(entry?.name));
        if(!relevant.length)return;
        resourceCount+=relevant.length;
        const last=relevant[relevant.length-1];
        lastResource=shortResource(last?.name);
        mark('RESOURCE_READY',{resource:lastResource,durationMs:Math.round(Number(last?.duration)||0),resourceCount,status:statusText});
      });
      resourceObserver.observe({type:'resource',buffered:true});
    }
  }catch(error){mark('RESOURCE_OBSERVER_UNAVAILABLE',{message:error?.message||error});}

  try{
    if(typeof root.PerformanceObserver==='function'&&root.PerformanceObserver.supportedEntryTypes?.includes?.('longtask')){
      longTaskObserver=new root.PerformanceObserver(list=>{
        for(const entry of list.getEntries())mark('LONG_TASK',{durationMs:Math.round(Number(entry?.duration)||0),status:statusText,lastResource});
      });
      longTaskObserver.observe({type:'longtask',buffered:true});
    }
  }catch(error){mark('LONGTASK_OBSERVER_UNAVAILABLE',{message:error?.message||error});}

  try{root.addEventListener?.('pagehide',()=>mark('PAGE_HIDE',{status:statusText,lastResource,shellState}));}catch{}
  try{root.addEventListener?.('pageshow',event=>mark('PAGE_SHOW',{persisted:!!event?.persisted,status:statusText}));}catch{}
  try{doc?.addEventListener?.('visibilitychange',()=>mark('VISIBILITY',{state:doc.visibilityState,status:statusText}));}catch{}

  const report=()=>Object.freeze({
    version,flow,bugId,
    generatedAt:now(),
    elapsedMs:Math.round(perfNow(root)-startedAt),
    shellState,statusText,statusAgeMs:Math.round(perfNow(root)-statusChangedAt),
    lastResource,resourceCount,maxGapMs:Math.round(maxGap),stallCount,
    lastInput,inputAgeMs:Math.round(perfNow(root)-lastInputAt),
    events:observer.read().filter(event=>event?.flow===flow).slice(-60)
  });

  const destroy=()=>{
    if(destroyed)return;
    destroyed=true;
    try{if(timer)(root.clearInterval||clearInterval)(timer);}catch{}
    try{resourceObserver?.disconnect?.();}catch{}
    try{longTaskObserver?.disconnect?.();}catch{}
    try{for(const type of ['pointerdown','touchstart','click'])root.removeEventListener?.(type,onInput,true);}catch{}
    try{hud?.remove?.();}catch{}
    root.__keloFreezeLocator=null;
  };

  const api=Object.freeze({version,mark,report,read:observer.read,last:observer.last,destroy,get hud(){return hud;}});
  root.__keloFreezeLocator=api;
  root.KELO_FREEZE_LOCATOR=api;

  mark('LOCATOR_START',{
    previousMilestone:previous?.milestone||'none',
    previousAt:previous?.at||'none',
    href:trim(root?.location?.href||'',220)
  });
  sampleDom();
  renderHud(0);
  timer=(root.setInterval||setInterval)(tick,Math.max(100,Number(tickMs)||250));
  return api;
}
