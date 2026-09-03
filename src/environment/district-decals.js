(function(){
  'use strict';
  const R=window.KELO_TILE_REGISTRY;
  const A=R?.atlases?.districtDecals;
  const T=R?.districtDecalTiles;
  const style=R?.styles?.districtDecals;
  const base=window.KELO_WORLD_RENDERER;
  if(!A||!T||!style||!base||typeof base.draw!=='function'){
    console.error('[Kelo district decals] registry or world renderer missing');
    return;
  }
  const TILE=R.worldTileSize||32;
  const img=new Image(); img.decoding='async';
  let ready=false,failed=false;
  const placements=Array.isArray(style.placements)?style.placements:[];
  function origin(id){return{x:(id%A.columns)*TILE,y:Math.floor(id/A.columns)*TILE};}
  function drawOverlay(g){
    if(!ready)return false;
    const z=window.CONFIG?.zoom||1;
    const cam=window.camera||{x:1440,y:1520};
    const hw=(window.screenW||innerWidth)/(2*z)+64;
    const hh=(window.screenH||innerHeight)/(2*z)+64;
    const minX=cam.x-hw,maxX=cam.x+hw,minY=cam.y-hh,maxY=cam.y+hh;
    let visible=0;
    g.save();g.imageSmoothingEnabled=false;
    for(const p of placements){
      if(p.x+TILE<minX||p.x>maxX||p.y+TILE<minY||p.y>maxY)continue;
      const id=T[p.tile];if(id==null)continue;
      const s=origin(id);
      g.drawImage(img,s.x,s.y,TILE,TILE,p.x,p.y,TILE,TILE);
      visible++;
    }
    g.restore();
    window.KELO_DISTRICT_DECAL_AUDIT.visiblePlacementCount=visible;
    return true;
  }
  window.KELO_WORLD_RENDERER=Object.freeze({
    ...base,
    draw(g){const ok=base.draw(g)===true;if(ok)drawOverlay(g);return ok;},
    districtDecalMode:style.mode,
    districtDecalCount:placements.length
  });
  window.KELO_DISTRICT_DECAL_AUDIT={
    version:'district-decals-v1',ready:false,assetLoaded:false,failed:false,
    mode:style.mode,layer:style.layer,placementCount:placements.length,visiblePlacementCount:0,
    atlas:A.id,registryVersion:R.version
  };
  img.onload=function(){
    if(img.naturalWidth!==A.width||img.naturalHeight!==A.height){
      failed=true;window.KELO_DISTRICT_DECAL_AUDIT.failed=true;
      console.error('[Kelo district decals] invalid atlas dimensions',img.naturalWidth,img.naturalHeight);return;
    }
    ready=true;window.KELO_DISTRICT_DECAL_AUDIT.ready=true;window.KELO_DISTRICT_DECAL_AUDIT.assetLoaded=true;
  };
  img.onerror=function(){failed=true;window.KELO_DISTRICT_DECAL_AUDIT.failed=true;console.error('[Kelo district decals] atlas load failed');};
  img.src=A.src;
})();