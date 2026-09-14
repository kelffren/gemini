/* KELO-INDEX
 * area: STUDIO / OVERLAY CANVAS
 * owns: optional separate editor canvas lifecycle
 * does-not-own: world canvas or input
 * public-api: createStudioOverlayCanvas()
 * online: no
 * mobile: iPhone dpr=3 must not allocate a 1179×2556 overlay on top of the game canvas
 */

function capOverlayDpr(raw){
  const n=Math.max(1,Number(raw)||1);
  const ua=String(globalThis.navigator?.userAgent||'');
  const short=Math.min(Number(globalThis.innerWidth)||999,Number(globalThis.innerHeight)||999);
  const mobile=/iPhone|iPad|iPod|Android/i.test(ua)||short<=900;
  return Math.min(n, mobile ? 1.5 : 2);
}

export function createStudioOverlayCanvas({ host = globalThis.document?.body, className = 'kelo-studio-overlay' } = {}) {
  const document = host?.ownerDocument || globalThis.document;
  if (!document || !host?.appendChild) throw new Error('STUDIO_OVERLAY_HOST_REQUIRED');
  const canvas = document.createElement('canvas');
  canvas.className = className;
  Object.assign(canvas.style, { position:'absolute', inset:'0', width:'100%', height:'100%', pointerEvents:'none', zIndex:'240' });
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha:true });
  let dprCap = capOverlayDpr(globalThis.devicePixelRatio || 1);
  function resize(width = host.clientWidth || globalThis.innerWidth || 1, height = host.clientHeight || globalThis.innerHeight || 1, dpr = dprCap) {
    dprCap = capOverlayDpr(dpr);
    const w=Math.max(1,Math.round(width*dprCap)), h=Math.max(1,Math.round(height*dprCap));
    if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;ctx.setTransform(dprCap,0,0,dprCap,0,0); return {width,height,dpr:dprCap};
  }
  function clear() { ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.restore(); ctx.setTransform(dprCap,0,0,dprCap,0,0); }
  resize();
  return Object.freeze({ canvas, ctx, resize, clear, get dpr(){return dprCap;}, destroy(){ canvas.remove(); } });
}
