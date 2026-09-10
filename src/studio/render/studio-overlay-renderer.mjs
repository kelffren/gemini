/* KELO-INDEX
 * area: STUDIO / OVERLAY RENDERER
 * owns: transient editor-only selection/ghost/gizmo/surface/collision/prefab/smart-guide primitives
 * does-not-own: world rendering, terrain textures, gameplay sprites or physics
 * public-api: createStudioOverlayRenderer()
 * online: local-only
 */

export function createStudioOverlayRenderer({ kernel, tools, assetPreview } = {}) {
  if (!kernel) throw new Error('STUDIO_OVERLAY_KERNEL_REQUIRED');
  function drawRect(ctx, rect, { dashed = false, alpha = 1 } = {}) { ctx.save(); ctx.globalAlpha *= alpha; if (dashed) ctx.setLineDash([6,4]); ctx.strokeRect(rect.x, rect.y, rect.w, rect.h); ctx.restore(); }
  function drawSurfaceCell(ctx,cell,{alpha=.24,dashed=false}={}){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=cell.erase?'#ff7777':cell.role==='path'?'#e7c56a':'#70c46a';ctx.fillRect(cell.x,cell.y,cell.w,cell.h);ctx.restore();drawRect(ctx,cell,{dashed,alpha:.65});}
  function drawPlacement(ctx,placement){
    const rect={x:placement.transform.x,y:placement.transform.y,w:placement.bounds.w,h:placement.bounds.h};
    const drew=assetPreview?.drawAsset?.(ctx,placement.prefabId,rect.x,rect.y,{rotation:placement.transform.rotation,alpha:.72,placeholder:false});
    if(!drew){ctx.save();ctx.globalAlpha=.18;ctx.fillRect(rect.x,rect.y,rect.w,rect.h);ctx.restore();}
    ctx.save();ctx.strokeStyle='rgba(131,235,175,.95)';drawRect(ctx,rect,{dashed:true});ctx.restore();
  }
  function drawCreatorPrefab(ctx,preview){
    const def=tools?.prefabStamp?.get?.(preview.prefabId);let drew=false;
    if(def?.children?.length){for(const child of def.children)drew=assetPreview?.drawAsset?.(ctx,child.prefabId,preview.x+(Number(child.dx)||0),preview.y+(Number(child.dy)||0),{rotation:Number(child.rotation)||0,alpha:.68,placeholder:false})||drew;}
    if(!drew){ctx.save();ctx.globalAlpha=.14;ctx.fillStyle='#e7c56a';ctx.fillRect(preview.x,preview.y,preview.w,preview.h);ctx.restore();}
    ctx.save();ctx.strokeStyle='rgba(231,197,106,.95)';drawRect(ctx,preview,{dashed:true});ctx.restore();
  }
  function drawSmartGuides(ctx,guides){
    if(!guides?.length)return;ctx.save();ctx.strokeStyle='rgba(244,221,141,.96)';ctx.fillStyle='rgba(244,221,141,.96)';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);
    for(const guide of guides){ctx.beginPath();if(guide.axis==='x'){ctx.moveTo(guide.position,guide.from);ctx.lineTo(guide.position,guide.to);}else{ctx.moveTo(guide.from,guide.position);ctx.lineTo(guide.to,guide.position);}ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(guide.axis==='x'?guide.position:guide.from,guide.axis==='x'?guide.from:guide.position,2.5,0,Math.PI*2);ctx.fill();ctx.setLineDash([5,4]);}
    ctx.restore();
  }
  function draw(ctx) {
    if (!ctx) return;ctx.save();ctx.lineWidth = 2;
    for (const id of kernel.selection.get()) { const row = kernel.spatial.get(id); if (row?.rect) drawRect(ctx, row.rect); }
    const marquee=tools?.marquee?.getPreview?.();if(marquee){ctx.save();ctx.fillStyle='rgba(231,197,106,.10)';ctx.fillRect(marquee.x,marquee.y,marquee.w,marquee.h);ctx.strokeStyle='rgba(231,197,106,.85)';drawRect(ctx,marquee,{dashed:true});ctx.restore();}
    const placement = tools?.placement?.getPreview?.();if (placement) drawPlacement(ctx,placement);
    const prefab = tools?.prefabStamp?.getPreview?.();if(prefab)drawCreatorPrefab(ctx,prefab);
    const transforms=tools?.transform?.getPreviews?.()||[];if(transforms.length){for(const transform of transforms){const row=kernel.spatial.get(transform.entityId);if(row?.rect)drawRect(ctx,{...row.rect,x:transform.x??row.rect.x,y:transform.y??row.rect.y},{dashed:true,alpha:.7});}drawSmartGuides(ctx,tools?.transform?.getGuides?.()||[]);}
    const stroke=tools?.terrain?.getStrokePreview?.();if(stroke?.cells?.length){for(const cell of stroke.cells)drawSurfaceCell(ctx,cell,{alpha:.20});}
    const terrain=tools?.terrain?.getPreview?.();if(terrain){const cells=terrain.cells?.length?terrain.cells:[terrain];for(const cell of cells)drawSurfaceCell(ctx,cell,{alpha:.28,dashed:true});}
    if (tools?.collision?.visible) { ctx.save();ctx.strokeStyle='rgba(255,105,105,.72)';ctx.fillStyle='rgba(255,80,80,.10)';for(const row of tools.collision.list?.()||[]){ctx.fillRect(row.x,row.y,row.w,row.h);drawRect(ctx,row,{alpha:.75});}const collision=tools.collision.getPreview?.();if(collision){ctx.globalAlpha=.28;ctx.fillRect(collision.x,collision.y,collision.w,collision.h);drawRect(ctx,collision,{dashed:true,alpha:1});}ctx.restore(); }
    ctx.restore();
  }
  return Object.freeze({ draw });
}
