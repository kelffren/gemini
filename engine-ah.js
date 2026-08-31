(function () {
  // Walk/run animation synced to distance traveled.
  // Fixes: (1) double bob from engine-ac + engine-ag fighting,
  //        (2) auto-drift when stick released (velocity not zeroed),
  //        (3) clock-based bob that ignored actual movement.
  const WALK_STRIDE = 22;
  const RUN_STRIDE  = 14;
  const WALK_BOB   = 1.4;
  const RUN_BOB    = 2.2;

  function gaitOf(p) {
    if (p._gait) return p._gait;
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    if (spd > 180) return 'run';
    if (spd > 20)  return 'walk';
    return 'idle';
  }

  function advanceStep(p) {
    if (p._lx == null) { p._lx = p.x; p._ly = p.y; p._step = 0; p._stepPhase = 0; }
    const dx = p.x - p._lx, dy = p.y - p._ly;
    p._lx = p.x; p._ly = p.y;
    const dist = Math.hypot(dx, dy);
    const gait = gaitOf(p);
    if (gait === 'idle' || dist < 0.05) { p._stepPhase = 0; return; }
    const stride = gait === 'run' ? RUN_STRIDE : WALK_STRIDE;
    p._step = (p._step || 0) + dist;
    p._stepPhase = (p._step / stride) % 1;
  }

  function legLift(phase) {
    return Math.max(0, Math.sin(phase * Math.PI * 2)) * 2.6;
  }

  // ---- Movement: zero velocity when stick released (kills auto-drift) ----
  const _move = updateMovement;
  updateMovement = function (dt) {
    _move(dt);
    // If no input this frame, force a hard stop so the avatar never creeps.
    if (!input.normX && !input.normY && Math.hypot(localPlayer.vx, localPlayer.vy) < 6) {
      localPlayer.vx = 0;
      localPlayer.vy = 0;
    }
  };

  // ---- Render: ONE bob for shadow + sprite, no clock, no second pass ----
  const _av = renderAvatar;
  renderAvatar = function (p, isSelf) {
    if (!p) return;
    advanceStep(p);

    const gait = gaitOf(p);
    const bob = gait === 'run' ? RUN_BOB : (gait === 'walk' ? WALK_BOB : 0);
    const phase = p._stepPhase || 0;
    const bobY = Math.sin(phase * Math.PI * 2) * bob;
    const lift = legLift(phase);

    ctx.save();
    ctx.translate(0, bobY);          // bob applies to shadow AND sprite together
    if (_av) _av(p, isSelf);
    ctx.restore();

    // planted feet ticks (only when a foot is actually lifted)
    if (gait !== 'idle' && lift > 0.5) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath();
      ctx.ellipse(p.x - 6, p.y + 18, 2.4, 1.0, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + 6, p.y + 18, 2.4, 1.0, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  // Drive bots' step phase from their own movement.
  const _sim = updateSimulation;
  updateSimulation = function (dt) {
    _sim(dt);
    if (typeof simulatedPlayers !== 'undefined') {
      simulatedPlayers.forEach(function (b) { advanceStep(b); });
    }
  };
})();
