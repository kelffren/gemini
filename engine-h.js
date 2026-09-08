/* KELO-INDEX
 * area: LEGACY HD RENDER SUPPORT
 * owner: HD/pixel-perfect compatibility; frame extension owned by KeloRender
 * keys: HIDPI PIXEL PERFECT PLAZA FALLBACK RENDER FOUNDATION
 * purpose: conserva DPR/zoom/fallback procedural sin envolver render
 * public-api: KELO_HD_RENDER, resize compatibility
 * consumes: KeloRender, mobile performance contract, canvas/ctx
 * state-owned: plazaReady legacy
 * extension-points: KeloRender.beforeFrame/afterFrame
 * reuse: no añadir renderers nuevos aquí
 * legacy: resize/zoom ownership aún pendiente de consolidación
 * do-not: NO envolver render
 */
(function () {
  const mobilePerf = window.KELO_MOBILE_PERFORMANCE_CONTRACT;
  const dprCap = Number(mobilePerf?.dprCap) || 3;
  function activeDpr(){ return Math.min(window.devicePixelRatio || 1, dprCap); }
  function pixelPerfectZoom(target){
    const dpr = activeDpr();
    const physicalScale = Math.max(1, Math.round((target || 1) * dpr));
    return physicalScale / dpr;
  }
  if (typeof CONFIG !== 'undefined') {
    CONFIG.zoom = pixelPerfectZoom(1);
    CONFIG.roundPixels = true;
  }
  if (typeof cycleZoom === 'function') {
    const zoomTargets = [0.55, 1, 1.45];
    cycleZoom = function () {
      const dpr = activeDpr();
      const steps = [...new Set(zoomTargets.map(pixelPerfectZoom))];
      let i = steps.findIndex(v => Math.abs(v - (CONFIG.zoom || 1)) < 0.001);
      if (i < 0) i = 0;
      CONFIG.zoom = steps[(i + 1) % steps.length];
      if (typeof showToast === 'function') showToast('Zoom HD ' + CONFIG.zoom.toFixed(2));
      if (typeof closeMenu === 'function') closeMenu();
    };
  }

  let plazaReady = false;
  resize = function () {
    screenW = window.innerWidth;
    screenH = window.innerHeight;
    const dpr = activeDpr();
    canvas.width = Math.floor(screenW * dpr);
    canvas.height = Math.floor(screenH * dpr);
    canvas.style.width = screenW + 'px';
    canvas.style.height = screenH + 'px';
    canvas.style.imageRendering = 'pixelated';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    try { window.dispatchEvent(new CustomEvent('kelo:world-audit')); } catch (e) {}
  };
  resize();
  const PLAZA = { x: 1040, y: 1240, w: 800, h: 560 };
  function drawMarblePlaza() {
    const p = PLAZA;
    ctx.save();
    if (!plazaReady) {
      const g = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
      g.addColorStop(0, '#12141a');
      g.addColorStop(0.5, '#1c1a16');
      g.addColorStop(1, '#0e1014');
      ctx.fillStyle = g;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = 'rgba(212,175,55,0.45)';
      ctx.lineWidth = 3;
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      ctx.strokeRect(p.x + 90, p.y + 70, p.w - 180, p.h - 140);
      ctx.beginPath();
      ctx.moveTo(cx, cy - 90); ctx.lineTo(cx + 90, cy); ctx.lineTo(cx, cy + 90); ctx.lineTo(cx - 90, cy); ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(212,175,55,0.28)';
      ctx.strokeRect(p.x + 16, p.y + 90, 150, 280);
      ctx.strokeRect(p.x + p.w - 166, p.y + 90, 150, 280);
      [[cx - 160, cy - 120], [cx + 160, cy - 120], [cx - 160, cy + 120], [cx + 160, cy + 120]].forEach(function (pt) {
        ctx.fillStyle = 'rgba(255,210,120,0.18)';
        ctx.beginPath(); ctx.arc(pt[0], pt[1], 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e7c56a';
        ctx.beginPath(); ctx.arc(pt[0], pt[1], 4, 0, Math.PI * 2); ctx.fill();
      });
    }
    const lg = ctx.createRadialGradient(localPlayer.x, localPlayer.y, 20, localPlayer.x, localPlayer.y, 280);
    lg.addColorStop(0, 'rgba(255,210,120,0.08)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
  }

  let restoreFillRect = null;
  function prepareLegacyFillRect() {
    ctx.imageSmoothingEnabled = false;
    const origFillRect = ctx.fillRect.bind(ctx);
    restoreFillRect = origFillRect;
    ctx.fillRect = function (x, y, w, h) {
      if (w === 520 && h === 520) { drawMarblePlaza(); return; }
      origFillRect(x, y, w, h);
    };
  }
  function restoreLegacyFillRect() {
    if (restoreFillRect) {
      ctx.fillRect = restoreFillRect;
      restoreFillRect = null;
    }
    ctx.imageSmoothingEnabled = false;
  }
  if(!window.KeloRender) throw new Error('KeloRender unavailable before engine-h');
  window.KeloRender.beforeFrame('engine-h:legacy-plaza-fillrect', prepareLegacyFillRect, 30);
  window.KeloRender.afterFrame('engine-h:legacy-plaza-fillrect', restoreLegacyFillRect, 30);

  window.KELO_HD_RENDER = Object.freeze({mode:'hidpi-pixel-perfect-v2',dprCap,defaultZoom:CONFIG.zoom,smoothing:false,mobilePerformanceContractVersion:mobilePerf?.version||null,renderOwner:'KeloRender'});
  window.KELO_LEGACY_PLAZA_IMAGE_DISABLED = true;
})();