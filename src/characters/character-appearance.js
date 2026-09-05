(function () {
  'use strict';

  const VERSION = 'character-appearance-v1.0.0';
  const DEFAULT_PLAYER = 'player_hero_v1';
  const DEFAULT_BOT = 'bot_crimson_v1';

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
      mirrorFaces: Object.freeze({ down: false, left: false, right: false, up: false }),
      sourceInsets: Object.freeze({ left: 0, top: 0, right: 0, bottom: 0 })
    })
  });

  const runtimes = Object.create(null);
  const audit = window.KELO_CHARACTER_APPEARANCE_AUDIT = {
    version: VERSION,
    defaultPlayerId: DEFAULT_PLAYER,
    defaultBotId: DEFAULT_BOT,
    assignedPlayers: 0,
    assignedBots: 0,
    loaded: {},
    dimensions: {},
    loadErrors: {},
    drawCountByAppearance: {},
    fallbackDraws: 0,
    imageSmoothingDisabled: true,
    usesSingleImagePerAppearance: true,
    usesActorAppearanceId: true,
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
      audit.dimensions[def.id] = { width: w, height: h, frameWidth: w / def.columns, frameHeight: h / def.rows };
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

  function assignDefaults() {
    if (typeof localPlayer !== 'undefined' && localPlayer) {
      if (!localPlayer.appearanceId) localPlayer.appearanceId = DEFAULT_PLAYER;
      if (!localPlayer.actorKind) localPlayer.actorKind = 'player';
      audit.assignedPlayers = 1;
    }
    if (typeof simulatedPlayers !== 'undefined' && Array.isArray(simulatedPlayers)) {
      simulatedPlayers.forEach(function (actor) {
        if (!actor) return;
        if (!actor.appearanceId) actor.appearanceId = DEFAULT_BOT;
        if (!actor.actorKind) actor.actorKind = 'bot';
      });
      audit.assignedBots = simulatedPlayers.length;
    }
  }

  function assign(actor, appearanceId) {
    if (!actor || !definitions[appearanceId]) return false;
    actor.appearanceId = appearanceId;
    return true;
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
    const targetDistance = actor.targetX != null ? Math.hypot(actor.targetX - actor.x, actor.targetY - actor.y) : 0;
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
    const phase = actor && actor.id ? Array.from(String(actor.id)).reduce(function (sum, ch) { return sum + ch.charCodeAt(0); }, 0) : 0;
    return Math.floor((Date.now() + phase * 23) / 130) % def.columns;
  }

  function fallbackPresentation(actor, face) {
    const side = face === 'left' || face === 'right';
    const width = side ? 55 : 62;
    const height = 93;
    const footY = actor.y + 10;
    return {
      footRootX: actor.x,
      footRootY: footY,
      depthRootX: actor.x,
      depthRootY: footY,
      visualWidth: width,
      visualHeight: height,
      nameplateAnchorX: actor.x,
      nameplateAnchorY: footY - height - 6
    };
  }

  function presentationOf(actor, face) {
    if (window.KELO_AVATAR_PRESENTATION && typeof window.KELO_AVATAR_PRESENTATION.get === 'function') {
      return window.KELO_AVATAR_PRESENTATION.get(actor, face);
    }
    return fallbackPresentation(actor, face);
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
    const inset = def.sourceInsets || { left: 0, top: 0, right: 0, bottom: 0 };
    const sx = col * def.frameWidth + inset.left;
    const sy = row * def.frameHeight + inset.top;
    const sw = def.frameWidth - inset.left - inset.right;
    const sh = def.frameHeight - inset.top - inset.bottom;
    const layout = presentationOf(actor, face);
    const dw = Math.round(layout.visualWidth);
    const dh = Math.round(layout.visualHeight);
    const dx = Math.round(layout.footRootX - dw / 2);
    const dy = Math.round(layout.footRootY - dh);

    ctx.save();
    const previousSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (def.mirrorFaces && def.mirrorFaces[face]) {
      ctx.translate(Math.round(layout.footRootX), 0);
      ctx.scale(-1, 1);
      ctx.translate(-Math.round(layout.footRootX), 0);
    }
    ctx.drawImage(runtime.image, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.imageSmoothingEnabled = previousSmoothing;
    ctx.restore();

    ctx.save();
    ctx.fillStyle = isSelf ? '#e7c56a' : '#f3eee4';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(actor.name || 'Kelo', Math.round(layout.nameplateAnchorX), Math.round(layout.nameplateAnchorY));
    ctx.restore();

    audit.drawCountByAppearance[def.id] = (audit.drawCountByAppearance[def.id] || 0) + 1;
    audit.lastDraw = {
      actorId: actor.id || null,
      appearanceId: def.id,
      face: face,
      frame: col,
      sourceRect: [sx, sy, sw, sh],
      destinationRect: [dx, dy, dw, dh],
      footRoot: [layout.footRootX, layout.footRootY]
    };
  };
})();
