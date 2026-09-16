/* KELO-INDEX
 * area: ENVIRONMENT / PROPS
 * owner: KELO_GENERIC_PROPS; collider lifecycle delegated to KELO_COLLISION; image lifecycle delegated to KELO_ATLAS_CONTRACT
 * keys: PROP RENDER LAYERS ATLAS COLLISION OWNERSHIP VIEWPORT RESIDENCY LAZY WARM EVICT
 * purpose: render data-driven props while keeping only near-viewport prop atlases acquired; preserve exact source pixels and owner-native atlas lifecycle
 * public-api: KELO_GENERIC_PROPS drawInstances/isAssetReady/syncResidency/residencySnapshot
 * consumes: KELO_PROP_CONTRACT, KELO_ENVIRONMENT_LAYERS, KELO_ATLAS_CONTRACT, KELO_COLLISION, KeloCamera.worldView
 * state-owned: local references to currently wanted/held prop atlas images only
 * reuse: publicar colliders con KELO_COLLISION.replaceOwner(); adquirir/liberar imágenes solo por KELO_ATLAS_CONTRACT
 * do-not: NO crear Image directamente, NO cargar todos los prop atlases en boot, NO mutar obstacles, NO crear otro asset loader
 */
(function(){
  'use strict';
  const C=window.KELO_PROP_CONTRACT;
  const L=window.KELO_ENVIRONMENT_LAYERS;
  const A=window.KELO_ATLAS_CONTRACT;
  const K=window.KELO_COLLISION;
  const CAM=window.KeloCamera;
  if(!C||!L||typeof L.register!=='function'||!A||typeof A.acquire!=='function'||typeof A.register!=='function'){console.error('[Kelo generic props] contract/layer stack/atlas contract missing');return;}

  const PREFETCH_MARGIN=128;
  const DRAW_MARGIN=32;
  const RESIDENCY_GRID=96;
  const RESYNC_MS=100;
  const images=new Map(),readyAssets=new Set(),heldAssets=new Set(),loadingAssets=new Map(),desiredAssets=new Set(),failedAssets=new Set();
  const groups=Object.entries(C.layerGroups||{});
  const stackedGroups=groups.filter(([,group])=>group.renderMode!=='immediate');
  const sources=Object.values(C.sources||{});
  const entries=Object.entries(C.assets||{}).filter(([,asset])=>asset?.src);
  const entryMap=new Map(entries);
  const dynamicSourcePropCounts={};
  const backDrawCountByGroup={};
  const frontDrawCountByGroup={};
  const actorRedrawCountByGroup={};
  const COLLISION_OWNER='environment:generic-props';
  let lastResidencyKey='',lastResidencyAt=0,acquireCount=0,releaseCount=0;

  const audit=window.KELO_GENERIC_PROP_AUDIT={
    version:'generic-props-v2.1-weightless-residency',contractVersion:C.version,ready:false,failed:false,
    propCount:C.props.length,assetCount:Object.keys(C.assets).length,layerGroupCount:groups.length,stackedLayerGroupCount:stackedGroups.length,immediateLayerGroupCount:groups.length-stackedGroups.length,
    sourceCount:sources.length,dynamicSourceCount:sources.filter(source=>typeof source.instances==='function').length,
    rendererMode:'data-driven-props-v7-viewport-resident',resourceMode:'atlas-contract-viewport-residency-v2',spatialBoundsMode:'layer-owned-visible-bounds-v1',
    collisionMode:'kelo-collision-owner-v2',collisionOwner:COLLISION_OWNER,decorationReset:window.KELO_WORLD_DECORATION_RESET===true,
    prefetchMarginWorld:PREFETCH_MARGIN,residencyGridWorld:RESIDENCY_GRID,resyncMs:RESYNC_MS,
    immediateDrawCalls:0,immediatePropCount:0,dynamicPropCount:0,registeredColliderCount:0,
    wantedAssetCount:0,residentAssetCount:0,heldAssetCount:0,loadingAssetCount:0,failedAssetCount:0,initialWantedAssetCount:0,acquireCount:0,releaseCount:0,
    wantedAssets:[],residentAssets:[],loadingAssets:[],failedAssets:[],dynamicSourcePropCounts,backDrawCountByGroup,frontDrawCountByGroup,actorRedrawCountByGroup,fountainChroma:false
  };

  function frameRect(asset,frame){
    if(asset?.frames&&typeof frame==='string'&&asset.frames[frame]){const rect=asset.frames[frame];return{x:Number(rect.x)||0,y:Number(rect.y)||0,w:Number(rect.w)||0,h:Number(rect.h)||0};}
    const index=Number(frame)||0,cols=asset.columns||1;
    return{x:(index%cols)*asset.frameWidth,y:Math.floor(index/cols)*asset.frameHeight,w:asset.frameWidth,h:asset.frameHeight};
  }
  function drawProp(g,prop){
    const asset=C.assets[prop.asset],img=images.get(prop.asset);
    if(!asset||!img||!readyAssets.has(prop.asset))return false;
    const source=frameRect(asset,prop.frame??0);if(!(source.w>0&&source.h>0))return false;
    g.drawImage(img,source.x,source.y,source.w,source.h,prop.position.x,prop.position.y,prop.size.w,prop.size.h);return true;
  }
  function drawInstances(g,props,track,allowDuringReset=false){
    if(!g||!Array.isArray(props)||(window.KELO_WORLD_DECORATION_RESET===true&&!allowDuringReset))return 0;
    let count=0;g.save();g.imageSmoothingEnabled=false;for(const prop of props)if(prop&&drawProp(g,prop))count++;g.restore();
    if(track){audit.immediateDrawCalls++;audit.immediatePropCount=count;}return count;
  }
  function actors(){
    const out=[],reset=window.KELO_WORLD_DECORATION_RESET===true;
    const pvp=typeof isPvPActive!=='undefined'&&isPvPActive&&typeof arenaPvP!=='undefined'&&arenaPvP?.rival;
    if(pvp)out.push(arenaPvP.rival);else if(!reset&&typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))out.push(...simulatedPlayers);
    if(typeof localPlayer!=='undefined'&&localPlayer)out.push(localPlayer);return out;
  }
  function actorOverlaps(actor,bounds){const radius=actor?.radius||20;return actor&&bounds&&actor.x+radius>bounds.x&&actor.x-radius<bounds.x+bounds.w&&actor.y+radius>bounds.y&&actor.y-radius<bounds.y+bounds.h;}
  function rectOverlaps(a,b){return !!(a&&b&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y);}
  function currentView(margin=0){
    if(!CAM||typeof CAM.worldView!=='function')return null;
    try{const view=CAM.worldView();if(!view||!(view.w>0&&view.h>0))return null;return{x:view.left-margin,y:view.top-margin,w:view.w+margin*2,h:view.h+margin*2,left:view.left-margin,top:view.top-margin,right:view.right+margin,bottom:view.bottom+margin};}catch(_){return null;}
  }
  function propBounds(prop){return prop?.visualBounds||((prop?.position&&prop?.size)?{x:prop.position.x,y:prop.position.y,w:prop.size.w,h:prop.size.h}:null);}
  function visibleProps(props,margin=DRAW_MARGIN){const view=currentView(margin);return view?props.filter(prop=>rectOverlaps(propBounds(prop),view)):props;}
  function refreshDynamicTotal(){audit.dynamicPropCount=Object.values(dynamicSourcePropCounts).reduce((sum,n)=>sum+(Number(n)||0),0);}
  function sourcePropsFor(groupKey){
    const out=[];
    for(const source of sources){
      if(source?.layerGroup!==groupKey||typeof source.instances!=='function')continue;
      let items=[];try{items=source.instances();}catch(error){console.warn('[Kelo generic props] dynamic source unavailable',source.id||groupKey,error);}
      const count=Array.isArray(items)?items.length:0;dynamicSourcePropCounts[source.id||groupKey]=count;if(count)out.push(...items);
    }
    refreshDynamicTotal();return out;
  }
  function propsFor(groupKey){const staticProps=C.props.filter(prop=>prop.layerGroup===groupKey);return staticProps.concat(sourcePropsFor(groupKey));}
  function propsForRole(groupKey,role){
    const props=propsFor(groupKey);
    if(role==='back')return props.filter(prop=>prop.layerRole!=='front');
    if(role==='front')return props.filter(prop=>prop.layerRole==='front'||(prop.occlusion?.mode&&prop.occlusion.mode!=='none'));
    return props;
  }
  function allProps(){const out=[...C.props];for(const groupKey of groups.map(([key])=>key))out.push(...sourcePropsFor(groupKey));return out;}

  function refreshResidencyAudit(){
    audit.wantedAssetCount=desiredAssets.size;audit.residentAssetCount=readyAssets.size;audit.heldAssetCount=heldAssets.size;audit.loadingAssetCount=loadingAssets.size;audit.failedAssetCount=failedAssets.size;
    audit.acquireCount=acquireCount;audit.releaseCount=releaseCount;
    audit.wantedAssets=[...desiredAssets].sort();audit.residentAssets=[...readyAssets].sort();audit.loadingAssets=[...loadingAssets.keys()].sort();audit.failedAssets=[...failedAssets].sort();
  }
  function releaseAsset(id){
    if(!heldAssets.has(id)||loadingAssets.has(id))return false;
    images.delete(id);readyAssets.delete(id);heldAssets.delete(id);A.release(id);releaseCount++;refreshResidencyAudit();return true;
  }
  function ensureAsset(id){
    const asset=entryMap.get(id);if(!asset)return Promise.resolve(null);
    if(readyAssets.has(id)&&images.has(id))return Promise.resolve(images.get(id));
    if(loadingAssets.has(id))return loadingAssets.get(id);
    if(!A.describe(id))A.register(id,asset,{role:'optional'});
    heldAssets.add(id);acquireCount++;
    const promise=A.acquire(id).then(img=>{
      loadingAssets.delete(id);failedAssets.delete(id);
      if(!desiredAssets.has(id)){
        heldAssets.delete(id);A.release(id);releaseCount++;refreshResidencyAudit();return img;
      }
      images.set(id,img);readyAssets.add(id);refreshResidencyAudit();return img;
    }).catch(error=>{
      loadingAssets.delete(id);failedAssets.add(id);images.delete(id);readyAssets.delete(id);
      if(heldAssets.delete(id)){try{A.release(id,{warmMs:0});releaseCount++;}catch(_){}}
      refreshResidencyAudit();console.error('[Kelo generic props] managed asset load failed',id,error);throw error;
    });
    loadingAssets.set(id,promise);refreshResidencyAudit();return promise;
  }
  function desiredForView(){
    const view=currentView(PREFETCH_MARGIN);
    if(!view)return new Set(entries.map(([id])=>id));
    const wanted=new Set();
    for(const prop of allProps())if(prop?.asset&&entryMap.has(prop.asset)&&rectOverlaps(propBounds(prop),view))wanted.add(prop.asset);
    return wanted;
  }
  function residencyKey(){
    const view=currentView(0);if(!view)return 'fallback-all';
    return [Math.floor(view.left/RESIDENCY_GRID),Math.floor(view.top/RESIDENCY_GRID),Math.ceil(view.w/RESIDENCY_GRID),Math.ceil(view.h/RESIDENCY_GRID)].join(':');
  }
  function syncResidency(force=false){
    const now=typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now(),key=residencyKey();
    if(!force&&key===lastResidencyKey&&now-lastResidencyAt<RESYNC_MS)return Object.freeze({wanted:[...desiredAssets],pending:[...loadingAssets.values()]});
    lastResidencyKey=key;lastResidencyAt=now;
    const wanted=desiredForView();desiredAssets.clear();for(const id of wanted)desiredAssets.add(id);
    for(const id of [...heldAssets])if(!desiredAssets.has(id))releaseAsset(id);
    const pending=[];for(const id of desiredAssets)if(!readyAssets.has(id))pending.push(ensureAsset(id));
    refreshResidencyAudit();return Object.freeze({wanted:[...desiredAssets],pending});
  }
  function residencySnapshot(){return Object.freeze({wanted:Object.freeze([...desiredAssets].sort()),resident:Object.freeze([...readyAssets].sort()),held:Object.freeze([...heldAssets].sort()),loading:Object.freeze([...loadingAssets.keys()].sort()),failed:Object.freeze([...failedAssets].sort()),acquireCount,releaseCount,prefetchMarginWorld:PREFETCH_MARGIN});}

  function drawBack(groupKey,g){
    const allowReset=C.layerGroups?.[groupKey]?.visibleDuringReset===true;if(window.KELO_WORLD_DECORATION_RESET===true&&!allowReset)return;
    syncResidency(false);backDrawCountByGroup[groupKey]=drawInstances(g,visibleProps(propsForRole(groupKey,'back')),false,allowReset);
  }
  function drawFront(groupKey,g){
    const allowReset=C.layerGroups?.[groupKey]?.visibleDuringReset===true;if(window.KELO_WORLD_DECORATION_RESET===true&&!allowReset)return;
    syncResidency(false);const props=visibleProps(propsFor(groupKey)),as=actors();let count=0,actorRedraws=0;
    g.save();g.imageSmoothingEnabled=false;
    for(const prop of props)if(prop.layerRole==='front'&&drawProp(g,prop))count++;
    for(const prop of props){
      if(prop.occlusion?.mode==='actor-base-y-clip-v1'){
        for(const actor of as){if(!actorOverlaps(actor,prop.visualBounds)||actor.y>=prop.occlusion.baseY)continue;const pad=prop.occlusion.clipPadding||8,r=Math.max(22,(actor.radius||20)+pad);g.save();g.beginPath();g.rect(actor.x-r,actor.y-r*1.8,r*2,r*2.5);g.clip();if(drawProp(g,prop))count++;g.restore();}
      }else if(prop.occlusion?.mode==='actor-base-y-redraw-v1'&&typeof renderAvatar==='function'){
        const bounds=prop.occlusion.bounds||prop.visualBounds;for(const actor of as){if(!actorOverlaps(actor,bounds)||actor.y<=prop.occlusion.baseY)continue;renderAvatar(actor,typeof localPlayer!=='undefined'&&actor===localPlayer);actorRedraws++;}
      }
    }
    g.restore();frontDrawCountByGroup[groupKey]=count;actorRedrawCountByGroup[groupKey]=actorRedraws;
  }
  function boundsFor(groupKey,role){return()=>window.KELO_WORLD_DECORATION_RESET===true&&C.layerGroups?.[groupKey]?.visibleDuringReset!==true?[]:propsForRole(groupKey,role).map(prop=>({id:prop.id,...prop.visualBounds}));}
  function registerStaticColliders(){
    if(!K||typeof K.replaceOwner!=='function'){audit.registeredColliderCount=0;return;}
    if(window.KELO_WORLD_DECORATION_RESET===true){K.clearOwner(COLLISION_OWNER);audit.registeredColliderCount=0;return;}
    const rows=[];for(const prop of C.props){const collider=prop?.collider;if(collider?.mode!=='rect')continue;rows.push({id:prop.id,x:collider.x,y:collider.y,w:collider.w,h:collider.h,noDraw:collider.noDraw!==false,_genericPropCollision:true});}
    audit.registeredColliderCount=K.replaceOwner(COLLISION_OWNER,rows);
  }

  for(const [id,asset] of entries)if(!A.describe(id))A.register(id,asset,{role:'optional'});
  try{
    for(const [key,group] of stackedGroups){
      if(group.back)L.register({id:`${group.id}-back`,phase:group.back.phase,priority:group.priority,required:true,ready:()=>audit.ready,draw:g=>drawBack(key,g),ownership:group.ownership,visibleDuringReset:group.visibleDuringReset===true,bounds:boundsFor(key,'back')});
      if(group.front)L.register({id:`${group.id}-front`,phase:group.front.phase,priority:group.priority,required:true,ready:()=>audit.ready,draw:g=>drawFront(key,g),ownership:group.ownership,visibleDuringReset:group.visibleDuringReset===true,bounds:boundsFor(key,'front')});
    }
  }catch(error){audit.failed=true;console.error('[Kelo generic props] layer registration failed',error);return;}
  registerStaticColliders();
  window.KELO_GENERIC_PROPS=Object.freeze({version:audit.version,resourceMode:audit.resourceMode,collisionOwner:COLLISION_OWNER,drawInstances,syncResidency:()=>syncResidency(true),residencySnapshot,isAssetReady:id=>readyAssets.has(id),get ready(){return audit.ready&&!audit.failed;}});

  if(!entries.length){audit.ready=true;refreshResidencyAudit();return;}
  const initial=syncResidency(true);audit.initialWantedAssetCount=initial.wanted.length;refreshResidencyAudit();
  Promise.allSettled(initial.pending).then(results=>{
    const rejected=results.filter(result=>result.status==='rejected');if(rejected.length)audit.failed=true;
    audit.ready=true;refreshResidencyAudit();
    try{window.dispatchEvent(new CustomEvent('kelo:generic-props-ready',{detail:{wanted:audit.initialWantedAssetCount,failed:rejected.length}}));}catch(_){ }
  });
  window.addEventListener('kelo:viewportchange',()=>syncResidency(true));
  window.addEventListener('kelo:camerazoomchange',()=>syncResidency(true));
})();