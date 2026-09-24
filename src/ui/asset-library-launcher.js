/* KELO-INDEX
 * area: UI / UNIVERSAL CONTENT LIBRARY LAUNCHER
 * owner: Kelo Universal Content Launcher
 * keys: ASSETS SPRITE-OS AUDIO MUSIC AMBIENCE ABILITIES SCENES VAULT PACKS COMMUNITY CREATOR MOBILE LAZY HYDRATION AOI STREAMING
 * purpose: expose Sprite OS, Universal Content Library, packs, community publishing, and on-demand hydration.
 */
(function(root){
'use strict';
if(root.KELO_ASSET_LIBRARY_LAUNCHER)return;
const ID='kelo-asset-library-launcher',SPRITE_ID='kelo-sprite-os-launcher',PACK_ID='kelo-content-packs-launcher',COMMUNITY_ID='kelo-community-creator-launcher';
let gridObserver=null,bodyObserver=null,hydratePromise=null,communityRuntimePromise=null,buildPromise=null,livePreviewPromise=null,boundAssetBridge=false,boundContentBridge=false,communityNetBridgeBound=false,communityScanAcc=0;
const BUILD_HANDOFF_KEY='kelo.library.build.pending.v1',PALETTE_HANDOFF_KEY='kelo.library.palette.pending.v1',EXTERNAL_PREVIEW_HANDOFF_KEY='kelo.library.external-preview.pending.v1';
const communityPeerKeys=new Map();
function disabledCount(){try{return root.KELO_ASSET_REGISTRY?.getState?.()?.disabled?.length||0;}catch{return 0;}}
function refresh(button){if(!button)return;const off=disabledCount(),small=button.querySelector('small');if(small)small.textContent=off?`Poner en la plaza · ${off} módulos off`:'Poner en la plaza';button.title='Biblioteca';}
async function hydratePersonalContent(){
 if(hydratePromise)return hydratePromise;
 hydratePromise=(async()=>{const [assetMod,contentMod]=await Promise.all([import('./../creators/assets/personal-asset-runtime-bridge.mjs?v=2'),import('./../creators/assets/personal-content-runtime-bridge.mjs?v=1')]);if(!boundAssetBridge){assetMod.bindPersonalAssetRuntime(root);boundAssetBridge=true;}if(!boundContentBridge){contentMod.bindPersonalContentRuntime(root);boundContentBridge=true;}const content=await contentMod.PERSONAL_CONTENT_RUNTIME_BRIDGE.hydrate(root);let visual={ready:false,installed:0,total:0};for(const delay of [0,180,650,1600,3200]){if(delay)await new Promise(resolve=>root.setTimeout(resolve,delay));visual=await assetMod.installIntegratedPersonalAssets(root);if(visual?.ready)break;}return{ready:!!(content?.ready||visual?.ready),content,visual};})().finally(()=>{hydratePromise=null;});
 return hydratePromise;
}
const hydratePersonalAssets=hydratePersonalContent;
function ensureCommunityRuntime(){if(root.__KELO_COMMUNITY_ASSET_RUNTIME__)return Promise.resolve(root.__KELO_COMMUNITY_ASSET_RUNTIME__);if(communityRuntimePromise)return communityRuntimePromise;communityRuntimePromise=import('./../creators/assets/community-asset-runtime.mjs?v=2').catch(error=>{communityRuntimePromise=null;throw error;});return communityRuntimePromise;}
function communityAssetsFor(peer){const assets=peer?.avatarManifest?.payload?.communityAssets;return Array.isArray(assets)?assets.slice(0,12):[];}
function communityAssetKey(assets){return assets.map(asset=>`${asset?.slot||''}:${asset?.id||asset?.assetId||''}@${asset?.version||1}:${asset?.sha256||''}`).join('|');}
function communityDistance(peer){const local=root.localPlayer;if(!local||!peer)return Infinity;return Math.hypot((Number(peer.x)||0)-(Number(local.x)||0),(Number(peer.y)||0)-(Number(local.y)||0));}
function dispatchCommunityAssets(playerId,assets,peer){root.dispatchEvent(new CustomEvent('kelo:community-player-assets',{detail:{playerId:String(playerId),assets,visible:true,distance:communityDistance(peer),profileOpen:false,source:'server-avatar-manifest-aoi'}}));}
function scanCommunityPeers(context){communityScanAcc+=Number(context?.dt)||0;if(communityScanAcc<.25)return;communityScanAcc=0;const peers=root.keloNet?.peers;if(!peers||typeof peers!=='object')return;const live=new Set();Object.keys(peers).forEach(playerId=>{const peer=peers[playerId];if(!peer)return;live.add(String(playerId));const assets=communityAssetsFor(peer),key=communityAssetKey(assets),previous=communityPeerKeys.get(String(playerId));peer.communityAssets=assets;if(previous===key)return;communityPeerKeys.set(String(playerId),key);if(assets.length||previous!=null)dispatchCommunityAssets(playerId,assets,peer);});for(const playerId of [...communityPeerKeys.keys()]){if(live.has(playerId))continue;communityPeerKeys.delete(playerId);if(root.__KELO_COMMUNITY_ASSET_RUNTIME__)root.dispatchEvent(new CustomEvent('kelo:community-player-left',{detail:{playerId,source:'server-aoi-leave'}}));}}
function bindCommunityNetworkBridge(){if(communityNetBridgeBound)return true;if(!root.KeloSimulation||typeof root.KeloSimulation.after!=='function')return false;root.KeloSimulation.after('asset-library:community-net-bridge',scanCommunityPeers,315);communityNetBridgeBound=true;return true;}
function openCreatorsWhenReady(){let tries=0;const attempt=()=>{tries++;const launcher=root.KELO_STUDIO_LAUNCHER||root.KELO_CREATORS_LAUNCHER;if(launcher?.open){void hydratePersonalContent().finally(()=>launcher.open().catch?.(()=>{}));return;}if(tries<20)root.setTimeout(attempt,150);};attempt();}
async function buildPersonalContent(id){id=String(id||'').trim();if(!id)throw new Error('LIBRARY_BUILD_ASSET_ID_REQUIRED');if(buildPromise)return buildPromise;buildPromise=(async()=>{await hydratePersonalContent();const creators=await import('./../creators/creator-entry.mjs?v=library-build-v4');const platform=await creators.bootKeloCreators({root});const session=await platform.openWorkspace('world');if(!session?.studio?.kernel)throw new Error('LIBRARY_BUILD_WORLD_NOT_READY');const bridge=await import('./../studio/integration/library-build-bridge.mjs?v=6-infinite-palette');const result=await bridge.startPersonalAssetPlacement({root,session,assetId:id,prepareScenePainter:true});try{root.KELO_LUXE?.closeMenu?.();}catch{}try{root.showToast?.(`Poner activo · ${result.template?.label||result.prefabId}`);}catch{}return result;})().finally(()=>{buildPromise=null;});return buildPromise;}
async function buildPersonalPalette(ids){
 const list=[...new Set((Array.isArray(ids)?ids:[]).map(v=>String(v||'').trim()).filter(Boolean))].slice(0,16);
 if(list.length<2)throw new Error('LIBRARY_PALETTE_NEEDS_TWO_ASSETS');
 if(buildPromise)return buildPromise;
 buildPromise=(async()=>{
   await hydratePersonalContent();
   const creators=await import('./../creators/creator-entry.mjs?v=library-build-v4');
   const platform=await creators.bootKeloCreators({root});
   const session=await platform.openWorkspace('world');
   if(!session?.studio?.kernel)throw new Error('LIBRARY_BUILD_WORLD_NOT_READY');
   const bridge=await import('./../studio/integration/library-build-bridge.mjs?v=6-infinite-palette');
   const activeTool=session.studio.tools?.libraryPaletteBrush;
   const refreshing=!!activeTool?.state?.().active;
   const result=refreshing
     ?await bridge.refreshPersonalAssetPalette({root,session,assetIds:list,maxTemplates:24})
     :await bridge.startPersonalAssetPalette({root,session,assetIds:list,maxTemplates:24});
   try{root.KELO_LUXE?.closeMenu?.();}catch{}
   try{
     root.showToast?.(
       refreshing
         ?result.unchanged?`Semantic Brush · paleta conservada · ${result.variants} variantes`:`Semantic Brush actualizado · ${result.variants} variantes`
         :`Semantic Brush · ${result.variants} variantes · arrastra para pintar`
     );
   }catch{}
   return{...result,refreshed:refreshing};
 })().finally(()=>{buildPromise=null;});
 return buildPromise;
}
async function previewExternalAsset(asset){
 if(!asset?.id||!asset?.previewUrl)throw new Error('LIVE_PREVIEW_ASSET_REQUIRED');
 if(livePreviewPromise)return livePreviewPromise;
 livePreviewPromise=(async()=>{
   const creators=await import('./../creators/creator-entry.mjs?v=library-live-preview-v1');
   const platform=await creators.bootKeloCreators({root});
   const workspace=await platform.openWorkspace('world');
   if(!workspace?.studio?.kernel)throw new Error('LIVE_PREVIEW_WORLD_NOT_READY');
   const bridge=await import('./../studio/integration/external-live-preview-bridge.mjs?v=1');
   const studio=workspace.studio,selected=studio.kernel.selection?.get?.()||[];
   const swapEntityId=selected.length===1?String(selected[0]):null;
   const result=swapEntityId?await bridge.startExternalAssetSwap({root,session:workspace,asset,entityId:swapEntityId}):await bridge.startExternalAssetPreview({root,session:workspace,asset});
   try{root.KELO_LUXE?.closeMenu?.();}catch{}
   return result;
 })().finally(()=>{livePreviewPromise=null;});
 return livePreviewPromise;
}
function consumePendingExternalPreview(){
 let asset=null,requested=false;
 try{const params=new URLSearchParams(root.location?.search||'');requested=params.get('liveAssetPreview')==='1';if(requested&&root.history?.replaceState){params.delete('liveAssetPreview');const q=params.toString();root.history.replaceState(null,'',`${root.location.pathname}${q?`?${q}`:''}${root.location.hash||''}`);}}catch{}
 try{const raw=root.localStorage?.getItem(EXTERNAL_PREVIEW_HANDOFF_KEY);if(raw){const row=JSON.parse(raw);if(Date.now()-Number(row?.at||0)<120000)asset=row?.asset||null;root.localStorage.removeItem(EXTERNAL_PREVIEW_HANDOFF_KEY);}}catch{}
 if((requested||asset)&&asset)void previewExternalAsset(asset).catch(error=>{console.error('[Kelo external live preview]',error);try{root.showToast?.(String(error?.message||error).replaceAll('_',' '));}catch{}});
}
function consumePendingBuild(){let id='',paletteRequested=false,ids=[];try{const params=new URLSearchParams(root.location?.search||'');id=params.get('buildAsset')||'';paletteRequested=params.get('buildPalette')==='1';if((id||paletteRequested)&&root.history?.replaceState){params.delete('buildAsset');params.delete('buildPalette');const q=params.toString();root.history.replaceState(null,'',`${root.location.pathname}${q?`?${q}`:''}${root.location.hash||''}`);}}catch{}try{const raw=root.localStorage?.getItem(BUILD_HANDOFF_KEY);if(raw){const row=JSON.parse(raw);if(!id&&Date.now()-Number(row?.at||0)<120000)id=String(row?.id||'');root.localStorage.removeItem(BUILD_HANDOFF_KEY);}}catch{}try{const raw=root.localStorage?.getItem(PALETTE_HANDOFF_KEY);if(raw){const row=JSON.parse(raw);if(Date.now()-Number(row?.at||0)<120000&&Array.isArray(row?.ids))ids=row.ids;root.localStorage.removeItem(PALETTE_HANDOFF_KEY);}}catch{}if((paletteRequested||ids.length)&&ids.length>=2){void buildPersonalPalette(ids).catch(error=>{console.error('[Kelo library palette]',error);try{root.showToast?.(String(error?.message||error).replaceAll('_',' '));}catch{}});return;}if(id)void buildPersonalContent(id).catch(error=>{console.error('[Kelo library build]',error);try{root.showToast?.(String(error?.message||error).replaceAll('_',' '));}catch{}});}
async function captureAssetSceneProfile(){
  if(!root.KELO_STUDIO_LAZY_BOOT)return null;
  try{
    const mod=await import('./../studio/studio-entry.mjs');
    const studio=mod.getKeloStudioSession?.(),doc=studio?.kernel?.document;
    if(!doc)return null;
    const entities=(doc.entities||[]).slice(0,1200),byId=new Map(entities.map(e=>[String(e.id),e]));
    const selectedIds=studio.kernel.selection?.get?.()||studio.selection?.get?.()||[],selected=selectedIds.map(id=>byId.get(String(id))).filter(Boolean);
    const player=root.localPlayer;const anchorEntity=selected[0]||null;
    const anchor={x:Number(anchorEntity?.transform?.x??anchorEntity?.x??player?.x??0),y:Number(anchorEntity?.transform?.y??anchorEntity?.y??player?.y??0),source:anchorEntity?'selection':player?'player':'scene-center'};
    const neighborhoodRadius=720;
    const distance=e=>Math.hypot(Number(e?.transform?.x??e?.x??0)-anchor.x,Number(e?.transform?.y??e?.y??0)-anchor.y);
    const local=entities.filter(e=>distance(e)<=neighborhoodRadius).sort((a,b)=>distance(a)-distance(b)).slice(0,96);
    const sample=local.length>=3?local:entities.slice(0,800);
    const categories=new Map(),styles=new Map(),sizes=[];
    for(const entity of sample){
      const prefab=studio.kernel.prefabs.resolve?.(entity?.prefabId);if(!prefab)continue;
      const category=String(prefab.category||'').toLowerCase();if(category)categories.set(category,(categories.get(category)||0)+1);
      const catalog=studio.adapter?.assetCatalog?.get?.(entity.prefabId);for(const token of [catalog?.family,catalog?.category,prefab.category]){const value=String(token||'').toLowerCase();if(value)styles.set(value,(styles.get(value)||0)+1);}
      const w=Number(prefab.bounds?.w||entity?.bounds?.w||0),h=Number(prefab.bounds?.h||entity?.bounds?.h||0),scale=Math.abs(Number(entity?.transform?.scale??entity?.scale??1))||1;if(w>0&&h>0)sizes.push(Math.max(w,h)*scale);
    }
    const sorted=map=>[...map.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]),orderedCategories=sorted(categories),orderedStyles=sorted(styles);
    sizes.sort((a,b)=>a-b);const targetSize=sizes.length?sizes[Math.floor(sizes.length/2)]:96;
    const profile={version:2,worldId:doc.worldId||null,sceneName:doc.metadata?.name||'Kelo World',category:orderedCategories[0]||null,styleTags:[...new Set(['kelo-world','game-ready','top-down',...orderedStyles.slice(0,8),...(doc.metadata?.tags||[])])].slice(0,14),perspective:'top-down',environment:doc.metadata?.name||null,targetSize,entityCount:entities.length,localEntityCount:local.length,anchor,neighborhoodRadius,localCategories:orderedCategories.slice(0,5),localStyles:orderedStyles.slice(0,8),updatedAt:Date.now()};
    root.KELO_ASSET_SCENE_PROFILE=profile;root.localStorage?.setItem?.('kelo.asset.scene-profile.v1',JSON.stringify(profile));return profile;
  }catch(error){console.warn('[Kelo asset scene profile]',error);return null;}
}
async function completeCurrentScene(){
 const profile=await captureAssetSceneProfile();if(!profile)throw new Error('SMART_PACK_SCENE_NOT_READY');
 const [{completeScene},{searchExternalAssets}]=await Promise.all([import('./../creators/assets/smart-scene-packs.mjs?v=1'),import('./../creators/assets/external-asset-providers.mjs?v=15')]);
 const pack=await completeScene({profile,search:searchExternalAssets});
 root.KELO_SMART_SCENE_PACK=pack;try{root.localStorage?.setItem?.('kelo.asset.smart-scene-pack.v1',JSON.stringify({at:Date.now(),profile:pack.profile,wanted:pack.wanted,assetIds:pack.assets.map(a=>a.id)}));}catch{}
 root.dispatchEvent?.(new CustomEvent('kelo:smart-scene-pack-ready',{detail:pack}));
 if(pack.assets.length){try{root.showToast?.(`Complete Scene · ${pack.assets.length} assets compatibles`);}catch{}}
 return pack;
}
function openPage(path){const opened=root.open(path,'_blank');if(!opened)root.location.href=path;try{root.KELO_LUXE?.closeMenu?.();}catch{}}
const openSpriteOS=()=>openPage('sprite-os.html'),openLibrary=()=>{void captureAssetSceneProfile();openPage('asset-vault.html');},openPacks=()=>openPage('content-packs.html'),openCommunityCreator=()=>openPage('creator-publish.html');
function menuButton(id,label,copy,icon,onClick,aria){const b=document.createElement('button');b.id=id;b.type='button';b.className='lx-menu-item';b.setAttribute('aria-label',aria);b.innerHTML=`<span class="lx-menu-icon" aria-hidden="true">${icon}</span><span class="lx-menu-copy"><b>${label}</b><small>${copy}</small></span>`;b.addEventListener('click',onClick);return b;}
function buildSpriteButton(){return menuButton(SPRITE_ID,'Sprite OS','Buscar · probar · usar en juego','🧍',openSpriteOS,'Abrir Sprite OS');}
function buildButton(){const b=menuButton(ID,'Biblioteca','Poner en la plaza','🧰',openLibrary,'Abrir Biblioteca');refresh(b);return b;}
function buildPackButton(){return menuButton(PACK_ID,'Completar escena','Assets compatibles con esta zona','✨',()=>void completeCurrentScene().catch(error=>{console.error('[Kelo smart scene pack]',error);try{root.showToast?.(String(error?.message||error).replaceAll('_',' '));}catch{}}),'Completar esta escena');}
function buildCommunityButton(){return menuButton(COMMUNITY_ID,'Crear / Publicar','Comunidad · validación automática','🎨',openCommunityCreator,'Crear y publicar asset comunitario');}
function ensureButton(grid,id,build,refreshExisting){let b=document.getElementById(id);if(!b||b.parentNode!==grid){if(b)b.remove();b=build();grid.appendChild(b);}else if(refreshExisting)refresh(b);return b;}
function ensureInMenu(){const grid=document.getElementById('lx-menu-grid');if(!grid)return false;[SPRITE_ID,PACK_ID,COMMUNITY_ID].forEach(id=>{const old=document.getElementById(id);if(old)old.remove();});ensureButton(grid,ID,buildButton,true);ensureButton(grid,PACK_ID,buildPackButton,false);if(!gridObserver){gridObserver=new MutationObserver(()=>{const button=document.getElementById(ID);if(!button||button.parentNode!==grid||[SPRITE_ID,COMMUNITY_ID].some(id=>document.getElementById(id)))queueMicrotask(ensureInMenu);});gridObserver.observe(grid,{childList:true});}return true;}
function mount(){bindCommunityNetworkBridge();consumePendingBuild();consumePendingExternalPreview();if(ensureInMenu())return;if(bodyObserver)return;bodyObserver=new MutationObserver(()=>{bindCommunityNetworkBridge();if(ensureInMenu()){bodyObserver.disconnect();bodyObserver=null;}});bodyObserver.observe(document.body,{childList:true,subtree:true});}
function maybeLoadLookRuntime(){try{const s=root.sessionStorage?.getItem('kelo.universal.look.preview.v1'),l=root.localStorage?.getItem('kelo.universal.look.runtime.v1');if(!(s!==null?s!=='[]':!!l&&l!=='[]')||root.KeloUniversalLookRuntime)return;const x=document.createElement('script');x.src='src/core/universal-look-runtime-bridge.js?v=20260917-sprite-game-v1';x.dataset.keloUniversalLookRuntime='1';document.body.appendChild(x);}catch{}}
root.addEventListener('message',event=>{if(event.origin!==root.location.origin)return;const type=event.data?.type,id=event.data?.id;if(type==='kelo:hydrate-personal-assets'||type==='kelo:hydrate-personal-content')void hydratePersonalContent().catch(error=>console.warn('[Kelo personal content hydration]',error));if(type==='kelo:play-personal-audio')void hydratePersonalContent().then(()=>root.KELO_PERSONAL_AUDIO?.play?.(id)).catch(error=>console.warn('[Kelo personal audio]',error));if(type==='kelo:open-creators'){void hydratePersonalContent().catch(()=>{});openCreatorsWhenReady();}if(type==='kelo:build-personal-content')void buildPersonalContent(id).catch(error=>{console.error('[Kelo library build]',error);try{root.showToast?.(String(error?.message||error).replaceAll('_',' '));}catch{}});if(type==='kelo:build-personal-palette')void buildPersonalPalette(event.data?.ids).catch(error=>{console.error('[Kelo library palette]',error);try{root.showToast?.(String(error?.message||error).replaceAll('_',' '));}catch{}});if(type==='kelo:preview-external-asset')void previewExternalAsset(event.data?.asset).catch(error=>{console.error('[Kelo external live preview]',error);try{root.showToast?.(String(error?.message||error).replaceAll('_',' '));}catch{}});if(type==='kelo:open-community-creator')openCommunityCreator();if(type==='kelo:open-sprite-os')openSpriteOS();});
root.addEventListener('kelo:community-player-assets',event=>{if(root.__KELO_COMMUNITY_ASSET_RUNTIME__)return;const detail=event.detail;void ensureCommunityRuntime().then(()=>root.dispatchEvent(new CustomEvent('kelo:community-player-assets',{detail}))).catch(error=>console.warn('[Kelo community asset runtime]',error));});
root.addEventListener('kelo:forest-plaza-catalog-ready',()=>void hydratePersonalContent().catch(()=>{}));
document.addEventListener('click',event=>{if(event.target?.closest?.('#lx-create-studio,#lx-create-asset-forge'))void hydratePersonalContent().catch(()=>{});},true);
root.addEventListener('kelo:asset-selection-changed',()=>refresh(document.getElementById(ID)));root.addEventListener('storage',()=>refresh(document.getElementById(ID)));
const api=Object.freeze({version:'content-library-launcher-v16-smart-scene-packs',open:openLibrary,openSpriteOS,openPacks,openCommunityCreator,buildPersonalContent,buildPersonalPalette,previewExternalAsset,completeCurrentScene,hydratePersonalAssets,hydratePersonalContent,ensureCommunityRuntime,bindCommunityNetworkBridge,refresh:()=>refresh(document.getElementById(ID))});
root.KELO_ASSET_LIBRARY_LAUNCHER=api;root.KELO_CONTENT_LIBRARY_LAUNCHER=api;
maybeLoadLookRuntime();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof globalThis!=='undefined'?globalThis:window);
