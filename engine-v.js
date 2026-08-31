(function () {
  const SCALE = 1.9;
  const _av = renderAvatar;
  renderAvatar = function (p, isSelf) {
    if (!p) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(SCALE, SCALE);
    ctx.translate(-p.x, -p.y);
    _av(p, isSelf);
    ctx.restore();
  };
  if (localPlayer) {
    localPlayer.radius = Math.max(localPlayer.radius || 20, 26);
  }
  if (typeof simulatedPlayers !== 'undefined') {
    simulatedPlayers.forEach(function (p) {
      p.radius = Math.max(p.radius || 16, 24);
    });
  }
})();
