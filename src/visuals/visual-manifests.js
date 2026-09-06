/* KELO-INDEX
 * area: VISUAL
 * keys: ASSET ANIMATION VFX PROJECTILE SFX SEQUENCE PROFILE STATUS MANIFEST
 * hace: manifiestos data-driven de piezas visuales reutilizables; ninguna definición depende de una piedra
 * online: solo IDs visuales locales; el cable transporta eventos semánticos y contexto, no estas definiciones
 */
(function (root) {
  'use strict';

  const ASSETS = Object.freeze({
    hero_default_sheet: Object.freeze({
      id: 'hero_default_sheet', type: 'spritesheet', src: 'assets/hero.PNG', preload: false,
      frameWidth: 256, frameHeight: 384, columns: 4, rows: 4
    }),
    sword_swap_activation_eye_asset: Object.freeze({
      id: 'sword_swap_activation_eye_asset', type: 'image',
      src: 'assets/fx/sword-swap/activation-eye.PNG', preload: true
    })
  });

  const ANIMATION_CLIPS = Object.freeze({
    cast_magic_01: Object.freeze({
      id: 'cast_magic_01', type: 'transform', channel: 'action', priority: 40,
      duration: 0.42, loop: false, interruptible: true,
      directions: Object.freeze(['up', 'down', 'left', 'right']), mirrorLeftFromRight: false,
      markers: Object.freeze({ release: 0.20, recover: 0.34 }),
      keyframes: Object.freeze([
        Object.freeze({ t: 0.00, scaleX: 1.00, scaleY: 1.00, rotation: 0, offsetX: 0, offsetY: 0 }),
        Object.freeze({ t: 0.22, scaleX: 0.96, scaleY: 1.04, rotation: -0.035, offsetX: 0, offsetY: -1 }),
        Object.freeze({ t: 0.52, scaleX: 1.07, scaleY: 0.96, rotation: 0.045, offsetX: 2, offsetY: 0 }),
        Object.freeze({ t: 1.00, scaleX: 1.00, scaleY: 1.00, rotation: 0, offsetX: 0, offsetY: 0 })
      ])
    }),
    cast_self_01: Object.freeze({
      id: 'cast_self_01', type: 'transform', channel: 'action', priority: 38,
      duration: 0.36, loop: false, interruptible: true,
      directions: Object.freeze(['up', 'down', 'left', 'right']), mirrorLeftFromRight: false,
      markers: Object.freeze({ release: 0.18, recover: 0.30 }),
      keyframes: Object.freeze([
        Object.freeze({ t: 0.00, scaleX: 1, scaleY: 1, rotation: 0, offsetX: 0, offsetY: 0 }),
        Object.freeze({ t: 0.45, scaleX: 1.04, scaleY: 0.96, rotation: 0, offsetX: 0, offsetY: 2 }),
        Object.freeze({ t: 1.00, scaleX: 1, scaleY: 1, rotation: 0, offsetX: 0, offsetY: 0 })
      ])
    })
  });

  const FX = Object.freeze({
    fire_hand_charge_small: Object.freeze({
      id: 'fire_hand_charge_small', type: 'glow', space: 'ACTOR', layer: 'actorFrontFX',
      socket: 'castOrigin', duration: 0.34, loop: false, radius: 16, color: '#ff8a3d', alpha: 0.52
    }),
    fire_muzzle_flash: Object.freeze({
      id: 'fire_muzzle_flash', type: 'burst', space: 'ACTOR', layer: 'actorFrontFX',
      socket: 'castOrigin', duration: 0.18, loop: false, radius: 24, color: '#ffd27a', rays: 8, alpha: 0.9
    }),
    fire_trail_01: Object.freeze({
      id: 'fire_trail_01', type: 'trail', space: 'WORLD', layer: 'worldFX',
      duration: 0.32, loop: false, radius: 8, color: '#ff6b35', alpha: 0.48
    }),
    fire_explosion_medium: Object.freeze({
      id: 'fire_explosion_medium', type: 'burst', space: 'WORLD', layer: 'foregroundFX',
      duration: 0.48, loop: false, radius: 54, color: '#ff6b35', accent: '#ffd166', rays: 14, alpha: 0.92
    }),
    burn_body_small: Object.freeze({
      id: 'burn_body_small', type: 'particle_emitter', space: 'ACTOR', layer: 'actorFrontFX',
      socket: 'center', duration: 1.0, loop: true, radius: 28, color: '#ff8c42', particleCount: 8, alpha: 0.72
    }),
    magic_ground_ring_01: Object.freeze({
      id: 'magic_ground_ring_01', type: 'ring', space: 'WORLD', layer: 'groundFX',
      duration: 0.8, loop: false, radius: 42, color: '#e7c56a', alpha: 0.42
    }),
    shield_ring_01: Object.freeze({
      id: 'shield_ring_01', type: 'ring', space: 'ACTOR', layer: 'actorFrontFX',
      socket: 'center', duration: 0.65, loop: false, radius: 34, color: '#ffd166', alpha: 0.58
    }),
    sword_swap_activation_eye: Object.freeze({
      id: 'sword_swap_activation_eye', type: 'static_sprite', assetId: 'sword_swap_activation_eye_asset',
      space: 'ACTOR', layer: 'actorFrontFX', socket: 'head', duration: 0.35, loop: false,
      width: 72, height: 72, alpha: 1
    })
  });

  const PROJECTILE_VISUALS = Object.freeze({
    projectile_fire_orb_01: Object.freeze({
      id: 'projectile_fire_orb_01', type: 'orb', layer: 'worldFX', radius: 11,
      color: '#ff6b35', coreColor: '#ffe0a3', glowRadius: 22, trailRef: 'fire_trail_01',
      defaultSpeed: 420, defaultMaxDistance: 500
    })
  });

  const SFX = Object.freeze({
    fire_cast_01: Object.freeze({
      id: 'fire_cast_01', type: 'synth', waveform: 'triangle', frequency: 180,
      frequencyEnd: 480, duration: 0.18, gain: 0.055
    }),
    fire_impact_01: Object.freeze({
      id: 'fire_impact_01', type: 'synth', waveform: 'sawtooth', frequency: 120,
      frequencyEnd: 55, duration: 0.15, gain: 0.045
    })
  });

  const SCREEN_FX = Object.freeze({
    impact_medium: Object.freeze({ id: 'impact_medium', type: 'shake', duration: 0.16, amplitude: 3.5 }),
    flash_warm_small: Object.freeze({ id: 'flash_warm_small', type: 'flash', duration: 0.10, alpha: 0.08, color: '#ffd7a1' })
  });

  const SEQUENCES = Object.freeze({
    sequence_fire_cast_01: Object.freeze({
      id: 'sequence_fire_cast_01', duration: 420,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'actorAnimation', ref: 'cast_magic_01' }),
        Object.freeze({ at: 40, type: 'fx', ref: 'fire_hand_charge_small', socket: 'castOrigin' }),
        Object.freeze({ at: 150, type: 'sfx', ref: 'fire_cast_01' }),
        Object.freeze({ at: 200, type: 'fx', ref: 'fire_muzzle_flash', socket: 'castOrigin' })
      ])
    }),
    sequence_fire_impact_01: Object.freeze({
      id: 'sequence_fire_impact_01', duration: 520,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'fx', ref: 'fire_explosion_medium' }),
        Object.freeze({ at: 0, type: 'sfx', ref: 'fire_impact_01' }),
        Object.freeze({ at: 20, type: 'screenFx', ref: 'impact_medium' })
      ])
    }),
    sequence_debug_explosion_reuse: Object.freeze({
      id: 'sequence_debug_explosion_reuse', duration: 600,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'fx', ref: 'magic_ground_ring_01' }),
        Object.freeze({ at: 180, type: 'fx', ref: 'fire_explosion_medium' })
      ])
    }),
    sequence_sword_swap_activation_eye: Object.freeze({
      id: 'sequence_sword_swap_activation_eye', duration: 350,
      cues: Object.freeze([
        Object.freeze({ at: 0, type: 'fx', ref: 'sword_swap_activation_eye', socket: 'head' })
      ])
    })
  });

  const VISUAL_PROFILES = Object.freeze({
    ability_visual_fireball_01: Object.freeze({
      id: 'ability_visual_fireball_01', abilityKey: 'fireball',
      castSequence: 'sequence_fire_cast_01',
      projectileVisual: 'projectile_fire_orb_01',
      impactSequence: 'sequence_fire_impact_01',
      statusVisuals: Object.freeze({ burn: 'burn_body_small' })
    }),
    ability_visual_sword_swap_01: Object.freeze({
      id: 'ability_visual_sword_swap_01', abilityKey: 'swap_sword',
      castSequence: 'sequence_sword_swap_activation_eye'
    })
  });

  const STATUS_VISUALS = Object.freeze({
    burn: 'burn_body_small',
    shield: 'shield_ring_01'
  });

  root.KELO_VISUAL_MANIFESTS = Object.freeze({
    version: 'visual-manifests-v1.1.0',
    assets: ASSETS,
    animationClips: ANIMATION_CLIPS,
    fx: FX,
    projectileVisuals: PROJECTILE_VISUALS,
    sfx: SFX,
    screenFx: SCREEN_FX,
    sequences: SEQUENCES,
    visualProfiles: VISUAL_PROFILES,
    statusVisuals: STATUS_VISUALS
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
