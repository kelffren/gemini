/* KELO-INDEX
 * area: STUDIO / OVERLAY RENDERER
 * owns: transient editor-only selection/ghost/gizmo/surface/collision/prefab primitives
 * does-not-own: world rendering, terrain textures, gameplay sprites or physics
 * public-api: createStudioOverlayRenderer()
 * online: local-only
 */

export function createStudioOverlayRenderer({ kernel, tools } = {}) {
  if (!kernel) throw new Error('STUDIO_OVERLAY_KERNEL_REQUIRED');
  function drawRect(ctx, rect, { dashed = false, alpha = 1 } = {}) { ctx.save(); ctx.globalAlpha *= alpha; if (dashed) ctx.setLineDash([6,4]); ctx.strokeRect(rect.x, rect.y, rect.w, rect.h); ctx.restore(); }
  function drawSurfaceCell(ctx,cell,{alpha=.24,dashed=false}={}){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=cell.erase?'#ff7777':cell.role==='path'?'#e7c56a':'#70c46a';ctx.fillRect(cell.x,cell.y,cell.w,cell.h);ctx.restore();drawRect(ctx,cell,{dashed,alpha:.65});}
  function draw(ctx) {
    if (!ctx) return;ctx.save();ctx.lineWidth = 2;
    for (const id of kernel.selection.get()) { const row = kernel.spatial.get(id); if (row?.rect) drawRect(ctx, row.rect); }
    const placement = tools?.placement?.getPreview?.();if (placement) { ctx.save();ctx.globalAlpha=.35;ctx.fillRect(placement.transform.x,placement.transform.y,placement.bounds.w,placement.bounds.h);ctx.restore();drawRect(ctx,{x:placement.transform.x,y:placement.transform.y,w:placement.bounds.w,h:placement.bounds.h},{dashed:true}); }
    const prefab = tools?.prefabStamp?.getPreview?.();if(prefab){ctx.save();ctx.globalAlpha=.16;ctx.fillStyle='#e7c56a';ctx.fillRect(prefab.x,prefab.y,prefab.w,prefab.h);ctx.restore();drawRect(ctx,prefab,{dashed:true,alpha:.9});}
    const transform = tools?.transform?.getPreview?.();if (transform) { const row=kernel.spatial.get(transform.entityId);if(row?.rect)drawRect(ctx,{...row.rect,x:transform.x??row.rect.x,y:transform.y??row.rect.y},{dashed:true,alpha:.7}); }
    const stroke=tools?.terrain?.getStrokePreview?.();if(stroke?.cells?.length){for(const cell of stroke.cells)drawSurfaceCell(ctx,cell,{alpha:.20});}
    const terrain=tools?.terrain?.getPreview?.();if(terrain){const cells=terrain.cells?.length?terrain.cells:[terrain];for(const cell of cells)drawSurfaceCell(ctx,cell,{alpha:.28,dashed:true});}
    if (tools?.collision?.visible) { ctx.save();ctx.strokeStyle='rgba(255,105,105,.72)';ctx.fillStyle='rgba(255,80,80,.10)';for(const row of tools.collision.list?.()||[]){ctx.fillRect(row.x,row.y,row.w,row.h);drawRect(ctx,row,{alpha:.75});}const collision=tools.collision.getPreview?.();if(collision){ctx.globalAlpha=.28;ctx.fillRect(collision.x,collision.y,collision.w,collision.h);drawRect(ctx,collision,{dashed:true,alpha:1});}ctx.restore(); }
    ctx.restore();
  }
  return Object.freeze({ draw });
}
