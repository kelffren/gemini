/* KELO-INDEX
 * area: CORE / OPTIONAL UI
 * owner: KeloCreatorsLazyGate
 * keys: CREATORS LAZY FIRST-USE ADMIN MOBILE SAFARI NO-FREEZE ASSET CATALOG
 * purpose: mantiene la entrada Creators disponible sin evaluar Studio hasta que el usuario la abre; carga el catálogo de assets solo en Creator
 * public-api: KeloCreatorsLazyGate.open/sync
 * consumes: KELO_ADMIN_KEYS + Luxe menu
 * do-not: NO creator imports on normal boot, NO polling, NO second loop
 */
(function(root){
'use strict';
if(root.KeloCreatorsLazyGate)return;
const VERSION='kelo-creators-lazy-gate-v4-assets';
const LAUNCHER_SRC='src/ui/studio-launcher.js?v=world-bridge-20260915-25';
const ASSET_CATALOG_SRC='src/property/property-asset-catalog.js?v=creator-assets-20260915-1';
let loading=null,catalogLoading=null;
const query=()=>{try{return new URLSearchParams(root.location.search);}catch(_){return new URLSearchParams();}};
const directRequested=()=>query().get('creators')==='1'||query().get('creator')==='1'||query().get('mapEditor')==='1';
const actor=()=>String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
function allowed(){
  const keys=root.KELO_ADMIN_KEYS,who=actor();
  return !!(keys?.can?.('creators.access',who)||keys?.can?.('world.edit',who)||keys?.can?.('animation.edit',who));
}
function toast(msg){if(typeof root.showToast==='function')root.showToast(msg);else console.info('[Kelo Creators gate]',msg);}
function paint(btn,busy){
  if(!btn)return;
  btn.innerHTML='<span class="lx-menu-icon" aria-hidden="true">♟</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Creators')+'</b><small>'+(busy?'Cargando assets bajo demanda':'Herramientas de creación')+'</small></span>';
  btn.disabled=!!busy;
  if(busy)btn.setAttribute('aria-busy','true');else btn.removeAttribute('aria-busy');
}
function sync(){
  const grid=document.querySelector('#lx-menu-panel .lx-menu-grid');
  if(!grid)return false;
  let btn=document.getElementById('lx-create-studio');
  if(!allowed()&&!directRequested()){btn?.remove();return true;}
  if(!btn){
    btn=document.createElement('button');btn.id='lx-create-studio';btn.type='button';btn.className='lx-menu-item';
    btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();void open();});grid.appendChild(btn);
  }
  btn.setAttribute('aria-label','Abrir Kelo Creators');paint(btn,!!loading);return true;
}
function loadAssetCatalog(){
  if(root.KELO_PROPERTY_CATALOG?.list)return Promise.resolve(root.KELO_PROPERTY_CATALOG);
  if(catalogLoading)return catalogLoading;
  catalogLoading=new Promise(function(resolve){
    let s=document.querySelector('script[data-kelo-creator-assets="1"]');
    const done=function(){resolve(root.KELO_PROPERTY_CATALOG||null);};
    if(s){s.addEventListener('load',done,{once:true});s.addEventListener('error',done,{once:true});return;}
    s=document.createElement('script');s.src=ASSET_CATALOG_SRC;s.async=false;s.dataset.keloCreatorAssets='1';
    s.onload=done;s.onerror=function(error){console.warn('[Kelo Creators gate] asset catalog unavailable; using fallback',error);done();};document.head.appendChild(s);
  }).finally(function(){catalogLoading=null;});
  return catalogLoading;
}
function loadStudio(){
  if(loading)return loading;
  loading=(async function(){
    // Creator-only load: the normal game does not pay for the full asset library.
    await loadAssetCatalog();
    if(root.KELO_STUDIO_LAUNCHER)return root.KELO_STUDIO_LAUNCHER;
    return new Promise(function(resolve,reject){
      const s=document.createElement('script');s.src=LAUNCHER_SRC;s.async=false;s.dataset.keloCreatorsFirstUse='1';
      s.onload=function(){resolve(root.KELO_STUDIO_LAUNCHER||null);};s.onerror=function(){reject(new Error('CREATORS_LAUNCHER_LOAD_FAILED'));};document.head.appendChild(s);
    });
  })().finally(function(){loading=null;sync();});
  return loading;
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
const api=Object.freeze({version:VERSION,open,sync,get allowed(){return allowed();},get directRequested(){return directRequested();}});
root.KeloCreatorsLazyGate=api;
root.KELO_CREATORS_LAZY_GATE=api;
try{root.KELO_ADMIN_KEYS?.onChange?.(sync);}catch(_){}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){sync();if(directRequested())void open();},{once:true});
else{sync();if(directRequested())void open();}
})(typeof globalThis!=='undefined'?globalThis:window);
