(function () {
  // Solo freno al soltar. El bob visual se quito: movia sombra+sprite y flotaba.
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
})();
