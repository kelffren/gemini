/* KELO-INDEX
 * area: STUDIO / OVERLAY RENDERER
 * owns: transient editor-only selection/ghost/gizmo primitives
 * does-not-own: world rendering or gameplay sprites
 * public-api: createStudioOverlayRenderer()
 * online: local-only
 */

export function createStudioOverlayRenderer({ kernel, tools } = {}) {
  if (!kernel) throw new Error('STUDIO_OVERLAY_KERNEL_REQUIRED');

  function drawRect(ctx, rect, { dashed = false, alpha = 1 } = {}) {
    ctx.save(); ctx.globalAlpha *= alpha; if (dashed) ctx.setLineDash([6,4]); ctx.strokeRect(rect.x, rect.y, rect.w, rect.h); ctx.restore();
  }

  function draw(ctx) {
    if (!ctx) return;
    ctx.save();
    ctx.lineWidth = 2;
    for (const id of kernel.selection.get()) { const row = kernel.spatial.get(id); if (row?.rect) drawRect(ctx, row.rect); }
    const placement = tools?.placement?.getPreview?.();
    if (placement) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillRect(placement.transform.x, placement.transform.y, placement.bounds.w, placement.bounds.h); ctx.restore(); drawRect(ctx, { x: placement.transform.x, y: placement.transform.y, w: placement.bounds.w, h: placement.bounds.h }, { dashed: true }); }
    const transform = tools?.transform?.getPreview?.();
    if (transform) { const row = kernel.spatial.get(transform.entityId); if (row?.rect) drawRect(ctx, { ...row.rect, x: transform.x ?? row.rect.x, y: transform.y ?? row.rect.y }, { dashed: true, alpha: 0.7 }); }
    ctx.restore();
  }

  return Object.freeze({ draw });
}
