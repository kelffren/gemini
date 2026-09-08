/* KELO-INDEX
 * area: STUDIO / OVERLAY CANVAS
 * owns: optional separate editor canvas lifecycle
 * does-not-own: world canvas or input
 * public-api: createStudioOverlayCanvas()
 * online: no
 */

export function createStudioOverlayCanvas({ host = globalThis.document?.body, className = 'kelo-studio-overlay' } = {}) {
  const document = host?.ownerDocument || globalThis.document;
  if (!document || !host?.appendChild) throw new Error('STUDIO_OVERLAY_HOST_REQUIRED');
  const canvas = document.createElement('canvas');
  canvas.className = className;
  Object.assign(canvas.style, { position:'absolute', inset:'0', width:'100%', height:'100%', pointerEvents:'none', zIndex:'240' });
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  function resize(width = host.clientWidth || globalThis.innerWidth || 1, height = host.clientHeight || globalThis.innerHeight || 1, dpr = globalThis.devicePixelRatio || 1) { const w=Math.max(1,Math.round(width*dpr)), h=Math.max(1,Math.round(height*dpr)); if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;ctx.setTransform(dpr,0,0,dpr,0,0); return {width,height,dpr}; }
  function clear() { const dpr = globalThis.devicePixelRatio || 1; ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.restore(); ctx.setTransform(dpr,0,0,dpr,0,0); }
  resize();
  return Object.freeze({ canvas, ctx, resize, clear, destroy(){ canvas.remove(); } });
}
