(function () {
  const T = window.KELO_TILE || 32;
  const OX = 1024, OY = 1216;
  window._keloFrame = 0;

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if ((o.x === 1150 && o.y === 1400) || (o.x === 1530 && o.y === 1400) ||
        (o.x === 1300 && o.y === 1250) || (o.x === 1300 && o.y === 1870)) {
      obstacles.splice(i, 1);
    } else {
      o.noDraw = true;
    }
  }
  [
    { x: OX + 4 * T, y: OY + 2 * T, w: 5 * T, h: 3 * T, noDraw: true },
    { x: OX + 20 * T, y: OY + 5 * T, w: 4 * T, h: 3 * T, noDraw: true },
    { x: OX + 2 * T, y: OY + 8 * T, w: 4 * T, h: 3 * T, noDraw: true },
    { x: OX + 18 * T, y: OY + 14 * T, w: 5 * T, h: 3 * T, noDraw: true }
  ].forEach(function (b) { obstacles.push(b); });

  const _r = render;
  render = function () {
    window._keloFrame = (window._keloFrame || 0) + 1;
    _r();
  };
})();
