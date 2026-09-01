(function () {
  // MOV-001: one processed intent magnitude drives gait + speed.
  // Keep the historical top speed (172.28) while removing the WALK->RUN speed step.
  const WALK_MAX = 0.74;
  const WALK_SPEED = 96;
  const RUN_SPEED = 165;
  const MAX_SPEED = RUN_SPEED + (1 - WALK_MAX) * 28; // 172.28, historical max
  const SPEED_BLEND_START = 0.55;
  const GAIT_IDLE_MAX = 0.04;
  const GAIT_RUN_START = 0.74;
  const VISUAL_FRAME_SEC = 0.130;
  const VISUAL_STOP_HOLD_SEC = 0.075;
  CONFIG.speed = WALK_SPEED;

  function processedMag() {
    // processInput() already applies the circular deadzone + POWER curve.
    // Reading raw pointer radius here used to make animation and physics disagree.
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

  function publishAudit(mag, gait, speedCap) {
    window.KELO_MOVEMENT_AUDIT = {
      version: 'MOV-001',
      rawTouchMag: rawTouchMag(),
      processedMag: mag,
      gait,
      speedCap,
      targetSpeed: mag * speedCap,
      actualSpeed: Math.hypot(localPlayer.vx || 0, localPlayer.vy || 0),
      colliderRadius: localPlayer.radius
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
        frameElapsed: 0,
        stopElapsed: VISUAL_STOP_HOLD_SEC
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
    const physicallyMoving = dist > 0.12 || spd > 16;
    const wasOn = v.on;

    if (hasIntent || physicallyMoving) {
      v.stopElapsed = 0;
      v.on = true;
    } else {
      v.stopElapsed += Math.max(0, dt || 0);
      v.on = v.stopElapsed < VISUAL_STOP_HOLD_SEC;
    }

    if (dist > 0.12) {
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

    if (v.on) {
      if (!wasOn) {
        v.frame = 0;
        v.frameElapsed = 0;
      } else {
        v.frameElapsed += Math.max(0, dt || 0);
        while (v.frameElapsed >= VISUAL_FRAME_SEC) {
          v.frameElapsed -= VISUAL_FRAME_SEC;
          v.frame = (v.frame + 1) % 4;
        }
      }
    } else {
      v.frame = 0;
      v.frameElapsed = 0;
    }

    v.gait = gait;
    v.lastX = p.x;
    v.lastY = p.y;
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
    updateVisualMotion(localPlayer, dt, gait);
    publishAudit(mag, gait, speedCap);
  };
})();
