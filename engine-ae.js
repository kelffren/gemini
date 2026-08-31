(function () {
  const T = window.KELO_TILE || 32;
  const OX = 1024, OY = 1216;

  const skipFill = { '#222b38': 1, '#222B38': 1, 'rgb(34, 43, 56)': 1 };
  const skipStroke = { '#38465c': 1, '#38465C': 1, 'rgb(56, 70, 92)': 1 };
  const _fill = CanvasRenderingContext2D.prototype.fillRect;
  const _stroke = CanvasRenderingContext2D.prototype.strokeRect;
  CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
    const s = String(this.fillStyle).toLowerCase();
    if (s === '#222b38' || s === 'rgb(34, 43, 56)') return;
    return _fill.call(this, x, y, w, h);
  };
  CanvasRenderingContext2D.prototype.strokeRect = function (x, y, w, h) {
    const s = String(this.strokeStyle).toLowerCase();
    if (s === '#38465c' || s === 'rgb(56, 70, 92)') return;
    if (s === '#8a7040' && w > 80) return;
    return _stroke.call(this, x, y, w, h);
  };

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if ((o.x === 1150 && o.y === 1400) || (o.x === 1530 && o.y === 1400) ||
        (o.x === 1300 && o.y === 1250) || (o.x === 1300 && o.y === 1870)) {
      obstacles.splice(i, 1);
    }
  }
  [
    { x: OX + 4 * T, y: OY + 2 * T, w: 5 * T, h: 3 * T, noDraw: true },
    { x: OX + 20 * T, y: OY + 5 * T, w: 4 * T, h: 3 * T, noDraw: true },
    { x: OX + 2 * T, y: OY + 8 * T, w: 4 * T, h: 3 * T, noDraw: true },
    { x: OX + 18 * T, y: OY + 14 * T, w: 5 * T, h: 3 * T, noDraw: true }
  ].forEach(function (b) { obstacles.push(b); });

  const yo = document.querySelectorAll('.btn-panel-toggle');
  yo.forEach(function (b) {
    if (b.textContent.trim() === 'Yo') b.style.display = 'none';
  });
})();
