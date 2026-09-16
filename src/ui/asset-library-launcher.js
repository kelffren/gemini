/* KELO-INDEX
 * area: UI / ASSET LIBRARY LAUNCHER
 * owner: Kelo Asset Library Launcher
 * keys: ASSETS LIBRARY VAULT EXTERNAL PROVIDERS MOBILE LAZY HYDRATION
 * purpose: expose Universal Asset Library from Luxe and hydrate personal integrated assets only when Creators/Studio needs them.
 */
(function(root){
'use strict';
if(root.KELO_ASSET_LIBRARY_LAUNCHER)return;
const ID='kelo-asset-library-launcher';
let gridObserver=null,bodyObserver=null,hydratePromise=null,boundBridge=false;

function disabledCount(){try{return root.KELO_ASSET_REGISTRY?.getState?.()?.disabled?.length||0;}catch{return 0;}}
function refresh(button){
  if(!button)return;
  const off=disabledCount(),small=button.querySelector('small');
  if(small)small.textContent=off?`Biblioteca + Baúl · ${off} packs off`:'Biblioteca + Baúl personal';
  button.title='Biblioteca Universal de Assets';
}

async function hydratePersonalAssets(){
  if(hydratePromise)return hydratePromise;
  hydratePromise=(async()=>{
    const mod=await import('./../creators/assets/personal-asset-runtime-bridge.mjs?v=1');
    if(!boundBridge){mod.bindPersonalAssetRuntime(root);boundBridge=true;}
    let result=null;
    for(const delay of [0,180,650,1600,3200]){
      if(delay)await new Promise(resolve=>root.setTimeout(resolve,delay));
      result=await mod.installIntegratedPersonalAssets(root);
      if(result?.ready)return result;
    }
    return result||{ready:false,installed:0,total:0};
  })().finally(()=>{hydratePromise=null;});
  return hydratePromise;
}

function openCreatorsWhenReady(){
  let tries=0;
  const attempt=()=>{
    tries++;
    const launcher=root.KELO_STUDIO_LAUNCHER||root.KELO_CREATORS_LAUNCHER;
    if(launcher?.open){void hydratePersonalAssets().finally(()=>launcher.open().catch?.(()=>{}));return;}
    if(tries<20)root.setTimeout(attempt,150);
  };
  attempt();
}

function openLibrary(){
  // Same-origin opener is intentionally preserved so the vault can ask the running game
  // to hydrate an integrated asset without adding that asset to global boot.
  const opened=root.open('asset-vault.html','_blank');
  if(!opened)root.location.href='asset-vault.html';
  try{root.KELO_LUXE?.closeMenu?.();}catch{}
}

function buildButton(){
  const button=document.createElement('button');button.id=ID;button.type='button';button.className='lx-menu-item';button.setAttribute('aria-label','Abrir Biblioteca Universal de Assets');
  button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">🧰</span><span class="lx-menu-copy"><b>Assets</b><small>Biblioteca + Baúl personal</small></span>';
  button.addEventListener('click',openLibrary);refresh(button);return button;
}

function ensureInMenu(){
  const grid=document.getElementById('lx-menu-grid');if(!grid)return false;
  let button=document.getElementById(ID);
  if(!button||button.parentNode!==grid){if(button)button.remove();button=buildButton();grid.appendChild(button);}else refresh(button);
  if(!gridObserver){gridObserver=new MutationObserver(()=>{const current=document.getElementById(ID);if(!current||current.parentNode!==grid)queueMicrotask(ensureInMenu);});gridObserver.observe(grid,{childList:true});}
  return true;
}
function mount(){
  if(ensureInMenu())return;if(bodyObserver)return;
  bodyObserver=new MutationObserver(()=>{if(ensureInMenu()){bodyObserver.disconnect();bodyObserver=null;}});bodyObserver.observe(document.body,{childList:true,subtree:true});
}

root.addEventListener('message',event=>{
  if(event.origin!==root.location.origin)return;
  const type=event.data?.type;
  if(type==='kelo:hydrate-personal-assets')void hydratePersonalAssets().catch(error=>console.warn('[Kelo personal assets hydration]',error));
  if(type==='kelo:open-creators'){void hydratePersonalAssets().catch(()=>{});openCreatorsWhenReady();}
});
root.addEventListener('kelo:forest-plaza-catalog-ready',()=>void hydratePersonalAssets().catch(()=>{}));
document.addEventListener('click',event=>{
  if(event.target?.closest?.('#lx-create-studio,#lx-create-asset-forge'))void hydratePersonalAssets().catch(()=>{});
},true);
root.addEventListener('kelo:asset-selection-changed',()=>refresh(document.getElementById(ID)));
root.addEventListener('storage',()=>refresh(document.getElementById(ID)));

const api=Object.freeze({version:'asset-library-launcher-v2-personal-vault',open:openLibrary,hydratePersonalAssets,refresh:()=>refresh(document.getElementById(ID))});
root.KELO_ASSET_LIBRARY_LAUNCHER=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof globalThis!=='undefined'?globalThis:window);
