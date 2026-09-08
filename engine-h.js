/* KELO-INDEX
 * area: LEGACY HD RENDER SUPPORT
 * owner: HD/pixel-perfect compatibility; camera/viewport owned by KeloCamera; frame extension owned by KeloRender
 * keys: HIDPI PIXEL PERFECT PLAZA FALLBACK RENDER CAMERA FOUNDATION
 * purpose: conserva DPR/pixel-perfect/fallback procedural sin poseer resize, zoom ni render
 * public-api: KELO_HD_RENDER
 * consumes: KeloCamera, KeloRender, mobile performance contract, canvas/ctx
 * state-owned: plazaReady legacy
 * extension-points: KeloCamera.configureViewport + KeloRender.beforeFrame/afterFrame
 * reuse: políticas de viewport se configuran en KeloCamera; no reemplazar resize/cycleZoom aquí
 * legacy: fallback procedural de plaza permanece; cámara ya migrada
 * do-not: NO envolver render, NO reemplazar resize/cycleZoom, NO escribir CONFIG.zoom/canvas size
 */
(function () {
  const mobilePerf = window.KELO_MOBILE_PERFORMANCE_CONTRACT;
  const cameraOwner = window.KeloCamera;
  const dprCap = Number(mobilePerf?.dprCap) || 3;
  if(!cameraOwner) throw new Error('KeloCamera unavailable before engine-h');

  cameraOwner.configureViewport({dprCap,pixelPerfect:true,roundPixels:true,smoothing:false,imageRendering:'pixelated'});
  const defaultBaseZoom=cameraOwner.pixelPerfectZoom(1);
  cameraOwner.setBaseZoom(defaultBaseZoom,'engine-h-default');
  cameraOwner.syncViewport('engine-h-boot');

  let plazaReady = false;
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
  let legacyPlazaPatchedFrames = 0;
  let legacyPlazaInterceptHits = 0;
  let legacyPlazaInterceptFrames = 0;
  let legacyPlazaHitThisFrame = false;
  function prepareLegacyFillRect() {
    ctx.imageSmoothingEnabled = false;
    legacyPlazaPatchedFrames++;
    legacyPlazaHitThisFrame = false;
    const origFillRect = ctx.fillRect.bind(ctx);
    restoreFillRect = origFillRect;
    ctx.fillRect = function (x, y, w, h) {
      if (w === 520 && h === 520) {
        legacyPlazaInterceptHits++;
        if (!legacyPlazaHitThisFrame) { legacyPlazaHitThisFrame = true; legacyPlazaInterceptFrames++; }
        drawMarblePlaza();
        return;
      }
      origFillRect(x, y, w, h);
    };
  }
  function restoreLegacyFillRect() {
    if (restoreFillRect) { ctx.fillRect = restoreFillRect; restoreFillRect = null; }
    ctx.imageSmoothingEnabled = false;
  }
  if(!window.KeloRender) throw new Error('KeloRender unavailable before engine-h');
  window.KeloRender.beforeFrame('engine-h:legacy-plaza-fillrect', prepareLegacyFillRect, 30);
  window.KeloRender.afterFrame('engine-h:legacy-plaza-fillrect', restoreLegacyFillRect, 30);

  window.KELO_HD_RENDER = Object.freeze({
    mode:'hidpi-pixel-perfect-v3-camera-owner',
    dprCap,
    defaultZoom:cameraOwner.getEffectiveZoom(),
    defaultBaseZoom:cameraOwner.getBaseZoom(),
    smoothing:false,
    mobilePerformanceContractVersion:mobilePerf?.version||null,
    cameraOwner:'KeloCamera',
    renderOwner:'KeloRender',
    directViewportWrites:false,
    directZoomWrites:false,
    hotPathAuditVersion:'legacy-plaza-intercept-v1',
    get legacyPlazaPatchedFrames(){return legacyPlazaPatchedFrames;},
    get legacyPlazaInterceptHits(){return legacyPlazaInterceptHits;},
    get legacyPlazaInterceptFrames(){return legacyPlazaInterceptFrames;}
  });
  window.KELO_LEGACY_PLAZA_IMAGE_DISABLED = true;
})();