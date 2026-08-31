(function () {
  const WALK_MAX = 0.55;
  const WALK_SPEED = 130;
  const RUN_SPEED = 305;
  CONFIG.speed = RUN_SPEED;

  function stickMag() {
    if (input.touchActive) {
      return Math.min(1, Math.hypot(input.currentX - input.originX, input.currentY - input.originY) / CONFIG.joystickRadius);
    }
    return Math.min(1, Math.hypot(input.normX || 0, input.normY || 0));
  }

  function gaitFrom(mag) {
    if (mag < 0.18) return 'idle';
    if (mag < WALK_MAX) return 'walk';
    return 'run';
  }

  const _move = updateMovement;
  updateMovement = function (dt) {
    const mag = stickMag();
    const gait = gaitFrom(mag);
    localPlayer.gait = gait;
    localPlayer._gait = gait;
    if (gait === 'run') CONFIG.speed = RUN_SPEED + (mag - WALK_MAX) * 90;
    else CONFIG.speed = WALK_SPEED;
    _move(dt);
  };
})();
