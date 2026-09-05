(function () {
  'use strict';

  const VERSION = 'character-appearance-v1.1.0';
  const DEFAULT_PLAYER = 'player_hero_v1';
  const DEFAULT_BOT = 'bot_crimson_v1';

  // Measured from the supplied 1024x1536 RGBA PNG at alpha >= 128.
  // Each entry anchors the actual ground-contact area instead of the 256x384 cell.
  const CRIMSON_ANCHORS = Object.freeze([
    Object.freeze([
      Object.freeze({ top: 66, bottom: 362, footX: 150.4 }),
      Object.freeze({ top: 65, bottom: 368, footX: 135.7 }),
      Object.freeze({ top: 65, bottom: 366, footX: 110.1 }),
      Object.freeze({ top: 65, bottom: 366, footX: 94.4 })
    ]),
    Object.freeze([
      Object.freeze({ top: 44, bottom: 343, footX: 135.6 }),
      Object.freeze({ top: 46, bottom: 344, footX: 121.7 }),
      Object.freeze({ top: 45, bottom: 346, footX: 106.1 }),
      Object.freeze({ top: 45, bottom: 346, footX: 91.0 })
    ]),
    Object.freeze([
      Object.freeze({ top: 16, bottom: 383, footX: 144.3 }),
      Object.freeze({ top: 15, bottom: 383, footX: 136.0 }),
      Object.freeze({ top: 15, bottom: 383, footX: 120.2 }),
      Object.freeze({ top: 15, bottom: 383, footX: 113.6 })
    ]),
    Object.freeze([
      Object.freeze({ top: 0, bottom: 299, footX: 140.2 }),
      Object.freeze({ top: 0, bottom: 307, footX: 120.1 }),
      Object.freeze({ top: 0, bottom: 307, footX: 108.3 }),
      Object.freeze({ top: 0, bottom: 311, footX: 119.6 })
    ])
  ]);

  const definitions = Object.freeze({
    player_hero_v1: Object.freeze({
      id: 'player_hero_v1',
      role: 'player',
      source: 'assets/hero.PNG',
      delegateToLegacyHero: true,
      columns: 4,
      rows: 4,
      frameWidth: 256,
      frameHeight: 384
    }),
    bot_crimson_v1: Object.freeze({
      id: 'bot_crimson_v1',
      role: 'bot',
      source: 'assets/bot-crimson-v1.png',
      delegateToLegacyHero: false,
      columns: 4,
      rows: 4,
      frameWidth: 256,
      frameHeight: 384,
      faceRows: Object.freeze({ down: 0, left: 1, right: 2, up: 3 }),
      targetBodyHeight: 86,
      rowScales: Object.freeze([0.285, 0.285, 0.235, 0.28]),
      anchors: CRIMSON_ANCHORS
    })
  });

  const runtimes = Object.create(null);
  const audit = window.KELO_CHARACTER_APPEARANCE_AUDIT = {
    version: VERSION,
    defaultPlayerId: DEFAULT_PLAYER,
    defaultBotId: DEFAULT_BOT,
    loaded: {},
    dimensions: {},
    loadErrors: {},
    drawCountByAppearance: {},
    fallbackDraws: 0,
    imageSmoothingDisabled: true,
    usesSingleImagePerAppearance: true,
    usesActorAppearanceId: true,
    normalizesVisibleBodyHeight: true,
    footAnchorPerFrame: true,
    lastDraw: null
  };

  function getDefinition(id) {
    return definitions[id] || definitions[DEFAULT_PLAYER];
  }

  function ensureRuntime(def) {
    if (!def || def.delegateToLegacyHero) return null;
    if (runtimes[def.id]) return runtimes[def.id];

    const runtime = runtimes[def.id] = { image: new Image(), ready: false, failed: false };
    runtime.image.decoding = 'async';
    runtime.image.onload = function () {
      const w = runtime.image.naturalWidth || runtime.image.width;
      const h = runtime.image.naturalHeight || runtime.image.height;
      audit.dimensions[def.id] = {
        width: w,
        height: h,
        columns: def.columns,
        rows: def.rows,
        frameWidth: w / def.columns,
        frameHeight: h / def.rows
      };
      if (w !== def.frameWidth * def.columns || h !== def.frameHeight * def.rows) {
        runtime.failed = true;
        audit.loadErrors[def.id] = 'DIMENSION_MISMATCH_' + w + 'x' + h;
        console.error('[Kelo appearance] invalid sprite dimensions', def.id, w, h);
        return;
      }
      runtime.ready = true;
      audit.loaded[def.id] = true;
    };
    runtime.image.onerror = function () {
      runtime.failed = true;
      audit.loadErrors[def.id] = 'LOAD_FAILED';
      console.error('[Kelo appearance] sprite load failed', def.id, def.source);
    };
    runtime.image.src = def.source;
    return runtime;
  }

  Object.keys(definitions).forEach(function (id) {
    const def = definitions[id];
    if (!def.delegateToLegacyHero) ensureRuntime(def);
  });

  function assign(actor, appearanceId) {
    if (!actor || !definitions[appearanceId]) return false;
    actor.appearanceId = appearanceId;
    return true;
  }

  function assignDefaults() {
    if (typeof localPlayer !== 'undefined' && localPlayer && !localPlayer.appearanceId) {
      localPlayer.appearanceId = DEFAULT_PLAYER;
      localPlayer.actorKind = localPlayer.actorKind || 'player';
    }
    if (typeof simulatedPlayers !== 'undefined' && Array.isArray(simulatedPlayers)) {
      simulatedPlayers.forEach(function (actor) {
        if (!actor) return;
        if (!actor.appearanceId) actor.appearanceId = DEFAULT_BOT;
        actor.actorKind = actor.actorKind || 'bot';
      });
    }
  }

  window.KeloCharacterAppearance = Object.freeze({
    version: VERSION,
    defaultPlayerId: DEFAULT_PLAYER,
    defaultBotId: DEFAULT_BOT,
    get: getDefinition,
    assign: assign,
    list: function () { return Object.keys(definitions); }
  });

  assignDefaults();

  if (typeof renderAvatar !== 'function') {
    audit.loadErrors.renderer = 'RENDER_AVATAR_UNAVAILABLE';
    return;
  }

  const previousRenderAvatar = renderAvatar;

  function motionOf(actor) {
    const visual = actor && actor._visualMotion;
    if (visual) {
      return {
        dx: visual.dx || 0,
        dy: visual.dy || 0,
        moving: !!visual.on,
        face: visual.face || actor._face || 'down',
        frame: Number.isFinite(visual.frame) ? visual.frame : null
      };
    }

    if (actor._appearanceLastX == null) {
      actor._appearanceLastX = actor.x;
      actor._appearanceLastY = actor.y;
    }
    const dx = actor.x - actor._appearanceLastX;
    const dy = actor.y - actor._appearanceLastY;
    const velocity = Math.hypot(actor.vx || 0, actor.vy || 0);
    const targetDistance = actor.targetX != null
      ? Math.hypot(actor.targetX - actor.x, actor.targetY - actor.y)
      : 0;
    const moving = Math.hypot(dx, dy) > 0.12 || velocity > 16 || targetDistance > 14;

    if (Math.hypot(dx, dy) > 0.12) {
      actor._appearanceMoveX = dx;
      actor._appearanceMoveY = dy;
    } else if (velocity > 16) {
      actor._appearanceMoveX = actor.vx || 0;
      actor._appearanceMoveY = actor.vy || 0;
    } else if (targetDistance > 14) {
      actor._appearanceMoveX = actor.targetX - actor.x;
      actor._appearanceMoveY = actor.targetY - actor.y;
    }

    actor._appearanceLastX = actor.x;
    actor._appearanceLastY = actor.y;

    const mx = actor._appearanceMoveX || 0;
    const my = actor._appearanceMoveY || 0;
    let face = actor._face || 'down';
    if (moving && (Math.abs(mx) > 0.01 || Math.abs(my) > 0.01)) {
      const side = Math.abs(mx) * 1.15 >= Math.abs(my);
      face = side ? (mx >= 0 ? 'right' : 'left') : (my >= 0 ? 'down' : 'up');
      actor._face = face;
    }
    return { dx: mx, dy: my, moving: moving, face: face, frame: null };
  }

  function frameColumn(actor, motion, def) {
    if (!motion.moving) return 0;
    if (motion.frame != null) return Math.abs(Math.floor(motion.frame)) % def.columns;
    const id = String((actor && actor.id) || 'bot');
    let phase = 0;
    for (let i = 0; i < id.length; i++) phase += id.charCodeAt(i);
    return Math.floor((Date.now() + phase * 23) / 130) % def.columns;
  }

  function footRootOf(actor, face) {
    if (window.KELO_AVATAR_PRESENTATION && typeof window.KELO_AVATAR_PRESENTATION.get === 'function') {
      const layout = window.KELO_AVATAR_PRESENTATION.get(actor, face);
      return { x: layout.footRootX, y: layout.footRootY };
    }
    return { x: actor.x, y: actor.y + 10 };
  }

  renderAvatar = function (actor, isSelf) {
    if (!actor) return previousRenderAvatar(actor, isSelf);
    const def = getDefinition(actor.appearanceId);
    if (!def || def.delegateToLegacyHero) return previousRenderAvatar(actor, isSelf);

    const runtime = ensureRuntime(def);
    if (!runtime || !runtime.ready || runtime.failed) {
      audit.fallbackDraws += 1;
      return previousRenderAvatar(actor, isSelf);
    }

    const motion = motionOf(actor);
    const face = def.faceRows[motion.face] == null ? 'down' : motion.face;
    const row = def.faceRows[face];
    const col = frameColumn(actor, motion, def);
    const anchor = def.anchors[row][col];
    const visibleBodyHeight = Math.max(1, anchor.bottom - anchor.top + 1);
    const scale = def.rowScales[row];
    const dw = def.frameWidth * scale;
    const dh = def.frameHeight * scale;
    const foot = footRootOf(actor, face);

    // The actual boot contact point is mapped to the actor foot root. The transparent
    // cell margins never participate in depth or apparent scale.
    const dx = Math.round(foot.x - anchor.footX * scale);
    const dy = Math.round(foot.y - (anchor.bottom + 1) * scale);
    const sx = col * def.frameWidth;
    const sy = row * def.frameHeight;

    ctx.save();
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      runtime.image,
      sx, sy, def.frameWidth, def.frameHeight,
      dx, dy, Math.round(dw), Math.round(dh)
    );
    ctx.imageSmoothingEnabled = previousSmoothing;
    ctx.restore();

    ctx.save();
    ctx.fillStyle = isSelf ? '#e7c56a' : '#f3eee4';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    const visibleWorldHeight = visibleBodyHeight * scale;
    ctx.fillText(actor.name || 'Kelo', Math.round(foot.x), Math.round(foot.y - Math.max(def.targetBodyHeight, visibleWorldHeight) - 7));
    ctx.restore();

    audit.drawCountByAppearance[def.id] = (audit.drawCountByAppearance[def.id] || 0) + 1;
    audit.lastDraw = {
      actorId: actor.id || null,
      appearanceId: def.id,
      face: face,
      frame: col,
      sourceRect: [sx, sy, def.frameWidth, def.frameHeight],
      destinationRect: [dx, dy, Math.round(dw), Math.round(dh)],
      footRoot: [foot.x, foot.y],
      sourceFootAnchor: [anchor.footX, anchor.bottom + 1],
      visibleBodyHeightPx: visibleBodyHeight,
      targetBodyHeightWorldPx: def.targetBodyHeight,
      visibleBodyHeightWorldPx: visibleWorldHeight,
      sourceScale: scale
    };
  };
})();
