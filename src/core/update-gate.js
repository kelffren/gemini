/* KELO-INDEX
 * area: CORE / POST-BOOT
 * owner: KeloUpdateGate
 * keys: UPDATE GATE VERSION WATCH LAZY TURBO MOBILE SAFARI ZERO-BOOT
 * purpose: detectar builds nuevos con pocos bytes y cargar Turbo V3 completo solo cuando realmente hace falta
 * public-api: KeloUpdateGate.checkNow/wakeHeavy/getState
 * state-owned: un timeout efímero + estado del gate; el updater pesado conserva autoridad de actualización
 * do-not: NO asset downloads, NO manifest walk, NO Service Worker, NO polling interval, NO gameplay state
 */
(function(root){
'use strict';
if(root.KeloUpdateGate)return;
const VERSION='kelo-update-gate-v1';
const STORAGE_KEY='kelo.world.updater.installedBuild.v1';
const BUILD_RE=/^[0-9a-f]{7,64}$/i;
const CHECK_EVERY_MS=15000;
const BUSY_RETRY_MS=5000;
const FIRST_CHECK_DELAY_MS=900;
const VERSION_TIMEOUT_MS=3500;
let timer=0,checking=false,heavyLoading=null,heavyReady=!!root.KeloUpdater,stopped=false,lastDeployed=null,lastError=null,lastReason='boot';

function normalize(v){v=String(v||'').trim();return BUILD_RE.test(v)?v.toLowerCase():null;}
function installed(){try{return normalize(localStorage.getItem(STORAGE_KEY));}catch(_){return null;}}
function emit(type,detail){try{root.dispatchEvent(new CustomEvent('kelo:update-gate:'+type,{detail:Object.assign(getState(),detail||{})}));}catch(_){} }
function getState(){return Object.freeze({version:VERSION,installedBuild:installed(),deployedBuild:lastDeployed,checking,heavyLoading:!!heavyLoading,heavyReady:!!root.KeloUpdater||heavyReady,lastError,lastReason,stopped});}
function clear(){if(timer){clearTimeout(timer);timer=0;}}
function schedule(ms){if(stopped||heavyReady||root.KeloUpdater)return;clear();timer=setTimeout(function(){void checkNow();},Math.max(1000,Number(ms)||CHECK_EVERY_MS));}
function gameplayBusy(){
  if(document.visibilityState!=='visible'||navigator.onLine===false)return true;
  if(root.KELO_COMBAT_ENABLED===true)return true;
  try{if(root.KeloArena?.isActive?.())return true;}catch(_){}
  try{if(typeof input!=='undefined'&&input&&(input.active||Math.abs(input.normX)>0.02||Math.abs(input.normY)>0.02))return true;}catch(_){}
  try{const d=root.KELO_MODULE_LOADER?.diagnostics?.();if(d&&Array.isArray(d.inflight)&&d.inflight.length)return true;}catch(_){}
  return false;
}
function load(src){
  return new Promise(function(resolve,reject){
    const base=src.split('?')[0],existing=Array.from(document.scripts).find(function(s){return String(s.getAttribute('src')||'').split('?')[0]===base;});
    if(existing){resolve();return;}
    const s=document.createElement('script');s.src=src;s.async=false;s.dataset.keloUpdateGate='1';s.onload=resolve;s.onerror=function(){reject(new Error('update_gate_script_failed:'+src));};document.head.appendChild(s);
  });
}
function wakeHeavy(reason){
  if(root.KeloUpdater){heavyReady=true;stopped=true;clear();return Promise.resolve(root.KeloUpdater);}
  if(heavyLoading)return heavyLoading;
  lastReason=String(reason||'manual');clear();emit('heavy-start',{reason:lastReason});
  heavyLoading=load('src/core/update-delta-core.js?v=3')
    .then(function(){return load('src/core/update-system.js?v=3');})
    .then(function(){return load('src/core/update-watch.js?v=3');})
    .then(function(){
      if(!root.KeloUpdater)throw new Error('updater_missing_after_load');
      heavyReady=true;stopped=true;clear();lastError=null;emit('heavy-ready',{reason:lastReason});
      try{root.dispatchEvent(new CustomEvent('kelo:update:connected',{detail:{version:'turbo-v3',mode:'lazy-gate',reason:lastReason}}));}catch(_){}
      return root.KeloUpdater;
    })
    .catch(function(error){lastError=String(error&&error.message||error);emit('heavy-error',{error:lastError});schedule(BUSY_RETRY_MS);throw error;})
    .finally(function(){heavyLoading=null;});
  return heavyLoading;
}
async function deployedBuild(){
  const controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},VERSION_TIMEOUT_MS);
  try{
    const u=new URL('version.json',document.baseURI);u.searchParams.set('_kelo_gate',Date.now().toString(36));
    const r=await fetch(u.href,{cache:'no-store',credentials:'same-origin',priority:'low',signal:controller.signal});
    if(!r.ok)throw new Error('version_http_'+r.status);
    const json=await r.json(),build=normalize(json&&json.sha);if(!build)throw new Error('version_missing_sha');return build;
  }finally{clearTimeout(timeout);}
}
async function checkNow(){
  if(stopped||heavyReady||root.KeloUpdater)return getState();
  if(checking)return getState();
  if(gameplayBusy()){lastReason='busy';schedule(BUSY_RETRY_MS);return getState();}
  checking=true;lastReason='checking';emit('checking',{});
  try{
    const deployed=await deployedBuild();lastDeployed=deployed;lastError=null;
    const current=installed();
    const requested=normalize(new URL(root.location.href).searchParams.get('kelo_update'));
    if(requested||!current){
      lastReason=requested?'apply-resume':'first-install';emit('heavy-needed',{reason:lastReason});await wakeHeavy(lastReason);return getState();
    }
    if(current!==deployed){lastReason='new-build';emit('available',{build:deployed});await wakeHeavy('new-build');return getState();}
    lastReason='current';emit('current',{build:deployed});schedule(CHECK_EVERY_MS);
  }catch(error){lastError=String(error&&error.message||error);lastReason='check-error';emit('error',{error:lastError});schedule(BUSY_RETRY_MS);}
  finally{checking=false;}
  return getState();
}
function start(){
  if(root.KeloUpdater){heavyReady=true;stopped=true;return;}
  const arm=function(){schedule(FIRST_CHECK_DELAY_MS);};
  if(document.readyState==='complete')arm();else root.addEventListener('load',arm,{once:true});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')schedule(1200);});
  root.addEventListener('online',function(){schedule(1000);});
}
root.KeloUpdateGate=Object.freeze({version:VERSION,checkNow,wakeHeavy,getState});
start();
})(typeof globalThis!=='undefined'?globalThis:window);
