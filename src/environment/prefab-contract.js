(function(){
  'use strict';
  const R=window.KELO_TILE_REGISTRY;
  const assets=R?.architectureAssets;
  const prefabs=R?.architecturePrefabs;
  const style=R?.styles?.architecture;
  if(!assets||!prefabs||!style){console.error('[Kelo prefab contract] architecture registry missing');return;}

  const normalizedAssets={};
  for(const [key,a] of Object.entries(assets)){
    normalizedAssets[key]=Object.freeze({
      id:a.id||key,family:a.family||'architecture',version:a.version||'1',src:a.src,
      width:a.width,height:a.height,worldWidth:a.worldWidth||a.width,worldHeight:a.worldHeight||a.height,
      sampling:a.sampling||'nearest',alpha:a.alpha!==false,frames:Object.freeze(a.frames||[]),
      fallback:a.fallback||null
    });
  }

  function freezeRect(r){return r?Object.freeze({x:r.x,y:r.y,w:r.w,h:r.h,noDraw:r.noDraw!==false}):null;}
  const normalizedPrefabs=[];
  for(const [key,p] of Object.entries(prefabs)){
    const a=normalizedAssets[p.asset];
    if(!a){console.error('[Kelo prefab contract] missing asset',key,p.asset);return;}
    const x=p.x||0,y=p.y||0,w=p.worldWidth||a.worldWidth,h=p.worldHeight||a.worldHeight;
    const collision=freezeRect(p.collision);
    const interaction=p.interaction?Object.freeze({...p.interaction}):null;
    const occlusion=p.occlusion?Object.freeze({...p.occlusion,clip:p.occlusion.clip?Object.freeze({...p.occlusion.clip}):null}):null;
    normalizedPrefabs.push(Object.freeze({
      key,id:p.id||key,asset:p.asset,position:Object.freeze({x,y}),size:Object.freeze({w,h}),
      anchor:Object.freeze(p.anchor||{x:0.5,y:1}),baseY:y+(p.baseYOffset??h),
      visualBounds:Object.freeze(p.visualBounds||{x,y,w,h}),footprint:Object.freeze(p.footprint||collision||{x,y:y+h,w,h:0}),
      collider:collision,interaction,entrance:p.entrance?Object.freeze({...p.entrance}):interaction,
      doors:Object.freeze(p.doors||[]),shadows:Object.freeze(p.shadows||[]),overlays:Object.freeze(p.overlays||[]),
      animation:Object.freeze(p.animation||[]),occlusion,districts:Object.freeze(p.districts||['central']),
      layerGroup:p.layerGroup||'architecture',priority:Number.isFinite(p.priority)?p.priority:20,
      ownership:p.ownership||'architecture-prefabs-v1',legacyVisualReplacement:!!p.legacyVisualReplacement,
      legacyObstacleRects:Object.freeze((p.legacyObstacleRects||[]).map(r=>Object.freeze({...r})))
    }));
  }

  const layerGroups=Object.freeze({
    architecture:Object.freeze({id:'architecture-prefabs',ownership:'architecture-prefabs-v1',priority:20,
      back:Object.freeze({phase:'props_back'}),front:Object.freeze({phase:'props_front'})})
  });

  window.KELO_PREFAB_CONTRACT=Object.freeze({
    version:'1.0.0',sourceRegistryVersion:R.version,mode:'data-driven-building-prefabs-v1',
    assets:Object.freeze(normalizedAssets),prefabs:Object.freeze(normalizedPrefabs),layerGroups,
    capabilities:Object.freeze({splitLayers:true,colliders:true,interactionMetadata:true,entrances:true,doors:true,shadows:true,overlays:true,animationFrames:true,occlusion:true,districtCompatibility:true,legacyReplacement:true})
  });
})();