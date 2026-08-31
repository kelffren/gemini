(function () {
  const WALK_STRIDE = 22;
  const RUN_STRIDE = 14;
  const WALK_BOB = 1.4;
  const RUN_BOB = 2.2;

  function gaitOf(p) {
    if (p._gait) return p._gait;
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    if (spd > 180) return 'run';
    if (spd > 20) return 'walk';
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

  function hasMoveInput() {
    if (input.touchActive) return true;
    if (input.normX || input.normY) return true;
    const k = input.keys || {};
    return !!(k.w || k.a || k.s || k.d || k.ArrowUp || k.ArrowDown || k.ArrowLeft || k.ArrowRight);
  }

  const _move = updateMovement;
  updateMovement = function (dt) {
    _move(dt);
    if (!hasMoveInput()) {
      localPlayer.vx = 0;
      localPlayer.vy = 0;
      input.normX = 0;
      input.normY = 0;
    }
  };

  const _av = renderAvatar;
  renderAvatar = function (p, isSelf) {
    if (!p) return;
    advanceStep(p);
    const gait = gaitOf(p);
    const bob = gait === 'run' ? RUN_BOB : (gait === 'walk' ? WALK_BOB : 0);
    const phase = p._stepPhase || 0;
    const bobY = Math.sin(phase * Math.PI * 2) * bob;
    ctx.save();
    ctx.translate(0, bobY);
    if (_av) _av(p, isSelf);
    ctx.restore();
  };

  const _sim = updateSimulation;
  updateSimulation = function (dt) {
    _sim(dt);
    if (typeof simulatedPlayers !== 'undefined') {
      simulatedPlayers.forEach(function (b) { advanceStep(b); });
    }
  };
})();
