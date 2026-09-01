(function () {
  // Kelo World plaza renderer V4.
  // Production atlas: assets/tileset.png = 512x512, exact 16x16 grid, 32x32 cells.
  const PAD = { x: 1040, y: 1240, w: 800, h: 560 };
  const TILE = 32;
  const COLS = 16;

  const T = Object.freeze({
    GRASS_A: 0,
    GRASS_B: 1,
    GRASS_C: 2,
    GRASS_FLOWERS: 3,
    MARBLE_A: 4,
    MARBLE_B: 5,
    MARBLE_GOLD_A: 6,
    MARBLE_GOLD_B: 7,
    MARBLE_GREEN_DIAMOND: 8,
    MARBLE_GREEN_CENTER: 9,
    MARBLE_DIAMOND: 10,
    GRASS_STONE_EDGE: 11,
    GRASS_STONE_CORNER: 12,
    MARBLE_EDGE_TOP: 13,
    MARBLE_EDGE_BOTTOM: 14,
    MARBLE_EDGE_LEFT: 15,

    TRANS_TOP: 16,
    TRANS_BOTTOM: 17,
    TRANS_LEFT: 18,
    TRANS_RIGHT: 19,
    TRANS_TL: 20,
    TRANS_TR: 21,
    TRANS_BL: 22,
    TRANS_BR: 23,
    GRASS_FLOWERS_RICH: 24,
    GRASS_SOFT: 25,
    MARBLE_CLEAN_A: 26,
    MARBLE_CLEAN_B: 27,
    MARBLE_CLEAN_C: 28,
    MARBLE_CLEAN_D: 29,
    MARBLE_FRAME_A: 30,
    MARBLE_FRAME_B: 31,

    FOUNTAIN: Object.freeze([32,33,34,48,49,50,64,65,66]),
    TREE: Object.freeze([35,36,51,52,67,68]),
    COLUMN: Object.freeze([37,53]),
    BUSH_A: 38,
    BUSH_FLOWERS: 39,
    FLOWERBED: Object.freeze([40,41]),
    STATUE: Object.freeze([42,58]),
    LAMP: Object.freeze([43,59]),
    BENCH: Object.freeze([44,45]),
    RUG: Object.freeze([46,47,62,63]),
    BUSH_B: 54,
    BUSH_FLOWERS_B: 55,
    PLANTER: 56,
    PLANTER_FLOWERS: 57,
    BRAZIER: 60,
    POT: 61
  });

  let floorLayer = null;
  let propLayer = null;
  let atlasReady = false;

  const sheet = new Image();
  sheet.decoding = 'async';

  function origin(id) {
    return { x: (id % COLS) * TILE, y: Math.floor(id / COLS) * TILE };
  }

  function drawTile(g, id, dx, dy) {
    const p = origin(id);
    g.drawImage(sheet, p.x, p.y, TILE, TILE, dx, dy, TILE, TILE);
  }

  function drawGridSprite(g, ids, gx, gy, w, h) {
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const id = ids[row * w + col];
        if (id == null) continue;
        drawTile(g, id, (gx + col) * TILE, (gy + row) * TILE);
      }
    }
  }

  function pick(gx, gy, list) {
    const n = Math.abs(((gx + 17) * 73856093) ^ ((gy + 29) * 19349663));
    return list[n % list.length];
  }

  function paintGround(g, cols, rows) {
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    const plazaHalfW = 5;
    const plazaHalfH = 4;

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const dx = Math.abs(gx - cx);
        const dy = Math.abs(gy - cy);
        const inSquare = dx <= plazaHalfW && dy <= plazaHalfH;
        const inVerticalPath = dx <= 1;
        const inHorizontalPath = dy <= 1;
        const isMarble = inSquare || inVerticalPath || inHorizontalPath;

        let id;
        if (!isMarble) {
          id = pick(gx, gy, [T.GRASS_A, T.GRASS_B, T.GRASS_C, T.GRASS_SOFT]);
          if (((gx * 11 + gy * 7) % 29) === 0) id = T.GRASS_FLOWERS;
          if (((gx * 13 + gy * 5) % 47) === 0) id = T.GRASS_FLOWERS_RICH;
        } else {
          id = pick(gx, gy, [
            T.MARBLE_A, T.MARBLE_B, T.MARBLE_CLEAN_A,
            T.MARBLE_CLEAN_B, T.MARBLE_CLEAN_C, T.MARBLE_CLEAN_D
          ]);

          const squareEdge =
            inSquare &&
            ((dx === plazaHalfW && dy <= plazaHalfH) ||
             (dy === plazaHalfH && dx <= plazaHalfW));

          if (squareEdge && ((gx + gy) % 2 === 0)) {
            id = pick(gx, gy, [T.MARBLE_GOLD_A, T.MARBLE_GOLD_B]);
          }

          const entrance =
            (dx === 0 && dy === plazaHalfH) ||
            (dy === 0 && dx === plazaHalfW);
          const innerCorner = dx === 4 && dy === 3;
          if (entrance || innerCorner) id = T.MARBLE_GREEN_DIAMOND;
        }

        drawTile(g, id, gx * TILE, gy * TILE);
      }
    }

    drawTile(g, T.MARBLE_GREEN_CENTER, cx * TILE, cy * TILE);
  }

  function paintProps(g, cols, rows) {
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);

    drawGridSprite(g, T.FOUNTAIN, cx - 1, cy - 2, 3, 3);

    [
      [cx - 5, cy - 4],
      [cx + 4, cy - 4],
      [cx - 5, cy + 2],
      [cx + 4, cy + 2]
    ].forEach(function (p) {
      drawGridSprite(g, T.COLUMN, p[0], p[1], 1, 2);
    });

    [
      [1, 1],
      [cols - 4, 1],
      [1, rows - 4],
      [cols - 4, rows - 4]
    ].forEach(function (p) {
      drawGridSprite(g, T.TREE, p[0], p[1], 2, 3);
    });

    [
      [cx - 8, cy - 5, T.BUSH_FLOWERS],
      [cx + 7, cy - 5, T.BUSH_A],
      [cx - 8, cy + 4, T.BUSH_A],
      [cx + 7, cy + 4, T.BUSH_FLOWERS_B],
      [cx - 7, cy - 5, T.PLANTER],
      [cx + 6, cy + 4, T.PLANTER_FLOWERS]
    ].forEach(function (p) {
      drawTile(g, p[2], p[0] * TILE, p[1] * TILE);
    });

    drawGridSprite(g, T.BENCH, cx - 9, cy - 1, 2, 1);
    drawGridSprite(g, T.BENCH, cx + 7, cy - 1, 2, 1);
    drawGridSprite(g, T.FLOWERBED, cx - 8, cy + 6, 2, 1);
    drawGridSprite(g, T.FLOWERBED, cx + 6, cy - 7, 2, 1);

    drawGridSprite(g, T.LAMP, cx - 3, 1, 1, 2);
    drawGridSprite(g, T.LAMP, cx + 3, rows - 3, 1, 2);
    drawTile(g, T.PLANTER, (cx - 2) * TILE, 2 * TILE);
    drawTile(g, T.PLANTER_FLOWERS, (cx + 2) * TILE, (rows - 2) * TILE);
  }

  function bake() {
    if (!atlasReady) return;

    const cols = Math.ceil(PAD.w / TILE);
    const rows = Math.ceil(PAD.h / TILE);

    const floor = document.createElement('canvas');
    floor.width = PAD.w;
    floor.height = PAD.h;
    const fg = floor.getContext('2d');
    fg.imageSmoothingEnabled = false;
    paintGround(fg, cols, rows);

    const props = document.createElement('canvas');
    props.width = PAD.w;
    props.height = PAD.h;
    const pg = props.getContext('2d');
    pg.imageSmoothingEnabled = false;
    paintProps(pg, cols, rows);

    floorLayer = floor;
    propLayer = props;
  }

  function fallback() {
    const c = document.createElement('canvas');
    c.width = PAD.w;
    c.height = PAD.h;
    const g = c.getContext('2d');
    g.fillStyle = '#4fce38';
    g.fillRect(0, 0, PAD.w, PAD.h);
    floorLayer = c;
    propLayer = null;
  }

  sheet.onload = function () {
    if (sheet.naturalWidth !== 512 || sheet.naturalHeight !== 512) {
      console.error('[Kelo tileset] Invalid atlas dimensions:', sheet.naturalWidth, sheet.naturalHeight);
      fallback();
      return;
    }
    atlasReady = true;
    bake();
  };

  sheet.onerror = function () {
    console.error('[Kelo tileset] assets/tileset.png failed to load.');
    fallback();
  };

  sheet.src = 'assets/tileset.png?v=88';

  const _r = render;
  render = function () {
    _r();
    if (!floorLayer) return;

    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(floorLayer, PAD.x, PAD.y);
    if (propLayer) ctx.drawImage(propLayer, PAD.x, PAD.y);

    if (typeof renderAvatar === 'function') {
      if (typeof simulatedPlayers !== 'undefined') {
        simulatedPlayers.forEach(function (p) { renderAvatar(p, false); });
      }
      if (typeof localPlayer !== 'undefined') renderAvatar(localPlayer, true);
    }

    ctx.restore();
  };

  window.KELO_PLAZA_TILESET = Object.freeze({
    sourceMode: 'asset-production-v1',
    assetPath: 'assets/tileset.png',
    atlasSize: 512,
    atlasTileSize: TILE,
    worldTileSize: TILE,
    columns: COLS,
    plaza: Object.freeze({ x: PAD.x, y: PAD.y, w: PAD.w, h: PAD.h })
  });
})();
