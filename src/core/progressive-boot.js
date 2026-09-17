/* KELO-INDEX
 * area: CORE / BOOT
 * owner: KeloProgressiveBoot
 * keys: 4G PROGRESSIVE PLAY-FIRST STAGES PRELOAD RESOURCE-TIMING IOS SAFARI
 * purpose: release the playable core as soon as the visual minimum is ready, then stream legacy/world/UI/services in dependency order with network-aware pacing.
 * public-api: KELO_PROGRESSIVE_BOOT.start/retry/getState/profile
 * state-owned: ephemeral boot metrics + one compact last-boot snapshot in localStorage
 * do-not: NO second game loop, NO dependency-order parallel execution, NO API/session/gameplay caching
 */
(function(root){
'use strict';
if(root.KELO_PROGRESSIVE_BOOT)return;

const VERSION='kelo-progressive-boot-v1-4g';
const BUILD='V6.69';
const STORAGE_KEY='kelo.4g.lastBoot.v1';
const STAGES=Object.freeze([
  Object.freeze({id:'visual',label:'Visual mínimo',priority:'high',files:Object.freeze([
    'src/core/camera-follow-shadow.js?v=1',
    'src/core/camera-system.js?v=1',
    'src/core/viewport-system.js?v=1',
    'src/core/avatar-render-system.js?v=2-base-zoo-authority',
    'src/core/render-extension-system.js?v=4-render-owner',
    'src/core/simulation-extension-system.js?v=4-sim-owner',
    'src/core/simulation-farm-shadow.js?v=1',
    'src/core/player-position-shadow.js?v=1'
  ])}),
  Object.freeze({id:'legacy',label:'Runtime cercano',priority:'auto',files:Object.freeze([
    'engine-d.js?v=95',
    'engine-e.js?v=94',
    'engine-f.js?v=95',
    'engine-g.js?v=96',
    'src/environment/mobile-performance-contract.js?v=2-cache-working-set',
    'engine-h.js?v=151',
    'engine-i.js?v=95-minimap-off-20260916',
    'engine-j.js?v=94',
    'engine-k.js?v=94'
  ])}),
  Object.freeze({id:'environment',label:'Mundo',priority:'low',files:Object.freeze([
    'src/environment/rural-nature-atlas.js?v=200',
    'src/environment/gardens-atlas.js?v=2',
    'src/environment/gardens-joins.js?v=3',
    'src/environment/terrain-contract.js?v=1',
    'src/environment/generated/arboleskelo1-atlas.js?v=1',
    'src/environment/tile-registry.js?v=237',
    'src/environment/atlas-contract.js?v=4',
    'src/environment/gardens-t-junction-registry.js?v=1',
    'src/environment/district-decals-registry.js?v=3',
    'src/environment/gardens-compositions.js?v=10',
    'src/environment/world-map.js?v=terrain-191',
    'src/environment/environment-layer-stack.js?v=5-dirty-audit',
    'src/environment/surface-ground.js?v=1',
    'src/environment/prop-contract.js?v=7-map-probe',
    'src/environment/generic-props.js?v=9',
    'src/environment/prefab-contract.js?v=1',
    'engine-l.js?v=223'
  ])}),
  Object.freeze({id:'ui',label:'Interfaz',priority:'low',files:Object.freeze([
    'src/ui/luxe-shell.js?v=231',
    'src/ui/mobile-orientation.js?v=6',
    'src/ui/luxe-player-hud.js?v=5-minimap-off-20260916',
    'src/systems/performance-governor.js?v=5-sampled-snapshots'
  ])}),
  Object.freeze({id:'services',label:'Servicios',priority:'low',files:Object.freeze([
    'src/core/feature-registry.js?v=2',
    'src/core/asset-registry.js?v=2-feature-registry',
    'src/core/module-loader.js?v=10-feature-registry',
    'src/ui/asset-library-launcher.js?v=1',
    'src/core/settings-lazy-gate.js?v=3-update-intel',
    'src/core/hot-data-registry.js?v=1-transactional',
    'src/abilities/ability-balance-hot-owner.js?v=1',
    'src/systems/equipment-market-hot-owner.js?v=1',
    'src/systems/arena-progression-hot-owner.js?v=1',
    'src/systems/liveops-world-content-hot-owner.js?v=1',
    'src/systems/liveops-interaction-runtime.js?v=1',
    'src/systems/liveops-npc-world-runtime.js?v=1',
    'src/core/update-gate.js?v=8-hot-data',
    'src/core/session-continuity-system.js?v=2-update-classes',
    'src/core/session-continuity-retry.js?v=1-event-driven',
    'src/systems/admin-key-system.js?v=1',
    'src/core/admin-control-lazy-gate.js?v=2',
    'src/core/account-live-control-gate.js?v=2',
    'src/core/creators-lazy-gate.js?v=3'
  ])})
]);

const executed=new Set();
const preloaded=new Set();
let runPromise=null;
let generation=0;
let state={
  version:VERSION,build:BUILD,status:'idle',stage:null,profile:null,
  startedAt:null,playableAt:null,completedAt:null,playableMs:null,completeMs:null,
  loadedStages:[],files:[],totalTransfer:0,totalEncoded:0,totalDecoded:0,
  failures:[],retryCount:0
};

function emit(name,detail){
  try{root.dispatchEvent(new CustomEvent('kelo:progressive-boot:'+name,{detail:Object.freeze(Object.assign(getState(),detail||{}))}));}catch(_){}
}
function query(){
  try{return new URLSearchParams(root.location&&root.location.search||'');}catch(_){return new URLSearchParams();}
}
function detectProfile(){
  const q=query();
  const override=String(q.get('keloNetwork')||'').toLowerCase();
  const c=root.navigator&&(root.navigator.connection||root.navigator.mozConnection||root.navigator.webkitConnection)||null;
  const effective=override==='save-data'?'':(override||String(c&&c.effectiveType||'').toLowerCase());
  const saveData=override==='save-data'||!!(c&&c.saveData);
  let coarse=false;
  try{coarse=!!root.matchMedia&&root.matchMedia('(pointer: coarse)').matches;}catch(_){}
  const shortSide=Math.min(Number(root.innerWidth)||9999,Number(root.innerHeight)||9999);
  const mobile=coarse||shortSide<=844;
  let tier='fast';
  if(saveData)tier='save-data';
  else if(effective==='slow-2g'||effective==='2g'||effective==='3g')tier='constrained';
  else if(effective==='4g')tier='4g';
  else if(mobile)tier='mobile-unknown';
  const table={
    'save-data':{lookahead:1,yieldMs:36,busyYieldMs:180},
    constrained:{lookahead:2,yieldMs:26,busyYieldMs:150},
    '4g':{lookahead:4,yieldMs:8,busyYieldMs:90},
    'mobile-unknown':{lookahead:3,yieldMs:12,busyYieldMs:110},
    fast:{lookahead:6,yieldMs:0,busyYieldMs:48}
  };
  const tuning=table[tier];
  return Object.freeze({
    tier,
    effectiveType:effective||null,
    saveData,
    mobile,
    downlinkMbps:c&&Number.isFinite(Number(c.downlink))?Number(c.downlink):null,
    rttMs:c&&Number.isFinite(Number(c.rtt))?Number(c.rtt):null,
    lookahead:tuning.lookahead,
    yieldMs:tuning.yieldMs,
    busyYieldMs:tuning.busyYieldMs,
    override:override||null
  });
}
const PROFILE=detectProfile();

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)));}
function nextFrame(){
  return new Promise(resolve=>{
    if(typeof root.requestAnimationFrame!=='function'){resolve();return;}
    root.requestAnimationFrame(()=>resolve());
  });
}
function busy(){
  try{
    if(typeof input!=='undefined'&&input&&(input.active||Math.abs(Number(input.normX)||0)>.02||Math.abs(Number(input.normY)||0)>.02))return true;
  }catch(_){}
  return false;
}
function base(src){return String(src||'').split('?')[0];}
function abs(src){return new URL(src,document.baseURI).href;}
function metric(src){
  try{
    const entries=performance.getEntriesByName(abs(src));
    const e=entries.length?entries[entries.length-1]:null;
    return e?{
      transferSize:Number(e.transferSize)||0,
      encodedBodySize:Number(e.encodedBodySize)||0,
      decodedBodySize:Number(e.decodedBodySize)||0,
      durationMs:Math.round(Number(e.duration)||0)
    }:{transferSize:0,encodedBodySize:0,decodedBodySize:0,durationMs:0};
  }catch(_){return {transferSize:0,encodedBodySize:0,decodedBodySize:0,durationMs:0};}
}
function chip(){
  return {
    box:document.getElementById('kelo-module-loader'),
    text:document.getElementById('kelo-ml-text'),
    bar:document.getElementById('kelo-ml-bar')
  };
}
function show(message,pct){
  const c=chip();
  if(!c.box)return;
  c.box.hidden=false;
  if(c.text)c.text.textContent=message;
  if(c.bar)c.bar.style.width=Math.max(0,Math.min(100,Number(pct)||0))+'%';
}
function hide(message){
  const c=chip();
  if(!c.box)return;
  if(message)show(message,100);
  setTimeout(()=>{if(c.box)c.box.hidden=true;},650);
}
function preload(src,priority){
  const key=abs(src);
  if(preloaded.has(key)||executed.has(base(src)))return;
  preloaded.add(key);
  const link=document.createElement('link');
  link.rel='preload';
  link.as='script';
  link.href=src;
  link.dataset.keloProgressivePreload='1';
  try{link.fetchPriority=priority==='high'?'high':'low';}catch(_){}
  document.head.appendChild(link);
}
function preloadWindow(stage,index){
  const end=Math.min(stage.files.length,index+1+PROFILE.lookahead);
  for(let i=index+1;i<end;i++)preload(stage.files[i],stage.priority);
}
function alreadyLoaded(src){
  const key=base(src);
  if(executed.has(key))return true;
  const found=Array.from(document.scripts).some(script=>{
    const raw=script.getAttribute('src');
    return raw&&base(raw)===key&&script.dataset.keloProgressiveFailed!=='1';
  });
  if(found)executed.add(key);
  return found;
}
async function loadScript(stage,src,attempt){
  if(alreadyLoaded(src))return Object.assign({stage:stage.id,src,ok:true,cached:true,attempt,wallMs:0},metric(src));
  await nextFrame();
  if(stage.id!=='visual'&&busy())await sleep(PROFILE.busyYieldMs);
  else if(PROFILE.yieldMs)await sleep(PROFILE.yieldMs);

  const t0=performance.now();
  const result=await new Promise(resolve=>{
    const script=document.createElement('script');
    const url=attempt>0?new URL(src,document.baseURI):null;
    if(url){url.searchParams.set('kelo_retry',String(attempt));script.src=url.href;}else script.src=src;
    script.async=false;
    script.dataset.keloProgressiveStage=stage.id;
    try{script.fetchPriority=stage.priority==='high'?'high':'low';}catch(_){}
    script.onload=()=>{
      script.dataset.keloProgressiveLoaded='1';
      executed.add(base(src));
      resolve({ok:true});
    };
    script.onerror=()=>{
      script.dataset.keloProgressiveFailed='1';
      try{script.remove();}catch(_){}
      resolve({ok:false});
    };
    document.head.appendChild(script);
  });
  const row=Object.assign({
    stage:stage.id,src,ok:result.ok,cached:false,attempt,
    wallMs:Math.round(performance.now()-t0)
  },metric(attempt>0?new URL(src,document.baseURI).href:src));
  state.files.push(row);
  state.totalTransfer+=row.transferSize;
  state.totalEncoded+=row.encodedBodySize;
  state.totalDecoded+=row.decodedBodySize;
  emit(result.ok?'file-end':'file-error',row);
  return row;
}
async function loadWithRetry(stage,src){
  let row=await loadScript(stage,src,0);
  if(row.ok)return row;
  state.retryCount++;
  row=await loadScript(stage,src,1);
  if(!row.ok)state.failures.push({stage:stage.id,src,error:'SCRIPT_LOAD_FAILED_AFTER_RETRY'});
  return row;
}
function releasePlayable(){
  if(state.playableAt!==null)return;
  state.playableAt=performance.now();
  state.playableMs=Math.round(state.playableAt-state.startedAt);
  root.__keloBootReady=true;
  try{root.dispatchEvent(new Event('kelo:boot-ready'));}catch(_){}
  try{root.__KELO_MINIMAP_PURGE__&&root.__KELO_MINIMAP_PURGE__();}catch(_){}
  emit('playable',{playableMs:state.playableMs});
}
function startModuleLoader(){
  try{root.KELO_MODULE_LOADER&&root.KELO_MODULE_LOADER.start({build:BUILD});}catch(error){console.error('[Kelo Progressive Boot] module loader start',error);}
}
function persist(){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify({
      version:VERSION,build:BUILD,status:state.status,profile:state.profile,
      playableMs:state.playableMs,completeMs:state.completeMs,
      totalTransfer:state.totalTransfer,totalEncoded:state.totalEncoded,totalDecoded:state.totalDecoded,
      loadedStages:state.loadedStages.slice(),failures:state.failures.slice(0,8),at:Date.now()
    }));
  }catch(_){}
}
async function runStage(stage,stageIndex){
  state.stage=stage.id;
  emit('stage-start',{stage:stage.id,label:stage.label,files:stage.files.length});
  for(let i=0;i<stage.files.length;i++){
    preloadWindow(stage,i);
    const total=STAGES.reduce((sum,s)=>sum+s.files.length,0);
    const done=state.files.filter(x=>x.ok).length;
    show('4G · '+stage.label+' '+(i+1)+'/'+stage.files.length,Math.max(3,Math.round(done/total*100)));
    const row=await loadWithRetry(stage,stage.files[i]);
    if(!row.ok){
      state.status='basic-mode';
      state.stage=null;
      root.__KELO_PROGRESSIVE_BOOT_FAILED__={stage:stage.id,src:stage.files[i],at:Date.now()};
      if(stage.id==='visual')releasePlayable();
      show('Modo básico activo · toca Actualizar',100);
      persist();
      emit('failed',{stage:stage.id,src:stage.files[i]});
      return false;
    }
  }
  state.loadedStages.push(stage.id);
  emit('stage-end',{stage:stage.id,label:stage.label});
  if(stageIndex===0)releasePlayable();
  if(stage.id==='services')startModuleLoader();
  persist();
  return true;
}
async function run(){
  const myGeneration=++generation;
  state={
    version:VERSION,build:BUILD,status:'loading',stage:null,profile:PROFILE,
    startedAt:performance.now(),playableAt:null,completedAt:null,playableMs:null,completeMs:null,
    loadedStages:[],files:[],totalTransfer:0,totalEncoded:0,totalDecoded:0,
    failures:[],retryCount:0
  };
  emit('start',{profile:PROFILE});
  for(let i=0;i<STAGES.length;i++){
    if(myGeneration!==generation)return false;
    const ok=await runStage(STAGES[i],i);
    if(!ok)return false;
  }
  state.status='complete';
  state.stage=null;
  state.completedAt=performance.now();
  state.completeMs=Math.round(state.completedAt-state.startedAt);
  persist();
  hide('Mundo listo');
  emit('complete',{playableMs:state.playableMs,completeMs:state.completeMs});
  return true;
}
function start(){
  if(runPromise)return runPromise;
  runPromise=run().finally(()=>{runPromise=null;});
  return runPromise;
}
function retry(){
  if(runPromise)return runPromise;
  generation++;
  state.status='retrying';
  return start();
}
function getState(){
  return Object.freeze({
    version:state.version,build:state.build,status:state.status,stage:state.stage,
    profile:state.profile||PROFILE,startedAt:state.startedAt,playableMs:state.playableMs,completeMs:state.completeMs,
    loadedStages:state.loadedStages.slice(),files:state.files.slice(),totalTransfer:state.totalTransfer,
    totalEncoded:state.totalEncoded,totalDecoded:state.totalDecoded,failures:state.failures.slice(),retryCount:state.retryCount
  });
}

root.KELO_PROGRESSIVE_BOOT=Object.freeze({version:VERSION,profile:PROFILE,start,retry,getState,stages:STAGES.map(s=>s.id)});
queueMicrotask(()=>{void start();});
})(typeof globalThis!=='undefined'?globalThis:window);
