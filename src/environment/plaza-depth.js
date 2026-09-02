(function () {
  const REGISTRY = window.KELO_TILE_REGISTRY;
  if (!REGISTRY?.atlases?.plaza || !REGISTRY?.tiles || typeof window.render !== 'function') {
    console.error('[Kelo plaza depth] registry or renderer missing');
    return;
  }

  const PLAZA = { x: 1040, y: 1240, w: 800, h: 560 };
  const TILE = REGISTRY.worldTileSize;
  const ATLAS = REGISTRY.atlases.plaza;
  const T = REGISTRY.tiles;
  const cols = Math.ceil(PLAZA.w / TILE);
  const rows = Math.ceil(PLAZA.h / TILE);
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const sheet = new Image();
  sheet.decoding = 'async';
  let ready = false;

  function spriteEntry(ids, gx, gy, w, h, kind) {
    return Object.freeze({ ids, gx, gy, w, h, kind, baseY: PLAZA.y + (gy + h) * TILE });
  }

  const OCCLUDERS = Object.freeze([
    spriteEntry(T.FOUNTAIN, cx - 1, cy - 2, 3, 3, 'fountain'),
    ...[[cx-5,cy-4],[cx+4,cy-4],[cx-5,cy+2],[cx+4,cy+2]].map(p => spriteEntry(T.COLUMN,p[0],p[1],1,2,'column')),
    ...[[1,1],[cols-4,1],[1,rows-4],[cols-4,rows-4]].map(p => spriteEntry(T.TREE,p[0],p[1],2,3,'tree')),
    spriteEntry(T.LAMP,cx-3,1,1,2,'lamp'),
    spriteEntry(T.LAMP,cx+3,rows-3,1,2,'lamp')
  ]);

  function atlasOrigin(id) {
    return { x: (id % ATLAS.columns) * TILE, y: Math.floor(id / ATLAS.columns) * TILE };
  }

  function drawWorldSprite(entry) {
    for (let r=0; r<entry.h; r++) for (let c=0; c<entry.w; c++) {
      const id = entry.ids[r * entry.w + c];
      if (id == null) continue;
      const p = atlasOrigin(id);
      ctx.drawImage(sheet,p.x,p.y,TILE,TILE,PLAZA.x + (entry.gx + c) * TILE,PLAZA.y + (entry.gy + r) * TILE,TILE,TILE);
    }
  }

  function actorIntersectsOccluder(actor, entry) {
    if (!actor) return false;
    const ax = actor.x || 0;
    const ay = actor.y || 0;
    const left = PLAZA.x + entry.gx * TILE - 14;
    const right = PLAZA.x + (entry.gx + entry.w) * TILE + 14;
    const top = PLAZA.y + entry.gy * TILE - 24;
    return ax >= left && ax <= right && ay >= top && ay < entry.baseY;
  }

  function drawFrontOccluders() {
    if (!ready || typeof localPlayer === 'undefined' || !localPlayer) return;
    const active = OCCLUDERS.filter(entry => actorIntersectsOccluder(localPlayer, entry));
    if (!active.length) return;
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW/2, screenH/2);
    ctx.scale(z,z);
    ctx.translate(-camera.x,-camera.y);
    ctx.imageSmoothingEnabled = false;
    active.sort((a,b) => a.baseY - b.baseY).forEach(drawWorldSprite);
    ctx.restore();
  }

  sheet.onload = function () {
    if (sheet.naturalWidth !== ATLAS.width || sheet.naturalHeight !== ATLAS.height) {
      console.error('[Kelo plaza depth] invalid atlas dimensions', sheet.naturalWidth, sheet.naturalHeight);
      return;
    }
    ready = true;
    if (window.KELO_PLAZA_AUDIT) {
      window.KELO_PLAZA_AUDIT.version = 'V5.48';
      window.KELO_PLAZA_AUDIT.registryVersion = REGISTRY.version;
      window.KELO_PLAZA_AUDIT.depthOcclusion = true;
      window.KELO_PLAZA_AUDIT.depthOccluderCount = OCCLUDERS.length;
    }
  };
  sheet.onerror = function () { console.error('[Kelo plaza depth] atlas load failed'); };
  sheet.src = ATLAS.src + '&depth=147';

  const previousRender = window.render;
  window.render = function () {
    previousRender();
    drawFrontOccluders();
  };

  window.KELO_PLAZA_DEPTH = Object.freeze({
    sourceMode: 'y-occlusion-overlay-v1',
    occluderCount: OCCLUDERS.length,
    atlasPath: ATLAS.src
  });
})();
