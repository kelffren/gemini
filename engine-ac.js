(function () {
  // MOV-001: one processed intent magnitude drives gait + speed.
  // MOV-004: visual stride advances from actual world distance, never render count.
  const WALK_MAX = 0.74;
  const WALK_SPEED = 96;
  const RUN_SPEED = 165;
  const MAX_SPEED = RUN_SPEED + (1 - WALK_MAX) * 28; // 172.28, historical max
  const SPEED_BLEND_START = 0.55;
  const GAIT_IDLE_MAX = 0.04;
  const GAIT_RUN_START = 0.74;
  const VISUAL_STOP_HOLD_SEC = 0.075;
  const WALK_CYCLE_WORLD_PX = 50;
  const RUN_CYCLE_WORLD_PX = 90;
  const MIN_VISUAL_MOVE_PX = 0.12;
  CONFIG.speed = WALK_SPEED;

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

  function rawTouchMag() {
    if (!input.touchActive) return null;
    return Math.min(1, Math.hypot(input.currentX - input.originX, input.currentY - input.originY) / CONFIG.joystickRadius);
  }

  function publishAudit(mag, gait, speedCap, visual) {
    window.KELO_MOVEMENT_AUDIT = {
      version: 'MOV-001+MOV-004',
      rawTouchMag: rawTouchMag(),
      processedMag: mag,
      gait,
      speedCap,
      targetSpeed: mag * speedCap,
      actualSpeed: Math.hypot(localPlayer.vx || 0, localPlayer.vy || 0),
      colliderRadius: localPlayer.radius,
      visualOn: !!(visual && visual.on),
      visualFrame: visual ? visual.frame : 0,
      stridePhase: visual ? visual.stridePhase : 0,
      strideDistancePx: visual ? visual.strideDistancePx : 0,
      lastStepDistancePx: visual ? visual.lastStepDistancePx : 0
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
        lastStepDistancePx: 0
      };
    }
    return p._visualMotion;
  }

  function updateVisualMotion(p, dt, gait) {
    const v = visualStateOf(p);
    const dx = p.x - v.lastX;
    const dy = p.y - v.lastY;
    const dist = Math.hypot(dx, dy);
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    const hasIntent = gait !== 'idle';
    const physicallyMoving = dist > MIN_VISUAL_MOVE_PX || spd > 16;

    if (hasIntent || physicallyMoving) {
      v.stopElapsed = 0;
      v.on = true;
    } else {
      v.stopElapsed += Math.max(0, dt || 0);
      v.on = v.stopElapsed < VISUAL_STOP_HOLD_SEC;
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

    // Advance animation only from actual post-collision displacement.
    // If Kelo pushes against a wall and does not move, the stride cannot treadmill.
    v.lastStepDistancePx = dist > MIN_VISUAL_MOVE_PX ? dist : 0;
    if (v.on && v.lastStepDistancePx > 0) {
      const cyclePx = gait === 'run' ? RUN_CYCLE_WORLD_PX : WALK_CYCLE_WORLD_PX;
      v.strideDistancePx += v.lastStepDistancePx;
      v.stridePhase = (v.stridePhase + v.lastStepDistancePx / cyclePx) % 1;
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
    const visual = updateVisualMotion(localPlayer, dt, gait);
    publishAudit(mag, gait, speedCap, visual);
  };
})();
