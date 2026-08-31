(function () {
  const T = window.KELO_TILE || 32;
  const OX = 1024, OY = 1216;
  const keep = [];
  obstacles.forEach(function (o) {
    const oldWall =
      (o.x === 1150 && o.y === 1400) ||
      (o.x === 1530 && o.y === 1400) ||
      (o.x === 1300 && o.y === 1250) ||
      (o.x === 1300 && o.y === 1870);
    if (!oldWall) keep.push(o);
  });
  obstacles.length = 0;
  keep.forEach(function (o) { obstacles.push(o); });
  [
    { x: OX + 4 * T, y: OY + 2 * T - 20, w: 5 * T, h: 3 * T + 20 },
    { x: OX + 20 * T, y: OY + 5 * T - 20, w: 4 * T, h: 3 * T + 20 },
    { x: OX + 2 * T, y: OY + 8 * T - 20, w: 4 * T, h: 3 * T + 20 },
    { x: OX + 18 * T, y: OY + 14 * T - 20, w: 5 * T, h: 3 * T + 20 }
  ].forEach(function (b) { obstacles.push(b); });
})();
