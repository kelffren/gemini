/* KELO-INDEX
 * area: CORE / PWA FRESHNESS
 * owner: KeloPWAFreshness
 * keys: IPHONE PWA STANDALONE BUILD SHA CACHE SERVICEWORKER FIRST-USE
 * purpose: keeps installed iPhone/PWA sessions aligned with the deployed Pages build and provides build-stamped URLs for lazy runtimes.
 * public-api: KeloPWAFreshness.ready/check/url/build/state
 * do-not: NO polling loop, NO gameplay state, NO repo tree walk
 */
(function(root){
'use strict';
if(root.KeloPWAFreshness)return;
const VERSION='kelo-pwa-freshness-v1.2';
const STORAGE_KEY='kelo.pwa.liveBuild.v1';
const RELOAD_KEY='kelo_pwa_build';
const BUILD_RE=/^[0-9a-f]{7,64}$/i;
const FRESH_TTL_MS=15000;
let build=null,lastError=null,checking=null,lastCheckedAt=0,reloaded=false;
const standalone=()=>!!(root.matchMedia?.('(display-mode: standalone)')?.matches||root.navigator?.standalone===true);
const normalize=v=>{v=String(v||'').trim();return BUILD_RE.test(v)?v.toLowerCase():null;};
function readStored(){try{return normalize(root.localStorage?.getItem(STORAGE_KEY));}catch(_){return null;}}
function writeStored(value){try{root.localStorage?.setItem(STORAGE_KEY,value);}catch(_){}}
function emit(type,detail){try{root.dispatchEvent(new CustomEvent('kelo:pwa-freshness:'+type,{detail:Object.freeze({...state(),...(detail||{})})}));}catch(_){}}
async function fetchBuild(){
  const url=new URL('version.json',root.document?.baseURI||root.location.href);
  url.searchParams.set('_kelo_pwa',Date.now().toString(36));
  const response=await root.fetch(url.href,{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw new Error('PWA_BUILD_HTTP_'+response.status);
  const data=await response.json();
  const next=normalize(data&&data.sha);
  if(!next)throw new Error('PWA_BUILD_SHA_MISSING');
  return next;
}
async function syncServiceWorker(next){
  if(!('serviceWorker' in root.navigator))return;
  try{
    const registrations=await root.navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(async registration=>{
      try{await registration.update();}catch(_){}
      for(const worker of [registration.installing,registration.waiting,registration.active]){
        try{worker?.postMessage?.({type:'KELO_SET_ACTIVE_BUILD',build:next});}catch(_){}
      }
    }));
    try{root.navigator.serviceWorker.controller?.postMessage?.({type:'KELO_SET_ACTIVE_BUILD',build:next});}catch(_){}
  }catch(error){lastError=String(error&&error.message||error);}
}
async function purgeRuntimeCaches(){
  if(!root.caches?.keys)return;
  try{
    const keys=await root.caches.keys();
    await Promise.all(keys.filter(k=>/^kelo-(?:assets-v3|update-meta-v3|update-stage-v3-)/.test(k)).map(k=>root.caches.delete(k)));
  }catch(error){lastError=String(error&&error.message||error);}
}
function reloadInto(next){
  if(!standalone()||reloaded)return false;
  const url=new URL(root.location.href);
  const token=next.slice(0,16);
  if(url.searchParams.get(RELOAD_KEY)===token)return false;
  reloaded=true;
  url.searchParams.set(RELOAD_KEY,token);
  url.searchParams.set('_kelo_pwa_reload',Date.now().toString(36));
  root.location.replace(url.href);
  return true;
}
async function check(options={}){
  if(checking)return checking;
  if(options.force!==true&&build&&Date.now()-lastCheckedAt<FRESH_TTL_MS){
    return Object.freeze({changed:false,reloading:false,build,cached:true});
  }
  checking=(async()=>{
    const previous=build||readStored();
    const next=await fetchBuild();
    lastCheckedAt=Date.now();build=next;lastError=null;
    const changed=!!previous&&previous!==next;
    writeStored(next);
    await syncServiceWorker(next);
    if(changed){
      await purgeRuntimeCaches();
      emit('changed',{previous,next});
      if(options.reload===true&&reloadInto(next))return Object.freeze({changed:true,reloading:true,build:next});
    }else emit('checked',{build:next});
    return Object.freeze({changed,reloading:false,build:next});
  })().catch(error=>{
    lastError=String(error&&error.message||error);
    build=build||readStored();
    emit('error',{error:lastError});
    return Object.freeze({changed:false,reloading:false,build,error:lastError});
  }).finally(()=>{checking=null;});
  return checking;
}
async function ready(options={}){return check(options);}
async function url(raw){
  await ready({reload:false});
  const u=new URL(String(raw||''),root.document?.baseURI||root.location.href);
  if(build)u.searchParams.set('kelo_live',build.slice(0,16));
  return u.href;
}
function state(){return Object.freeze({version:VERSION,build:build||readStored(),standalone:standalone(),lastError,lastCheckedAt,reloading:reloaded});}
const api=Object.freeze({version:VERSION,ready,check,url,state,get build(){return build||readStored();},get standalone(){return standalone();}});
root.KeloPWAFreshness=api;
function resumeCheck(){void check({reload:true,force:true});}
root.addEventListener?.('pageshow',resumeCheck,{passive:true});
root.document?.addEventListener?.('visibilitychange',()=>{if(root.document.visibilityState==='visible')resumeCheck();},{passive:true});
void check({reload:false,force:true});
})(typeof globalThis!=='undefined'?globalThis:window);
