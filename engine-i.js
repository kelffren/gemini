(function () {
  // Kelo World plaza ground V3.
  // Important: world tiles are ALWAYS 32x32. The map is painted tile-by-tile;
  // no complete sprite sheet is ever stretched into the world.
  const PAD = { x: 1040, y: 1240, w: 800, h: 560 };
  const TILE = 32;
  const ATLAS_COLS = 16;
  const ATLAS_SIZE = 512;

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

  const COLORS = Object.freeze({
    grassA: '#55c936',
    grassB: '#62d93d',
    grassC: '#46b934',
    grassDark: '#33952e',
    grassLight: '#82e85c',
    marbleA: '#f7f2e0',
    marbleB: '#eee7cf',
    marbleLight: '#fffbed',
    marbleVein: '#c6bda6',
    gold: '#d7a631',
    goldDark: '#a8781f',
    goldLight: '#f4cf5b',
    greenInset: '#43a54a'
  });

  function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function tileOrigin(id) {
    return { x: (id % ATLAS_COLS) * TILE, y: Math.floor(id / ATLAS_COLS) * TILE };
  }

  function buildRuntimeAtlas() {
    const atlas = document.createElement('canvas');
    atlas.width = ATLAS_SIZE;
    atlas.height = ATLAS_SIZE;
    const g = atlas.getContext('2d');
    g.imageSmoothingEnabled = false;

    function rectTile(id, color) {
      const p = tileOrigin(id);
      g.fillStyle = color;
      g.fillRect(p.x, p.y, TILE, TILE);
      return p;
    }

    function grassTile(id, base, seed, flowers) {
      const p = rectTile(id, base);
      const rnd = makeRng(seed);
      for (let n = 0; n < 22; n++) {
        const x = p.x + 2 + Math.floor(rnd() * 28);
        const y = p.y + 2 + Math.floor(rnd() * 28);
        g.fillStyle = rnd() > 0.45 ? COLORS.grassDark : COLORS.grassLight;
        g.fillRect(x, y, 1 + (rnd() > 0.7 ? 1 : 0), 1);
      }
      if (flowers) {
        const fs = [
          [7, 8, '#fffdf2'],
          [22, 19, '#ffe67e'],
          [14, 26, '#ffb5d1']
        ];
        fs.forEach(function (f) {
          g.fillStyle = f[2];
          g.fillRect(p.x + f[0], p.y + f[1], 2, 2);
          g.fillStyle = '#f4cf5b';
          g.fillRect(p.x + f[0] + 1, p.y + f[1] + 1, 1, 1);
        });
      }
    }

    function marbleBase(id, base) {
      const p = rectTile(id, base);
      g.fillStyle = COLORS.marbleLight;
      g.fillRect(p.x, p.y, TILE, 1);
      g.fillStyle = '#ded5bd';
      g.fillRect(p.x, p.y + TILE - 1, TILE, 1);
      g.strokeStyle = COLORS.marbleVein;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(p.x + 3, p.y + 25);
      g.lineTo(p.x + 10, p.y + 18);
      g.lineTo(p.x + 15, p.y + 19);
      g.lineTo(p.x + 21, p.y + 10);
      g.lineTo(p.x + 29, p.y + 6);
      g.stroke();
      return p;
    }

    function addGoldFrame(p) {
      g.strokeStyle = COLORS.gold;
      g.lineWidth = 2;
      g.strokeRect(p.x + 2, p.y + 2, 27, 27);
      g.strokeStyle = COLORS.goldLight;
      g.lineWidth = 1;
      g.strokeRect(p.x + 5, p.y + 5, 21, 21);
    }

    function diamondTile(id, green) {
      const p = marbleBase(id, COLORS.marbleA);
      g.fillStyle = green ? COLORS.greenInset : COLORS.marbleB;
      g.strokeStyle = COLORS.gold;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(p.x + 16, p.y + 4);
      g.lineTo(p.x + 28, p.y + 16);
      g.lineTo(p.x + 16, p.y + 28);
      g.lineTo(p.x + 4, p.y + 16);
      g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = green ? COLORS.grassLight : COLORS.marbleLight;
      g.beginPath();
      g.moveTo(p.x + 16, p.y + 9);
      g.lineTo(p.x + 23, p.y + 16);
      g.lineTo(p.x + 16, p.y + 23);
      g.lineTo(p.x + 9, p.y + 16);
      g.closePath();
      g.fill();
    }

    function medallionTile(id) {
      const p = marbleBase(id, COLORS.marbleA);
      g.fillStyle = COLORS.greenInset;
      g.strokeStyle = COLORS.gold;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(p.x + 16, p.y + 16, 12, 0, Math.PI * 2);
      g.fill(); g.stroke();
      g.fillStyle = COLORS.goldLight;
      g.strokeStyle = COLORS.goldDark;
      g.lineWidth = 1;
      const pts = [
        [16, 6], [19, 13], [26, 10], [21, 16],
        [26, 22], [19, 19], [16, 27], [13, 19],
        [6, 22], [11, 16], [6, 10], [13, 13]
      ];
      g.beginPath();
      pts.forEach(function (pt, i) {
        if (i === 0) g.moveTo(p.x + pt[0], p.y + pt[1]);
        else g.lineTo(p.x + pt[0], p.y + pt[1]);
      });
      g.closePath(); g.fill(); g.stroke();
    }

    grassTile(TILES.GRASS_A, COLORS.grassA, 101, false);
    grassTile(TILES.GRASS_B, COLORS.grassB, 202, false);
    grassTile(TILES.GRASS_C, COLORS.grassC, 303, false);
    grassTile(TILES.GRASS_FLOWERS, COLORS.grassA, 404, true);

    marbleBase(TILES.MARBLE_A, COLORS.marbleA);
    marbleBase(TILES.MARBLE_B, COLORS.marbleB);
    addGoldFrame(marbleBase(TILES.MARBLE_GOLD_A, COLORS.marbleA));
    addGoldFrame(marbleBase(TILES.MARBLE_GOLD_B, COLORS.marbleB));
    diamondTile(TILES.MARBLE_GREEN_DIAMOND, true);
    medallionTile(TILES.MARBLE_GREEN_CENTER);
    diamondTile(TILES.MARBLE_DIAMOND, false);

    [TILES.GRASS_STONE_EDGE, TILES.GRASS_STONE_CORNER].forEach(function (id, i) {
      const p = rectTile(id, i ? COLORS.grassA : COLORS.grassB);
      g.fillStyle = COLORS.marbleA;
      g.fillRect(p.x + 23, p.y, 9, TILE);
      g.fillStyle = COLORS.gold;
      g.fillRect(p.x + 22, p.y, 1, TILE);
    });

    [TILES.MARBLE_EDGE_A, TILES.MARBLE_EDGE_B, TILES.MARBLE_EDGE_C].forEach(function (id, i) {
      const p = marbleBase(id, i === 1 ? COLORS.marbleB : COLORS.marbleA);
      g.fillStyle = COLORS.gold;
      g.fillRect(p.x + 1, p.y + 2, 30, 2);
      g.fillStyle = COLORS.goldLight;
      g.fillRect(p.x + 1, p.y + 5, 30, 1);
    });

    return atlas;
  }

  const sheet = buildRuntimeAtlas();
  let floor = null;

  function drawTile(g, id, dx, dy) {
    const p = tileOrigin(id);
    g.drawImage(sheet, p.x, p.y, TILE, TILE, dx, dy, TILE, TILE);
  }

  function seededPick(gx, gy, list) {
    const n = Math.abs(((gx + 17) * 73856093) ^ ((gy + 29) * 19349663));
    return list[n % list.length];
  }

  function geometry(cols, rows) {
    return { cx: Math.floor(cols / 2), cy: Math.floor(rows / 2) };
  }

  function isMainMarble(gx, gy, cols, rows) {
    const c = geometry(cols, rows);
    const dx = Math.abs(gx - c.cx);
    const dy = Math.abs(gy - c.cy);
    return (dx <= 5 && dy <= 4) || dx <= 1 || dy <= 1;
  }

  function isCentralBorder(gx, gy, cols, rows) {
    const c = geometry(cols, rows);
    const dx = Math.abs(gx - c.cx);
    const dy = Math.abs(gy - c.cy);
    return (dx === 5 && dy <= 4) || (dy === 4 && dx <= 5);
  }

  function bake() {
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
          id = isCentralBorder(gx, gy, cols, rows)
            ? seededPick(gx, gy, [TILES.MARBLE_GOLD_A, TILES.MARBLE_GOLD_B])
            : seededPick(gx, gy, marble);
        } else {
          id = seededPick(gx, gy, grass);
          if (((gx * 7 + gy * 11) % 23) === 0) id = TILES.GRASS_FLOWERS;
        }
        drawTile(g, id, gx * TILE, gy * TILE);
      }
    }

    const c0 = geometry(cols, rows);
    drawTile(g, TILES.MARBLE_GREEN_CENTER, c0.cx * TILE, c0.cy * TILE);
    floor = c;
  }

  bake();

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

    // engine-i is still a render wrapper in the legacy stack, therefore actors
    // are redrawn above the ground until the renderer is converted to layers.
    if (typeof renderAvatar === 'function') {
      if (typeof simulatedPlayers !== 'undefined') {
        simulatedPlayers.forEach(function (p) { renderAvatar(p, false); });
      }
      if (typeof localPlayer !== 'undefined') renderAvatar(localPlayer, true);
    }
    ctx.restore();
  };

  window.KELO_PLAZA_TILESET = Object.freeze({
    sourceMode: 'runtime-procedural-v3',
    assetPath: 'assets/tileset.png',
    atlasSize: ATLAS_SIZE,
    atlasTileSize: TILE,
    worldTileSize: TILE,
    columns: ATLAS_COLS,
    plaza: Object.freeze({ x: PAD.x, y: PAD.y, w: PAD.w, h: PAD.h })
  });
})();
