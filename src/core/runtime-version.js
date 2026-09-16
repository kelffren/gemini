/* KELO-INDEX
 * area: CORE / LAZY RUNTIME
 * owner: KeloRuntimeVersion
 * keys: BUILD SHA CACHE BUST MODULE SCRIPT STYLE SAFARI IPHONE UPDATE
 * purpose: derive one stable build identity and apply it to lazy runtime URLs without random nonces or Service Worker dependence
 * authority: installed/pending updater build first; version.json only fills an unknown first-session build
 * do-not: NO updater ownership, NO polling, NO arbitrary JS hot-swap, NO service_role, NO gameplay state
 */
(function(root){
'use strict';
if(root.KeloRuntimeVersion)return;
const VERSION='kelo-runtime-version-v1';
const BUILD_RE=/^[0-9a-f]{7,64}$/i;
const STORAGE_KEY='kelo.world.updater.installedBuild.v1';
const PENDING_KEY='kelo.world.updater.pendingBuild.v5';
const LEGACY_PENDING_KEY='kelo.world.updater.pendingBuild.v4';
const baseUrl=new URL('./',root.document?.baseURI||root.location?.href||'https://invalid.local/');
const imports=new Map();
let resolvedBuild=null,resolving=null,lastSource='unknown',lastError=null;
function normalize(value){const v=String(value||'').trim();return BUILD_RE.test(v)?v.toLowerCase():null;}
function safeGet(storage,key){try{return storage?.getItem?.(key)||null;}catch(_){return null;}}
function pendingBuild(){
  for(const key of [PENDING_KEY,LEGACY_PENDING_KEY]){
    const raw=safeGet(root.sessionStorage,key);if(!raw)continue;
    try{const parsed=JSON.parse(raw),b=normalize(parsed?.build||parsed);if(b)return b;}catch(_){const b=normalize(raw);if(b)return b;}
  }
  return null;
}
function queryBuild(){try{return normalize(new URL(root.location.href).searchParams.get('kelo_update'));}catch(_){return null;}}
function localBuild(){return normalize(safeGet(root.localStorage,STORAGE_KEY));}
function gateBuild(){try{return normalize(root.KeloUpdateGate?.getState?.().installedBuild);}catch(_){return null;}}
function chooseKnown(){
  const pairs=[['update-query',queryBuild()],['pending-update',pendingBuild()],['installed',localBuild()],['gate-installed',gateBuild()]];
  for(const [source,build] of pairs)if(build){resolvedBuild=build;lastSource=source;return build;}
  return null;
}
async function fetchDeployed(){
  const u=new URL('version.json',baseUrl);u.searchParams.set('_kelo_runtime_version',Date.now().toString(36));
  const controller=new AbortController(),timer=root.setTimeout(()=>controller.abort(),3500);
  try{
    const r=await root.fetch(u.href,{cache:'no-store',credentials:'same-origin',signal:controller.signal,priority:'low'});
    if(!r.ok)throw new Error('runtime_version_http_'+r.status);
    const json=await r.json(),build=normalize(json?.sha);if(!build)throw new Error('runtime_version_missing_sha');
    resolvedBuild=build;lastSource='version-json';lastError=null;return build;
  }finally{root.clearTimeout(timer);}
}
async function ready(){
  const known=chooseKnown();if(known)return known;
  if(resolvedBuild)return resolvedBuild;if(resolving)return resolving;
  resolving=fetchDeployed().catch(error=>{lastError=String(error?.message||error);return null;}).finally(()=>{resolving=null;});
  return resolving;
}
function isRuntimeUrl(u){return u.origin===baseUrl.origin&&u.pathname.startsWith(baseUrl.pathname);}
function versioned(src,base){
  const u=new URL(String(src||''),base||baseUrl.href);if(!isRuntimeUrl(u))return u.href;
  const build=resolvedBuild||chooseKnown();if(!build)return u.href;
  u.searchParams.delete('v');u.searchParams.delete('kelo_build');u.searchParams.set('kelo_build',build.slice(0,16));
  return u.href;
}
async function url(src,base){await ready();return versioned(src,base);}
async function importModule(src,base){const href=await url(src,base);if(imports.has(href))return imports.get(href);const p=import(href).catch(error=>{imports.delete(href);throw error;});imports.set(href,p);return p;}
async function loadScript(src,{base,async=false,datasetKey=null}={}){
  const href=await url(src,base);const existing=Array.from(root.document?.scripts||[]).find(node=>node.src===href);if(existing)return existing;
  return new Promise((resolve,reject)=>{const node=root.document.createElement('script');node.src=href;node.async=!!async;if(datasetKey)node.dataset[datasetKey]='1';node.onload=()=>resolve(node);node.onerror=()=>reject(new Error('RUNTIME_SCRIPT_LOAD_FAILED:'+src));root.document.head.appendChild(node);});
}
async function loadStyle(src,{base}={}){
  const href=await url(src,base);const existing=Array.from(root.document?.querySelectorAll?.('link[rel~="stylesheet"]')||[]).find(node=>node.href===href);if(existing)return existing;
  return new Promise((resolve,reject)=>{const node=root.document.createElement('link');node.rel='stylesheet';node.href=href;node.onload=()=>resolve(node);node.onerror=()=>reject(new Error('RUNTIME_STYLE_LOAD_FAILED:'+src));root.document.head.appendChild(node);});
}
function refreshKnown(){resolvedBuild=null;const b=chooseKnown();try{root.dispatchEvent(new CustomEvent('kelo:runtime-version',{detail:{build:b,source:lastSource}}));}catch(_){}return b;}
const api=Object.freeze({version:VERSION,ready,url,versioned,importModule,loadScript,loadStyle,refreshKnown,get build(){return resolvedBuild||chooseKnown();},get source(){return lastSource;},diagnostics(){return Object.freeze({version:VERSION,build:resolvedBuild||chooseKnown(),source:lastSource,lastError,imports:imports.size});}});
root.KeloRuntimeVersion=api;root.KELO_RUNTIME_VERSION=api;
root.addEventListener?.('pageshow',refreshKnown,{passive:true});
root.addEventListener?.('kelo:update:connected',refreshKnown);
})(typeof globalThis!=='undefined'?globalThis:window);
