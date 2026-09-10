/* KELO-INDEX
 * area: VISUAL
 * keys: MELEE EVENT ATTACK HIT MISS REACTION DIRECTION ONLINE PRESENTATION 8WAY SKIN-AGNOSTIC
 * hace: traduce eventos semánticos melee a clips/FX/SFX sin poseer gameplay
 * online: acepta actor/target por referencia local o ID remoto; no calcula hit, daño, cooldown ni posición
 * invariant: actor._face permanece cardinal para compatibilidad de skins; el action clip usa dirección visual de 8 vías
 */
(function (root) {
  'use strict';

  const VERSION = 'melee-combat-visuals-v1.1.0-universal-8way';
  const manifest = root.KELO_MELEE_VISUAL_MANIFEST;
  const bus = root.KeloVisualEventBus;
  const contextApi = root.KeloVisualContext;

  if (!manifest || !bus || !contextApi || !root.KeloAnimation || !root.KeloSequence) {
    console.error('[Kelo melee visuals] visual runtime unavailable');
    return;
  }

  const lastAttackAt = new Map();
  const acceptedAttackIds = new Map();
  const timers = new Set();
  let syntheticSeq = 1;

  const audit = root.KELO_MELEE_VISUAL_AUDIT = Object.assign(root.KELO_MELEE_VISUAL_AUDIT || {}, {
    runtimeReady: true,
    runtimeVersion: VERSION,
    attacksStarted: 0,
    hitsPresented: 0,
    missesPresented: 0,
    throttled: 0,
    lastAttackId: null,
    lastDirection: null,
    lastCardinalFace: null,
    lastHitTargetId: null,
    gameplayMutation: false,
    skinAgnostic: true,
    directionCount: 8
  });

  function nowMs() {
    return root.performance && typeof root.performance.now === 'function' ? root.performance.now() : Date.now();
  }

  function actorId(actor) {
    return contextApi.actorIdOf(actor) || 'actor';
  }

  function resolveActor(value, fallbackId) {
    if (value && typeof value === 'object') return value;
    return fallbackId != null ? contextApi.resolveActor(fallbackId) : null;
  }

  function normalizedDirection(raw, actor, target) {
    let x = raw && Number(raw.x), y = raw && Number(raw.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < 0.001) {
      if (actor && target) {
        x = (Number(target.x) || 0) - (Number(actor.x) || 0);
        y = (Number(target.y) || 0) - (Number(actor.y) || 0);
      } else {
        const face = actor && actor._face || 'down';
        if (face === 'up') { x = 0; y = -1; }
        else if (face === 'left') { x = -1; y = 0; }
        else if (face === 'right') { x = 1; y = 0; }
        else { x = 0; y = 1; }
      }
    }
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  // Keep the avatar renderer on its legacy-safe 4-way facing. No skin is required
  // to implement diagonal sprite sheets for this melee attack to work.
  function faceFromDirection(direction) {
    if (Math.abs(direction.x) > Math.abs(direction.y)) return direction.x < 0 ? 'left' : 'right';
    return direction.y < 0 ? 'up' : 'down';
  }

  // Presentation selects one of eight clips independently from the skin facing.
  function direction8FromDirection(direction) {
    const angle = Math.atan2(direction.y, direction.x);
    const octant = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
    return ['right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right'][octant];
  }

  function attackIdOf(payload) {
    return String(payload && (payload.attackId || payload.castId) || ('melee_visual_' + (syntheticSeq++).toString(36)));
  }

  function baseContext(payload, actor, direction, direction8) {
    const targetActor = resolveActor(payload && payload.targetActor, payload && payload.targetActorId);
    const targetPoint = payload && payload.target && Number.isFinite(Number(payload.target.x)) && Number.isFinite(Number(payload.target.y))
      ? { x: Number(payload.target.x), y: Number(payload.target.y) }
      : targetActor ? { x: Number(targetActor.x) || 0, y: Number(targetActor.y) || 0 } : null;
    return {
      actor: actor,
      actorId: actorId(actor),
      castId: payload && (payload.attackId || payload.castId) || null,
      origin: { x: Number(actor.x) || 0, y: Number(actor.y) || 0 },
      target: targetPoint,
      direction: direction,
      gameplay: Object.assign({}, payload && payload.gameplay || {}),
      visual: Object.assign({
        scale: 1,
        seed: Number(payload && payload.seed) || (Date.now() & 65535),
        direction8: direction8 || direction8FromDirection(direction)
      }, payload && payload.visual || {}),
      source: payload && payload.source || 'melee',
      predicted: payload && payload.predicted === true,
      confirmed: payload && payload.confirmedHit === true,
      remote: payload && payload.remote === true,
      serverTime: payload && payload.serverTime
    };
  }

  function playAttack(payload) {
    const actor = resolveActor(payload && payload.actor, payload && payload.actorId);
    if (!actor) return null;
    const targetActor = resolveActor(payload && payload.targetActor, payload && payload.targetActorId);
    const direction = normalizedDirection(payload && payload.direction, actor, targetActor);
    const face = faceFromDirection(direction);
    const direction8 = direction8FromDirection(direction);
    const id = attackIdOf(payload);
    const key = actorId(actor);
    const now = nowMs();
    const previous = Number(lastAttackAt.get(key)) || -Infinity;

    if (now - previous < manifest.visualThrottleMs) {
      audit.throttled += 1;
      return null;
    }

    lastAttackAt.set(key, now);
    acceptedAttackIds.set(id, now);
    if (acceptedAttackIds.size > 32) {
      const oldest = acceptedAttackIds.keys().next().value;
      acceptedAttackIds.delete(oldest);
    }

    actor._face = face;
    const context = baseContext(Object.assign({}, payload, { attackId: id }), actor, direction, direction8);
    const clipId = manifest.attackClips[direction8] || manifest.attackClips[face] || manifest.attackClips.down;
    const sequenceRef = manifest.swingSequences[direction8] || manifest.swingSequences[face] || manifest.swingSequences.down;
    const animationId = root.KeloAnimation.play(actor, clipId, { channel: 'action', context: context });
    const sequenceId = root.KeloSequence.play(sequenceRef, context);

    audit.attacksStarted += 1;
    audit.lastAttackId = id;
    audit.lastDirection = direction8;
    audit.lastCardinalFace = face;
    if (payload && payload.confirmedHit === false) audit.missesPresented += 1;

    return { attackId: id, animationId: animationId, sequenceId: sequenceId, face: face, direction8: direction8 };
  }

  function playHitNow(payload) {
    const target = resolveActor(payload && payload.targetActor, payload && payload.targetActorId);
    const attacker = resolveActor(payload && payload.actor, payload && payload.actorId);
    if (!target) return null;
    const direction = normalizedDirection(payload && payload.direction, attacker, target);
    const face = faceFromDirection(direction);
    const direction8 = direction8FromDirection(direction);
    const context = baseContext({
      attackId: payload && (payload.attackId || payload.castId),
      targetActor: attacker,
      targetActorId: attacker && actorId(attacker),
      target: attacker ? { x: attacker.x, y: attacker.y } : null,
      direction: direction,
      gameplay: payload && payload.gameplay,
      visual: payload && payload.visual,
      source: payload && payload.source,
      remote: payload && payload.remote,
      serverTime: payload && payload.serverTime,
      confirmedHit: true
    }, target, direction, direction8);

    const clipId = manifest.reactionClips[direction8] || manifest.reactionClips[face] || manifest.reactionClips.down;
    const reactionId = root.KeloAnimation.play(target, clipId, { channel: 'reaction', context: context });
    const sequenceId = root.KeloSequence.play(manifest.hitSequence, context);

    audit.hitsPresented += 1;
    audit.lastHitTargetId = actorId(target);
    return { reactionId: reactionId, sequenceId: sequenceId, face: face, direction8: direction8 };
  }

  function playHit(payload) {
    const id = String(payload && (payload.attackId || payload.castId) || '');
    if (id && !acceptedAttackIds.has(id) && payload && payload.allowOrphanHit !== true) return null;

    const startedAt = Number(payload && payload.visualStartedAt);
    const elapsed = Number.isFinite(startedAt) ? Math.max(0, nowMs() - startedAt) : 0;
    const delay = Math.max(0, manifest.impactAtMs - elapsed);

    if (delay <= 1) return playHitNow(payload);
    const timer = setTimeout(function () {
      timers.delete(timer);
      playHitNow(payload);
      if (id) acceptedAttackIds.delete(id);
    }, delay);
    timers.add(timer);
    return timer;
  }

  function preview(actor, target, hit) {
    if (!actor) return null;
    const direction = normalizedDirection(null, actor, target);
    const attackId = 'melee_preview_' + (syntheticSeq++).toString(36);
    const payload = {
      attackId: attackId,
      actor: actor,
      actorId: actorId(actor),
      targetActor: target || null,
      targetActorId: target ? actorId(target) : null,
      target: target ? { x: target.x, y: target.y } : { x: actor.x + direction.x * 80, y: actor.y + direction.y * 80 },
      direction: direction,
      confirmedHit: hit === true,
      visualStartedAt: nowMs(),
      source: 'melee-preview'
    };
    const attack = playAttack(payload);
    if (attack && hit === true && target) playHit(payload);
    return attack;
  }

  bus.on('MELEE_ATTACK_STARTED', playAttack);
  bus.on('MELEE_HIT_CONFIRMED', playHit);

  root.KeloMeleeVisuals = Object.freeze({
    version: VERSION,
    playAttack: playAttack,
    playHit: playHit,
    preview: preview,
    faceFromDirection: faceFromDirection,
    direction8FromDirection: direction8FromDirection,
    get impactDelayMs() { return manifest.impactAtMs; }
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
