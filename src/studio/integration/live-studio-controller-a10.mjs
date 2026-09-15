/* KELO-INDEX
 * area: STUDIO / A10 MOBILE HYDRATION
 * owner: mobile World editor boot orchestration only
 * owns: real serialization of deferred mobile hydration/basic-tools/productivity/extras and explicit asset-palette activation
 * does-not-own: Studio session state, world authority, tools, UI implementation or document semantics
 * public-api: openKeloStudioLive(), closeKeloStudioLive(), getKeloStudioLive()
 * mobile: captures legacy delayed boot tasks, hydrates the map alone, returns the basic editor, then waits for each ESM graph to actually settle before starting the next optional phase
 */
import { yieldStudioBoot } from './studio-boot-pace.mjs';

const moduleUrl=new URL(import.meta.url);
const BUILD=moduleUrl.searchParams.get('v')||'world-bridge-20260915-21';
const CONTROLLER=`./live-studio-controller.mjs?v=${encodeURIComponent(BUILD)}`;
const MODULE_BY_KIND=Object.freeze({
  'basic-tools':'register-basic-tools.mjs',
  productivity:'creator-productivity-panel.mjs',
  extras:'studio-boot-extras.mjs',
  'asset-palette':'studio-asset-palette.mjs'
});
let controllerMod=null;
const cleanupByRoot=new WeakMap();

function isPhone(root){const ua=String(root?.navigator?.userAgent||'');const short=Math.min(Number(root?.innerWidth)||999,Number(root?.innerHeight)||999);return /iPhone|iPad|iPod|Android/i.test(ua)||short<=500;}
function perfNow(root){try{return Number(root?.performance?.now?.())||Date.now();}catch{return Date.now();}}
function studioResources(root){try{return (root?.performance?.getEntriesByType?.('resource')||[]).filter(row=>String(row?.name||'').includes('/src/studio/')).map(row=>String(row.name||''));}catch{return [];}}
function snapshot(root,extra={}){const doc=root?.document,shell=doc?.getElementById?.('kelo-studio-live')||null;let heapMb='';try{const bytes=Number(root?.performance?.memory?.usedJSHeapSize);if(Number.isFinite(bytes)&&bytes>0)heapMb=Math.round(bytes/1048576);}catch{}return{t:Math.round(perfNow(root)),build:BUILD,canvases:doc?.querySelectorAll?.('canvas')?.length||0,studioCanvases:shell?.querySelectorAll?.('canvas')?.length||0,resources:studioResources(root).length,heapMb,...extra};}
function mark(observer,root,name,data={}){try{observer?.mark?.(name,snapshot(root,data));}catch{}}
function callbackText(fn){try{return Function.prototype.toString.call(fn);}catch{return '';}}
function classifyTimer(fn,delay){const ms=Number(delay)||0,text=callbackText(fn);if(fn?.name==='hydrateAfterChrome')return 'hydrate';if(ms>=7000&&text.includes('creator-productivity-panel.mjs'))return 'productivity';if(ms>=7000&&text.includes('loadBasicTools'))return 'basic-tools';if(ms>=7000&&text.includes('loadAssetPalette'))return 'asset-palette';if(ms>=14000&&text.includes('installStudioProductivityExtras'))return 'extras';return '';}
function createCapture(root){
  const originalSet=root?.setTimeout,originalClear=root?.clearTimeout;
  const nativeSet=typeof originalSet==='function'?originalSet.bind(root):setTimeout,nativeClear=typeof originalClear==='function'?originalClear.bind(root):clearTimeout;
  const tasks=new Map();let nextId=-100000;
  const add=(kind,fn,args=[])=>{const id=nextId--;tasks.set(id,{id,kind,fn,args});return id;};
  const set=function(fn,delay,...args){const kind=classifyTimer(fn,delay);return kind?add(kind,fn,args):nativeSet(fn,delay,...args);};
  const clear=function(id){if(tasks.has(id)){tasks.delete(id);return;}nativeClear(id);};
  try{root.setTimeout=set;root.clearTimeout=clear;}catch{}
  const restore=()=>{try{if(originalSet)root.setTimeout=originalSet;else delete root.setTimeout;}catch{}try{if(originalClear)root.clearTimeout=originalClear;else delete root.clearTimeout;}catch{}};
  const take=kind=>Array.from(tasks.values()).filter(row=>row.kind===kind).map(row=>{tasks.delete(row.id);return row;});
  return{restore,take};
}
function nextTask(root){return new Promise(resolve=>{const wait=typeof root?.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;wait(resolve,0);});}
async function waitForStudioModuleSettled(root,kind){
  const fragment=MODULE_BY_KIND[kind];
  if(!fragment){await nextTask(root);return;}
  let seen=false,lastCount=-1,stableTurns=0;
  // A void dynamic import finishes evaluation before later timer tasks can run.
  // Require the target resource to be observed and the Studio resource count to
  // remain unchanged across several separate tasks before the next heavy phase.
  for(let turn=0;turn<96;turn++){
    await nextTask(root);
    const names=studioResources(root),count=names.length;
    if(names.some(name=>name.includes(fragment)))seen=true;
    if(seen&&count===lastCount)stableTurns++;else stableTurns=0;
    lastCount=count;
    if(seen&&stableTurns>=3)return;
  }
  // Never deadlock the editor if Resource Timing is unavailable/capped.
  await yieldStudioBoot(root);
}
async function runTasks(root,kind,rows=[]){
  for(const row of rows){
    if(typeof row.fn!=='function')continue;
    const result=row.fn(...row.args);
    if(result&&typeof result.then==='function')await result;
    await waitForStudioModuleSettled(root,kind);
  }
}
async function loadController(){if(controllerMod)return controllerMod;controllerMod=await import(CONTROLLER);return controllerMod;}

export async function openKeloStudioLive(opts={}){
  const root=opts.root||globalThis,observer=opts.__a10Observer||root?.KELO_A10_OBSERVER||null,ctrl=await loadController();
  if(!isPhone(root))return ctrl.openKeloStudioLive(opts);
  cleanupByRoot.get(root)?.();cleanupByRoot.delete(root);
  const previousObserver=root?.KELO_A10_OBSERVER;try{root.KELO_A10_OBSERVER=observer;}catch{}
  const capture=createCapture(root);let session;
  try{session=await ctrl.openKeloStudioLive(opts);}finally{capture.restore();}
  mark(observer,root,'A10_CHROME_READY');
  mark(observer,root,'A10_CORE_READY',{entities:session?.studio?.kernel?.document?.entities?.length||0});

  const hydrate=capture.take('hydrate'),basic=capture.take('basic-tools'),productivity=capture.take('productivity'),extras=capture.take('extras'),assets=capture.take('asset-palette');
  if(hydrate.length){await yieldStudioBoot(root);for(const row of hydrate){const result=row.fn?.(...row.args);if(result&&typeof result.then==='function')await result;}}
  mark(observer,root,'A10_MAP_READY',{entities:session?.studio?.kernel?.document?.entities?.length||0,terrain:Object.keys(session?.studio?.kernel?.document?.terrain||{}).length,collisions:Object.keys(session?.studio?.kernel?.document?.navigation?.collisions||{}).length});

  let closed=false;
  // Register every optional phase now, but gate execution behind the next browser
  // task. Promise resolution of open() therefore reaches the bridge/workspace first
  // and the basic editor becomes interactive before optional modules begin.
  const startGate=new Promise(resolve=>{const wait=typeof root?.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;wait(resolve,0);});
  let phaseChain=startGate;
  const queuePhase=(label,kind,rows,startMark=null,readyMark=null)=>{
    if(!rows.length)return phaseChain;
    phaseChain=phaseChain.then(async()=>{
      if(closed)return null;
      await nextTask(root);
      if(closed)return null;
      if(startMark)mark(observer,root,startMark);
      const started=perfNow(root);
      await runTasks(root,kind,rows);
      if(readyMark)mark(observer,root,readyMark,{durationMs:Math.round(perfNow(root)-started)});
      return null;
    }).catch(error=>{console.warn(`[Kelo Studio A10] ${label} phase failed; editor remains usable`,error);return null;});
    return phaseChain;
  };
  queuePhase('basic-tools','basic-tools',basic,'A10_BASIC_TOOLS_START','A10_BASIC_TOOLS_READY');
  queuePhase('productivity','productivity',productivity,'A10_PRODUCTIVITY_START','A10_PRODUCTIVITY_READY');
  queuePhase('extras','extras',extras,'A10_EXTRAS_START','A10_EXTRAS_READY');

  let assetsRequested=false;
  const onAssetsClick=event=>{
    const opener=event?.target?.closest?.('[data-act="edit-assets"],[data-clean-action="assets"]');
    if(!opener||assetsRequested||!assets.length)return;
    assetsRequested=true;
    mark(observer,root,'A10_ASSETS_REQUESTED');
    queuePhase('asset-palette','asset-palette',assets,null,'A10_ASSETS_READY');
  };
  try{root.document?.addEventListener?.('click',onAssetsClick,true);}catch{}
  const cleanup=()=>{closed=true;try{root.document?.removeEventListener?.('click',onAssetsClick,true);}catch{}try{if(previousObserver===undefined)delete root.KELO_A10_OBSERVER;else root.KELO_A10_OBSERVER=previousObserver;}catch{}};
  cleanupByRoot.set(root,cleanup);
  return session;
}
export async function closeKeloStudioLive(opts={}){const root=opts.root||globalThis;cleanupByRoot.get(root)?.();cleanupByRoot.delete(root);const ctrl=controllerMod||await loadController();return ctrl.closeKeloStudioLive(opts);}
export function getKeloStudioLive(){return controllerMod?.getKeloStudioLive?.()||null;}
