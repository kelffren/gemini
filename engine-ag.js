(function () {
  // Walk/run cycle synced to distance traveled (not clock).
  // Bob is applied to the WHOLE avatar (shadow + sprite) so feet plant on ground.
  const WALK_STRIDE = 26;   // px per step while walking
  const RUN_STRIDE  = 16;   // px per step while running
  const WALK_BOB   = 1.6;   // vertical bob amplitude (walk)
  const RUN_BOB    = 2.6;   // vertical bob amplitude (run)

  function gaitOf(p) {
    if (p._gait) return p._gait;                 // local player sets this in engine-ac
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    if (spd > 180) return 'run';
    if (spd > 20)  return 'walk';
    return 'idle';
  }

  function faceOf(p) {
    const vx = p.vx || 0, vy = p.vy || 0;
    if (Math.hypot(vx, vy) < 8) return p._face || 'down';
    const f = Math.abs(vx) > Math.abs(vy)
      ? (vx > 0 ? 'right' : 'left')
      : (vy > 0 ? 'down' : 'up');
    p._face = f;
    return f;
  }

  // Advance the step counter by distance moved this frame.
  function advanceStep(p, dt) {
    if (p._lx == null) { p._lx = p.x; p._ly = p.y; p._step = 0; }
    const dx = p.x - p._lx, dy = p.y - p._ly;
    p._lx = p.x; p._ly = p.y;
    const dist = Math.hypot(dx, dy);
    const gait = gaitOf(p);
    if (gait === 'idle' || dist < 0.15) { p._step = 0; return; }
    const stride = gait === 'run' ? RUN_STRIDE : WALK_STRIDE;
    p._step += dist;
    p._stepPhase = (p._step / stride) % 1;          // 0..1 continuous phase
  }

  // Leg offset for the current phase: plants on 0 and 0.5, lifts in between.
  function legLift(phase) {
    // two-step cycle: peak lift at 0.25 and 0.75
    const s = Math.sin(phase * Math.PI * 2);
    return Math.max(0, s) * 3.2;
  }

  const _av = renderAvatar;
  renderAvatar = function (p, isSelf) {
    if (!p) return;
    advanceStep(p, 0);

    const gait = gaitOf(p);
    const bob = gait === 'run' ? RUN_BOB : (gait === 'walk' ? WALK_BOB : 0);
    const lift = legLift(p._stepPhase || 0);
    const bobY = Math.sin((p._stepPhase || 0) * Math.PI * 2) * bob - lift * 0.15;

    ctx.save();
    ctx.translate(0, bobY);                       // <-- bob BEFORE shadow + sprite
    if (_av) _av(p, isSelf);
    ctx.restore();

    // planted feet indicator: small dark ticks under the shadow when moving
    if (gait !== 'idle' && lift > 0.4) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(p.x - 5, p.y + 20, 2.2, 1.1, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + 5, p.y + 20, 2.2, 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  // Also drive bots' step phase from their own movement.
  const _sim = updateSimulation;
  updateSimulation = function (dt) {
    _sim(dt);
    if (typeof simulatedPlayers !== 'undefined') {
      simulatedPlayers.forEach(function (b) { advanceStep(b, dt); });
    }
  };
})();
