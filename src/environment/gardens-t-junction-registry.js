(function(){
'use strict';
const R=window.KELO_TILE_REGISTRY;
if(!R?.atlases){console.error('[Kelo gardens T registry] base TileRegistry missing');return;}
const atlas=Object.freeze({
  id:'gardens-t-junctions-v1',src:'assets/gardens-t-junctions-v1.svg?v=1',width:128,height:32,
  tileWidth:R.worldTileSize||32,tileHeight:R.worldTileSize||32,columns:4,tileCount:4,family:'garden_junction',overlay:true,
  orientationMode:'clockwise-missing-branch-v1',orientations:Object.freeze({NWS:0,WNE:1,NES:2,ESW:3})
});
const atlases=Object.freeze({...R.atlases,gardensTJunctions:atlas});
window.KELO_TILE_REGISTRY=Object.freeze({...R,version:R.version,atlases});
window.KELO_GARDENS_T_REGISTRY_AUDIT=Object.freeze({
  version:'gardens-t-junction-registry-v1.1',ready:true,registryVersion:R.version,atlasId:atlas.id,
  registryKey:'gardensTJunctions',orientationCount:Object.keys(atlas.orientations).length,firstClassRegistryAtlas:true
});
})();
