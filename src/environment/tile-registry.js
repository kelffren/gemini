(function () {
  const TILE = 32;
  const atlas = Object.freeze({
    id: 'plaza-core',
    src: 'assets/tileset-vclean.png?art=131',
    width: 512,
    height: 512,
    tileWidth: TILE,
    tileHeight: TILE,
    columns: 16
  });
  const transitionAtlas = Object.freeze({
    id: 'plaza-transitions',
    src: 'assets/plaza-transitions-v1.png?art=140',
    width: 128,
    height: 128,
    tileWidth: TILE,
    tileHeight: TILE,
    columns: 4
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
    marble:Object.freeze([
      tiles.MARBLE_IVORY_A,tiles.MARBLE_IVORY_B,tiles.MARBLE_IVORY_C,tiles.MARBLE_IVORY_D,
      tiles.MARBLE_IVORY_A,tiles.MARBLE_IVORY_B,tiles.MARBLE_IVORY_C,tiles.MARBLE_IVORY_D
    ]),
    marbleAccent:Object.freeze([tiles.MARBLE_A,tiles.MARBLE_B,tiles.MARBLE_DIAMOND]),
    marbleGold:Object.freeze([tiles.MARBLE_GOLD_A,tiles.MARBLE_GOLD_B])
  });

  // 4-neighbour mask: top=1, right=2, bottom=4, left=8.
  // Every combination maps to one authored transparent overlay tile.
  const transitionMasks = Object.freeze({
    0:15, 1:0, 2:1, 3:5, 4:2, 5:12, 6:6, 7:9,
    8:3, 9:4, 10:13, 11:8, 12:7, 13:11, 14:10, 15:14
  });

  const styles = Object.freeze({
    plazaTransition:Object.freeze({
      mode:'authored-overlay-atlas',
      neighbourMask:'TRBL',
      softenStickerAccents:true
    })
  });

  window.KELO_TILE_REGISTRY = Object.freeze({
    version:'1.4.0',
    worldTileSize:TILE,
    atlases:Object.freeze({plaza:atlas, transitions:transitionAtlas}),
    tiles,
    families,
    transitionMasks,
    styles
  });
})();
