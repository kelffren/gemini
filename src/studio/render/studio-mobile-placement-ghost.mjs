/* KELO-INDEX
 * area: STUDIO / RENDER / MOBILE PLACEMENT GHOST
 * owns: one DPR=1 viewport canvas for the active placement preview on phones
 * does-not-own: grid, selection handles, authority or persistent world mutation
 * public-api: createStudioMobilePlacementGhost()
 * cleanup: explicit placement subscription, resize listeners, timer, RAF and canvas cleanup
 */

export function createStudioMobilePlacementGhost({root=globalThis,placement,assetPreview,getCamera=()=>({}),host=root?.document?.body}={}){
  const document=root?.document;
  if(!document||!host?.appendChild||!placement?.onPreview||!assetPreview?.drawAsset)return Object.freeze({destroy(){},refresh(){},get active(){return false;}});
  const canvas=document.createElement('canvas');
  canvas.className='kelo-studio-placement-ghost';
  canvas.dataset.keloPlacementGhost='1';
  canvas.dataset.keloGhostState='empty';
  Object.assign(canvas.style,{position:'fixed',left:'0',top:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'2147481500'});
  host.appendChild(canvas);
  const ctx=canvas.getContext('2d',{alpha:true});
  let destroyed=false,preview=placement.getPreview?.()||null,raf=0,warmSerial=0,centerLock=false,lastPreview=null;

  function camera(){const row=getCamera?.()||{};return{x:Number(row.x)||0,y:Number(row.y)||0,zoom:Math.max(.1,Number(row.zoom||row.effectiveZoom)||1)};}
  function size(){
    const vv=root.visualViewport,width=Math.max(1,Math.round(Number(vv?.width)||Number(root.innerWidth)||1)),height=Math.max(1,Math.round(Number(vv?.height)||Number(root.innerHeight)||1));
    if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;return{width,height};
  }
  function clear(){if(!ctx)return;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);}
  function queueWarm(id){const serial=++warmSerial;Promise.resolve(assetPreview.warmAsset?.(id)).then(()=>{if(!destroyed&&serial===warmSerial)schedule();}).catch(()=>{});}
  function draw(){
    raf=0;if(destroyed||!ctx)return;
    const {width,height}=size();clear();
    if(!preview?.prefabId){canvas.dataset.keloGhostState='empty';canvas.dataset.keloGhostAsset='';return;}
    const c=camera(),t=preview.transform||{};
    ctx.save();ctx.translate(width/2,height/2);ctx.scale(c.zoom,c.zoom);ctx.translate(-c.x,-c.y);
    const drew=assetPreview.drawAsset(ctx,preview.prefabId,Number(t.x)||0,Number(t.y)||0,{rotation:Number(t.rotation)||0,alpha:.82,placeholder:false});
    ctx.restore();
    canvas.dataset.keloGhostState=drew?'real':'loading';canvas.dataset.keloGhostAsset=String(preview.prefabId||'');
    if(!drew)queueWarm(preview.prefabId);
  }
  function schedule(){if(destroyed||raf)return;raf=root.requestAnimationFrame?.(draw)||(root.setTimeout||setTimeout)(draw,16);}
  function refresh(){schedule();return !!preview;}
  const unsubscribe=placement.onPreview(next=>{
    const fresh=!!next&&next!==lastPreview;
    preview=next;lastPreview=next;
    if(!next){centerLock=false;warmSerial++;schedule();return;}
    if(fresh&&!centerLock&&placement?.move){
      centerLock=true;const c=camera();
      try{placement.move(c.x,c.y,{snap:1});}catch{}
      (root.setTimeout||setTimeout)(()=>{centerLock=false;},0);
    }
    schedule();
  });
  const onResize=()=>schedule();root.addEventListener?.('resize',onResize,{passive:true});root.visualViewport?.addEventListener?.('resize',onResize,{passive:true});
  const lifeTimer=(root.setInterval||setInterval)(()=>{if(!document.getElementById('kelo-studio-live'))destroy();},1000);
  function destroy(){if(destroyed)return;destroyed=true;warmSerial++;unsubscribe?.();root.removeEventListener?.('resize',onResize);root.visualViewport?.removeEventListener?.('resize',onResize);try{(root.clearInterval||clearInterval)(lifeTimer);}catch{}if(raf){if(typeof root.cancelAnimationFrame==='function')root.cancelAnimationFrame(raf);else (root.clearTimeout||clearTimeout)(raf);raf=0;}canvas.remove();}
  schedule();
  return Object.freeze({version:'studio-mobile-placement-ghost-v1',refresh,destroy,get active(){return !!preview;},get state(){return canvas.dataset.keloGhostState||'';}});
}
