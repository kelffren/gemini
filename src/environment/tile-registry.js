(function () {
  const TILE = 32;
  const atlas = Object.freeze({
    id: 'plaza-core',
    src: 'assets/tileset.png',
    width: 512,
    height: 512,
    tileWidth: TILE,
    tileHeight: TILE,
    columns: 16
  });

  const tiles = Object.freeze({
    GRASS_A:0, GRASS_B:1, GRASS_C:2, GRASS_FLOWERS:3,
    MARBLE_A:4, MARBLE_B:5, MARBLE_GOLD_A:6, MARBLE_GOLD_B:7,
    MARBLE_GREEN_DIAMOND:8, MARBLE_GREEN_CENTER:9, MARBLE_DIAMOND:10,
    GRASS_SOFT:25, MARBLE_CLEAN_A:26, MARBLE_CLEAN_B:27,
    MARBLE_CLEAN_C:28, MARBLE_CLEAN_D:29,
    FOUNTAIN:Object.freeze([32,33,34,48,49,50,64,65,66]),
    TREE:Object.freeze([35,36,51,52,67,68]), COLUMN:Object.freeze([37,53]),
    BUSH_A:38, BUSH_FLOWERS:39, FLOWERBED:Object.freeze([40,41]),
    STATUE:Object.freeze([42,58]), LAMP:Object.freeze([43,59]), BENCH:Object.freeze([44,45]),
    BUSH_B:54, BUSH_FLOWERS_B:55, PLANTER:56, PLANTER_FLOWERS:57
  });

  const families = Object.freeze({
    grass:Object.freeze([tiles.GRASS_A,tiles.GRASS_B,tiles.GRASS_C,tiles.GRASS_SOFT]),
    grassDetail:Object.freeze([tiles.GRASS_FLOWERS]),
    marble:Object.freeze([tiles.MARBLE_A,tiles.MARBLE_B,tiles.MARBLE_CLEAN_A,tiles.MARBLE_CLEAN_B,tiles.MARBLE_CLEAN_C,tiles.MARBLE_CLEAN_D]),
    marbleGold:Object.freeze([tiles.MARBLE_GOLD_A,tiles.MARBLE_GOLD_B])
  });

  window.KELO_TILE_REGISTRY = Object.freeze({
    version:'1.0.0',
    worldTileSize:TILE,
    atlases:Object.freeze({plaza:atlas}),
    tiles,
    families
  });
})();
