(function () {
  const TILE = 32;
  const atlas = Object.freeze({
    id:'plaza-core', src:'assets/tileset-vclean.png?art=131', width:512, height:512,
    tileWidth:TILE, tileHeight:TILE, columns:16
  });
  const transitionAtlas = Object.freeze({
    id:'plaza-transitions', src:'assets/plaza-transitions-v1.png?art=140', width:128, height:128,
    tileWidth:TILE, tileHeight:TILE, columns:4
  });
  const ruralSoilAtlas = Object.freeze({
    id:'rural-soil', src:'assets/rural-soil-v1.png?art=160', width:128, height:128,
    tileWidth:TILE, tileHeight:TILE, columns:4
  });
  const ruralPropsAtlas = Object.freeze({
    id:'rural-props', src:'assets/rural-props-v1.png?art=170', width:128, height:128,
    tileWidth:TILE, tileHeight:TILE, columns:4
  });
  const ruralLandmarksAtlas = Object.freeze({
    id:'rural-landmarks', src:'assets/rural-landmarks-v1.png?art=180', width:256, height:128,
    tileWidth:TILE, tileHeight:TILE, columns:8
  });
  const ruralNatureAtlas = window.KELO_RURAL_NATURE_ATLAS;
  if (!ruralNatureAtlas || ruralNatureAtlas.width!==256 || ruralNatureAtlas.height!==128) {
    console.error('[Kelo registry] authored rural nature atlas missing or invalid');
    return;
  }

  const architectureAssets = Object.freeze({
    luxeBoutique:Object.freeze({
      id:'luxe-boutique', src:'assets/kelo-luxe-boutique.png?v=6', width:192, height:222,
      worldWidth:192, worldHeight:222, family:'architecture'
    }),
    marketPavilion:Object.freeze({
      id:'market-pavilion', src:'assets/market-pavilion-v1.png?art=220', width:224, height:160,
      worldWidth:224, worldHeight:160, family:'architecture'
    }),
    commerceArcade:Object.freeze({
      id:'commerce-arcade', src:'assets/commerce-arcade-v1.svg?v=1', width:160, height:432,
      worldWidth:160, worldHeight:432, family:'architecture'
    }),
    bancoHall:Object.freeze({
      id:'banco-hall', src:'assets/banco-hall-v1.svg?v=2', width:160, height:128,
      worldWidth:160, worldHeight:128, family:'architecture'
    })
  });
  const architecturePrefabs = Object.freeze({
    luxeBoutique:Object.freeze({
      id:'luxe-boutique-central', asset:'luxeBoutique', x:1112, y:1318, baseYOffset:222,
      collision:Object.freeze({x:1140,y:1488,w:136,h:52}),
      interaction:Object.freeze({x:1208,y:1552,radius:90}),
      occlusion:Object.freeze({sideInset:9,topInset:40,bottomPadding:4,clip:Object.freeze({xPadding:7,topPadding:24,bottomPadding:7})}),
      legacyVisualReplacement:true
    }),
    marketPavilion:Object.freeze({
      id:'market-pavilion-south', asset:'marketPavilion', x:1288, y:1790, baseYOffset:160,
      collision:Object.freeze({x:1300,y:1870,w:200,h:80}),
      occlusion:Object.freeze({sideInset:14,topInset:36,bottomPadding:80,clip:Object.freeze({xPadding:14,topPadding:52,bottomPadding:18})}),
      legacyVisualReplacement:true
    }),
    commerceArcade:Object.freeze({
      id:'commerce-arcade-east', asset:'commerceArcade', x:1510, y:1384, baseYOffset:416,
      collision:Object.freeze({x:1530,y:1400,w:120,h:400}),
      occlusion:Object.freeze({sideInset:12,topInset:20,bottomPadding:16,clip:Object.freeze({xPadding:12,topPadding:36,bottomPadding:16})}),
      legacyVisualReplacement:true
    }),
    bancoHall:Object.freeze({
      id:'banco-hall-central', asset:'bancoHall', x:1648, y:1344, baseYOffset:128,
      collision:Object.freeze({x:1664,y:1376,w:128,h:96}),
      occlusion:Object.freeze({sideInset:12,topInset:28,bottomPadding:10,clip:Object.freeze({xPadding:10,topPadding:24,bottomPadding:10})}),
      legacyVisualReplacement:true
    })
  });

  const tiles = Object.freeze({
    GRASS_A:0, GRASS_B:1, GRASS_C:2, GRASS_FLOWERS:3,
    MARBLE_A:4, MARBLE_B:5, MARBLE_GOLD_A:6, MARBLE_GOLD_B:7,
    MARBLE_GREEN_DIAMOND:8, MARBLE_GREEN_CENTER:9, MARBLE_DIAMOND:10,
    GRASS_SOFT:25, MARBLE_CLEAN_A:26, MARBLE_CLEAN_B:27,
    MARBLE_CLEAN_C:28, MARBLE_CLEAN_D:29,
    MARBLE_IVORY_A:80, MARBLE_IVORY_B:81, MARBLE_IVORY_C:82, MARBLE_IVORY_D:83,
    FOUNTAIN:Object.freeze([32,33,34,48,49,50,64,65,66]),
    TREE:Object.freeze([35,36,51,52,67,68]), COLUMN:Object.freeze([37,53]),
    BUSH_A:38, BUSH_FLOWERS:39, FLOWERBED:Object.freeze([40,41]),
    STATUE:Object.freeze([42,58]), LAMP:Object.freeze([43,59]), BENCH:Object.freeze([44,45]),
    BUSH_B:54, BUSH_FLOWERS_B:55, PLANTER:56, PLANTER_FLOWERS:57
  });
  const families = Object.freeze({
    grass:Object.freeze([tiles.GRASS_A,tiles.GRASS_B,tiles.GRASS_C,tiles.GRASS_SOFT]),
    grassDetail:Object.freeze([tiles.GRASS_FLOWERS]),
    marble:Object.freeze([tiles.MARBLE_IVORY_A,tiles.MARBLE_IVORY_B,tiles.MARBLE_IVORY_C,tiles.MARBLE_IVORY_D,tiles.MARBLE_IVORY_A,tiles.MARBLE_IVORY_B,tiles.MARBLE_IVORY_C,tiles.MARBLE_IVORY_D]),
    marbleAccent:Object.freeze([tiles.MARBLE_A,tiles.MARBLE_B,tiles.MARBLE_DIAMOND]),
    marbleGold:Object.freeze([tiles.MARBLE_GOLD_A,tiles.MARBLE_GOLD_B])
  });
  const districtGroundStyles = Object.freeze({
    central:Object.freeze({detailEvery:43,detailCluster:false,marbleAccentEvery:0}),
    rural:Object.freeze({detailEvery:31,detailCluster:true,marbleAccentEvery:0}),
    arena:Object.freeze({detailEvery:61,detailCluster:false,marbleAccentEvery:29}),
    commerce:Object.freeze({detailEvery:67,detailCluster:false,marbleAccentEvery:23}),
    gardens:Object.freeze({detailEvery:17,detailCluster:true,marbleAccentEvery:0}),
    default:Object.freeze({detailEvery:53,detailCluster:false,marbleAccentEvery:0})
  });
  const ruralTiles = Object.freeze({
    TOP_LEFT:0, TOP:1, TOP_RIGHT:2, CENTER_ALT_A:3,
    LEFT:4, CENTER:5, RIGHT:6, CENTER_ALT_B:7,
    BOTTOM_LEFT:8, BOTTOM:9, BOTTOM_RIGHT:10, CENTER_ALT_C:11
  });
  const ruralPropTiles = Object.freeze({
    FENCE_H:0, FENCE_V:1, CORNER_LEFT:2, CORNER_RIGHT:3,
    GATE_CLOSED:4, GATE_OPEN:5, FIELD_SIGN:6, FENCE_BROKEN:7,
    DIRT_FULL:8, DIRT_VERTICAL:9, DIRT_HORIZONTAL:10, DIRT_CROSS:11,
    WEED_A:12, STONE_A:13, WEED_B:14, LOG_A:15
  });
  const ruralLandmarkTiles = Object.freeze({HAY:7,CRATE:15,BUSH:23,FLOWERS:31});
  const ruralLandmarkSprites = Object.freeze({
    barn:Object.freeze({sx:0,sy:0,w:160,h:128,baseY:112}),
    silo:Object.freeze({sx:160,sy:0,w:64,h:128,baseY:116})
  });
  const ruralNatureTiles = ruralNatureAtlas.tiles;
  const ruralNatureSprites = ruralNatureAtlas.treeFamilies;
  const transitionMasks = Object.freeze({
    0:15,1:0,2:1,3:5,4:2,5:12,6:6,7:9,8:3,9:4,10:13,11:8,12:7,13:11,14:10,15:14
  });
  const styles = Object.freeze({
    plazaTransition:Object.freeze({mode:'authored-overlay-atlas',neighbourMask:'TRBL',softenStickerAccents:true}),
    propDepth:Object.freeze({mode:'y-occlusion-overlay-v1',localActorIntersection:true,frontOccluders:Object.freeze(['fountain','column','tree','lamp'])}),
    architecture:Object.freeze({mode:'authored-layered-raster-v1',depthMode:'building-base-y-occlusion-v1',actorClip:true,prefabContract:'registry-asset-placement-collision-v1',rendererMode:'generic-prefab-list-v1'}),
    districtGround:Object.freeze({mode:'district-profile-v1',profiles:districtGroundStyles}),
    ruralFarm:Object.freeze({
      mode:'authored-nine-slice-v1',
      plotTiles:Object.freeze([0,1,2,4,5,6,8,9,10]),
      logicalPlotSize:96,
      cropAnchors:Object.freeze([[16,18],[48,18],[80,18],[16,50],[48,50],[80,50]]),
      boundary:Object.freeze({mode:'modular-fence-gate-v1',padding:16,gateSide:'north',dirtApproachTiles:1,propAtlas:'rural-props'})
    }),
    ruralLandmarks:Object.freeze({
      mode:'layered-rural-landmarks-v1',
      authoredLandmarks:Object.freeze(['barn','silo']),
      depthMode:'actor-base-y-v1',
      gameplayFootprint:'visual-only-v1',
      edgeVegetation:Object.freeze({
        mode:'authored-rural-nature-edge-clusters-v1',
        sourceAtlas:'ruralNature',
        treeFamilies:Object.freeze(['oak','fruit']),
        hedgeTiles:Object.freeze(['HEDGE_A','HEDGE_B','HEDGE_FLOWERS_A','HEDGE_FLOWERS_B']),
        detailTiles:Object.freeze(['TALL_GRASS','WILDFLOWERS','STUMP','STONE']),
        centerClear:true,
        roadClearance:32
      })
    })
  });
  window.KELO_TILE_REGISTRY = Object.freeze({
    version:'1.10.12', worldTileSize:TILE,
    atlases:Object.freeze({plaza:atlas,transitions:transitionAtlas,ruralSoil:ruralSoilAtlas,ruralProps:ruralPropsAtlas,ruralLandmarks:ruralLandmarksAtlas,ruralNature:ruralNatureAtlas}),
    architectureAssets,architecturePrefabs,
    tiles,ruralTiles,ruralPropTiles,ruralLandmarkTiles,ruralLandmarkSprites,ruralNatureTiles,ruralNatureSprites,families,transitionMasks,styles
  });
})();