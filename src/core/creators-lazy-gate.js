/* KELO-INDEX
 * area: CORE / OPTIONAL UI
 * owner: KeloCreatorsLazyGate
 * keys: CREATORS ASSET FORGE LAZY FIRST-USE ADMIN MOBILE SAFARI BUILD VERSION
 * purpose: keep Creators lazy while routing every first-use URL through the installed build SHA
 * public-api: KeloCreatorsLazyGate.open/openAssetForge/sync
 * consumes: KELO_ADMIN_KEYS + Luxe menu + KeloRuntimeVersion
 * do-not: NO creator imports on normal boot, NO polling, NO random cache nonce, NO second loop
 */
(function(root){
'use strict';
if(root.KeloCreatorsLazyGate)return;
const VERSION='kelo-creators-lazy-gate-v7-runtime-build';
const VERSIONER_SRC='src/core/runtime-version.js?v=runtime-version-1';
const LAUNCHER_SRC='src/ui/studio-launcher.js';
const ASSET_CATALOG_SRC='src/property/property-asset-catalog.js';
const CREATOR_ENTRY_SRC='src/creators/creator-entry.mjs';
let loading=null,catalogLoading=null,forgeLoading=null,versionerLoading=null;
const query=()=>{try{return new URLSearchParams(root.location.search);}catch(_){return new URLSearchParams();}};
const directRequested=()=>query().get('creators')==='1'||query().get('creator')==='1'||query().get('mapEditor')==='1';
const actor=()=>String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
function allowed(){const keys=root.KELO_ADMIN_KEYS,who=actor();return !!(keys?.can?.('creators.access',who)||keys?.can?.('world.edit',who)||keys?.can?.('animation.edit',who));}
function toast(msg){if(typeof root.showToast==='function')root.showToast(msg);else console.info('[Kelo Creators gate]',msg);}
function paint(btn,busy){if(!btn)return;btn.innerHTML='<span class="lx-menu-icon" aria-hidden="true">♟</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Creators')+'</b><small>'+(busy?'Cargando assets bajo demanda':'Herramientas de creación')+'</small></span>';btn.disabled=!!busy;if(busy)btn.setAttribute('aria-busy','true');else btn.removeAttribute('aria-busy');}
function paintForge(btn,busy){if(!btn)return;btn.innerHTML='<span class="lx-menu-icon" aria-hidden="true">✎</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Asset Forge')+'</b><small>'+(busy?'Cargando editor ligero':'Dibujar · reparar · mercado')+'</small></span>';btn.disabled=!!busy;if(busy)btn.setAttribute('aria-busy','true');else btn.removeAttribute('aria-busy');}
function sync(){
  const grid=document.querySelector('#lx-menu-panel .lx-menu-grid');if(!grid)return false;
  let btn=document.getElementById('lx-create-studio'),forgeBtn=document.getElementById('lx-create-asset-forge');
  if(!allowed()&&!directRequested()){btn?.remove();forgeBtn?.remove();return true;}
  if(!btn){btn=document.createElement('button');btn.id='lx-create-studio';btn.type='button';btn.className='lx-menu-item';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();void open();});grid.appendChild(btn);}
  if(!forgeBtn){forgeBtn=document.createElement('button');forgeBtn.id='lx-create-asset-forge';forgeBtn.type='button';forgeBtn.className='lx-menu-item';forgeBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();void openAssetForge();});grid.appendChild(forgeBtn);}
  btn.setAttribute('aria-label','Abrir Kelo Creators');paint(btn,!!loading);forgeBtn.setAttribute('aria-label','Abrir Kelo Asset Forge');paintForge(forgeBtn,!!forgeLoading);return true;
}
function ensureVersioner(){
  if(root.KeloRuntimeVersion)return Promise.resolve(root.KeloRuntimeVersion);if(versionerLoading)return versionerLoading;
  versionerLoading=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-kelo-runtime-version="1"]');
    if(existing){existing.addEventListener('load',()=>resolve(root.KeloRuntimeVersion),{once:true});existing.addEventListener('error',()=>reject(new Error('RUNTIME_VERSION_LOAD_FAILED')),{once:true});return;}
    const s=document.createElement('script');s.src=VERSIONER_SRC;s.async=false;s.dataset.keloRuntimeVersion='1';s.onload=()=>root.KeloRuntimeVersion?resolve(root.KeloRuntimeVersion):reject(new Error('RUNTIME_VERSION_MISSING'));s.onerror=()=>reject(new Error('RUNTIME_VERSION_LOAD_FAILED'));document.head.appendChild(s);
  }).finally(()=>{versionerLoading=null;});return versionerLoading;
}
async function runtime(){const r=await ensureVersioner();await r.ready();return r;}
async function loadAssetCatalog(){
  if(root.KELO_PROPERTY_CATALOG?.list)return root.KELO_PROPERTY_CATALOG;if(catalogLoading)return catalogLoading;
  catalogLoading=(async()=>{const r=await runtime();const src=await r.url(ASSET_CATALOG_SRC);const stale=document.querySelector('script[data-kelo-creator-assets="1"]');if(stale&&stale.src!==src)stale.remove();if(root.KELO_PROPERTY_CATALOG?.list)return root.KELO_PROPERTY_CATALOG;try{await r.loadScript(ASSET_CATALOG_SRC,{datasetKey:'keloCreatorAssets'});}catch(error){console.warn('[Kelo Creators gate] asset catalog unavailable; using fallback',error);}return root.KELO_PROPERTY_CATALOG||null;})().finally(()=>{catalogLoading=null;});return catalogLoading;
}
async function loadStudio(){
  if(loading)return loading;
  loading=(async()=>{await loadAssetCatalog();if(root.KELO_STUDIO_LAUNCHER)return root.KELO_STUDIO_LAUNCHER;const r=await runtime();await r.loadScript(LAUNCHER_SRC,{datasetKey:'keloCreatorsFirstUse'});if(!root.KELO_STUDIO_LAUNCHER)throw new Error('CREATORS_LAUNCHER_LOAD_FAILED');return root.KELO_STUDIO_LAUNCHER;})().finally(()=>{loading=null;sync();});return loading;
}
async function openAssetForge(){
  if(forgeLoading)return forgeLoading;if(!allowed()){toast('Necesitas acceso a Kelo Creators');return false;}
  const btn=document.getElementById('lx-create-asset-forge');paintForge(btn,true);
  forgeLoading=(async()=>{try{root.KELO_LUXE?.closeMenu?.();const r=await runtime(),mod=await r.importModule(CREATOR_ENTRY_SRC);const platform=await mod.bootKeloCreators({root});await platform.openWorkspace('asset-forge');return true;}catch(error){console.error('[Kelo Asset Forge lazy gate]',error);toast('No se pudo abrir Asset Forge');return false;}})().finally(()=>{forgeLoading=null;paintForge(document.getElementById('lx-create-asset-forge'),false);sync();});return forgeLoading;
}
async function open(){
  if(!allowed()&&directRequested()&&query().get('mapEditor')==='1'&&root.KELO_ADMIN_KEYS?.request){try{await root.KELO_ADMIN_KEYS.request('admin-key:bootstrap-local-root',{actorId:actor(),ownerId:actor(),developer:true});}catch(_){}}
  if(!allowed()){toast('Necesitas acceso a Kelo Creators');return false;}
  const btn=document.getElementById('lx-create-studio');paint(btn,true);
  try{const launcher=await loadStudio();if(!launcher||typeof launcher.open!=='function')throw new Error('CREATORS_LAUNCHER_UNAVAILABLE');await launcher.open();return true;}catch(error){console.error('[Kelo Creators lazy gate]',error);toast('No se pudo abrir Kelo Creators');return false;}finally{paint(document.getElementById('lx-create-studio'),false);}
}
const api=Object.freeze({version:VERSION,open,openAssetForge,sync,get allowed(){return allowed();},get directRequested(){return directRequested();}});root.KeloCreatorsLazyGate=api;root.KELO_CREATORS_LAZY_GATE=api;
try{root.KELO_ADMIN_KEYS?.onChange?.(sync);}catch(_){}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{sync();if(directRequested())void open();},{once:true});else{sync();if(directRequested())void open();}
})(typeof globalThis!=='undefined'?globalThis:window);
