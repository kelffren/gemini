(function(){
  'use strict';
  const R=window.KELO_TILE_REGISTRY;
  if(!R){console.error('[Kelo district decals] tile registry missing');return;}
  if(typeof camera!=='undefined'&&!window.camera)window.camera=camera;
  const atlas=Object.freeze({
    id:'district-decals',src:'assets/district-decals-v1.svg?art=240',width:256,height:32,
    tileWidth:32,tileHeight:32,columns:8,tileCount:8,family:'decals'
  });
  const tiles=Object.freeze({
    RURAL_DIRT_A:0,RURAL_DIRT_B:1,
    ARENA_CRACK_A:2,ARENA_CRACK_B:3,
    COMMERCE_INLAY_A:4,COMMERCE_INLAY_B:5,
    GARDENS_PETALS_A:6,GARDENS_PETALS_B:7
  });
  const placements=Object.freeze([
    Object.freeze({district:'rural',tile:'RURAL_DIRT_A',x:520,y:1370}),
    Object.freeze({district:'rural',tile:'RURAL_DIRT_B',x:536,y:1872}),
    Object.freeze({district:'rural',tile:'RURAL_DIRT_A',x:1112,y:1888}),
    Object.freeze({district:'arena',tile:'ARENA_CRACK_A',x:1860,y:708}),
    Object.freeze({district:'arena',tile:'ARENA_CRACK_B',x:2228,y:820}),
    Object.freeze({district:'arena',tile:'ARENA_CRACK_A',x:2460,y:736}),
    Object.freeze({district:'commerce',tile:'COMMERCE_INLAY_A',x:1976,y:1476}),
    Object.freeze({district:'commerce',tile:'COMMERCE_INLAY_B',x:2288,y:1632}),
    Object.freeze({district:'commerce',tile:'COMMERCE_INLAY_A',x:2512,y:1816}),
    Object.freeze({district:'gardens',tile:'GARDENS_PETALS_A',x:1168,y:2224}),
    Object.freeze({district:'gardens',tile:'GARDENS_PETALS_B',x:1664,y:2208}),
    Object.freeze({district:'gardens',tile:'GARDENS_PETALS_A',x:1776,y:2608}),
    Object.freeze({district:'gardens',tile:'GARDENS_PETALS_B',x:1216,y:2696})
  ]);
  const districtDecals=Object.freeze({
    mode:'authored-placement-layer-v1',layer:'decals/details',atlas:'districtDecals',
    placementCount:placements.length,placements,
    composition:Object.freeze({central:'quiet',rural:'earth-and-weeds',arena:'worn-stone',commerce:'restrained-brass',gardens:'petals-and-leaves'})
  });
  window.KELO_TILE_REGISTRY=Object.freeze({
    ...R,
    version:'1.11.1',
    atlases:Object.freeze({...R.atlases,districtDecals:atlas}),
    districtDecalTiles:tiles,
    styles:Object.freeze({...R.styles,districtDecals})
  });
  window.KELO_DISTRICT_DECAL_REGISTRY_AUDIT=Object.freeze({version:'district-decals-registry-v1.1',ready:true,registryVersion:'1.11.1',placementCount:placements.length,atlas:atlas.id,cameraBridge:window.camera===camera});
})();