/* KELO-INDEX
 * area: CORE / POST-BOOT
 * owner: KeloUpdateGate
 * keys: UPDATE GATE VERSION WATCH LAZY TURBO V5 MOBILE SAFARI CONDITIONAL REVALIDATION HOTSET LEARNING
 * purpose: detect new builds with tiny conditional requests, learn used resources with zero extra script request, and wake verified predictive updater V5 only when necessary
 * public-api: KeloUpdateGate.checkNow/wakeHeavy/getState/learnHotset
 * state-owned: one timeout + lightweight build state + compact resource hotset; V5 owns downloads and verification
 * do-not: NO asset downloads, NO repo walk, NO Service Worker, NO setInterval, NO second loop, NO gameplay state
 */
(function(root){
'use strict';
if(root.KeloUpdateGate)return;
const VERSION='kelo-update-gate-v4-learning';
const STORAGE_KEY='kelo.world.updater.installedBuild.v1';
const PENDING_KEY='kelo.world.updater.pendingBuild.v5';
const LEGACY_PENDING_KEY='kelo.world.updater.pendingBuild.v4';
const HOTSET_KEY='kelo.world.updater.hotset.v1';
const BUILD_RE=/^[0-9a-f]{7,64}$/i;
const FAST_CHECK_MS=5000;
const STEADY_CHECK_MS=15000;
const FAST_WINDOW_MS=120000;
const BUSY_RETRY_MS=4000;
const FIRST_CHECK_DELAY_MS=650;
const VERSION_TIMEOUT_MS=3500;
const HOTSET_LIMIT=80;
const startedAt=Date.now();
const baseUrl=new URL('./',document.baseURI);
let timer=0,checking=false,heavyLoading=null,heavyReady=!!root.KeloUpdater,stopped=false,lastDeployed=null,lastError=null,lastReason='boot',hotsetLearnedAt=0;

function normalize(v){v=String(v||'').trim();return BUILD_RE.test(v)?v.toLowerCase():null;}
function installed(){try{return normalize(localStorage.getItem(STORAGE_KEY));}catch(_){return null;}}
function parsePending(raw){if(!raw)return null;try{const j=JSON.parse(raw);return normalize(j&&j.build);}catch(_){return normalize(raw);}}
function pending(){try{return parsePending(sessionStorage.getItem(PENDING_KEY))||parsePending(sessionStorage.getItem(LEGACY_PENDING_KEY));}catch(_){return null;}}
function migrateLegacyPending(){try{const raw=sessionStorage.getItem(LEGACY_PENDING_KEY),b=parsePending(raw);if(!b||sessionStorage.getItem(PENDING_KEY))return;b&&sessionStorage.setItem(PENDING_KEY,JSON.stringify({build:b,previous:installed(),attempts:0,startedAt:Date.now(),migratedFrom:'v4'}));sessionStorage.removeItem(LEGACY_PENDING_KEY);}catch(_){} }
function emit(type,detail){try{root.dispatchEvent(new CustomEvent('kelo:update-gate:'+type,{detail:Object.assign(getState(),detail||{})}));}catch(_){} }
function readJson(raw){try{return raw?JSON.parse(raw):null;}catch(_){return null;}}
function getState(){return Object.freeze({version:VERSION,installedBuild:installed(),pendingBuild:pending(),deployedBuild:lastDeployed,checking,heavyLoading:!!heavyLoading,heavyReady:!!root.KeloUpdater||heavyReady,lastError,lastReason,stopped,nextCheckMs:nextDelay(),hotsetLearnedAt});}
function clear(){if(timer){clearTimeout(timer);timer=0;}}
function nextDelay(){return Date.now()-startedAt<FAST_WINDOW_MS?FAST_CHECK_MS:STEADY_CHECK_MS;}
function schedule(ms){if(stopped||heavyReady||root.KeloUpdater)return;clear();timer=setTimeout(function(){void checkNow();},Math.max(500,Number(ms)||nextDelay()));}
function gameplayBusy(){
  if(document.visibilityState!=='visible'||navigator.onLine===false)return true;
  if(root.KELO_COMBAT_ENABLED===true)return true;
  try{if(root.KeloArena?.isActive?.())return true;}catch(_){}
  try{if(typeof input!=='undefined'&&input&&(input.active||Math.abs(input.normX)>0.02||Math.abs(input.normY)>0.02))return true;}catch(_){}
  try{const d=root.KELO_MODULE_LOADER?.diagnostics?.();if(d&&Array.isArray(d.inflight)&&d.inflight.length)return true;}catch(_){}
  return false;
}
function repoPath(value){try{const u=new URL(value,baseUrl);if(u.origin!==baseUrl.origin||!u.pathname.startsWith(baseUrl.pathname))return null;return decodeURIComponent(u.pathname.slice(baseUrl.pathname.length).replace(/^\/+/,''))||'index.html';}catch(_){return null;}}
function observedResources(){const out=new Map();try{performance.getEntriesByType('resource').forEach(function(e){const name=e&&e.name;if(!name||!/\.(?:js|mjs|css|json|woff2?|ttf|otf)(?:[?#].*)?$/i.test(name))return;const path=repoPath(name);if(!path)return;const u=new URL(name,baseUrl);u.hash='';out.set(path,{path:path,url:u.href});});}catch(_){}return out;}
function learnHotset(){
  try{
    const current=readJson(localStorage.getItem(HOTSET_KEY)),previous=new Map((current&&Array.isArray(current.items)?current.items:[]).filter(Boolean).map(function(x){return [x.path,x];})),now=Date.now();
    for(const e of observedResources().values()){const old=previous.get(e.path)||{path:e.path,url:e.url,hits:0,lastSeen:0};old.url=e.url;old.hits=Math.min(999,Number(old.hits||0)+1);old.lastSeen=now;previous.set(e.path,old);}
    const items=Array.from(previous.values()).sort(function(a,b){return (Number(b.hits)||0)-(Number(a.hits)||0)||(Number(b.lastSeen)||0)-(Number(a.lastSeen)||0);}).slice(0,HOTSET_LIMIT);
    localStorage.setItem(HOTSET_KEY,JSON.stringify({version:1,updatedAt:now,items:items}));hotsetLearnedAt=now;emit('hotset-learned',{count:items.length,observed:observedResources().size});return items;
  }catch(_){return [];}
}
function load(src){return new Promise(function(resolve,reject){const base=src.split('?')[0],existing=Array.from(document.scripts).find(function(s){return String(s.getAttribute('src')||'').split('?')[0]===base;});if(existing){resolve();return;}const s=document.createElement('script');s.src=src;s.async=false;s.dataset.keloUpdateGate='1';s.onload=resolve;s.onerror=function(){reject(new Error('update_gate_script_load_failed:'+src));};document.head.appendChild(s);});}
function wakeHeavy(reason){
  if(root.KeloUpdater){heavyReady=true;stopped=true;clear();return Promise.resolve(root.KeloUpdater);}
  if(heavyLoading)return heavyLoading;
  lastReason=String(reason||'manual');clear();try{learnHotset();}catch(_){}emit('heavy-start',{reason:lastReason});
  heavyLoading=load('src/core/update-system-v5.js?v=5-verified-predictive')
    .then(function(){return load('src/core/update-watch.js?v=3');})
    .then(function(){if(!root.KeloUpdater)throw new Error('updater_missing_after_load');heavyReady=true;stopped=true;clear();lastError=null;emit('heavy-ready',{reason:lastReason});try{root.dispatchEvent(new CustomEvent('kelo:update:connected',{detail:{version:'turbo-v5',mode:'verified-predictive-gate',reason:lastReason}}));}catch(_){}return root.KeloUpdater;})
    .catch(function(error){lastError=String(error&&error.message||error);emit('heavy-error',{error:lastError});schedule(BUSY_RETRY_MS);throw error;})
    .finally(function(){heavyLoading=null;});
  return heavyLoading;
}
async function deployedBuild(){
  const controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},VERSION_TIMEOUT_MS);
  try{const u=new URL('version.json',document.baseURI);u.searchParams.set('_kelo_gate',Date.now().toString(36));const r=await fetch(u.href,{cache:'no-cache',credentials:'same-origin',priority:'low',signal:controller.signal});if(!r.ok)throw new Error('version_http_'+r.status);const json=await r.json(),build=normalize(json&&json.sha);if(!build)throw new Error('version_missing_sha');return build;}finally{clearTimeout(timeout);}
}
async function checkNow(){
  if(stopped||heavyReady||root.KeloUpdater)return getState();if(checking)return getState();if(gameplayBusy()){lastReason='busy';schedule(BUSY_RETRY_MS);return getState();}
  checking=true;lastReason='checking';emit('checking',{});
  try{const deployed=await deployedBuild();lastDeployed=deployed;lastError=null;const current=installed(),resume=pending(),requested=normalize(new URL(root.location.href).searchParams.get('kelo_update'));
    if(resume||requested||!current){lastReason=resume||requested?'apply-resume':'first-install';emit('heavy-needed',{reason:lastReason});await wakeHeavy(lastReason);return getState();}
    if(current!==deployed){lastReason='new-build';emit('available',{build:deployed});await wakeHeavy('new-build');return getState();}
    lastReason='current';emit('current',{build:deployed});schedule(nextDelay());
  }catch(error){lastError=String(error&&error.message||error);lastReason='check-error';emit('error',{error:lastError});schedule(BUSY_RETRY_MS);}finally{checking=false;}
  return getState();
}
function start(){
  migrateLegacyPending();if(root.KeloUpdater){heavyReady=true;stopped=true;return;}
  const arm=function(){setTimeout(function(){try{learnHotset();}catch(_){}},2500);if(pending()){setTimeout(function(){void wakeHeavy('apply-resume');},0);return;}schedule(FIRST_CHECK_DELAY_MS);};
  if(document.readyState==='complete')arm();else root.addEventListener('load',arm,{once:true});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')schedule(250);else try{learnHotset();}catch(_){} });
  root.addEventListener('online',function(){schedule(250);});
  root.addEventListener('pagehide',function(){try{learnHotset();}catch(_){}},{capture:false});
}
root.KeloUpdateGate=Object.freeze({version:VERSION,checkNow,wakeHeavy,getState,learnHotset});
start();
})(typeof globalThis!=='undefined'?globalThis:window);
