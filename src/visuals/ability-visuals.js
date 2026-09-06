/* KELO-INDEX
 * area: VISUAL
 * keys: ABILITY PROFILE CAST PROJECTILE IMPACT STATUS PREDICTION REMOTE LEGACY ADAPTER AIM
 * hace: resuelve eventos de ability a perfiles visuales opcionales y adapta el runtime actual sin meter visuales en StoneSystem
 * online: local y remoto terminan en los mismos eventos semánticos; no decide daño/cooldown/validez
 */
(function (root) {
  'use strict';

  const manifests = root.KELO_VISUAL_MANIFESTS;
  const bus = root.KeloVisualEventBus;
  const ctxApi = root.KeloVisualContext;
  if (!manifests || !bus || !ctxApi) {
    console.error('[Kelo ability visuals] visual core unavailable');
    return;
  }

  const profiles = new Map();
  const profileByAbilityKey = new Map();
  const activeProjectileVisuals = new Map();
  const activeStatusVisuals = new Map();
  const activeCastSequences = new Map();
  const activeCastByAbility = new Map();
  const pendingBySlot = new Map();
  const maskedLegacyColors = new Map();
  let enabled = true;
  let fallbackSeq = 1;
  let pointerAim = null;

  function register(def) {
    if (!def || !def.id) throw new Error('INVALID_ABILITY_VISUAL_PROFILE');
    const id = String(def.id);
    if (profiles.has(id)) throw new Error('DUPLICATE_ABILITY_VISUAL_PROFILE_' + id);
    const frozen = Object.freeze(Object.assign({}, def, { id: id }));
    profiles.set(id, frozen);
    if (def.abilityKey) profileByAbilityKey.set(String(def.abilityKey), frozen);
    return id;
  }
  Object.keys(manifests.visualProfiles || {}).forEach(function (id) { register(manifests.visualProfiles[id]); });

  function get(id) { return profiles.get(String(id || '')) || null; }
  function list() { return Array.from(profiles.values()); }

  function abilityDef(abilityId, abilityKey) {
    const registry = root.KeloAbilities && root.KeloAbilities.registry;
    if (registry) {
      if (abilityId != null && typeof registry.getById === 'function') {
        const byId = registry.getById(Number(abilityId)); if (byId) return byId;
      }
      if (abilityKey && typeof registry.getByKey === 'function') {
        const byKey = registry.getByKey(String(abilityKey)); if (byKey) return byKey;
      }
    }
    const defs = root.ABILITIES || [];
    return defs.find(function (def) { return (abilityId != null && Number(def.id) === Number(abilityId)) || (abilityKey && def.key === abilityKey); }) || null;
  }

  function resolveProfile(abilityId, abilityKey) {
    const def = abilityDef(abilityId, abilityKey);
    if (def && def.visualProfileId && profiles.has(def.visualProfileId)) return profiles.get(def.visualProfileId);
    const key = abilityKey || def && def.key;
    return key && profileByAbilityKey.get(String(key)) || null;
  }

  function hasProfile(abilityOrDef) {
    if (!abilityOrDef) return false;
    if (typeof abilityOrDef === 'object') return !!resolveProfile(abilityOrDef.id, abilityOrDef.key);
    if (Number.isFinite(Number(abilityOrDef))) return !!resolveProfile(Number(abilityOrDef), null);
    return !!resolveProfile(null, String(abilityOrDef));
  }

  function shouldUseLegacy(abilityOrDef) { return !enabled || !hasProfile(abilityOrDef); }

  function normalizedEvent(payload) {
    const raw = payload && payload.context ? Object.assign({}, payload.context, payload) : Object.assign({}, payload || {});
    if (!raw.actor && raw.playerId) raw.actorId = raw.actorId || raw.playerId;
    if (!raw.actor && raw.actorId) raw.actor = ctxApi.resolveActor(raw.actorId);
    return ctxApi.normalize(raw);
  }

  function playCue(abilityId, cue, context) {
    const c = ctxApi.normalize(Object.assign({}, context || {}, { abilityId: abilityId != null ? abilityId : context && context.abilityId }));
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (!enabled || !profile) return null;
    if (cue === 'cast' && profile.castSequence && root.KeloSequence) return root.KeloSequence.play(profile.castSequence, c);
    if (cue === 'impact' && profile.impactSequence && root.KeloSequence) return root.KeloSequence.play(profile.impactSequence, c);
    if (cue === 'projectile' && profile.projectileVisual && root.KeloProjectileVisuals) return root.KeloProjectileVisuals.preview(profile.projectileVisual, c, { speed: c.gameplay.speed, maxDistance: c.gameplay.range });
    const ref = profile[cue];
    if (ref && root.KeloFX) return root.KeloFX.spawn(ref, c);
    return null;
  }

  function onCastStarted(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (!profile || !profile.castSequence || !root.KeloSequence) return;
    const sequenceId = root.KeloSequence.play(profile.castSequence, c);
    if (c.castId && sequenceId) activeCastSequences.set(c.castId, sequenceId);
  }

  function onCastConfirmed(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (!profile) return;
    // Local prediction already started the cast presentation. Remote confirms enter here without prediction.
    if (!payload || payload.visualPredicted !== true) {
      if (profile.castSequence && root.KeloSequence) {
        const sequenceId = root.KeloSequence.play(profile.castSequence, c);
        if (c.castId && sequenceId) activeCastSequences.set(c.castId, sequenceId);
      }
    }
  }

  function onCastRejected(payload) {
    const c = normalizedEvent(payload);
    const actor = c.actor || ctxApi.resolveActor(c.actorId);
    if (actor && root.KeloAnimation) root.KeloAnimation.stop(actor, 'action', 'CAST_REJECTED');
    if (c.castId && activeCastSequences.has(c.castId) && root.KeloSequence) root.KeloSequence.stop(activeCastSequences.get(c.castId));
    if (c.castId) activeCastSequences.delete(c.castId);
  }

  function onProjectileSpawn(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (!profile || !profile.projectileVisual || !root.KeloProjectileVisuals) return;
    const gameplayObject = payload && payload.gameplayObject || null;
    const visualId = gameplayObject
      ? root.KeloProjectileVisuals.attach(gameplayObject, profile.projectileVisual, c, { speed: c.gameplay.speed, maxDistance: c.gameplay.range })
      : root.KeloProjectileVisuals.preview(profile.projectileVisual, c, { speed: c.gameplay.speed, maxDistance: c.gameplay.range });
    const key = c.projectileId || c.castId;
    if (key && visualId) activeProjectileVisuals.set(key, visualId);
  }

  function stopProjectileFor(c) {
    const key = c.projectileId || c.castId;
    if (!key || !root.KeloProjectileVisuals) return;
    const visualId = activeProjectileVisuals.get(key);
    if (visualId) root.KeloProjectileVisuals.stop(visualId);
    activeProjectileVisuals.delete(key);
  }

  function onProjectileHit(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    stopProjectileFor(c);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (profile && profile.impactSequence && root.KeloSequence) root.KeloSequence.play(profile.impactSequence, c);
  }

  function onProjectileExpired(payload) { stopProjectileFor(normalizedEvent(payload)); }

  function statusKey(c, status) { return String(c.actorId || 'actor') + ':' + String(status || c.statusId || 'status'); }
  function onStatusApplied(payload) {
    if (!enabled || !root.KeloFX) return;
    const c = normalizedEvent(payload);
    const status = payload && (payload.status || payload.effect && payload.effect.status);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    const ref = profile && profile.statusVisuals && profile.statusVisuals[status] || manifests.statusVisuals && manifests.statusVisuals[status];
    if (!ref) return;
    const duration = Math.max(0.1, Number(payload && payload.duration || payload && payload.effect && payload.effect.duration) || 1);
    const id = root.KeloFX.spawn(ref, c, { loop: false, duration: duration });
    if (id) activeStatusVisuals.set(statusKey(c, status), id);
  }

  function onStatusRemoved(payload) {
    if (!root.KeloFX) return;
    const c = normalizedEvent(payload);
    const status = payload && (payload.status || payload.effect && payload.effect.status);
    const key = statusKey(c, status);
    const id = activeStatusVisuals.get(key);
    if (id) root.KeloFX.stop(id);
    activeStatusVisuals.delete(key);
  }

  function onShield(payload) {
    if (!enabled || !root.KeloFX) return;
    const c = normalizedEvent(payload);
    const ref = manifests.statusVisuals && manifests.statusVisuals.shield;
    if (ref) root.KeloFX.spawn(ref, c);
  }

  bus.on('CAST_STARTED', onCastStarted);
  bus.on('CAST_CONFIRMED', onCastConfirmed);
  bus.on('CAST_REJECTED', onCastRejected);
  bus.on('PROJECTILE_SPAWNED', onProjectileSpawn);
  bus.on('PROJECTILE_HIT', onProjectileHit);
  bus.on('PROJECTILE_EXPIRED', onProjectileExpired);
  bus.on('STATUS_APPLIED', onStatusApplied);
  bus.on('STATUS_REMOVED', onStatusRemoved);
  bus.on('SHIELD_APPLIED', onShield);

  function faceDirection(actor) {
    const face = actor && actor._face || 'right';
    if (face === 'left') return { x: -1, y: 0 };
    if (face === 'up') return { x: 0, y: -1 };
    if (face === 'down') return { x: 0, y: 1 };
    return { x: 1, y: 0 };
  }

  function normalizeDirection(dx, dy, fallback) {
    const len = Math.hypot(Number(dx) || 0, Number(dy) || 0);
    if (!len) return fallback || { x: 1, y: 0 };
    return { x: dx / len, y: dy / len };
  }

  function slotDefinition(slot) {
    const entry = root.KeloAbilities && root.KeloAbilities.hotbar && root.KeloAbilities.hotbar.slots && root.KeloAbilities.hotbar.slots[slot];
    return entry && entry.definition || null;
  }

  function player() { try { return typeof localPlayer !== 'undefined' ? localPlayer : null; } catch (e) { return null; } }

  function makePending(slot, event) {
    const actor = player();
    const def = slotDefinition(slot);
    if (!actor || !def) return null;
    const actorId = String(actor.id || 'local');
    const castId = 'cast_' + actorId + '_' + Date.now().toString(36) + '_' + (fallbackSeq++).toString(36);
    const pending = {
      slot: slot, pointerId: event && event.pointerId, x0: event && event.clientX || 0, y0: event && event.clientY || 0,
      x1: event && event.clientX || 0, y1: event && event.clientY || 0,
      def: def, castId: castId, seed: (Date.now() ^ fallbackSeq * 2654435761) >>> 0,
      direction: faceDirection(actor), position: null
    };
    pendingBySlot.set(slot, pending);
    const c = contextForPending(pending, true);
    bus.emit('CAST_STARTED', Object.assign({}, c, { visualPredicted: true }));
    return pending;
  }

  function contextForPending(pending, predicted) {
    const actor = player();
    const def = pending.def || slotDefinition(pending.slot);
    const delivery = def && def.delivery || {};
    const target = def && def.targeting || {};
    const origin = actor && root.KeloAnchors ? root.KeloAnchors.get(actor, 'castOrigin') : actor ? { x: actor.x, y: actor.y } : null;
    return {
      actor: actor, actorId: actor && String(actor.id || 'local'), castId: pending.castId,
      abilityId: def && def.id, abilityKey: def && def.key, origin: origin,
      target: pending.position, direction: pending.direction,
      gameplay: {
        speed: Number(delivery.speed) || 0,
        range: Number(delivery.maxDistance || target.range) || 0,
        radius: Number(delivery.radius || delivery.activationRadius) || 0
      },
      visual: { seed: pending.seed, scale: 1 }, predicted: predicted === true, confirmed: predicted !== true
    };
  }

  function finalizeAim(pending) {
    if (!pending) return;
    const actor = player();
    const def = pending.def;
    const dx = pending.x1 - pending.x0, dy = pending.y1 - pending.y0;
    pending.direction = normalizeDirection(dx, dy, faceDirection(actor));
    if (def && def.targeting && def.targeting.type === 'position' && actor) {
      const zoom = typeof CONFIG !== 'undefined' && Number(CONFIG.zoom) || 1;
      const amount = Math.min(Number(def.targeting.range) || 300, (Math.hypot(dx, dy) / zoom * 1.2) || 80);
      pending.position = { x: actor.x + pending.direction.x * amount, y: actor.y + pending.direction.y * amount };
    }
  }

  // Capture phase records aiming before the existing hotbar target handlers call gameplay cast().
  function installAimCapture() {
    document.addEventListener('pointerdown', function (event) {
      const button = event.target && event.target.closest && event.target.closest('.stone-slot[data-slot]');
      if (!button) return;
      const slot = Number(button.dataset.slot);
      if (!Number.isInteger(slot)) return;
      const pending = makePending(slot, event);
      if (pending) pointerAim = pending;
    }, true);
    document.addEventListener('pointermove', function (event) {
      if (!pointerAim || pointerAim.pointerId !== event.pointerId) return;
      pointerAim.x1 = event.clientX; pointerAim.y1 = event.clientY;
    }, true);
    document.addEventListener('pointerup', function (event) {
      if (!pointerAim || pointerAim.pointerId !== event.pointerId) return;
      pointerAim.x1 = event.clientX; pointerAim.y1 = event.clientY; finalizeAim(pointerAim); pointerAim = null;
    }, true);
    document.addEventListener('pointercancel', function (event) {
      if (!pointerAim || pointerAim.pointerId !== event.pointerId) return;
      const c = contextForPending(pointerAim, false); bus.emit('CAST_REJECTED', Object.assign({}, c, { reason: 'POINTER_CANCELLED' })); pendingBySlot.delete(pointerAim.slot); pointerAim = null;
    }, true);
  }

  function maskDefinition(def) {
    if (!enabled || !def || !resolveProfile(def.id, def.key) || !def.visuals) return;
    if (!maskedLegacyColors.has(def)) maskedLegacyColors.set(def, def.visuals.color);
    def.visuals.color = 'rgba(0,0,0,0)';
  }
  function restoreLegacyMasks() {
    maskedLegacyColors.forEach(function (color, def) { if (def && def.visuals) def.visuals.color = color; });
    maskedLegacyColors.clear();
  }
  function applyLegacyMasks() {
    if (!enabled) return restoreLegacyMasks();
    const slots = root.KeloAbilities && root.KeloAbilities.hotbar && root.KeloAbilities.hotbar.slots || [];
    slots.forEach(function (slot) { if (slot && slot.definition) maskDefinition(slot.definition); });
  }

  // KELO-INDEX VISUAL/LEGACY-ADAPTER convierte el bus actual a eventos semánticos sin tocar StoneSystem ni gameplay.
  function installLegacyAbilityBusAdapter() {
    const abilityBus = root.KeloAbilities && root.KeloAbilities.bus;
    if (!abilityBus || typeof abilityBus.on !== 'function') return;
    installAimCapture();
    applyLegacyMasks();

    abilityBus.on('LOADOUT_CHANGED', function () { applyLegacyMasks(); });
    abilityBus.on('ABILITY_CAST', function (payload) {
      const slot = Number(payload.slotIndex);
      let pending = pendingBySlot.get(slot);
      if (!pending) {
        pending = makePending(slot, null);
        if (pending) finalizeAim(pending);
      }
      if (!pending) return;
      const def = slotDefinition(slot) || abilityDef(payload.abilityId, payload.abilityKey);
      pending.def = def || pending.def;
      finalizeAim(pending);
      if (def) maskDefinition(def);
      const c = contextForPending(pending, false);
      c.abilityId = payload.abilityId; c.abilityKey = payload.abilityKey; c.confirmed = true; c.predicted = false;
      activeCastByAbility.set(Number(payload.abilityId), { context: c, def: def, projectileHit: false, createdAt: performance.now() });
      bus.emit('CAST_CONFIRMED', Object.assign({}, c, { visualPredicted: true, clientSequence: payload.clientSequence }));
      if (def && def.delivery && def.delivery.type === 'projectile') {
        bus.emit('PROJECTILE_SPAWNED', Object.assign({}, c, { projectileId: 'p_' + c.castId }));
      } else if (def && (def.delivery.type === 'instant' || def.delivery.type === 'self_aoe')) {
        bus.emit('ABILITY_IMPACT', Object.assign({}, c, { target: c.origin }));
      }
      pendingBySlot.delete(slot);
    });

    abilityBus.on('ABILITY_FAILED', function (payload) {
      const slot = Number(payload && payload.request && payload.request.slotIndex);
      const pending = pendingBySlot.get(slot);
      if (!pending) return;
      const c = contextForPending(pending, false);
      bus.emit('CAST_REJECTED', Object.assign({}, c, { reason: payload.reason || 'REJECTED' }));
      pendingBySlot.delete(slot);
    });

    abilityBus.on('DAMAGE', function (payload) {
      const activeCast = activeCastByAbility.get(Number(payload.abilityId));
      if (!activeCast) return;
      const c = Object.assign({}, activeCast.context);
      if (payload.target) c.target = { x: payload.target.x, y: payload.target.y };
      const deliveryType = activeCast.def && activeCast.def.delivery && activeCast.def.delivery.type;
      if (deliveryType === 'projectile' && !activeCast.projectileHit) {
        activeCast.projectileHit = true;
        bus.emit('PROJECTILE_HIT', Object.assign({}, c, { projectileId: 'p_' + c.castId, targetActorId: payload.target && payload.target.id || null }));
      }
      bus.emit('ABILITY_IMPACT', Object.assign({}, c, { targetActorId: payload.target && payload.target.id || null, amount: payload.amount }));
    });

    abilityBus.on('STATUS_APPLIED', function (payload) {
      const activeCast = activeCastByAbility.get(Number(payload.abilityId));
      const base = activeCast ? activeCast.context : { abilityId: payload.abilityId };
      const target = payload.target;
      bus.emit('STATUS_APPLIED', Object.assign({}, base, {
        actor: target || null, actorId: target && String(target.id || '') || null,
        target: target ? { x: target.x, y: target.y } : null,
        status: payload.effect && payload.effect.status, effect: payload.effect,
        duration: payload.effect && payload.effect.duration
      }));
    });
    abilityBus.on('SHIELD_APPLIED', function (payload) {
      const target = payload.target;
      bus.emit('SHIELD_APPLIED', { actor: target, actorId: target && String(target.id || ''), abilityId: payload.abilityId, origin: target ? { x: target.x, y: target.y } : null, amount: payload.amount, visual: { seed: fallbackSeq++ } });
    });
    abilityBus.on('SHIELD_BROKEN', function (payload) {
      const target = payload.target; bus.emit('SHIELD_BROKEN', { actor: target, actorId: target && String(target.id || ''), origin: target ? { x: target.x, y: target.y } : null });
    });
    abilityBus.on('DEATH', function (payload) {
      const target = payload.target; bus.emit('DEATH', { actor: target, actorId: target && String(target.id || ''), origin: target ? { x: target.x, y: target.y } : null, abilityId: payload.abilityId });
    });

    root.KELO_ABILITY_SEMANTIC_EVENTS = true;
    if (root.KELO_VISUAL_AUDIT) root.KELO_VISUAL_AUDIT.legacyAbilityAdapter = 'semantic-event-bridge-v1';
  }

  function collectProfileAssets(profile) {
    const ids = new Set();
    function addFromFx(ref) { const def = ref && root.KeloFXRegistry && root.KeloFXRegistry.get(ref); if (def && def.assetId) ids.add(def.assetId); }
    function addFromProjectile(ref) { const def = ref && root.KeloProjectileVisualRegistry && root.KeloProjectileVisualRegistry.get(ref); if (def && def.assetId) ids.add(def.assetId); if (def && def.trailRef) addFromFx(def.trailRef); }
    function addSequence(ref) {
      const seq = ref && root.KeloSequenceRegistry && root.KeloSequenceRegistry.get(ref); if (!seq) return;
      seq.cues.forEach(function (cue) {
        if (cue.type === 'fx') addFromFx(cue.ref);
        if (cue.type === 'projectileVisual') addFromProjectile(cue.ref);
        if (cue.type === 'actorAnimation') { const clip = root.KeloAnimationRegistry && root.KeloAnimationRegistry.get(cue.ref); if (clip && clip.assetId) ids.add(clip.assetId); }
        if (cue.type === 'sfx') { const sfx = root.KeloSFXRegistry && root.KeloSFXRegistry.get(cue.ref); if (sfx && sfx.assetId) ids.add(sfx.assetId); }
      });
    }
    if (profile) { addSequence(profile.castSequence); addSequence(profile.impactSequence); addFromProjectile(profile.projectileVisual); }
    return Array.from(ids);
  }

  function preloadProfile(profile) {
    if (!profile || !root.KeloAssetRegistry) return Promise.resolve([]);
    return root.KeloAssetRegistry.preload(collectProfileAssets(profile));
  }

  function setEnabled(value) {
    enabled = value !== false;
    if (enabled) applyLegacyMasks(); else restoreLegacyMasks();
    if (root.KELO_VISUAL_AUDIT) root.KELO_VISUAL_AUDIT.abilityResolverEnabled = enabled;
    return enabled;
  }

  root.KeloVisualProfileRegistry = Object.freeze({ version: 'visual-profile-registry-v1.0.0', register: register, get: get, list: list, resolve: resolveProfile });
  root.KeloAbilityVisuals = Object.freeze({
    version: 'ability-visual-resolver-v1.1.0',
    setEnabled: setEnabled,
    get enabled() { return enabled; },
    hasProfile: hasProfile,
    shouldUseLegacy: shouldUseLegacy,
    resolveProfile: resolveProfile,
    playCue: playCue,
    preloadProfile: preloadProfile,
    applyLegacyMasks: applyLegacyMasks
  });

  if (root.KELO_VISUAL_AUDIT) root.KELO_VISUAL_AUDIT.abilityResolverEnabled = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installLegacyAbilityBusAdapter, { once: true });
  else installLegacyAbilityBusAdapter();
})(typeof globalThis !== 'undefined' ? globalThis : window);
