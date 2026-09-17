/* KELO-INDEX
 * area: CORE / OPTIONAL UI
 * owner: KeloCreatorsLazyGate
 * keys: CREATORS ASSET FORGE LAZY FIRST-USE ADMIN MOBILE SAFARI NO-FREEZE ASSET CATALOG OPEN ACCESS PWA
 * purpose: mantiene Creators y Asset Forge disponibles sin evaluar Studio hasta que el usuario los abre; en PWA valida el build LIVE antes de cargar herramientas.
 * public-api: KeloCreatorsLazyGate.open/openAssetForge/sync
 * consumes: KELO_ADMIN_KEYS + Luxe menu + KeloPWAFreshness
 * do-not: NO creator imports on normal boot, NO polling, NO second loop
 */
(function(root){
'use strict';
if(root.KeloCreatorsLazyGate)return;
const VERSION='kelo-creators-lazy-gate-v10-pwa-live';
const FRESHNESS_SRC='src/core/pwa-freshness-guard.js?v=1.1';
// TEMPORAL: Creadores abierto para todos. Mantener la verificación original intacta
// permite volver a permisos por rol cambiando solo este flag a false.
const OPEN_CREATOR_ACCESS=true;
const LAUNCHER_SRC='src/ui/studio-launcher.js?v=creators-open-20260917-3';
const ASSET_CATALOG_SRC='src/property/property-asset-catalog.js?v=creator-assets-20260915-1';
const ASSET_FORGE_SRC='src/creators/creator-entry.mjs?v=asset-forge-20260915-1';
let loading=null,catalogLoading=null,forgeLoading=null,freshnessLoading=null;
const query=()=>{try{return new URLSearchParams(root.location.search);}catch(_){return new URLSearchParams();}};
const directRequested=()=>query().get('creators')==='1'||query().get('creator')==='1'||query().get('mapEditor')==='1';
const actor=()=>String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
function permissionAllowed(){
  const keys=root.KELO_ADMIN_KEYS,who=actor();
  return !!(keys?.can?.('creators.access',who)||keys?.can?.('world.edit',who)||keys?.can?.('animation.edit',who));
}
function allowed(){return OPEN_CREATOR_ACCESS||permissionAllowed();}
function toast(msg){if(typeof root.showToast==='function')root.showToast(msg);else console.info('[Kelo Creators gate]',msg);}
function base(src){try{return new URL(String(src||''),root.document?.baseURI||root.location.href).pathname;}catch(_){return String(src||'').split('?')[0];}}
function liveToken(){return String(root.KeloPWAFreshness?.build||'').slice(0,16);}
function ensureFreshness(){
  if(root.KeloPWAFreshness)return Promise.resolve(root.KeloPWAFreshness);
  if(freshnessLoading)return freshnessLoading;
  freshnessLoading=new Promise(function(resolve){
    const existing=Array.from(document.scripts).find(s=>base(s.getAttribute('src'))===base(FRESHNESS_SRC));
    if(existing){
      const done=()=>resolve(root.KeloPWAFreshness||null);
      if(root.KeloPWAFreshness){done();return;}
      existing.addEventListener('load',done,{once:true});
      existing.addEventListener('error',()=>resolve(null),{once:true});
      setTimeout(done,2500);return;
    }
    const script=document.createElement('script');script.src=FRESHNESS_SRC;script.async=false;script.dataset.keloPwaFreshness='1';
    script.onload=()=>resolve(root.KeloPWAFreshness||null);
    script.onerror=()=>{try{script.remove();}catch(_){}resolve(null);};
    document.head.appendChild(script);
  }).finally(()=>{freshnessLoading=null;});
  return freshnessLoading;
}
async function freshUrl(src){
  const guard=await ensureFreshness();
  if(guard?.url){try{return await guard.url(src);}catch(_){}}
  return new URL(src,root.document?.baseURI||root.location.href).href;
}
function paint(btn,busy){
  if(!btn)return;
  btn.innerHTML='<span class="lx-menu-icon" aria-hidden="true">♟</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Creators')+'</b><small>'+(busy?'Validando build y herramientas':'Herramientas de creación')+'</small></span>';
  btn.disabled=!!busy;
  if(busy)btn.setAttribute('aria-busy','true');else btn.removeAttribute('aria-busy');
}
function paintForge(btn,busy){
  if(!btn)return;
  btn.innerHTML='<span class="lx-menu-icon" aria-hidden="true">✎</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Asset Forge')+'</b><small>'+(busy?'Validando build y editor':'Dibujar · reparar · mercado')+'</small></span>';
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
async function loadAssetCatalog(){
  if(root.KELO_PROPERTY_CATALOG?.list)return root.KELO_PROPERTY_CATALOG;
  if(catalogLoading)return catalogLoading;
  catalogLoading=(async function(){
    const stale=document.querySelector('script[data-kelo-creator-assets="1"]');
    if(stale)stale.remove();
    const resolvedSrc=await freshUrl(ASSET_CATALOG_SRC);
    return new Promise(function(resolve){
      const s=document.createElement('script');s.src=resolvedSrc;s.async=false;s.dataset.keloCreatorAssets='1';
      const token=liveToken();if(token)s.dataset.keloLiveBuild=token;
      const done=function(){resolve(root.KELO_PROPERTY_CATALOG||null);};
      s.onload=done;s.onerror=function(error){try{s.remove();}catch(_){}console.warn('[Kelo Creators gate] asset catalog unavailable; using fallback',error);done();};document.head.appendChild(s);
    });
  })().finally(function(){catalogLoading=null;});
  return catalogLoading;
}
function evictStaleLauncher(){
  const launcher=root.KELO_STUDIO_LAUNCHER,token=liveToken();
  const script=document.querySelector('script[data-kelo-creators-first-use="1"]');
  const staleBuild=!!(token&&script&&script.dataset.keloLiveBuild!==token);
  const staleAccess=!!(OPEN_CREATOR_ACCESS&&launcher&&launcher.allowed===false);
  if(!launcher&&!script)return;
  if(!staleBuild&&!staleAccess)return;
  try{root.KELO_STUDIO_LAUNCHER=null;}catch(_){}
  try{root.KELO_CREATORS_LAUNCHER=null;}catch(_){}
  try{document.querySelectorAll('script[data-kelo-creators-first-use="1"]').forEach(function(node){node.remove();});}catch(_){}
}
function studioReallyMounted(){
  const doc=root.document;if(!doc)return false;
  const live=doc.getElementById('kelo-studio-live');
  const workspace=doc.getElementById('kelo-studio-workspace');
  return !!(live?.isConnected||workspace?.isConnected);
}
function clearStaleStudioState(){
  const doc=root.document;if(!doc?.body||studioReallyMounted())return false;
  if(!doc.body.classList.contains('kelo-studio-active'))return false;
  try{doc.body.classList.remove('kelo-studio-active');}catch(_){}
  try{doc.getElementById('kelo-world-launch-curtain')?.remove();}catch(_){}
  try{doc.querySelector('canvas.kelo-studio-overlay')?.remove();}catch(_){}
  return true;
}
function recoverHiddenHub(){
  const doc=root.document,hub=doc?.getElementById('kelo-creators-hub');
  if(!hub||studioReallyMounted())return false;
  clearStaleStudioState();
  try{
    const hidden=root.getComputedStyle?.(hub)?.display==='none';
    if(hidden)hub.style.display='grid';
    hub.style.pointerEvents='';
    return hidden;
  }catch(_){return false;}
}
function loadStudio(){
  if(loading)return loading;
  loading=(async function(){
    const guard=await ensureFreshness();
    if(guard?.ready)await guard.ready({reload:false});
    await loadAssetCatalog();
    evictStaleLauncher();
    if(root.KELO_STUDIO_LAUNCHER)return root.KELO_STUDIO_LAUNCHER;
    const resolvedSrc=await freshUrl(LAUNCHER_SRC),token=liveToken();
    return new Promise(function(resolve,reject){
      const s=document.createElement('script');s.src=resolvedSrc;s.async=false;s.dataset.keloCreatorsFirstUse='1';if(token)s.dataset.keloLiveBuild=token;
      s.onload=function(){resolve(root.KELO_STUDIO_LAUNCHER||null);};
      s.onerror=function(){try{s.remove();}catch(_){}reject(new Error('CREATORS_LAUNCHER_LOAD_FAILED'));};document.head.appendChild(s);
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
      const guard=await ensureFreshness();if(guard?.ready)await guard.ready({reload:false});
      root.KELO_LUXE?.closeMenu?.();clearStaleStudioState();
      const mod=await import(await freshUrl(ASSET_FORGE_SRC));
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
  try{
    clearStaleStudioState();
    const launcher=await loadStudio();
    if(!launcher||typeof launcher.open!=='function')throw new Error('CREATORS_LAUNCHER_UNAVAILABLE');
    await launcher.open();
    recoverHiddenHub();
    return true;
  }
  catch(error){console.error('[Kelo Creators lazy gate]',error);toast('No se pudo abrir Kelo Creators');return false;}
  finally{paint(document.getElementById('lx-create-studio'),false);}
}
const api=Object.freeze({version:VERSION,open,openAssetForge,sync,get allowed(){return allowed();},get directRequested(){return directRequested();},get openAccess(){return OPEN_CREATOR_ACCESS;},get liveBuild(){return root.KeloPWAFreshness?.build||null;}});
root.KeloCreatorsLazyGate=api;
root.KELO_CREATORS_LAZY_GATE=api;
try{root.KELO_ADMIN_KEYS?.onChange?.(sync);}catch(_){}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){sync();if(directRequested())void open();},{once:true});
else{sync();if(directRequested())void open();}
})(typeof globalThis!=='undefined'?globalThis:window);