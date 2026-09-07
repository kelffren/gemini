/* KELO-INDEX
 * area: VISUAL
 * keys: SWORD SWAP PVP IMPACT PLANTED LOOP SPRITESHEET
 * hace: puente visual mínimo para que el PvP aislado dibuje los PNG de clavado/loop usando la capa projectile worldFX que ya renderiza la arena
 * online: solo consume eventos semánticos; no cambia posiciones, cooldown, daño ni autoridad
 */
(function (root) {
  'use strict';

  const VERSION = 'sword-swap-pvp-visuals-v1.0.0';
  const IMPACT_ASSET = 'sword_swap_pvp_impact_asset_v1';
  const LOOP_ASSET = 'sword_swap_pvp_loop_asset_v1';
  const IMPACT_VISUAL = 'sword_swap_pvp_impact_visual_v1';
  const LOOP_VISUAL = 'sword_swap_pvp_loop_visual_v1';
  const FRAME_W = 362;
  const FRAME_H = 724;
  const swordObjects = new Map();
  const active = new Map();
  let installed = false;

  function keyOf(payload) {
    return String(payload && payload.swordEntityId || '');
  }

  function stopVisual(id) {
    if (id && root.KeloProjectileVisuals && typeof root.KeloProjectileVisuals.stop === 'function') {
      root.KeloProjectileVisuals.stop(id);
    }
  }

  function clearActive(key, forgetObject) {
    const item = active.get(key);
    if (item) {
      if (item.timer) clearTimeout(item.timer);
      stopVisual(item.impactId);
      stopVisual(item.loopId);
      active.delete(key);
    }
    if (forgetObject) swordObjects.delete(key);
  }

  function registerDefinitions() {
    if (!root.KeloAssetRegistry || !root.KeloProjectileVisualRegistry) return false;

    const assets = [
      { id: IMPACT_ASSET, type: 'image', src: 'assets/fx/sword-swap/a.PNG', preload: true },
      { id: LOOP_ASSET, type: 'image', src: 'assets/fx/sword-swap/loop.PNG', preload: true },
    ];
    assets.forEach(function (def) {
      if (!root.KeloAssetRegistry.get(def.id)) root.KeloAssetRegistry.register(def);
    });

    if (!root.KeloProjectileVisualRegistry.get(IMPACT_VISUAL)) {
      root.KeloProjectileVisualRegistry.register({
        id: IMPACT_VISUAL,
        type: 'sprite_animation',
        assetId: IMPACT_ASSET,
        layer: 'worldFX',
        frameWidth: FRAME_W,
        frameHeight: FRAME_H,
        columns: 6,
        rows: 1,
        frames: 6,
        fps: 12,
        loop: false,
        sourcePixelScale: 0.40,
        alpha: 1,
        alignToVelocity: false,
        defaultSpeed: 0,
        defaultMaxDistance: 1,
      });
    }

    if (!root.KeloProjectileVisualRegistry.get(LOOP_VISUAL)) {
      root.KeloProjectileVisualRegistry.register({
        id: LOOP_VISUAL,
        type: 'sprite_animation',
        assetId: LOOP_ASSET,
        layer: 'worldFX',
        frameWidth: FRAME_W,
        frameHeight: FRAME_H,
        columns: 6,
        rows: 1,
        frames: 6,
        fps: 9,
        loop: true,
        sourcePixelScale: 0.40,
        alpha: 1,
        alignToVelocity: false,
        defaultSpeed: 0,
        defaultMaxDistance: 1,
      });
    }

    root.KeloAssetRegistry.preload([IMPACT_ASSET, LOOP_ASSET]).catch(function () {});
    return true;
  }

  function contextFor(payload, object) {
    const position = payload && (payload.position || payload.target) || object || { x: 0, y: 0 };
    return {
      actor: payload && payload.actor || null,
      actorId: payload && payload.actorId || payload && payload.playerId || null,
      abilityId: payload && payload.abilityId,
      abilityKey: payload && payload.abilityKey || 'swap_sword',
      origin: { x: Number(position.x) || 0, y: Number(position.y) || 0 },
      target: { x: Number(position.x) || 0, y: Number(position.y) || 0 },
      direction: { x: 0, y: -1 },
      gameplay: { speed: 0, range: 1 },
      visual: { seed: Date.now() & 65535, scale: 1 },
    };
  }

  function onThrown(payload) {
    if (root.KELO_COMBAT_ENABLED !== true) return;
    const key = keyOf(payload);
    if (!key || !payload || !payload.gameplayObject) return;
    clearActive(key, false);
    swordObjects.set(key, payload.gameplayObject);
  }

  function onLanded(payload) {
    if (root.KELO_COMBAT_ENABLED !== true || !root.KeloProjectileVisuals) return;
    const key = keyOf(payload);
    const object = key && swordObjects.get(key);
    if (!key || !object) return;

    clearActive(key, false);
    const context = contextFor(payload, object);
    const impactId = root.KeloProjectileVisuals.attach(object, IMPACT_VISUAL, context, {
      speed: 0,
      maxDistance: 1,
      loop: false,
    });
    const record = { impactId: impactId, loopId: null, timer: null };
    active.set(key, record);

    record.timer = setTimeout(function () {
      const current = active.get(key);
      if (!current || current !== record || root.KELO_COMBAT_ENABLED !== true) return;
      stopVisual(current.impactId);
      current.impactId = null;
      current.loopId = root.KeloProjectileVisuals.attach(object, LOOP_VISUAL, context, {
        speed: 0,
        maxDistance: 1,
        loop: true,
      });
      current.timer = null;
    }, 500);
  }

  function onAbilityCast(payload) {
    if (!payload || payload.abilityKey !== 'swap_sword') return;
    const phase = String(payload.specialPhase || payload.swapStage || '');
    if (phase !== 'recall_to_sword' && phase !== 'swap_character' && phase !== 'SWAP') return;
    const key = keyOf(payload);
    if (key) clearActive(key, phase === 'recall_to_sword');
  }

  function onCancelled(payload) {
    const key = keyOf(payload);
    if (key) clearActive(key, true);
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
    installed = true;
    root.KELO_SWORD_SWAP_PVP_VISUAL_AUDIT = {
      ready: true,
      version: VERSION,
      sourceAssets: ['a.PNG', 'loop.PNG'],
      renderPath: 'KeloProjectileVisuals/worldFX',
      reason: 'PvP arena has an isolated renderer and does not draw KeloFX foregroundFX directly',
    };
    return true;
  }

  function boot() {
    if (install()) return;
    setTimeout(boot, 80);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : window);
