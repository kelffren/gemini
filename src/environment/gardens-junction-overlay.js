(function(){
'use strict';
const R=window.KELO_TILE_REGISTRY;
const GC=R?.styles?.gardensCompositions;
const A=R?.atlases?.gardensTJunctions;
if(!GC||!A||GC.tJunctionAtlas?.id!==A.id){console.error('[Kelo gardens junctions] registry junction contract missing');return;}
const TILE=R.worldTileSize||32;
const ORIGIN_X=33,ORIGIN_Y=67;
const placements=[];
for(const comp of GC.compositions||[]){
  for(const cell of comp.cells||[]){
    if(String(cell[2]||'').indexOf('HEDGE_T_')===0){
      placements.push(Object.freeze({lx:cell[0],ly:cell[1],orientation:((Number(cell[3])||0)%4+4)%4,id:cell[2]}));
    }
  }
}
const img=new Image();
let assetReady=false,installed=false;
window.KELO_GARDENS_JUNCTION_AUDIT={
  version:'gardens-junction-overlay-v3',ready:false,assetLoaded:false,mode:'tile-registry-four-orientation-t-overlay-v3',
  atlasId:A.id,registryKey:'gardensTJunctions',registryOwned:true,atlasWidth:A.width,atlasHeight:A.height,orientationCount:Object.keys(A.orientations||{}).length,placementCount:placements.length,
  authoredPlacementCount:placements.length,legacyVirtualOwnership:false,ownership:'tile-registry-overlay-exclusive-v2',localOrigin:Object.freeze([ORIGIN_X,ORIGIN_Y])
};
function install(){
  if(installed)return;
  const base=window.KELO_WORLD_RENDERER;
  if(!base||typeof base.draw!=='function'){setTimeout(install,16);return;}
  installed=true;
  function draw(g){
    const drew=base.draw(g);
    if(drew&&assetReady&&placements.length){
      const prev=g.imageSmoothingEnabled;g.imageSmoothingEnabled=false;
      for(const p of placements){
        const sx=p.orientation*TILE,wx=(ORIGIN_X+p.lx)*TILE,wy=(ORIGIN_Y+p.ly)*TILE;
        g.drawImage(img,sx,0,TILE,TILE,wx,wy,TILE,TILE);
      }
      g.imageSmoothingEnabled=prev;
    }
    return drew;
  }
  window.KELO_WORLD_RENDERER=Object.freeze({draw,districts:base.districts,chunkSize:base.chunkSize,get ready(){return base.ready&&assetReady;},junctionOverlay:true});
}
img.onload=function(){
  if(img.naturalWidth!==A.width||img.naturalHeight!==A.height){console.error('[Kelo gardens junctions] invalid atlas dimensions',img.naturalWidth,img.naturalHeight);return;}
  assetReady=true;Object.assign(window.KELO_GARDENS_JUNCTION_AUDIT,{ready:true,assetLoaded:true});
};
img.onerror=function(){console.error('[Kelo gardens junctions] atlas load failed');};
img.src=A.src;
install();
})();