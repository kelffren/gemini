(function () {
  // MOV-001: one processed intent magnitude drives gait + speed.
  // MOV-004: visual stride advances from actual world distance, never render count.
  // MOV-CADENCE-V2: remove the 50->90px stride-length jump at WALK->RUN.
  // MOV-STOP-V2: release never freezes an arbitrary stride pose; physics remains unchanged.
  const WALK_MAX = 0.74;
  const WALK_SPEED = 110;
  const RUN_SPEED = 178;
  const MAX_SPEED = RUN_SPEED + (1 - WALK_MAX) * 28;
  const SPEED_BLEND_START = 0.48;
  const GAIT_IDLE_MAX = 0.03;
  const GAIT_RUN_START = 0.70;
  const VISUAL_STOP_HOLD_SEC = 0.075;
  const WALK_CYCLE_WORLD_PX = 50;
  const RUN_CYCLE_WORLD_PX = 90;
  const MIN_VISUAL_MOVE_PX = 0.12;
  const MOV_CADENCE_V2 = new URLSearchParams(window.location.search).get('movCadenceV2') !== '0';
  const MOV_STOP_V2 = new URLSearchParams(window.location.search).get('movStopV2') !== '0';
  CONFIG.speed = WALK_SPEED;
  CONFIG.joystickDeadzone = 0.045;
  CONFIG.joystickCurve = 'LINEAR';
  CONFIG.joystickRadius = 72;
  CONFIG.movementType = 'DIRECT';
  CONFIG.accelDecay = 32;
  CONFIG.decelDecay = 18;

  function processedMag() {
    return Math.min(1, Math.hypot(input.normX || 0, input.normY || 0));
  }

  function smoothstep01(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  }

  function speedFor(mag) {
    if (mag <= SPEED_BLEND_START) return WALK_SPEED;
    const t = (mag - SPEED_BLEND_START) / (1 - SPEED_BLEND_START);
    return WALK_SPEED + (MAX_SPEED - WALK_SPEED) * smoothstep01(t);
  }

  function gaitFrom(mag) {
    if (mag < GAIT_IDLE_MAX) return 'idle';
    if (mag < GAIT_RUN_START) return 'walk';
    return 'run';
  }

  function cycleWorldPxFor(mag, gait) {
    if (!MOV_CADENCE_V2) return gait === 'run' ? RUN_CYCLE_WORLD_PX : WALK_CYCLE_WORLD_PX;
    if (gait !== 'run') return WALK_CYCLE_WORLD_PX;
    const t = Math.max(0, Math.min(1, (mag - GAIT_RUN_START) / (1 - GAIT_RUN_START)));
    return WALK_CYCLE_WORLD_PX + (RUN_CYCLE_WORLD_PX - WALK_CYCLE_WORLD_PX) * t;
  }

  function rawTouchMag() {
    if (!input.touchActive) return null;
    return Math.min(1, Math.hypot(input.currentX - input.originX, input.currentY - input.originY) / CONFIG.joystickRadius);
  }

  function publishAudit(mag, gait, speedCap, visual) {
    window.KELO_MOVEMENT_AUDIT = {
      version: 'MOV-stop-v2',
      rawTouchMag: rawTouchMag(),
      processedMag: mag,
      gait,
      speedCap,
      targetSpeed: mag * speedCap,
      actualSpeed: Math.hypot(localPlayer.vx || 0, localPlayer.vy || 0),
      colliderRadius: localPlayer.radius,
      cadenceV2: MOV_CADENCE_V2,
      stopV2: MOV_STOP_V2,
      cycleWorldPx: visual ? visual.cycleWorldPx : cycleWorldPxFor(mag, gait),
      visualOn: !!(visual && visual.on),
      visualFrame: visual ? visual.frame : 0,
      stridePhase: visual ? visual.stridePhase : 0,
      strideDistancePx: visual ? visual.strideDistancePx : 0,
      lastStepDistancePx: visual ? visual.lastStepDistancePx : 0,
      releaseCount: visual ? visual.releaseCount : 0,
      lastReleaseFromFrame: visual ? visual.lastReleaseFromFrame : 0,
      lastReleaseFromPhase: visual ? visual.lastReleaseFromPhase : 0,
      unsupportedPoseFreezeMs: visual ? visual.unsupportedPoseFreezeMs : 0,
      releaseToStablePlantMs: visual ? visual.releaseToStablePlantMs : 0,
      reversalAccidentalIdleCount: visual ? visual.reversalAccidentalIdleCount : 0
    };
  }

  function visualStateOf(p) {
    if (!p._visualMotion) {
      p._visualMotion = {
        lastX: p.x,
        lastY: p.y,
        dx: 0,
        dy: 0,
        on: false,
        face: p._face || 'down',
        gait: 'idle',
        frame: 0,
        stopElapsed: VISUAL_STOP_HOLD_SEC,
        stridePhase: 0,
        strideDistancePx: 0,
        lastStepDistancePx: 0,
        cycleWorldPx: WALK_CYCLE_WORLD_PX,
        releaseCount: 0,
        lastReleaseFromFrame: 0,
        lastReleaseFromPhase: 0,
        unsupportedPoseFreezeMs: 0,
        releaseToStablePlantMs: 0,
        reversalAccidentalIdleCount: 0
      };
    }
    return p._visualMotion;
  }

  function updateVisualMotion(p, dt, gait, mag) {
    const v = visualStateOf(p);
    const dx = p.x - v.lastX;
    const dy = p.y - v.lastY;
    const dist = Math.hypot(dx, dy);
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    const hasIntent = gait !== 'idle';
    const physicallyMoving = dist > MIN_VISUAL_MOVE_PX || spd > 16;
    const wasOn = v.on;

    if (hasIntent || physicallyMoving) {
      v.stopElapsed = 0;
      v.on = true;
    } else if (MOV_STOP_V2) {
      if (wasOn) {
        v.releaseCount += 1;
        v.lastReleaseFromFrame = v.frame;
        v.lastReleaseFromPhase = v.stridePhase;
      }
      v.stopElapsed = VISUAL_STOP_HOLD_SEC;
      v.on = false;
      v.unsupportedPoseFreezeMs = 0;
      v.releaseToStablePlantMs = 0;
    } else {
      v.stopElapsed += Math.max(0, dt || 0);
      v.on = v.stopElapsed < VISUAL_STOP_HOLD_SEC;
      v.unsupportedPoseFreezeMs = v.on ? v.stopElapsed * 1000 : 0;
      v.releaseToStablePlantMs = v.on ? v.stopElapsed * 1000 : VISUAL_STOP_HOLD_SEC * 1000;
    }

    if (dist > MIN_VISUAL_MOVE_PX) {
      v.dx = dx;
      v.dy = dy;
    } else if (spd > 16) {
      v.dx = p.vx || 0;
      v.dy = p.vy || 0;
    } else if (hasIntent) {
      v.dx = input.normX || 0;
      v.dy = input.normY || 0;
    }

    if (v.on && (Math.abs(v.dx) > 0.0001 || Math.abs(v.dy) > 0.0001)) {
      const side = Math.abs(v.dx) * 1.15 >= Math.abs(v.dy);
      v.face = side ? (v.dx >= 0 ? 'right' : 'left') : (v.dy >= 0 ? 'down' : 'up');
      p._face = v.face;
    }

    v.lastStepDistancePx = dist > MIN_VISUAL_MOVE_PX ? dist : 0;
    v.cycleWorldPx = cycleWorldPxFor(mag, gait);
    if (v.on && v.lastStepDistancePx > 0) {
      v.strideDistancePx += v.lastStepDistancePx;
      v.stridePhase = (v.stridePhase + v.lastStepDistancePx / v.cycleWorldPx) % 1;
      v.frame = Math.floor(v.stridePhase * 4) % 4;
    } else if (!v.on) {
      v.stridePhase = 0;
      v.strideDistancePx = 0;
      v.frame = 0;
    }

    v.gait = gait;
    v.lastX = p.x;
    v.lastY = p.y;
    return v;
  }

  const _move = updateMovement;
  updateMovement = function (dt) {
    const mag = processedMag();
    const gait = gaitFrom(mag);
    const speedCap = speedFor(mag);
    localPlayer.gait = gait;
    localPlayer._gait = gait;
    CONFIG.speed = speedCap;
    _move(dt);
    const visual = updateVisualMotion(localPlayer, dt, gait, mag);
    publishAudit(mag, gait, speedCap, visual);
  };
})();
