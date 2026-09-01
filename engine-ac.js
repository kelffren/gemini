(function () {
  const WALK_MAX = 0.74;
  const WALK_SPEED = 96;
  const RUN_SPEED = 165;
  const VISUAL_FRAME_SEC = 0.130;
  const VISUAL_STOP_HOLD_SEC = 0.075;
  CONFIG.speed = WALK_SPEED;

  function stickMag() {
    if (input.touchActive) {
      return Math.min(1, Math.hypot(input.currentX - input.originX, input.currentY - input.originY) / CONFIG.joystickRadius);
    }
    return Math.min(1, Math.hypot(input.normX || 0, input.normY || 0));
  }

  function gaitFrom(mag) {
    if (mag < 0.14) return 'idle';
    if (mag < WALK_MAX) return 'walk';
    return 'run';
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
        // Deterministic start: every new locomotion burst begins on contact frame 0.
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
    const mag = stickMag();
    const gait = gaitFrom(mag);
    localPlayer.gait = gait;
    localPlayer._gait = gait;
    if (gait === 'run') CONFIG.speed = RUN_SPEED + (mag - WALK_MAX) * 28;
    else CONFIG.speed = WALK_SPEED;
    _move(dt);
    updateVisualMotion(localPlayer, dt, gait);
  };
})();
