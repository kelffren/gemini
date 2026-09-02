(function () {
  'use strict';

  const REGISTRY = window.KELO_TILE_REGISTRY;
  const ARCH = REGISTRY?.architectureAssets?.luxeBoutique;
  if (!REGISTRY || !ARCH) {
    console.error('[Kelo Luxe] architecture registry entry missing');
    return;
  }

  // Authored raster landmark: user-provided Kelo Luxe Boutique artwork.
  // Keep this file asset-driven. Do not replace it with procedural Canvas art.
  const SHOP = Object.freeze({
    x: 1248,
    y: 1050,
    w: ARCH.worldWidth,
    h: ARCH.worldHeight,
    frontX: 1440,
    frontY: 1532,
    interactRadius: 220
  });
  const COLLISION = Object.freeze({ x: 1272, y: 1362, w: 336, h: 132 });
  const ASSET = ARCH.src;

  const img = new Image();
  let ready = false;
  let failed = false;
  let wrapped = false;
  let depthWrapped = false;

  function drawBoutique(g) {
    if (!ready) return;
    g.save();
    g.imageSmoothingEnabled = false;
    g.drawImage(img, SHOP.x, SHOP.y, SHOP.w, SHOP.h);
    g.restore();
  }

  function installWorldLayer() {
    const base = window.KELO_WORLD_RENDERER;
    if (!base || typeof base.draw !== 'function') return false;
    if (base.__keloLuxeBoutique) {
      wrapped = true;
      return true;
    }
    window.KELO_WORLD_RENDERER = Object.freeze({
      __keloLuxeBoutique: true,
      draw: function (g) {
        const ok = base.draw(g);
        if (ok === true) drawBoutique(g);
        return ok;
      },
      districts: base.districts,
      chunkSize: base.chunkSize,
      get ready() { return base.ready; }
    });
    wrapped = true;
    return true;
  }

  function actorBehindShop(actor) {
    if (!actor) return false;
    const r = actor.radius || 20;
    return actor.x + r > SHOP.x + 18 && actor.x - r < SHOP.x + SHOP.w - 18 &&
      actor.y > SHOP.y + 76 && actor.y < COLLISION.y + 6;
  }

  function drawActorOcclusion(g, actor) {
    if (!ready || !actorBehindShop(actor)) return false;
    const r = actor.radius || 20;
    g.save();
    g.beginPath();
    // Repaint only the actor-sized window of the authored building. This keeps
    // other actors in front of the facade while correctly hiding this actor behind it.
    g.rect(actor.x - r - 16, actor.y - r - 50, r * 2 + 32, r * 2 + 66);
    g.clip();
    drawBoutique(g);
    g.restore();
    return true;
  }

  function installDepthLayer() {
    if (depthWrapped || typeof window.render !== 'function') return depthWrapped;
    const baseRender = window.render;
    if (baseRender.__keloLuxeDepth) { depthWrapped = true; return true; }
    const layeredRender = function () {
      baseRender();
      if (!ready || typeof ctx === 'undefined' || typeof camera === 'undefined' || typeof screenW === 'undefined' || typeof screenH === 'undefined') return;
      const actors = [];
      if (typeof localPlayer !== 'undefined' && localPlayer) actors.push(localPlayer);
      if (typeof simulatedPlayers !== 'undefined' && Array.isArray(simulatedPlayers)) actors.push(...simulatedPlayers);
      const active = actors.filter(actorBehindShop);
      if (!active.length) return;
      const z = (typeof CONFIG !== 'undefined' && CONFIG.zoom) || 1;
      ctx.save();
      ctx.translate(screenW / 2, screenH / 2);
      ctx.scale(z, z);
      ctx.translate(-camera.x, -camera.y);
      ctx.imageSmoothingEnabled = false;
      active.forEach(actor => drawActorOcclusion(ctx, actor));
      ctx.restore();
    };
    layeredRender.__keloLuxeDepth = true;
    window.render = layeredRender;
    depthWrapped = true;
    return true;
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function installCollision() {
    if (typeof obstacles === 'undefined' || !Array.isArray(obstacles)) return false;
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      if (o && (o._luxeBoutiqueCollision || (o.noDraw === true && overlaps(o, COLLISION)))) obstacles.splice(i, 1);
    }
    obstacles.push({ x: COLLISION.x, y: COLLISION.y, w: COLLISION.w, h: COLLISION.h, noDraw: true, _luxeBoutiqueCollision: true });
    return true;
  }

  function nearShop() {
    if (typeof localPlayer === 'undefined' || !localPlayer) return false;
    return Math.hypot(localPlayer.x - SHOP.frontX, localPlayer.y - SHOP.frontY) <= SHOP.interactRadius;
  }

  function openBoutique() {
    if (!nearShop()) {
      if (typeof showToast === 'function') showToast('Acércate a Kelo Luxe');
      return false;
    }
    if (window.KELO_BOUTIQUE && typeof window.KELO_BOUTIQUE.open === 'function') {
      window.KELO_BOUTIQUE.open();
      if (typeof showToast === 'function') showToast('Kelo Luxe Boutique');
      return true;
    }
    if (typeof showToast === 'function') showToast('Boutique cargando…');
    return false;
  }

  function pointerToWorld(e) {
    const gameCanvas = document.getElementById('game-canvas');
    if (!gameCanvas || typeof screenToWorld !== 'function') return null;
    const r = gameCanvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const sx = (e.clientX - r.left) * ((gameCanvas.width || r.width) / r.width);
    const sy = (e.clientY - r.top) * ((gameCanvas.height || r.height) / r.height);
    return screenToWorld(sx, sy);
  }

  function insideShop(p) {
    return !!p && p.x >= SHOP.x && p.x <= SHOP.x + SHOP.w && p.y >= SHOP.y && p.y <= SHOP.y + SHOP.h;
  }

  function installInteraction() {
    const gameCanvas = document.getElementById('game-canvas');
    if (gameCanvas && !gameCanvas._keloLuxeBoutiqueTap) {
      gameCanvas._keloLuxeBoutiqueTap = true;
      gameCanvas.addEventListener('pointerdown', function (e) {
        const p = pointerToWorld(e);
        if (!insideShop(p)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        openBoutique();
      }, true);
    }
    if (!window._keloLuxeBoutiqueKey) {
      window._keloLuxeBoutiqueKey = true;
      window.addEventListener('keydown', function (e) {
        if ((e.key || '').toLowerCase() !== 'e') return;
        const active = document.activeElement;
        if (active && /INPUT|TEXTAREA/.test(active.tagName || '')) return;
        if (nearShop()) openBoutique();
      });
    }
  }

  function install() {
    installWorldLayer();
    installCollision();
    installInteraction();
    installDepthLayer();
  }

  img.onload = function () { ready = true; failed = false; };
  img.onerror = function () { failed = true; console.error('[Kelo Luxe] boutique raster failed to load:', ASSET); };
  img.src = ASSET;

  install();
  setTimeout(install, 120);
  setTimeout(install, 600);

  window.KELO_LUXE_KIOSK = Object.freeze({
    disabled: false,
    version: 'authored-raster-v1.4',
    asset: ASSET,
    source: 'tile-registry-architecture-asset',
    shop: SHOP,
    collision: COLLISION,
    interaction: 'tap-building-or-E-nearby',
    depthMode: REGISTRY.styles.architecture.depthMode,
    depthOcclusion: true,
    isOccluding: actorBehindShop,
    get ready() { return ready; },
    get failed() { return failed; },
    get rendererWrapped() { return wrapped; },
    get depthWrapped() { return depthWrapped; },
    open: openBoutique
  });
})();