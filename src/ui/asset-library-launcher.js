/* KELO-INDEX
 * area: UI / UNIVERSAL CONTENT LIBRARY LAUNCHER
 * owner: Kelo Universal Content Launcher
 * keys: ASSETS AUDIO MUSIC AMBIENCE ABILITIES SCENES VAULT MOBILE LAZY HYDRATION
 * purpose: expose Universal Content Library and hydrate only integrated personal content when requested.
 */
(function(root){
'use strict';
if(root.KELO_ASSET_LIBRARY_LAUNCHER)return;
const ID='kelo-asset-library-launcher';
let gridObserver=null,bodyObserver=null,hydratePromise=null,boundAssetBridge=false,boundContentBridge=false;
function disabledCount(){try{return root.KELO_ASSET_REGISTRY?.getState?.()?.disabled?.length||0;}catch{return 0;}}
function refresh(button){if(!button)return;const off=disabledCount(),small=button.querySelector('small');if(small)small.textContent=off?`Assets · audio · skills · escenas · ${off} packs off`:'Assets · audio · skills · escenas';button.title='Biblioteca Universal de Contenido';}
async function hydratePersonalContent(){
  if(hydratePromise)return hydratePromise;
  hydratePromise=(async()=>{
    const [assetMod,contentMod]=await Promise.all([import('./../creators/assets/personal-asset-runtime-bridge.mjs?v=2'),import('./../creators/assets/personal-content-runtime-bridge.mjs?v=1')]);
    if(!boundAssetBridge){assetMod.bindPersonalAssetRuntime(root);boundAssetBridge=true;}
    if(!boundContentBridge){contentMod.bindPersonalContentRuntime(root);boundContentBridge=true;}
    const content=await contentMod.PERSONAL_CONTENT_RUNTIME_BRIDGE.hydrate(root);
    let visual={ready:false,installed:0,total:0};
    for(const delay of [0,180,650,1600,3200]){if(delay)await new Promise(resolve=>root.setTimeout(resolve,delay));visual=await assetMod.installIntegratedPersonalAssets(root);if(visual?.ready)break;}
    return{ready:!!(content?.ready||visual?.ready),content,visual};
  })().finally(()=>{hydratePromise=null;});
  return hydratePromise;
}
const hydratePersonalAssets=hydratePersonalContent;
function openCreatorsWhenReady(){let tries=0;const attempt=()=>{tries++;const launcher=root.KELO_STUDIO_LAUNCHER||root.KELO_CREATORS_LAUNCHER;if(launcher?.open){void hydratePersonalContent().finally(()=>launcher.open().catch?.(()=>{}));return;}if(tries<20)root.setTimeout(attempt,150);};attempt();}
function openLibrary(){const opened=root.open('asset-vault.html','_blank');if(!opened)root.location.href='asset-vault.html';try{root.KELO_LUXE?.closeMenu?.();}catch{}}
function buildButton(){const button=document.createElement('button');button.id=ID;button.type='button';button.className='lx-menu-item';button.setAttribute('aria-label','Abrir Biblioteca Universal de Contenido');button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">🧰</span><span class="lx-menu-copy"><b>Biblioteca</b><small>Assets · audio · skills · escenas</small></span>';button.addEventListener('click',openLibrary);refresh(button);return button;}
function ensureInMenu(){const grid=document.getElementById('lx-menu-grid');if(!grid)return false;let button=document.getElementById(ID);if(!button||button.parentNode!==grid){if(button)button.remove();button=buildButton();grid.appendChild(button);}else refresh(button);if(!gridObserver){gridObserver=new MutationObserver(()=>{const current=document.getElementById(ID);if(!current||current.parentNode!==grid)queueMicrotask(ensureInMenu);});gridObserver.observe(grid,{childList:true});}return true;}
function mount(){if(ensureInMenu())return;if(bodyObserver)return;bodyObserver=new MutationObserver(()=>{if(ensureInMenu()){bodyObserver.disconnect();bodyObserver=null;}});bodyObserver.observe(document.body,{childList:true,subtree:true});}
root.addEventListener('message',event=>{if(event.origin!==root.location.origin)return;const type=event.data?.type,id=event.data?.id;if(type==='kelo:hydrate-personal-assets'||type==='kelo:hydrate-personal-content')void hydratePersonalContent().catch(error=>console.warn('[Kelo personal content hydration]',error));if(type==='kelo:play-personal-audio')void hydratePersonalContent().then(()=>root.KELO_PERSONAL_AUDIO?.play?.(id)).catch(error=>console.warn('[Kelo personal audio]',error));if(type==='kelo:open-creators'){void hydratePersonalContent().catch(()=>{});openCreatorsWhenReady();}});
root.addEventListener('kelo:forest-plaza-catalog-ready',()=>void hydratePersonalContent().catch(()=>{}));
document.addEventListener('click',event=>{if(event.target?.closest?.('#lx-create-studio,#lx-create-asset-forge'))void hydratePersonalContent().catch(()=>{});},true);
root.addEventListener('kelo:asset-selection-changed',()=>refresh(document.getElementById(ID)));root.addEventListener('storage',()=>refresh(document.getElementById(ID)));
const api=Object.freeze({version:'content-library-launcher-v3-universal-vault',open:openLibrary,hydratePersonalAssets,hydratePersonalContent,refresh:()=>refresh(document.getElementById(ID))});
root.KELO_ASSET_LIBRARY_LAUNCHER=api;root.KELO_CONTENT_LIBRARY_LAUNCHER=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof globalThis!=='undefined'?globalThis:window);
