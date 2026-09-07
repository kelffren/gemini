/* KELO-INDEX
 * area: VISUAL
 * keys: MELEE SWORD ATTACK REACTION SLASH HITSTOP SFX SEQUENCE MOBILE
 * hace: registra el paquete visual data-driven del melee ligero sin tocar daño, hitbox ni cooldown
 * online: define únicamente IDs/timings de presentación reconstruibles desde eventos semánticos
 */
(function (root) {
  'use strict';

  const VERSION = 'melee-visual-manifest-v1.0.0';
  const IMPACT_AT_MS = 150;
  const ATTACK_DURATION = 0.33;
  const REACTION_DURATION = 0.11;

  const animationRegistry = root.KeloAnimationRegistry;
  const fxRegistry = root.KeloFXRegistry;
  const sfxRegistry = root.KeloSFXRegistry;
  const screenRegistry = root.KeloScreenFXRegistry;
  const sequenceRegistry = root.KeloSequenceRegistry;

  if (!animationRegistry || !fxRegistry || !sfxRegistry || !screenRegistry || !sequenceRegistry) {
    console.error('[Kelo melee manifest] visual registries unavailable');
    return;
  }

  function freezeFrames(frames) {
    return Object.freeze(frames.map(function (frame) { return Object.freeze(frame); }));
  }

  function registerSafe(registry, def) {
    if (registry.get(def.id)) return def.id;
    return registry.register(Object.freeze(def));
  }

  const attackMotion = Object.freeze({
    down: Object.freeze({ backX: 0, backY: -3, strikeX: 0, strikeY: 8, followX: 0, followY: 4, rotation: -0.09 }),
    up: Object.freeze({ backX: 0, backY: 3, strikeX: 0, strikeY: -8, followX: 0, followY: -4, rotation: 0.09 }),
    right: Object.freeze({ backX: -3, backY: 0, strikeX: 8, strikeY: 0, followX: 4, followY: 0, rotation: 0.09 }),
    left: Object.freeze({ backX: 3, backY: 0, strikeX: -8, strikeY: 0, followX: -4, followY: 0, rotation: -0.09 })
  });

  const reactionMotion = Object.freeze({
    down: Object.freeze({ x: 0, y: 4, rotation: 0.035 }),
    up: Object.freeze({ x: 0, y: -4, rotation: -0.035 }),
    right: Object.freeze({ x: 4, y: 0, rotation: 0.035 }),
    left: Object.freeze({ x: -4, y: 0, rotation: -0.035 })
  });

  const attackClips = {};
  Object.keys(attackMotion).forEach(function (face) {
    const m = attackMotion[face];
    const id = 'melee_sword_light_01_' + face;
    registerSafe(animationRegistry, {
      id: id,
      type: 'transform',
      channel: 'action',
      priority: 45,
      duration: ATTACK_DURATION,
      loop: false,
      interruptible: true,
      directions: Object.freeze([face]),
      markers: Object.freeze({ swing: 0.07, impact: IMPACT_AT_MS / 1000, recover: 0.205 }),
      keyframes: freezeFrames([
        { t: 0.00, scaleX: 1.00, scaleY: 1.00, rotation: 0, offsetX: 0, offsetY: 0 },
        { t: 0.21, scaleX: 0.975, scaleY: 1.035, rotation: -m.rotation * 0.42, offsetX: m.backX, offsetY: m.backY },
        { t: 0.46, scaleX: 1.055, scaleY: 0.955, rotation: m.rotation, offsetX: m.strikeX, offsetY: m.strikeY },
        { t: 0.58, scaleX: 1.045, scaleY: 0.965, rotation: m.rotation * 0.78, offsetX: m.strikeX * 0.92, offsetY: m.strikeY * 0.92 },
        { t: 0.74, scaleX: 1.015, scaleY: 0.992, rotation: -m.rotation * 0.34, offsetX: m.followX, offsetY: m.followY },
        { t: 1.00, scaleX: 1.00, scaleY: 1.00, rotation: 0, offsetX: 0, offsetY: 0 }
      ])
    });
    attackClips[face] = id;
  });

  const reactionClips = {};
  Object.keys(reactionMotion).forEach(function (face) {
    const m = reactionMotion[face];
    const id = 'melee_hit_reaction_light_' + face;
    registerSafe(animationRegistry, {
      id: id,
      type: 'transform',
      channel: 'reaction',
      priority: 60,
      duration: REACTION_DURATION,
      loop: false,
      interruptible: true,
      directions: Object.freeze(['up', 'down', 'left', 'right']),
      keyframes: freezeFrames([
        { t: 0.00, scaleX: 1.00, scaleY: 1.00, rotation: 0, offsetX: 0, offsetY: 0 },
        { t: 0.22, scaleX: 0.99, scaleY: 1.01, rotation: 0, offsetX: 0, offsetY: 0 },
        { t: 0.42, scaleX: 1.04, scaleY: 0.96, rotation: m.rotation, offsetX: m.x, offsetY: m.y },
        { t: 0.62, scaleX: 1.035, scaleY: 0.965, rotation: m.rotation * 0.85, offsetX: m.x * 0.9, offsetY: m.y * 0.9 },
        { t: 1.00, scaleX: 1.00, scaleY: 1.00, rotation: 0, offsetX: 0, offsetY: 0 }
      ])
    });
    reactionClips[face] = id;
  });

  registerSafe(fxRegistry, {
    id: 'melee_slash_sword_light_01',
    type: 'slash_arc',
    space: 'ACTOR',
    layer: 'actorFrontFX',
    socket: 'weapon',
    duration: 0.11,
    loop: false,
    radius: 36,
    arc: 2.25,
    width: 7.5,
    squash: 0.62,
    color: '#f0c85a',
    accent: '#fff6ce',
    coreColor: '#ffffff',
    alpha: 0.94
  });

  registerSafe(fxRegistry, {
    id: 'melee_hit_sparks_light_01',
    type: 'burst',
    space: 'ACTOR',
    layer: 'actorFrontFX',
    socket: 'center',
    duration: 0.13,
    loop: false,
    radius: 19,
    color: '#ffd978',
    accent: '#ffffff',
    rays: 7,
    alpha: 0.88
  });

  registerSafe(fxRegistry, {
    id: 'melee_hit_glow_light_01',
    type: 'glow',
    space: 'ACTOR',
    layer: 'actorFrontFX',
    socket: 'center',
    duration: 0.075,
    loop: false,
    radius: 12,
    color: '#fff7d6',
    alpha: 0.42
  });

  registerSafe(sfxRegistry, {
    id: 'melee_swing_light_01',
    type: 'synth',
    waveform: 'triangle',
    frequency: 520,
    frequencyEnd: 165,
    duration: 0.075,
    gain: 0.027
  });

  registerSafe(sfxRegistry, {
    id: 'melee_hit_light_01',
    type: 'synth',
    waveform: 'sawtooth',
    frequency: 145,
    frequencyEnd: 58,
    duration: 0.085,
    gain: 0.034
  });

  registerSafe(screenRegistry, {
    id: 'melee_impact_light',
    type: 'shake',
    duration: 0.075,
    amplitude: 1.65
  });

  registerSafe(screenRegistry, {
    id: 'melee_flash_light',
    type: 'flash',
    duration: 0.055,
    alpha: 0.025,
    color: '#fff1c4'
  });

  registerSafe(sequenceRegistry, {
    id: 'sequence_melee_sword_light_01',
    duration: 180,
    cues: Object.freeze([
      Object.freeze({ at: 62, type: 'sfx', ref: 'melee_swing_light_01' }),
      Object.freeze({ at: 68, type: 'fx', ref: 'melee_slash_sword_light_01', socket: 'weapon' })
    ])
  });

  registerSafe(sequenceRegistry, {
    id: 'sequence_melee_hit_light_01',
    duration: 150,
    cues: Object.freeze([
      Object.freeze({ at: 0, type: 'fx', ref: 'melee_hit_glow_light_01', socket: 'center' }),
      Object.freeze({ at: 0, type: 'fx', ref: 'melee_hit_sparks_light_01', socket: 'center' }),
      Object.freeze({ at: 0, type: 'sfx', ref: 'melee_hit_light_01' }),
      Object.freeze({ at: 0, type: 'screenFx', ref: 'melee_impact_light' }),
      Object.freeze({ at: 0, type: 'screenFx', ref: 'melee_flash_light' })
    ])
  });

  root.KELO_MELEE_VISUAL_MANIFEST = Object.freeze({
    version: VERSION,
    attackId: 'sword_light_attack_1',
    attackDurationMs: Math.round(ATTACK_DURATION * 1000),
    anticipationMs: 69,
    swingMs: 83,
    impactAtMs: IMPACT_AT_MS,
    recoveryMs: 178,
    reactionDurationMs: Math.round(REACTION_DURATION * 1000),
    visualThrottleMs: 180,
    attackClips: Object.freeze(attackClips),
    reactionClips: Object.freeze(reactionClips),
    swingSequence: 'sequence_melee_sword_light_01',
    hitSequence: 'sequence_melee_hit_light_01'
  });

  root.KELO_MELEE_VISUAL_AUDIT = Object.assign(root.KELO_MELEE_VISUAL_AUDIT || {}, {
    manifestReady: true,
    version: VERSION,
    attackClips: Object.keys(attackClips).length,
    reactionClips: Object.keys(reactionClips).length,
    impactAtMs: IMPACT_AT_MS
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
