(function () {
  const PLAZA = { x: 1040, y: 1240, w: 800, h: 560 };

  function inPlaza(o) {
    const x = o.x || 0, y = o.y || 0, w = o.w || o.width || 0, h = o.h || o.height || 0;
    return x < PLAZA.x + PLAZA.w && x + w > PLAZA.x && y < PLAZA.y + PLAZA.h && y + h > PLAZA.y;
  }
  if (Array.isArray(obstacles)) {
    for (let i = obstacles.length - 1; i >= 0; i--) {
      if (inPlaza(obstacles[i])) obstacles.splice(i, 1);
    }
  }

  function applyHiDPI() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    screenW = window.innerWidth;
    screenH = window.innerHeight;
    const needW = Math.floor(screenW * dpr);
    const needH = Math.floor(screenH * dpr);
    if (canvas.width !== needW || canvas.height !== needH) {
      canvas.width = needW;
      canvas.height = needH;
      canvas.style.width = screenW + 'px';
      canvas.style.height = screenH + 'px';
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  function landingPoint() {
    const range = skillAim.castRange || 120;
    return {
      x: localPlayer.x + (skillAim.dirX || 1) * range,
      y: localPlayer.y + (skillAim.dirY || 0) * range,
      range: range
    };
  }

  function burst(x, y, color, n, size) {
    if (typeof spawnParticle !== 'function') return;
    for (let i = 0; i < n; i++) {
      spawnParticle(
        x + (Math.random() - 0.5) * 28,
        y + (Math.random() - 0.5) * 28,
        color || '#ffd166',
        size || 16,
        0.35 + Math.random() * 0.5
      );
    }
  }

  function trailLine(x1, y1, x2, y2, color) {
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      burst(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, color, 2, 12);
    }
    if (typeof spawnDashTrail === 'function') spawnDashTrail(x1, y1, x2, y2, color);
  }

  const _cast = castAimedSkill;
  castAimedSkill = function(index, typeId, dirX, dirY) {
    const stone = STATE.equipped[index];
    if (!stone || stone.currentCd > 0) return;
    const land = landingPoint();
    const color = stone.color || '#ffd166';
    if (typeId === 'dash') {
      stone.currentCd = stone.baseCd;
      dashTween.active = true;
      dashTween.t = 0;
      dashTween.dur = 0.11 + 0.08 * (land.range / 170);
      dashTween.fromX = localPlayer.x;
      dashTween.fromY = localPlayer.y;
      dashTween.toX = Math.max(24, Math.min(CONFIG.worldWidth - 24, land.x));
      dashTween.toY = Math.max(24, Math.min(CONFIG.worldHeight - 24, land.y));
      aim.x = dirX; aim.y = dirY;
      trailLine(dashTween.fromX, dashTween.fromY, dashTween.toX, dashTween.toY, color);
      burst(dashTween.toX, dashTween.toY, color, 14, 18);
      return;
    }
    _cast(index, typeId, dirX, dirY);
    trailLine(localPlayer.x, localPlayer.y, land.x, land.y, color);
    burst(land.x, land.y, color, typeId === 'meteor' ? 22 : 12, typeId === 'meteor' ? 22 : 14);
  };

  function drawLanding() {
    if (!skillAim.active) return;
    const land = landingPoint();
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    ctx.strokeStyle = 'rgba(255,214,102,0.95)';
    ctx.fillStyle = 'rgba(255,214,102,0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(localPlayer.x, localPlayer.y);
    ctx.lineTo(land.x, land.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(land.x, land.y, skillAim.typeId === 'meteor' ? 64 : 18, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(land.x - 16, land.y); ctx.lineTo(land.x + 16, land.y);
    ctx.moveTo(land.x, land.y - 16); ctx.lineTo(land.x, land.y + 16);
    ctx.stroke();
    ctx.fillStyle = '#ffe08a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('cae ' + Math.round(land.range), land.x, land.y - 28);
    ctx.restore();
  }

  const _r = render;
  render = function () {
    applyHiDPI();
    _r();
    drawLanding();
  };
})();
