/* KELO-INDEX
 * area: VISUAL
 * keys: VFX ANIMATION SEQUENCE EVENTBUS LAYERS AUDIT CONTEXT ONLINE
 * hace: núcleo desacoplado de visuales; orquesta update/render por capas y eventos semánticos sin poseer gameplay
 * online: serializa solo contexto/eventos visuales; autoridad de daño/cooldown/inventario queda fuera
 */
(function (root) {
  'use strict';

  const VERSION = 'visual-system-v1.0.0';
  const WORLD_LAYERS = Object.freeze(['groundFX', 'belowActor', 'worldFX', 'foregroundFX']);
  const ACTOR_LAYERS = Object.freeze(['actorBackFX', 'actorFrontFX']);
  const SCREEN_LAYERS = Object.freeze(['screenFX', 'UI']);
  const listeners = new Map();

  const audit = root.KELO_VISUAL_AUDIT = {
    version: VERSION,
    ready: true,
    integrationReady: false,
    abilityResolverEnabled: false,
    loadedAssets: 0,
    activeClips: 0,
    activeFX: 0,
    activeProjectiles: 0,
    activeSequences: 0,
    pooledInstances: 0,
    drawnFX: 0,
    culledFX: 0,
    missingAssets: [],
    quality: 'HIGH',
    lastEvent: null,
    actorBridgeWrapped: false,
    updateBridgeWrapped: false,
    renderHooks: Object.freeze({ world: WORLD_LAYERS.slice(), actor: ACTOR_LAYERS.slice(), screen: SCREEN_LAYERS.slice() })
  };

  function on(name, fn) {
    const key = String(name || '');
    if (!key || typeof fn !== 'function') return function () {};
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    return function () { const set = listeners.get(key); if (set) set.delete(fn); };
  }

  function emit(name, payload) {
    const key = String(name || '');
    audit.lastEvent = { name: key, castId: payload && payload.castId || null, abilityId: payload && payload.abilityId || null };
    const set = listeners.get(key);
    if (!set) return;
    set.forEach(function (fn) {
      try { fn(payload || {}); }
      catch (error) { console.error('[Kelo visual event]', key, error); }
    });
  }

  function vec(value) {
    if (!value || !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) return null;
    return { x: Number(value.x), y: Number(value.y) };
  }

  function actorIdOf(actor) {
    if (!actor) return null;
    return String(actor.id || actor.playerKey || actor._keloVisualActorId || 'actor');
  }

  function resolveActor(actorId) {
    const id = actorId == null ? null : String(actorId);
    if (!id) return null;
    try {
      if (typeof localPlayer !== 'undefined' && localPlayer && actorIdOf(localPlayer) === id) return localPlayer;
      if (typeof simulatedPlayers !== 'undefined' && Array.isArray(simulatedPlayers)) {
        const sim = simulatedPlayers.find(function (actor) { return actor && actorIdOf(actor) === id; });
        if (sim) return sim;
      }
    } catch (e) {}
    const peers = root.keloNet && root.keloNet.peers;
    return peers && peers[id] || null;
  }

  function normalizeContext(raw) {
    const input = raw || {};
    const actor = input.actor || resolveActor(input.actorId);
    const actorId = input.actorId != null ? String(input.actorId) : actorIdOf(actor);
    const origin = vec(input.origin) || (actor && Number.isFinite(actor.x) && Number.isFinite(actor.y) ? { x: actor.x, y: actor.y } : null);
    const target = vec(input.target) || vec(input.position);
    const direction = vec(input.direction);
    const gameplay = input.gameplay && typeof input.gameplay === 'object' ? Object.assign({}, input.gameplay) : {};
    const visual = input.visual && typeof input.visual === 'object' ? Object.assign({}, input.visual) : {};
    if (!Number.isFinite(Number(visual.scale))) visual.scale = 1;
    if (!Number.isFinite(Number(visual.seed))) visual.seed = 0;
    return {
      actorId: actorId,
      actor: actor || null,
      castId: input.castId == null ? null : String(input.castId),
      abilityId: input.abilityId == null ? null : Number(input.abilityId),
      abilityKey: input.abilityKey == null ? null : String(input.abilityKey),
      origin: origin,
      target: target,
      direction: direction,
      gameplay: gameplay,
      visual: visual,
      projectileId: input.projectileId == null ? null : String(input.projectileId),
      statusId: input.statusId == null ? null : String(input.statusId),
      source: input.source || null,
      predicted: input.predicted === true,
      confirmed: input.confirmed === true,
      rejected: input.rejected === true,
      remote: input.remote === true,
      serverTime: Number.isFinite(Number(input.serverTime)) ? Number(input.serverTime) : null
    };
  }

  function serializableContext(raw) {
    const c = normalizeContext(raw);
    return {
      actorId: c.actorId,
      castId: c.castId,
      abilityId: c.abilityId,
      abilityKey: c.abilityKey,
      origin: c.origin,
      target: c.target,
      direction: c.direction,
      gameplay: c.gameplay,
      visual: c.visual,
      projectileId: c.projectileId,
      statusId: c.statusId,
      predicted: c.predicted,
      confirmed: c.confirmed,
      rejected: c.rejected,
      serverTime: c.serverTime
    };
  }

  function qualityName() {
    const perf = root.KELO_PERF;
    const id = perf && perf.profile && perf.profile.id;
    if (id === 'performance') return 'LOW';
    if (id === 'medium') return 'MEDIUM';
    return 'HIGH';
  }

  function syncAudit() {
    audit.quality = qualityName();
    const assets = root.KeloAssetRegistry && root.KeloAssetRegistry.metrics ? root.KeloAssetRegistry.metrics() : null;
    const animation = root.KeloAnimation && root.KeloAnimation.metrics ? root.KeloAnimation.metrics() : null;
    const fx = root.KeloFX && root.KeloFX.metrics ? root.KeloFX.metrics() : null;
    const projectiles = root.KeloProjectileVisuals && root.KeloProjectileVisuals.metrics ? root.KeloProjectileVisuals.metrics() : null;
    const sequences = root.KeloSequence && root.KeloSequence.metrics ? root.KeloSequence.metrics() : null;
    if (assets) {
      audit.loadedAssets = assets.loaded;
      audit.missingAssets = assets.missing.slice();
    }
    audit.activeClips = animation ? animation.active : 0;
    audit.activeFX = fx ? fx.active : 0;
    audit.activeProjectiles = projectiles ? projectiles.active : 0;
    audit.activeSequences = sequences ? sequences.active : 0;
    audit.pooledInstances = (fx ? fx.pooled : 0) + (projectiles ? projectiles.pooled : 0);
    audit.drawnFX = (fx ? fx.drawn : 0) + (projectiles ? projectiles.drawn : 0);
    audit.culledFX = (fx ? fx.culled : 0) + (projectiles ? projectiles.culled : 0);
  }

  // KELO-INDEX VISUAL/UPDATE avanza únicamente presentación; nunca daño, cooldown, inventario o física.
  function update(dt) {
    const delta = Math.max(0, Math.min(0.1, Number(dt) || 0));
    if (root.KeloAnimation && typeof root.KeloAnimation.update === 'function') root.KeloAnimation.update(delta);
    if (root.KeloSequence && typeof root.KeloSequence.update === 'function') root.KeloSequence.update(delta);
    if (root.KeloFX && typeof root.KeloFX.update === 'function') root.KeloFX.update(delta);
    if (root.KeloProjectileVisuals && typeof root.KeloProjectileVisuals.update === 'function') root.KeloProjectileVisuals.update(delta);
    if (root.KeloScreenFX && typeof root.KeloScreenFX.update === 'function') root.KeloScreenFX.update(delta);
    syncAudit();
  }

  function renderWorldLayer(layer, g) {
    if (WORLD_LAYERS.indexOf(layer) < 0 || !g) return;
    if (root.KeloFX && typeof root.KeloFX.drawLayer === 'function') root.KeloFX.drawLayer(layer, g);
    if (root.KeloProjectileVisuals && typeof root.KeloProjectileVisuals.drawLayer === 'function') root.KeloProjectileVisuals.drawLayer(layer, g);
  }

  function renderActorLayer(layer, actor, g) {
    if (ACTOR_LAYERS.indexOf(layer) < 0 || !actor || !g) return;
    if (root.KeloFX && typeof root.KeloFX.drawActorLayer === 'function') root.KeloFX.drawActorLayer(layer, actor, g);
  }

  function renderScreenLayer(layer, g) {
    if (SCREEN_LAYERS.indexOf(layer) < 0 || !g) return;
    if (root.KeloFX && typeof root.KeloFX.drawLayer === 'function') root.KeloFX.drawLayer(layer, g);
    if (layer === 'screenFX' && root.KeloScreenFX && typeof root.KeloScreenFX.draw === 'function') root.KeloScreenFX.draw(g);
  }

  root.KeloVisualEventBus = Object.freeze({ on: on, emit: emit });
  root.KeloVisualContext = Object.freeze({ normalize: normalizeContext, serialize: serializableContext, resolveActor: resolveActor, actorIdOf: actorIdOf });
  root.KeloVisualSystem = Object.freeze({
    version: VERSION,
    worldLayers: WORLD_LAYERS,
    actorLayers: ACTOR_LAYERS,
    screenLayers: SCREEN_LAYERS,
    update: update,
    renderWorldLayer: renderWorldLayer,
    renderActorLayer: renderActorLayer,
    renderScreenLayer: renderScreenLayer,
    syncAudit: syncAudit,
    get quality() { return qualityName(); }
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
