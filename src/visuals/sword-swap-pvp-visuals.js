/* KELO-INDEX
 * area: VISUAL
 * keys: SWORD SWAP PVP IMPACT PLANTED LOOP TELEPORT RETURN SPRITESHEET
 * hace: puente visual del PvP aislado para impacto, espada clavada, teleport y llamada/retorno usando los PNG reales en la capa projectile worldFX que sí renderiza la arena
 * online: solo consume eventos semánticos; no cambia posiciones, cooldown, daño ni autoridad
 */
(function (root) {
  'use strict';

  const VERSION = 'sword-swap-pvp-visuals-v1.2.0';
  const FRAME_W = 362;
  const FRAME_H = 724;
  const IMPACT_MS = 500;
  const TELEPORT_MS = 500;

  const IDS = Object.freeze({
    impactAsset: 'sword_swap_pvp_impact_asset_v2',
    loopAsset: 'sword_swap_pvp_loop_asset_v2',
    teleportAsset: 'sword_swap_pvp_teleport_asset_v2',
    returnAsset: 'sword_swap_pvp_return_asset_v2',
    impactVisual: 'sword_swap_pvp_impact_visual_v2',
    loopVisual: 'sword_swap_pvp_loop_visual_v2',
    teleportVisual: 'sword_swap_pvp_teleport_visual_v2',
    returnVisual: 'sword_swap_pvp_return_visual_v2',
  });

  const swordObjects = new Map();
  const active = new Map();
  const transient = new Set();
  let installed = false;
  let lastPlayerPos = null;
  let trackingStarted = false;

  const audit = root.KELO_SWORD_SWAP_PVP_VISUAL_AUDIT = {
    ready: false,
    version: VERSION,
    sourceAssets: ['a.PNG', 'loop.PNG', 'teleport .PNG', 'regreso2.PNG'],
    renderPath: 'KeloProjectileVisuals/worldFX',
    assetsReady: false,
    impactPlayed: 0,
    loopPlayed: 0,
    teleportPlayed: 0,
    returnPlayed: 0,
    lastPhase: null,
    lastSwordEntityId: null,
    lastTeleportPoints: null,
    lastReturnDirection: null,
    reason: 'PvP arena has an isolated renderer and only draws projectile worldFX directly',
  };

  function player() {
    try { return typeof localPlayer !== 'undefined' ? localPlayer : null; }
    catch (e) { return null; }
  }

  function pointOf(p) {
    return p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))
      ? { x: Number(p.x), y: Number(p.y) }
      : null;
  }

  function keyOf(payload) {
    return String(payload && payload.swordEntityId || '');
  }

  function stopVisual(id) {
    if (id && root.KeloProjectileVisuals && typeof root.KeloProjectileVisuals.stop === 'function') {
      root.KeloProjectileVisuals.stop(id);
    }
  }

  function clearTransient(id) {
    if (!id) return;
    stopVisual(id);
    transient.delete(id);
  }

  function clearActive(key, forgetObject) {
    const item = active.get(key);
    if (item) {
      if (item.timer) clearTimeout(item.timer);
      if (item.returnTimer) clearTimeout(item.returnTimer);
      stopVisual(item.impactId);
      stopVisual(item.loopId);
      stopVisual(item.returnId);
      active.delete(key);
    }
    if (forgetObject) swordObjects.delete(key);
  }

  function registerVisual(def) {
    if (!root.KeloProjectileVisualRegistry.get(def.id)) root.KeloProjectileVisualRegistry.register(def);
  }

  function registerDefinitions() {
    if (!root.KeloAssetRegistry || !root.KeloProjectileVisualRegistry) return false;

    const assets = [
      { id: IDS.impactAsset, type: 'image', src: 'assets/fx/sword-swap/a.PNG', preload: true },
      { id: IDS.loopAsset, type: 'image', src: 'assets/fx/sword-swap/loop.PNG', preload: true },
      { id: IDS.teleportAsset, type: 'image', src: 'assets/fx/sword-swap/teleport%20.PNG', preload: true },
      { id: IDS.returnAsset, type: 'image', src: 'assets/fx/sword-swap/regreso2.PNG', preload: true },
    ];

    assets.forEach(function (def) {
      if (!root.KeloAssetRegistry.get(def.id)) root.KeloAssetRegistry.register(def);
    });

    registerVisual({
      id: IDS.impactVisual,
      type: 'sprite_animation', assetId: IDS.impactAsset, layer: 'worldFX',
      frameWidth: FRAME_W, frameHeight: FRAME_H, columns: 6, rows: 1, frames: 6, fps: 12, loop: false,
      sourcePixelScale: 0.40, alpha: 1, alignToVelocity: false, defaultSpeed: 0, defaultMaxDistance: 1,
    });

    registerVisual({
      id: IDS.loopVisual,
      type: 'sprite_animation', assetId: IDS.loopAsset, layer: 'worldFX',
      frameWidth: FRAME_W, frameHeight: FRAME_H, columns: 6, rows: 1, frames: 6, fps: 9, loop: true,
      sourcePixelScale: 0.40, alpha: 1, alignToVelocity: false, defaultSpeed: 0, defaultMaxDistance: 1,
    });

    registerVisual({
      id: IDS.teleportVisual,
      type: 'sprite_animation', assetId: IDS.teleportAsset, layer: 'worldFX',
      frameWidth: FRAME_W, frameHeight: FRAME_H, columns: 6, rows: 1, frames: 6, fps: 14, loop: false,
      sourcePixelScale: 0.34, alpha: 1, alignToVelocity: false, defaultSpeed: 0, defaultMaxDistance: 1,
    });

    registerVisual({
      id: IDS.returnVisual,
      type: 'sprite_animation', assetId: IDS.returnAsset, layer: 'worldFX',
      frames: 2, fps: 14, loop: true,
      frameRects: [
        { x: FRAME_W * 4, y: 0, width: FRAME_W, height: FRAME_H },
        { x: FRAME_W * 5, y: 0, width: FRAME_W, height: FRAME_H },
      ],
      sourcePixelScale: 0.36, alpha: 1, alignToVelocity: true,
      rotationOffset: Math.PI, defaultSpeed: 980, defaultMaxDistance: 1200,
    });

    root.KeloAssetRegistry.preload(assets.map(function (a) { return a.id; })).then(function () {
      audit.assetsReady = assets.every(function (a) { return root.KeloAssetRegistry.isReady(a.id); });
    }).catch(function () {
      audit.assetsReady = false;
    });
    return true;
  }

  function contextFor(payload, object, direction) {
    const position = pointOf(payload && (payload.position || payload.target)) || pointOf(object) || { x: 0, y: 0 };
    return {
      actor: payload && payload.actor || player(),
      actorId: payload && payload.actorId || payload && payload.playerId || null,
      abilityId: payload && payload.abilityId,
      abilityKey: payload && payload.abilityKey || 'swap_sword',
      origin: { x: position.x, y: position.y },
      target: { x: position.x, y: position.y },
      direction: direction || { x: 0, y: -1 },
      gameplay: { speed: 0, range: 1 },
      visual: { seed: Date.now() & 65535, scale: 1 },
    };
  }

  function attachStaticVisual(point, visualId, durationMs) {
    if (!point || !root.KeloProjectileVisuals) return null;
    const anchor = { x: point.x, y: point.y, _keloVisualDead: false };
    const context = {
      abilityKey: 'swap_sword', origin: { x: point.x, y: point.y }, target: { x: point.x, y: point.y },
      direction: { x: 0, y: -1 }, gameplay: { speed: 0, range: 1 }, visual: { seed: Date.now() & 65535, scale: 1 },
    };
    const id = root.KeloProjectileVisuals.attach(anchor, visualId, context, { speed: 0, maxDistance: 1, loop: false });
    if (!id) return null;
    transient.add(id);
    setTimeout(function () { anchor._keloVisualDead = true; clearTransient(id); }, Math.max(100, durationMs || TELEPORT_MS));
    return id;
  }

  function playTeleportPair(from, to) {
    const a = pointOf(from), b = pointOf(to);
    if (!a || !b) return;
    attachStaticVisual(a, IDS.teleportVisual, TELEPORT_MS);
    attachStaticVisual(b, IDS.teleportVisual, TELEPORT_MS);
    audit.teleportPlayed += 1;
    audit.lastPhase = 'TELEPORT';
    audit.lastTeleportPoints = { from: a, to: b };
  }

  function beginReturnVisual(key, payload) {
    const object = key && swordObjects.get(key);
    const actor = player();
    if (!key || !object || !actor || !root.KeloProjectileVisuals) return;

    const dx = Number(actor.x) - Number(object.x);
    const dy = Number(actor.y) - Number(object.y);
    const len = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / len, y: dy / len };
    const context = contextFor(payload, object, dir);
    context.target = { x: Number(actor.x), y: Number(actor.y) };
    context.gameplay = { speed: 980, range: Math.max(120, len + 120) };

    const record = active.get(key) || { impactId: null, loopId: null, returnId: null, timer: null, returnTimer: null };
    if (record.timer) { clearTimeout(record.timer); record.timer = null; }
    stopVisual(record.impactId); record.impactId = null;
    stopVisual(record.loopId); record.loopId = null;
    stopVisual(record.returnId);

    record.returnId = root.KeloProjectileVisuals.attach(object, IDS.returnVisual, context, {
      speed: 980,
      maxDistance: Math.max(120, len + 120),
      loop: true,
    });
    const returnMs = Math.max(450, Number(payload && payload.returnDurationSec || 3) * 1000 + 180);
    record.returnTimer = setTimeout(function () {
      const current = active.get(key);
      if (!current || current !== record) return;
      stopVisual(current.returnId);
      current.returnId = null;
      current.returnTimer = null;
      active.delete(key);
      swordObjects.delete(key);
    }, returnMs);
    active.set(key, record);

    audit.returnPlayed += 1;
    audit.lastPhase = 'RETURN';
    audit.lastSwordEntityId = key;
    audit.lastReturnDirection = dir;
  }

  function onThrown(payload) {
    if (root.KELO_COMBAT_ENABLED !== true) return;
    const key = keyOf(payload);
    if (!key || !payload || !payload.gameplayObject) return;
    clearActive(key, false);
    swordObjects.set(key, payload.gameplayObject);
    audit.lastPhase = 'THROW';
    audit.lastSwordEntityId = key;
  }

  function onLanded(payload) {
    if (root.KELO_COMBAT_ENABLED !== true || !root.KeloProjectileVisuals) return;
    const key = keyOf(payload);
    const object = key && swordObjects.get(key);
    if (!key || !object) return;

    clearActive(key, false);
    const context = contextFor(payload, object);
    const impactId = root.KeloProjectileVisuals.attach(object, IDS.impactVisual, context, { speed: 0, maxDistance: 1, loop: false });
    const record = { impactId: impactId, loopId: null, returnId: null, timer: null, returnTimer: null };
    active.set(key, record);
    audit.impactPlayed += 1;
    audit.lastPhase = 'IMPACT';
    audit.lastSwordEntityId = key;

    record.timer = setTimeout(function () {
      const current = active.get(key);
      if (!current || current !== record || root.KELO_COMBAT_ENABLED !== true) return;
      stopVisual(current.impactId);
      current.impactId = null;
      current.loopId = root.KeloProjectileVisuals.attach(object, IDS.loopVisual, context, { speed: 0, maxDistance: 1, loop: true });
      current.timer = null;
      audit.loopPlayed += 1;
      audit.lastPhase = 'STUCK';
    }, IMPACT_MS);
  }

  function onAbilityCast(payload) {
    if (!payload || payload.abilityKey !== 'swap_sword') return;
    const phase = String(payload.specialPhase || payload.swapStage || '');
    if (phase !== 'recall_to_sword' && phase !== 'swap_character' && phase !== 'SWAP') return;

    const key = keyOf(payload);
    const actor = player();
    const before = pointOf(lastPlayerPos);
    const after = pointOf(actor);

    if (phase === 'recall_to_sword') {
      if (key) clearActive(key, false);
      if (before && after) playTeleportPair(before, after);
      if (key) swordObjects.delete(key);
      audit.lastSwordEntityId = key || null;
      return;
    }

    if (phase === 'swap_character' || phase === 'SWAP') {
      if (before && after) playTeleportPair(before, after);
      if (key) beginReturnVisual(key, payload);
    }
  }

  function onCancelled(payload) {
    const key = keyOf(payload);
    if (key) clearActive(key, true);
  }

  function trackPlayer() {
    if (!trackingStarted) trackingStarted = true;
    const p = player();
    if (p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))) lastPlayerPos = { x: Number(p.x), y: Number(p.y) };
    root.requestAnimationFrame(trackPlayer);
  }

  function install() {
    if (installed) return true;
    if (!registerDefinitions()) return false;
    const bus = root.KeloAbilities && root.KeloAbilities.bus;
    if (!bus || typeof bus.on !== 'function') return false;

    bus.on('SWAP_SWORD_THROWN', onThrown);
    bus.on('SWAP_SWORD_LANDED', onLanded);
    bus.on('SWAP_SWORD_THROW_CANCELLED', onCancelled);
    bus.on('SWAP_SWORD_RESOLVED', onCancelled);
    bus.on('ABILITY_CAST', onAbilityCast);

    if (!trackingStarted && typeof root.requestAnimationFrame === 'function') root.requestAnimationFrame(trackPlayer);
    installed = true;
    audit.ready = true;
    return true;
  }

  function boot() {
    if (install()) return;
    setTimeout(boot, 80);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : window);
