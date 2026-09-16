/* KELO-INDEX
 * area: UI / CREATORS LAUNCHER
 * owner: Kelo Studio Launcher (compat name retained)
 * keys: CREATORS MENU PREMIUM LAZY ADMIN MOBILE SAFARI BUILD SHA
 * purpose: open Creator surfaces through one stable per-build module identity instead of hand-maintained ?v= tags
 * public-api: KELO_STUDIO_LAUNCHER + KELO_CREATORS_LAUNCHER alias
 * consumes: KELO_ADMIN_KEYS, KeloRuntimeVersion, KELO_LUXE
 * state-owned: only ephemeral load state
 */
(function(){
'use strict';
if(window.KELO_STUDIO_LAUNCHER)return;
let loading=false,factoryLoading=false,forgeLoading=false,directOpenStarted=false;
const params=()=>new URLSearchParams(window.location.search);
const directRequested=()=>params().get('creators')==='1'||params().get('creator')==='1';
const actor=()=>String(window.KELO_ADMIN_KEYS?.playerId?.()||window.keloNet?.playerKey||window.localPlayer?.id||'local_pioneer');
const allowed=()=>{const keys=window.KELO_ADMIN_KEYS,who=actor();return !!(keys?.can?.('creators.access',who)||keys?.can?.('world.edit',who)||keys?.can?.('animation.edit',who));};
const toast=m=>{if(typeof window.showToast==='function')window.showToast(m);else console.info('[Kelo Creators]',m);};
const friendlyError=error=>String(error?.message||error||'No se pudo abrir Kelo Creators');
async function importRuntime(path){
  const runtime=window.KeloRuntimeVersion;if(runtime){await runtime.ready();return runtime.importModule(path);}
  return import(new URL(path,document.baseURI).href);
}
function paint(button,busy){if(!button)return;button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">♟</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Creators')+'</b><small>'+(busy?'Cargando herramientas':'Herramientas de creación')+'</small></span>';button.disabled=!!busy;if(busy)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');}
function paintFactory(button,busy){if(!button)return;button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">▦</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Sprite Factory')+'</b><small>'+(busy?'Preparando pipeline':'Sprites 8D · AI · preview · QA')+'</small></span>';button.disabled=!!busy;if(busy)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');}
function paintForge(button,busy){if(!button)return;button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">✎</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Asset Forge')+'</b><small>'+(busy?'Cargando editor':'Dibujar · reparar · mercado')+'</small></span>';button.disabled=!!busy;if(busy)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');}
async function loadCreatorHub(){
  try{return await importRuntime('src/creators/ui/creator-hub.mjs');}
  catch(firstError){console.warn('[Kelo Creators launcher] retrying Creator Hub',firstError);return importRuntime('src/creators/ui/creator-hub.mjs');}
}
async function open(){
  if(loading)return;if(!allowed())return toast('Necesitas acceso a Kelo Creators');loading=true;const btn=document.getElementById('lx-create-studio');paint(btn,true);
  try{window.KELO_LUXE?.closeMenu?.();const mod=await loadCreatorHub();await mod.openCreatorHub({root:window});}
  catch(e){console.error('[Kelo Creators launcher]',e);toast(friendlyError(e));throw e;}
  finally{loading=false;if(btn?.isConnected)paint(btn,false);}
}
async function openFactory(){
  if(factoryLoading)return;if(!allowed())return toast('Necesitas acceso a Kelo Creators');factoryLoading=true;const btn=document.getElementById('lx-create-sprite-factory');paintFactory(btn,true);
  try{window.KELO_LUXE?.closeMenu?.();const mod=await importRuntime('src/creators/ui/sprite-factory-online.mjs');await mod.openSpriteFactoryOnline({root:window});}
  catch(e){console.error('[Kelo Sprite Factory launcher]',e);toast(friendlyError(e));}
  finally{factoryLoading=false;if(btn?.isConnected)paintFactory(btn,false);}
}
async function openForge(){
  if(forgeLoading)return;if(!allowed())return toast('Necesitas acceso a Kelo Creators');forgeLoading=true;const btn=document.getElementById('lx-create-asset-forge');paintForge(btn,true);
  try{window.KELO_LUXE?.closeMenu?.();const mod=await importRuntime('src/creators/creator-entry.mjs');const platform=await mod.bootKeloCreators({root:window});await platform.openWorkspace('asset-forge');}
  catch(e){console.error('[Kelo Asset Forge launcher]',e);toast(friendlyError(e));}
  finally{forgeLoading=false;if(btn?.isConnected)paintForge(btn,false);}
}
function sync(){
  const grid=document.querySelector('#lx-menu-panel .lx-menu-grid');if(!grid)return false;
  let btn=document.getElementById('lx-create-studio'),factoryBtn=document.getElementById('lx-create-sprite-factory'),forgeBtn=document.getElementById('lx-create-asset-forge');
  if(!allowed()){btn?.remove();factoryBtn?.remove();forgeBtn?.remove();return true;}
  if(!btn){btn=document.createElement('button');btn.id='lx-create-studio';btn.type='button';btn.className='lx-menu-item';btn.onclick=e=>{e.preventDefault();e.stopPropagation();void open().catch(()=>{});};grid.appendChild(btn);}
  if(!factoryBtn){factoryBtn=document.createElement('button');factoryBtn.id='lx-create-sprite-factory';factoryBtn.type='button';factoryBtn.className='lx-menu-item';factoryBtn.onclick=e=>{e.preventDefault();e.stopPropagation();void openFactory();};grid.appendChild(factoryBtn);}
  if(!forgeBtn){forgeBtn=document.createElement('button');forgeBtn.id='lx-create-asset-forge';forgeBtn.type='button';forgeBtn.className='lx-menu-item';forgeBtn.onclick=e=>{e.preventDefault();e.stopPropagation();void openForge();};grid.appendChild(forgeBtn);}
  btn.setAttribute('aria-label','Abrir Kelo Creators');paint(btn,loading);factoryBtn.setAttribute('aria-label','Abrir Kelo Sprite Factory');paintFactory(factoryBtn,factoryLoading);forgeBtn.setAttribute('aria-label','Abrir Kelo Asset Forge');paintForge(forgeBtn,forgeLoading);return true;
}
function maybeOpenDirect(){
  if(!directRequested()||directOpenStarted)return;let tries=0;
  const attempt=()=>{if(directOpenStarted)return;tries++;sync();if(allowed()){directOpenStarted=true;void open().catch(error=>{directOpenStarted=false;console.error('[Kelo Creators direct launch]',error);if(tries<12)window.setTimeout(attempt,250);});return;}if(tries<12)window.setTimeout(attempt,100);else toast('No se pudo activar la llave de Kelo Creators');};attempt();
}
async function bootOnlineAuthorization(){
  try{const m=await importRuntime('src/auth/account-permissions-runtime.mjs');await m.installAccountPermissions({root:window});sync();maybeOpenDirect();}catch(error){console.warn('[Kelo online permissions boot]',error);}
  try{const m=await importRuntime('src/ui/account-admin-panel.mjs');await m.installAccountAdminPanel({root:window});}catch(error){console.warn('[Kelo admin panel boot]',error);}
  try{const m=await importRuntime('src/auth/account-live-control-runtime.mjs');await m.installAccountLiveControl({root:window});}catch(error){console.warn('[Kelo account live control boot]',error);}
}
function bootSurgery(){void importRuntime('src/studio/diagnostics/world-surgery-runtime.mjs').then(m=>m.installWorldSurgery({root:window})).catch(error=>console.warn('[Kelo World Surgery boot]',error));}
function boot(){bootSurgery();sync();maybeOpenDirect();void bootOnlineAuthorization();void importRuntime('src/characters/creator-avatar-runtime.mjs').then(m=>m.installCreatorAvatarRuntime({root:window})).catch(e=>console.warn('[Kelo Avatar runtime]',e));}
window.KELO_ADMIN_KEYS?.onChange?.(()=>{sync();maybeOpenDirect();});
const api=Object.freeze({version:'studio-launcher-v1.21.0-runtime-build',open,openSpriteFactory:openFactory,openAssetForge:openForge,sync,get allowed(){return allowed();},get directRequested(){return directRequested();}});window.KELO_STUDIO_LAUNCHER=api;window.KELO_CREATORS_LAUNCHER=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
