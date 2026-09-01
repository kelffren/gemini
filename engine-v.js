(function () {
  const SCALE = 1.35;
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
})();
