/* KELO-INDEX
 * area: VISUAL
 * keys: ABILITY PROFILE CAST PROJECTILE IMPACT STATUS PREDICTION REMOTE LEGACY ADAPTER
 * hace: resuelve eventos de ability a perfiles visuales opcionales; gameplay sigue funcionando si este archivo no existe
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
  let enabled = true;
  let fallbackSeq = 1;

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

  function onCastConfirmed(payload) {
    if (!enabled) return;
    const c = normalizedEvent(payload);
    const profile = resolveProfile(c.abilityId, c.abilityKey);
    if (!profile) return;
    if (profile.castSequence && root.KeloSequence) root.KeloSequence.play(profile.castSequence, c);
  }

  function onCastRejected(payload) {
    const c = normalizedEvent(payload);
    const actor = c.actor || ctxApi.resolveActor(c.actorId);
    if (actor && root.KeloAnimation) root.KeloAnimation.stop(actor, 'action', 'CAST_REJECTED');
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
    const id = root.KeloFX.spawn(ref, c, { loop: true });
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

  bus.on('CAST_CONFIRMED', onCastConfirmed);
  bus.on('CAST_REJECTED', onCastRejected);
  bus.on('PROJECTILE_SPAWNED', onProjectileSpawn);
  bus.on('PROJECTILE_HIT', onProjectileHit);
  bus.on('PROJECTILE_EXPIRED', onProjectileExpired);
  bus.on('STATUS_APPLIED', onStatusApplied);
  bus.on('STATUS_REMOVED', onStatusRemoved);
  bus.on('SHIELD_APPLIED', onShield);

  function installLegacyAbilityBusAdapter() {
    if (root.KELO_ABILITY_SEMANTIC_EVENTS === true) return;
    const abilityBus = root.KeloAbilities && root.KeloAbilities.bus;
    if (!abilityBus || typeof abilityBus.on !== 'function') return;
    abilityBus.on('ABILITY_CAST', function (payload) {
      const actor = typeof localPlayer !== 'undefined' ? localPlayer : null;
      const def = abilityDef(payload.abilityId, payload.abilityKey);
      const face = actor && actor._face || 'right';
      const direction = face === 'left' ? { x: -1, y: 0 } : face === 'up' ? { x: 0, y: -1 } : face === 'down' ? { x: 0, y: 1 } : { x: 1, y: 0 };
      const castId = 'cast_' + String(payload.playerId || 'local') + '_' + String(payload.clientSequence || fallbackSeq++);
      const context = {
        actor: actor, actorId: payload.playerId, castId: castId, abilityId: payload.abilityId, abilityKey: payload.abilityKey,
        origin: actor ? { x: actor.x, y: actor.y } : null, direction: direction,
        gameplay: { speed: def && def.delivery && def.delivery.speed, range: def && (def.delivery.maxDistance || def.targeting && def.targeting.range) },
        visual: { seed: Number(payload.clientSequence) || fallbackSeq }, confirmed: true
      };
      bus.emit('CAST_CONFIRMED', context);
      if (def && def.delivery && def.delivery.type === 'projectile') bus.emit('PROJECTILE_SPAWNED', Object.assign({}, context, { projectileId: 'p_' + castId }));
    });
  }

  function preloadProfile(profile) {
    if (!profile || !root.KeloAssetRegistry) return Promise.resolve([]);
    const refs = [];
    [profile.castSequence, profile.impactSequence].forEach(function () {});
    return root.KeloAssetRegistry.preload(refs);
  }

  function setEnabled(value) {
    enabled = value !== false;
    if (root.KELO_VISUAL_AUDIT) root.KELO_VISUAL_AUDIT.abilityResolverEnabled = enabled;
    return enabled;
  }

  root.KeloVisualProfileRegistry = Object.freeze({ version: 'visual-profile-registry-v1.0.0', register: register, get: get, list: list, resolve: resolveProfile });
  root.KeloAbilityVisuals = Object.freeze({
    version: 'ability-visual-resolver-v1.0.0',
    setEnabled: setEnabled,
    get enabled() { return enabled; },
    hasProfile: hasProfile,
    shouldUseLegacy: shouldUseLegacy,
    resolveProfile: resolveProfile,
    playCue: playCue,
    preloadProfile: preloadProfile
  });

  if (root.KELO_VISUAL_AUDIT) root.KELO_VISUAL_AUDIT.abilityResolverEnabled = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installLegacyAbilityBusAdapter, { once: true });
  else installLegacyAbilityBusAdapter();
})(typeof globalThis !== 'undefined' ? globalThis : window);
