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
    if (gait === 'walk') CONFIG.speed = WALK_SPEED;
    else if (gait === 'run') CONFIG.speed = RUN_SPEED + (mag - WALK_MAX) * 90;
    else CONFIG.speed = WALK_SPEED;
    _move(dt);
  };

  const _av = renderAvatar;
  renderAvatar = function (p, isSelf) {
    if (!p) return;
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    const gait = (isSelf && localPlayer.gait) ? localPlayer.gait : (spd > 180 ? 'run' : spd > 20 ? 'walk' : 'idle');
    p._gait = gait;
    const oldY = p.y;
    if (gait === 'walk') p.y += Math.sin(Date.now() / 160) * 1.2;
    else if (gait === 'run') p.y += Math.sin(Date.now() / 90) * 2.2;
    _av(p, isSelf);
    p.y = oldY;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,' + (gait === 'idle' ? 0.28 : 0.4) + ')';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 20, gait === 'run' ? 16 : 13, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const _r = render;
  render = function () {
    _r();
    if (!input.touchActive || isBuildMode) return;
    const mag = stickMag();
    ctx.save();
    ctx.strokeStyle = 'rgba(231,197,106,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(input.originX, input.originY, CONFIG.joystickRadius * WALK_MAX, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = mag < 0.18 ? '#888' : mag < WALK_MAX ? '#e7c56a' : '#39d353';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mag < 0.18 ? '' : mag < WALK_MAX ? 'andar' : 'correr', input.originX, input.originY + CONFIG.joystickRadius + 16);
    ctx.restore();
  };
})();
