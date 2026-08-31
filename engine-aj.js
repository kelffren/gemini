(function () {
  // Solo limpia obstaculos duplicados. El anti-jitter bloqueaba el movimiento.
  const seen = {};
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    const k = Math.round(o.x) + ':' + Math.round(o.y);
    if (seen[k]) obstacles.splice(i, 1);
    else seen[k] = true;
  }
})();
