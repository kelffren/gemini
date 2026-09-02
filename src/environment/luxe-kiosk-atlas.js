(function () {
  'use strict';

  // Authored raster landmark: user-provided Kelo Luxe Boutique artwork.
  // Keep this file asset-driven. Do not replace it with procedural Canvas art.
  const SHOP = Object.freeze({
    x: 1248,
    y: 1050,
    w: 384,
    h: 446,
    frontX: 1440,
    frontY: 1532,
    interactRadius: 220
  });
  const COLLISION = Object.freeze({ x: 1272, y: 1362, w: 336, h: 134 });
  const ASSET = 'assets/kelo-luxe-boutique.png?v=1';

  const img = new Image();
  let ready = false;
  let failed = false;
  let wrapped = false;

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

    const renderer = {
      __keloLuxeBoutique: true,
      draw: function (g) {
        const ok = base.draw(g);
        if (ok === true) drawBoutique(g);
        return ok;
      },
      districts: base.districts,
      chunkSize: base.chunkSize,
      get ready() { return base.ready; }
    };

    window.KELO_WORLD_RENDERER = Object.freeze(renderer);
    wrapped = true;
    return true;
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function installCollision() {
    if (typeof obstacles === 'undefined' || !Array.isArray(obstacles)) return false;

    // Remove superseded invisible plaza placeholder collisions only where the authored shop lives.
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      if (o && (o._luxeBoutiqueCollision || (o.noDraw === true && overlaps(o, COLLISION)))) {
        obstacles.splice(i, 1);
      }
    }

    obstacles.push({
      x: COLLISION.x,
      y: COLLISION.y,
      w: COLLISION.w,
      h: COLLISION.h,
      noDraw: true,
      _luxeBoutiqueCollision: true
    });
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
    const sw = gameCanvas.width || r.width;
    const sh = gameCanvas.height || r.height;
    const sx = (e.clientX - r.left) * (sw / r.width);
    const sy = (e.clientY - r.top) * (sh / r.height);
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
  }

  img.onload = function () {
    ready = true;
    failed = false;
  };
  img.onerror = function () {
    failed = true;
    console.error('[Kelo Luxe] boutique raster failed to load:', ASSET);
  };
  img.src = ASSET;

  install();
  setTimeout(install, 120);
  setTimeout(install, 600);

  window.KELO_LUXE_KIOSK = Object.freeze({
    disabled: false,
    version: 'authored-raster-v1.1',
    asset: ASSET,
    source: 'user-authored-raster',
    shop: SHOP,
    collision: COLLISION,
    interaction: 'tap-building-or-E-nearby',
    get ready() { return ready; },
    get failed() { return failed; },
    get rendererWrapped() { return wrapped; },
    open: openBoutique
  });
})();
