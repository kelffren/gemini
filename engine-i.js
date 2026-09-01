(function () {
  // Plaza ground V2: 32px logical tiles, vivid grass base + Roman marble paths.
  // The atlas is an exact 16x16 grid of 32px cells (512x512).
  const PAD = { x: 1040, y: 1240, w: 800, h: 560 };
  const TILE = 32;
  const ATLAS_COLS = 16;

  const TILES = Object.freeze({
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
    MARBLE_EDGE_A: 13,
    MARBLE_EDGE_B: 14,
    MARBLE_EDGE_C: 15
  });

  let floor = null;
  let ready = false;

  const sheet = new Image();
  sheet.decoding = 'async';
  sheet.onload = function () {
    ready = true;
    bake();
  };
  sheet.onerror = function () {
    ready = false;
    bakeFallback();
    console.warn('[Kelo tileset] assets/tileset.png no cargó; usando fallback de plaza.');
  };
  sheet.src = 'assets/tileset.png?v=85';

  function drawTile(g, id, dx, dy) {
    const sx = (id % ATLAS_COLS) * TILE;
    const sy = Math.floor(id / ATLAS_COLS) * TILE;
    g.drawImage(sheet, sx, sy, TILE, TILE, dx, dy, TILE, TILE);
  }

  function seededPick(gx, gy, list) {
    // Deterministic so refresh does not reshuffle the plaza.
    const n = Math.abs(((gx + 17) * 73856093) ^ ((gy + 29) * 19349663));
    return list[n % list.length];
  }

  function isMainMarble(gx, gy, cols, rows) {
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    const centralSquare = Math.abs(gx - cx) <= 5 && Math.abs(gy - cy) <= 4;
    const horizontalPath = Math.abs(gy - cy) <= 1;
    const verticalPath = Math.abs(gx - cx) <= 1;
    return centralSquare || horizontalPath || verticalPath;
  }

  function isCentralBorder(gx, gy, cols, rows) {
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    const dx = Math.abs(gx - cx);
    const dy = Math.abs(gy - cy);
    return (dx === 5 && dy <= 4) || (dy === 4 && dx <= 5);
  }

  function bake() {
    if (!ready || !sheet.naturalWidth) return;

    const c = document.createElement('canvas');
    c.width = PAD.w;
    c.height = PAD.h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;

    const cols = Math.ceil(PAD.w / TILE);
    const rows = Math.ceil(PAD.h / TILE);
    const grass = [TILES.GRASS_A, TILES.GRASS_B, TILES.GRASS_C];
    const marble = [TILES.MARBLE_A, TILES.MARBLE_B, TILES.MARBLE_DIAMOND];

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        let id;

        if (isMainMarble(gx, gy, cols, rows)) {
          if (isCentralBorder(gx, gy, cols, rows)) {
            id = seededPick(gx, gy, [TILES.MARBLE_GOLD_A, TILES.MARBLE_GOLD_B]);
          } else {
            id = seededPick(gx, gy, marble);
          }
        } else {
          id = seededPick(gx, gy, grass);
          if (((gx * 7 + gy * 11) % 23) === 0) id = TILES.GRASS_FLOWERS;
        }

        drawTile(g, id, gx * TILE, gy * TILE);
      }
    }

    // Signature medallion at the heart of the plaza.
    const cx = Math.floor(cols / 2);
    const cy = Math.floor(rows / 2);
    drawTile(g, TILES.MARBLE_GREEN_CENTER, cx * TILE, cy * TILE);

    floor = c;
  }

  function bakeFallback() {
    const c = document.createElement('canvas');
    c.width = PAD.w;
    c.height = PAD.h;
    const g = c.getContext('2d');
    const cols = Math.ceil(PAD.w / TILE);
    const rows = Math.ceil(PAD.h / TILE);

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        g.fillStyle = isMainMarble(gx, gy, cols, rows)
          ? (((gx + gy) & 1) ? '#f2ead6' : '#fff8e8')
          : (((gx + gy) & 1) ? '#55c92d' : '#62d936');
        g.fillRect(gx * TILE, gy * TILE, TILE, TILE);
      }
    }

    floor = c;
  }

  const _r = render;
  render = function () {
    _r();
    if (!floor) return;

    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(floor, PAD.x, PAD.y);

    // Keep actors above the floor. Later engine wrappers continue drawing
    // buildings/effects over this layer as before.
    if (typeof renderAvatar === 'function') {
      if (typeof simulatedPlayers !== 'undefined') {
        simulatedPlayers.forEach(function (p) { renderAvatar(p, false); });
      }
      if (typeof localPlayer !== 'undefined') renderAvatar(localPlayer, true);
    }
    ctx.restore();
  };

  window.KELO_PLAZA_TILESET = Object.freeze({
    atlas: 'assets/tileset.png',
    atlasSize: 512,
    atlasTileSize: TILE,
    worldTileSize: TILE,
    columns: ATLAS_COLS,
    plaza: Object.freeze({ x: PAD.x, y: PAD.y, w: PAD.w, h: PAD.h })
  });
})();
