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
  const view = document.defaultView || globalThis;
  const canvas = document.createElement('canvas');
  canvas.className = className;
  // Studio is a viewport overlay. Using body.clientHeight here can allocate a canvas as
  // tall as the complete game/world document on mobile; multiplied by iPhone DPR that
  // can become hundreds of MB and block Safari's main thread while World is opening.
  Object.assign(canvas.style, { position:'fixed', inset:'0', width:'100vw', height:'100dvh', pointerEvents:'none', zIndex:'240' });
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const finitePositive=value=>Number.isFinite(Number(value))&&Number(value)>0;
  const viewport=()=>{
    const vv=view.visualViewport;
    return {
      width:Math.max(1,Number(vv?.width)||Number(document.documentElement?.clientWidth)||Number(view.innerWidth)||1),
      height:Math.max(1,Number(vv?.height)||Number(document.documentElement?.clientHeight)||Number(view.innerHeight)||1)
    };
  };
  const pixelRatio=value=>Math.max(1,Math.min(3,finitePositive(value)?Number(value):Number(view.devicePixelRatio)||1));
  function resize(width = null, height = null, dpr = null) {
    const vp=viewport(),cssWidth=finitePositive(width)?Number(width):vp.width,cssHeight=finitePositive(height)?Number(height):vp.height,ratio=pixelRatio(dpr);
    const w=Math.max(1,Math.round(cssWidth*ratio)),h=Math.max(1,Math.round(cssHeight*ratio));
    if(canvas.width!==w)canvas.width=w;
    if(canvas.height!==h)canvas.height=h;
    ctx.setTransform(ratio,0,0,ratio,0,0);
    return {width:cssWidth,height:cssHeight,dpr:ratio};
  }
  function clear() {
    const ratio=pixelRatio();
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.restore();ctx.setTransform(ratio,0,0,ratio,0,0);
  }
  resize();
  return Object.freeze({ canvas, ctx, resize, clear, destroy(){ canvas.remove(); } });
}
