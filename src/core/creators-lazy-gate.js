/* KELO-INDEX
 * area: CORE / OPTIONAL UI
 * owner: KeloCreatorsLazyGate
 * keys: CREATORS ASSET FORGE LAZY FIRST-USE ADMIN MOBILE SAFARI NO-FREEZE ASSET CATALOG OPEN ACCESS
 * purpose: mantiene Creators y Asset Forge disponibles sin evaluar Studio hasta que el usuario los abre; Asset Forge no carga el catálogo grande
 * public-api: KeloCreatorsLazyGate.open/openAssetForge/sync
 * consumes: KELO_ADMIN_KEYS + Luxe menu
 * do-not: NO creator imports on normal boot, NO polling, NO second loop
 */
(function(root){
'use strict';
if(root.KeloCreatorsLazyGate)return;
const VERSION='kelo-creators-lazy-gate-v8-ios-open-access';
// TEMPORAL: Creadores abierto para todos. Mantener la verificación original intacta
// permite volver a permisos por rol cambiando solo este flag a false.
const OPEN_CREATOR_ACCESS=true;
// iOS standalone can keep an old launcher in HTTP cache or in the resumed window.
// Use a new URL and evict only a stale launcher that still reports access=false.
const LAUNCHER_SRC='src/ui/studio-launcher.js?v=creators-open-20260917-2';
const ASSET_CATALOG_SRC='src/property/property-asset-catalog.js?v=creator-assets-20260915-1';
const assetForgeModuleUrl=()=>new URL('src/creators/creator-entry.mjs?v=asset-forge-20260915-1',root.document?.baseURI||root.location.href).href;
let loading=null,catalogLoading=null,forgeLoading=null;
const query=()=>{try{return new URLSearchParams(root.location.search);}catch(_){return new URLSearchParams();}};
const directRequested=()=>query().get('creators')==='1'||query().get('creator')==='1'||query().get('mapEditor')==='1';
const actor=()=>String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
function permissionAllowed(){
  const keys=root.KELO_ADMIN_KEYS,who=actor();
  return !!(keys?.can?.('creators.access',who)||keys?.can?.('world.edit',who)||keys?.can?.('animation.edit',who));
}
function allowed(){
  return OPEN_CREATOR_ACCESS||permissionAllowed();
}
function toast(msg){if(typeof root.showToast==='function')root.showToast(msg);else console.info('[Kelo Creators gate]',msg);}
function paint(btn,busy){
  if(!btn)return;
  btn.innerHTML='<span class="lx-menu-icon" aria-hidden="true">♟</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Creators')+'</b><small>'+(busy?'Cargando assets bajo demanda':'Herramientas de creación')+'</small></span>';
  btn.disabled=!!busy;
  if(busy)btn.setAttribute('aria-busy','true');else btn.removeAttribute('aria-busy');
}
function paintForge(btn,busy){
  if(!btn)return;
  btn.innerHTML='<span class="lx-menu-icon" aria-hidden="true">✎</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Asset Forge')+'</b><small>'+(busy?'Cargando editor ligero':'Dibujar · reparar · mercado')+'</small></span>';
  btn.disabled=!!busy;
  if(busy)btn.setAttribute('aria-busy','true');else btn.removeAttribute('aria-busy');
}
function sync(){
  const grid=document.querySelector('#lx-menu-panel .lx-menu-grid');
  if(!grid)return false;
  let btn=document.getElementById('lx-create-studio'),forgeBtn=document.getElementById('lx-create-asset-forge');
  if(!allowed()&&!directRequested()){btn?.remove();forgeBtn?.remove();return true;}
  if(!btn){
    btn=document.createElement('button');btn.id='lx-create-studio';btn.type='button';btn.className='lx-menu-item';
    btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();void open();});grid.appendChild(btn);
  }
  if(!forgeBtn){
    forgeBtn=document.createElement('button');forgeBtn.id='lx-create-asset-forge';forgeBtn.type='button';forgeBtn.className='lx-menu-item';
    forgeBtn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();void openAssetForge();});grid.appendChild(forgeBtn);
  }
  btn.setAttribute('aria-label','Abrir Kelo Creators');paint(btn,!!loading);
  forgeBtn.setAttribute('aria-label','Abrir Kelo Asset Forge');paintForge(forgeBtn,!!forgeLoading);
  return true;
}
function loadAssetCatalog(){
  if(root.KELO_PROPERTY_CATALOG?.list)return Promise.resolve(root.KELO_PROPERTY_CATALOG);
  if(catalogLoading)return catalogLoading;
  catalogLoading=new Promise(function(resolve){
    const stale=document.querySelector('script[data-kelo-creator-assets="1"]');
    if(stale)stale.remove();
    const s=document.createElement('script');s.src=ASSET_CATALOG_SRC;s.async=false;s.dataset.keloCreatorAssets='1';
    const done=function(){resolve(root.KELO_PROPERTY_CATALOG||null);};
    s.onload=done;s.onerror=function(error){console.warn('[Kelo Creators gate] asset catalog unavailable; using fallback',error);done();};document.head.appendChild(s);
  }).finally(function(){catalogLoading=null;});
  return catalogLoading;
}
function evictClosedLauncher(){
  const launcher=root.KELO_STUDIO_LAUNCHER;
  if(!OPEN_CREATOR_ACCESS||!launcher||launcher.allowed!==false)return;
  try{root.KELO_STUDIO_LAUNCHER=null;}catch(_){}
  try{root.KELO_CREATORS_LAUNCHER=null;}catch(_){}
  try{document.querySelectorAll('script[data-kelo-creators-first-use="1"]').forEach(function(node){node.remove();});}catch(_){}
}
function loadStudio(){
  if(loading)return loading;
  loading=(async function(){
    // Creator-only load: the normal game does not pay for the full asset library.
    await loadAssetCatalog();
    // An iPhone home-screen app may resume a pre-fix launcher from memory.
    // If the gate is intentionally open but that launcher still says closed, replace it.
    evictClosedLauncher();
    if(root.KELO_STUDIO_LAUNCHER)return root.KELO_STUDIO_LAUNCHER;
    return new Promise(function(resolve,reject){
      const s=document.createElement('script');s.src=LAUNCHER_SRC;s.async=false;s.dataset.keloCreatorsFirstUse='1';
      s.onload=function(){resolve(root.KELO_STUDIO_LAUNCHER||null);};s.onerror=function(){reject(new Error('CREATORS_LAUNCHER_LOAD_FAILED'));};document.head.appendChild(s);
    });
  })().finally(function(){loading=null;sync();});
  return loading;
}
async function openAssetForge(){
  if(forgeLoading)return forgeLoading;
  if(!allowed()){toast('Necesitas acceso a Kelo Creators');return false;}
  const btn=document.getElementById('lx-create-asset-forge');paintForge(btn,true);
  forgeLoading=(async function(){
    try{
      root.KELO_LUXE?.closeMenu?.();
      const mod=await import(assetForgeModuleUrl());
      const platform=await mod.bootKeloCreators({root});
      await platform.openWorkspace('asset-forge');
      return true;
    }catch(error){console.error('[Kelo Asset Forge lazy gate]',error);toast('No se pudo abrir Asset Forge');return false;}
  })().finally(function(){forgeLoading=null;paintForge(document.getElementById('lx-create-asset-forge'),false);sync();});
  return forgeLoading;
}
async function open(){
  if(!allowed()){
    if(directRequested()&&query().get('mapEditor')==='1'&&root.KELO_ADMIN_KEYS?.request){
      try{await root.KELO_ADMIN_KEYS.request('admin-key:bootstrap-local-root',{actorId:actor(),ownerId:actor(),developer:true});}catch(_){}
    }
  }
  if(!allowed()){toast('Necesitas acceso a Kelo Creators');return false;}
  const btn=document.getElementById('lx-create-studio');paint(btn,true);
  try{const launcher=await loadStudio();if(!launcher||typeof launcher.open!=='function')throw new Error('CREATORS_LAUNCHER_UNAVAILABLE');await launcher.open();return true;}
  catch(error){console.error('[Kelo Creators lazy gate]',error);toast('No se pudo abrir Kelo Creators');return false;}
  finally{paint(document.getElementById('lx-create-studio'),false);}
}
const api=Object.freeze({version:VERSION,open,openAssetForge,sync,get allowed(){return allowed();},get directRequested(){return directRequested();},get openAccess(){return OPEN_CREATOR_ACCESS;}});
root.KeloCreatorsLazyGate=api;
root.KELO_CREATORS_LAZY_GATE=api;
try{root.KELO_ADMIN_KEYS?.onChange?.(sync);}catch(_){}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){sync();if(directRequested())void open();},{once:true});
else{sync();if(directRequested())void open();}
})(typeof globalThis!=='undefined'?globalThis:window);