(function () {
  const raw = new Image();
  raw.decoding = 'async';
  if ('fetchPriority' in raw) raw.fetchPriority = 'high';
  let sheet = null, ok = false, FW = 256, FH = 384;
  const COLS = 4;
  const ROWS = 4;
  const FOOT_ROOT_OFFSET_Y = 10;
  const HERO_AUDIT = window.KELO_HERO_SPRITE_AUDIT = {
    version: 'hero-preprocess-audit-v1',
    source: 'assets/hero.PNG',
    loaded: false,
    processed: false,
    sheetWidth: 0,
    sheetHeight: 0,
    frameWidth: 0,
    frameHeight: 0,
    nearWhitePixelCount: 0,
    whiteKnockoutAffectedPixelCount: 0,
    whiteKnockoutOpaquePixelCount: 0,
    whiteKnockoutOpaqueLossPct: 0,
    croppedOpaquePixelCount: 0,
    croppedOpaquePixelCountByFrame: [],
    sheetMutationAfterIdle: false,
    preprocessMs: 0,
    error: null
  };

  function useRawSheet() {
    sheet = raw;
    FW = raw.width / COLS;
    FH = raw.height / ROWS;
    ok = true;
    HERO_AUDIT.loaded = true;
    HERO_AUDIT.sheetWidth = raw.width;
    HERO_AUDIT.sheetHeight = raw.height;
    HERO_AUDIT.frameWidth = FW;
    HERO_AUDIT.frameHeight = FH;
  }

  function knockWhite() {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    try {
      const c = document.createElement('canvas');
      c.width = raw.width;
      c.height = raw.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(raw, 0, 0);
      const data = g.getImageData(0, 0, c.width, c.height);
      const d = data.data;
      const padX = Math.max(2, FW * 0.05);
      const padY = Math.max(2, FH * 0.04);
      const cropByFrame = new Array(COLS * ROWS).fill(0);
      let nearWhite = 0;
      let affected = 0;
      let affectedOpaque = 0;
      let opaqueTotal = 0;
      let croppedOpaque = 0;

      for (let y = 0; y < c.height; y++) {
        const row = Math.min(ROWS - 1, Math.floor(y / FH));
        const localY = y - row * FH;
        for (let x = 0; x < c.width; x++) {
          const col = Math.min(COLS - 1, Math.floor(x / FW));
          const localX = x - col * FW;
          const i = (y * c.width + x) * 4;
          const alpha = d[i + 3];
          const isNearWhite = d[i] > 232 && d[i + 1] > 232 && d[i + 2] > 232;
          if (alpha > 0) opaqueTotal += 1;
          if (isNearWhite) nearWhite += 1;
          if (alpha > 0 && (localX < padX || localX >= FW - padX || localY < padY || localY >= FH - padY)) {
            const frameIndex = row * COLS + col;
            cropByFrame[frameIndex] += 1;
            croppedOpaque += 1;
          }
          if (isNearWhite) {
            affected += 1;
            if (alpha > 0) affectedOpaque += 1;
            d[i + 3] = 0;
          }
        }
      }
      g.putImageData(data, 0, 0);
      sheet = c;
      HERO_AUDIT.processed = true;
      HERO_AUDIT.nearWhitePixelCount = nearWhite;
      HERO_AUDIT.whiteKnockoutAffectedPixelCount = affected;
      HERO_AUDIT.whiteKnockoutOpaquePixelCount = affectedOpaque;
      HERO_AUDIT.whiteKnockoutOpaqueLossPct = opaqueTotal ? affectedOpaque / opaqueTotal * 100 : 0;
      HERO_AUDIT.croppedOpaquePixelCount = croppedOpaque;
      HERO_AUDIT.croppedOpaquePixelCountByFrame = cropByFrame;
      HERO_AUDIT.sheetMutationAfterIdle = affected > 0;
    } catch (e) {
      HERO_AUDIT.error = String(e && e.message ? e.message : e);
    }
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    HERO_AUDIT.preprocessMs = Math.max(0, t1 - t0);
  }

  raw.onload = function () {
    useRawSheet();
    const later = function () { knockWhite(); };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(later, { timeout: 900 });
    else setTimeout(later, 0);
  };
  raw.onerror = function () {
    HERO_AUDIT.error = 'production sprite load failed';
    console.error('[Kelo hero] production sprite load failed');
  };
  raw.src = 'assets/hero.PNG';

  function legacyMovingOf(p) {
    if (p._lx == null) { p._lx = p.x; p._ly = p.y; }
    const dx = p.x - p._lx;
    const dy = p.y - p._ly;
    const dist = Math.hypot(dx, dy);
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    const toTarget = (p.targetX != null)
      ? Math.hypot((p.targetX - p.x), (p.targetY - p.y))
      : 0;
    if (dist > 0.12 || spd > 16 || toTarget > 14) p._walkHold = 10;
    else if (p._walkHold) p._walkHold -= 1;
    if (dist > 0.12) {
      p._mdx = dx;
      p._mdy = dy;
    } else if (spd > 16) {
      p._mdx = p.vx;
      p._mdy = p.vy;
    } else if (toTarget > 14) {
      p._mdx = p.targetX - p.x;
      p._mdy = p.targetY - p.y;
    }
    p._lx = p.x;
    p._ly = p.y;
    return { dx: p._mdx || 0, dy: p._mdy || 0, on: (p._walkHold || 0) > 0 };
  }

  function motionOf(p) {
    const v = p && p._visualMotion;
    if (v) return { dx: v.dx || 0, dy: v.dy || 0, on: !!v.on, face: v.face || p._face || 'down', frame: v.frame || 0 };
    const m = legacyMovingOf(p);
    m.face = p._face || 'down';
    m.frame = null;
    return m;
  }

  function faceOf(p, m) {
    if (m.face) return m.face;
    if (!m.on) return p._face || 'down';
    const side = Math.abs(m.dx) * 1.15 >= Math.abs(m.dy);
    const f = side ? (m.dx >= 0 ? 'right' : 'left') : (m.dy >= 0 ? 'down' : 'up');
    p._face = f;
    return f;
  }

  function stepCol(p, m) {
    if (!m.on) return 0;
    if (m.frame != null) return m.frame % COLS;
    return Math.floor(Date.now() / 130) % COLS;
  }

  function presentationOf(p, face) {
    const side = face === 'left' || face === 'right';
    const visualWidth = side ? 48 : 54;
    const visualHeight = Math.round(54 * (FH / FW));
    const physicsRootX = p.x;
    const physicsRootY = p.y;
    const footRootX = p.x;
    const footRootY = p.y + FOOT_ROOT_OFFSET_Y;
    return {
      physicsRootX, physicsRootY,
      colliderRadius: p.radius,
      footRootX, footRootY,
      depthRootX: footRootX, depthRootY: footRootY,
      shadowAnchorX: footRootX, shadowAnchorY: footRootY,
      visualWidth, visualHeight,
      visualLeft: footRootX - visualWidth / 2,
      visualTop: footRootY - visualHeight,
      visualRight: footRootX + visualWidth / 2,
      visualBottom: footRootY,
      nameplateAnchorX: footRootX,
      nameplateAnchorY: footRootY - visualHeight - 6
    };
  }

  window.KELO_AVATAR_PRESENTATION = Object.freeze({
    version: 'foot-root-v1',
    footRootOffsetY: FOOT_ROOT_OFFSET_Y,
    get: function (p, face) { return presentationOf(p, face || (p && p._face) || 'down'); }
  });

  const _av = renderAvatar;
  renderAvatar = function (p, isSelf) {
    if (!ok || !p || !sheet) return _av(p, isSelf);
    const m = motionOf(p);
    const face = faceOf(p, m);
    const col = stepCol(p, m);
    const side = face === 'left' || face === 'right';
    const row = face === 'up' ? 3 : (face === 'down' ? 0 : 2);
    const padX = Math.max(2, FW * 0.05);
    const padY = Math.max(2, FH * 0.04);
    const layout = presentationOf(p, face);
    const dw = layout.visualWidth;
    const dh = layout.visualHeight;
    const footY = layout.footRootY;
    ctx.save();
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (face === 'left') {
      ctx.translate(p.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-p.x, 0);
    }
    ctx.drawImage(
      sheet,
      col * FW + padX, row * FH + padY, FW - padX * 2, FH - padY * 2,
      Math.round(p.x - dw / 2), Math.round(footY - dh),
      dw, dh
    );
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.restore();
    ctx.save();
    ctx.fillStyle = isSelf ? '#e7c56a' : '#f3eee4';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || 'Kelo', Math.round(layout.nameplateAnchorX), Math.round(layout.nameplateAnchorY));
    ctx.restore();
  };
})();
