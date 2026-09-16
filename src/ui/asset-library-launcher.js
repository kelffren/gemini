/* KELO-INDEX
 * area: UI / UNIVERSAL CONTENT LIBRARY LAUNCHER
 * owner: Kelo Universal Content Launcher
 * keys: ASSETS AUDIO MUSIC AMBIENCE ABILITIES SCENES VAULT PACKS COMMUNITY CREATOR MOBILE LAZY HYDRATION AOI STREAMING
 * purpose: expose Universal Content Library, Content Packs, community publishing, and hydrate only requested content.
 */
(function(root){
'use strict';
if(root.KELO_ASSET_LIBRARY_LAUNCHER)return;
const ID='kelo-asset-library-launcher',PACK_ID='kelo-content-packs-launcher',COMMUNITY_ID='kelo-community-creator-launcher';
let gridObserver=null,bodyObserver=null,hydratePromise=null,communityRuntimePromise=null,boundAssetBridge=false,boundContentBridge=false,communityNetBridgeBound=false,communityScanAcc=0;
const communityPeerKeys=new Map();
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
function ensureCommunityRuntime(){
  if(root.__KELO_COMMUNITY_ASSET_RUNTIME__)return Promise.resolve(root.__KELO_COMMUNITY_ASSET_RUNTIME__);
  if(communityRuntimePromise)return communityRuntimePromise;
  communityRuntimePromise=import('./../creators/assets/community-asset-runtime.mjs?v=2').catch(error=>{communityRuntimePromise=null;throw error;});
  return communityRuntimePromise;
}
function communityAssetsFor(peer){
  const assets=peer?.avatarManifest?.payload?.communityAssets;
  return Array.isArray(assets)?assets.slice(0,12):[];
}
function communityAssetKey(assets){return assets.map(asset=>`${asset?.slot||''}:${asset?.id||asset?.assetId||''}@${asset?.version||1}:${asset?.sha256||''}`).join('|');}
function communityDistance(peer){
  const local=root.localPlayer;
  if(!local||!peer)return Infinity;
  return Math.hypot((Number(peer.x)||0)-(Number(local.x)||0),(Number(peer.y)||0)-(Number(local.y)||0));
}
function dispatchCommunityAssets(playerId,assets,peer){
  root.dispatchEvent(new CustomEvent('kelo:community-player-assets',{detail:{playerId:String(playerId),assets,visible:true,distance:communityDistance(peer),profileOpen:false,source:'server-avatar-manifest-aoi'}}));
}
function scanCommunityPeers(context){
  communityScanAcc+=Number(context?.dt)||0;
  if(communityScanAcc<.25)return;
  communityScanAcc=0;
  const peers=root.keloNet?.peers;
  if(!peers||typeof peers!=='object')return;
  const live=new Set();
  Object.keys(peers).forEach(playerId=>{
    const peer=peers[playerId];if(!peer)return;
    live.add(String(playerId));
    const assets=communityAssetsFor(peer),key=communityAssetKey(assets),previous=communityPeerKeys.get(String(playerId));
    peer.communityAssets=assets;
    if(previous===key)return;
    communityPeerKeys.set(String(playerId),key);
    if(assets.length||previous!=null)dispatchCommunityAssets(playerId,assets,peer);
  });
  for(const playerId of [...communityPeerKeys.keys()]){
    if(live.has(playerId))continue;
    communityPeerKeys.delete(playerId);
    if(root.__KELO_COMMUNITY_ASSET_RUNTIME__)root.dispatchEvent(new CustomEvent('kelo:community-player-left',{detail:{playerId,source:'server-aoi-leave'}}));
  }
}
function bindCommunityNetworkBridge(){
  if(communityNetBridgeBound)return true;
  if(!root.KeloSimulation||typeof root.KeloSimulation.after!=='function')return false;
  root.KeloSimulation.after('asset-library:community-net-bridge',scanCommunityPeers,315);
  communityNetBridgeBound=true;
  return true;
}
function openCreatorsWhenReady(){let tries=0;const attempt=()=>{tries++;const launcher=root.KELO_STUDIO_LAUNCHER||root.KELO_CREATORS_LAUNCHER;if(launcher?.open){void hydratePersonalContent().finally(()=>launcher.open().catch?.(()=>{}));return;}if(tries<20)root.setTimeout(attempt,150);};attempt();}
function openPage(path){const opened=root.open(path,'_blank');if(!opened)root.location.href=path;try{root.KELO_LUXE?.closeMenu?.();}catch{}}
function openLibrary(){openPage('asset-vault.html');}
function openPacks(){openPage('content-packs.html');}
function openCommunityCreator(){openPage('creator-publish.html');}
function buildButton(){const button=document.createElement('button');button.id=ID;button.type='button';button.className='lx-menu-item';button.setAttribute('aria-label','Abrir Biblioteca Universal de Contenido');button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">🧰</span><span class="lx-menu-copy"><b>Biblioteca</b><small>Assets · audio · skills · escenas</small></span>';button.addEventListener('click',openLibrary);refresh(button);return button;}
function buildPackButton(){const button=document.createElement('button');button.id=PACK_ID;button.type='button';button.className='lx-menu-item';button.setAttribute('aria-label','Abrir Content Packs');button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">📦</span><span class="lx-menu-copy"><b>Packs</b><small>Instalar grupos · bajo demanda</small></span>';button.addEventListener('click',openPacks);return button;}
function buildCommunityButton(){const button=document.createElement('button');button.id=COMMUNITY_ID;button.type='button';button.className='lx-menu-item';button.setAttribute('aria-label','Crear y publicar asset comunitario');button.innerHTML='<span class="lx-menu-icon" aria-hidden="true">🎨</span><span class="lx-menu-copy"><b>Crear / Publicar</b><small>Comunidad · validación automática</small></span>';button.addEventListener('click',openCommunityCreator);return button;}
function ensureInMenu(){
  const grid=document.getElementById('lx-menu-grid');if(!grid)return false;
  let button=document.getElementById(ID);if(!button||button.parentNode!==grid){if(button)button.remove();button=buildButton();grid.appendChild(button);}else refresh(button);
  let packButton=document.getElementById(PACK_ID);if(!packButton||packButton.parentNode!==grid){if(packButton)packButton.remove();packButton=buildPackButton();grid.appendChild(packButton);}
  let communityButton=document.getElementById(COMMUNITY_ID);if(!communityButton||communityButton.parentNode!==grid){if(communityButton)communityButton.remove();communityButton=buildCommunityButton();grid.appendChild(communityButton);}
  if(!gridObserver){gridObserver=new MutationObserver(()=>{const current=document.getElementById(ID),packs=document.getElementById(PACK_ID),community=document.getElementById(COMMUNITY_ID);if(!current||current.parentNode!==grid||!packs||packs.parentNode!==grid||!community||community.parentNode!==grid)queueMicrotask(ensureInMenu);});gridObserver.observe(grid,{childList:true});}
  return true;
}
function mount(){bindCommunityNetworkBridge();if(ensureInMenu())return;if(bodyObserver)return;bodyObserver=new MutationObserver(()=>{bindCommunityNetworkBridge();if(ensureInMenu()){bodyObserver.disconnect();bodyObserver=null;}});bodyObserver.observe(document.body,{childList:true,subtree:true});}
root.addEventListener('message',event=>{if(event.origin!==root.location.origin)return;const type=event.data?.type,id=event.data?.id;if(type==='kelo:hydrate-personal-assets'||type==='kelo:hydrate-personal-content')void hydratePersonalContent().catch(error=>console.warn('[Kelo personal content hydration]',error));if(type==='kelo:play-personal-audio')void hydratePersonalContent().then(()=>root.KELO_PERSONAL_AUDIO?.play?.(id)).catch(error=>console.warn('[Kelo personal audio]',error));if(type==='kelo:open-creators'){void hydratePersonalContent().catch(()=>{});openCreatorsWhenReady();}if(type==='kelo:open-community-creator')openCommunityCreator();});
root.addEventListener('kelo:community-player-assets',event=>{
  if(root.__KELO_COMMUNITY_ASSET_RUNTIME__)return;
  const detail=event.detail;
  void ensureCommunityRuntime().then(()=>root.dispatchEvent(new CustomEvent('kelo:community-player-assets',{detail}))).catch(error=>console.warn('[Kelo community asset runtime]',error));
});
root.addEventListener('kelo:forest-plaza-catalog-ready',()=>void hydratePersonalContent().catch(()=>{}));
document.addEventListener('click',event=>{if(event.target?.closest?.('#lx-create-studio,#lx-create-asset-forge'))void hydratePersonalContent().catch(()=>{});},true);
root.addEventListener('kelo:asset-selection-changed',()=>refresh(document.getElementById(ID)));root.addEventListener('storage',()=>refresh(document.getElementById(ID)));
const api=Object.freeze({version:'content-library-launcher-v6-community-aoi',open:openLibrary,openPacks,openCommunityCreator,hydratePersonalAssets,hydratePersonalContent,ensureCommunityRuntime,bindCommunityNetworkBridge,refresh:()=>refresh(document.getElementById(ID))});
root.KELO_ASSET_LIBRARY_LAUNCHER=api;root.KELO_CONTENT_LIBRARY_LAUNCHER=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof globalThis!=='undefined'?globalThis:window);
