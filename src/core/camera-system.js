/* KELO-INDEX
 * area: CORE / CAMERA
 * owner: KeloCamera
 * keys: CAMERA VIEWPORT ZOOM DPR FOCUS SCREEN WORLD ORIENTATION FOUNDATION
 * purpose: owner único para comandos de cámara, zoom, viewport/Canvas y conversiones screen↔world sin reescribir el follow legacy
 * public-api: KeloCamera
 * consumes: camera, CONFIG, canvas, ctx, screenW/screenH y updateCamera legacy de engine-a
 * state-owned: targetX/Y, zoom efectivo/base, viewport policy, DPR policy y comandos externos de foco
 * extension-points: setTarget/focus/setBaseZoom/configureViewport/syncViewport/setFollowTuning
 * reuse: gameplay pide foco/zoom al owner; UI/orientación delegan viewport y framing aquí
 * legacy: engine-a conserva temporalmente la matemática interna de follow/dead-zone; writers legacy de target/zoom quedan capturados por adapters de propiedad
 * do-not: NO escribir camera.targetX/Y, CONFIG.zoom, canvas.width/height o reemplazar resize desde features nuevas
 */
(function(root){
  'use strict';
  if(root.KeloCamera)return;
  if(typeof camera==='undefined'||typeof CONFIG==='undefined'||typeof canvas==='undefined'||typeof ctx==='undefined'){
    throw new Error('KeloCamera: legacy camera/canvas core unavailable');
  }

  const VERSION='kelo-camera-v1.1.0';
  const ZOOM_PRESETS=Object.freeze([0.7,0.82,1]);
  const legacyUpdateCamera=typeof updateCamera==='function'?updateCamera:null;
  let baseZoom=Number.isFinite(Number(CONFIG.zoom))&&Number(CONFIG.zoom)>0?Number(CONFIG.zoom):0.82;
  let effectiveZoom=baseZoom;
  let managedTargetX=Number(camera.targetX)||0;
  let managedTargetY=Number(camera.targetY)||0;
  let dprCap=3;
  let pixelPerfect=false;
  let roundPixels=!!CONFIG.roundPixels;
  let smoothing=true;
  let imageRendering='auto';
  let viewportScheduled=false;
  let lastEffectiveZoom=null;
  let lastViewportKey='';

  Object.defineProperty(camera,'targetX',{configurable:true,enumerable:true,get:()=>managedTargetX,set:value=>{const n=Number(value);if(Number.isFinite(n))managedTargetX=n;}});
  Object.defineProperty(camera,'targetY',{configurable:true,enumerable:true,get:()=>managedTargetY,set:value=>{const n=Number(value);if(Number.isFinite(n))managedTargetY=n;}});
  Object.defineProperty(CONFIG,'zoom',{configurable:true,enumerable:true,get:()=>effectiveZoom,set:value=>{
    const n=Number(value);
    if(Number.isFinite(n)&&n>0){baseZoom=n;effectiveZoom=n;}
  }});

  function orientation(){return root.innerWidth>=root.innerHeight?'landscape':'portrait';}
  function activeDpr(){return Math.max(1,Math.min(Number(root.devicePixelRatio)||1,Math.max(1,Number(dprCap)||1)));}
  function pixelPerfectZoom(target){
    const dpr=activeDpr();
    const physicalScale=Math.max(1,Math.round((Number(target)||1)*dpr));
    return physicalScale/dpr;
  }
  function effectiveZoomFor(base,mode){
    const b=Math.max(0.05,Number(base)||1);
    if(mode!=='landscape')return b;
    const w=Math.max(1,root.innerWidth),h=Math.max(1,root.innerHeight);
    return b*(h/w);
  }
  function emit(name,detail){try{root.dispatchEvent(new CustomEvent(name,{detail}));}catch(e){}}
  function syncViewportCss(){
    const rootEl=document.documentElement;
    rootEl.style.setProperty('--kelo-vw',`${root.innerWidth}px`);
    rootEl.style.setProperty('--kelo-vh',`${root.innerHeight}px`);
  }
  function applyZoom(source){
    const mode=orientation();
    effectiveZoom=effectiveZoomFor(baseZoom,mode);
    document.documentElement.style.setProperty('--kelo-camera-zoom',String(effectiveZoom));
    const changed=!Number.isFinite(lastEffectiveZoom)||Math.abs(lastEffectiveZoom-effectiveZoom)>0.0001;
    lastEffectiveZoom=effectiveZoom;
    if(changed){
      emit('kelo:camerazoomchange',{
        source:source||'camera',orientation:mode,baseZoom,effectiveZoom,
        verticalWorldSpan:root.innerHeight/effectiveZoom,
        portraitReferenceWorldSpan:Math.max(root.innerWidth,root.innerHeight)/baseZoom
      });
    }
    return effectiveZoom;
  }
  function configureViewport(options){
    const opts=options||{};
    if(Number.isFinite(Number(opts.dprCap))&&Number(opts.dprCap)>0)dprCap=Number(opts.dprCap);
    if(typeof opts.pixelPerfect==='boolean')pixelPerfect=opts.pixelPerfect;
    if(typeof opts.roundPixels==='boolean')roundPixels=opts.roundPixels;
    if(typeof opts.smoothing==='boolean')smoothing=opts.smoothing;
    if(typeof opts.imageRendering==='string')imageRendering=opts.imageRendering;
    CONFIG.roundPixels=roundPixels;
    return snapshot();
  }
  function syncViewport(source){
    screenW=root.innerWidth;
    screenH=root.innerHeight;
    const dpr=activeDpr();
    const width=Math.max(1,Math.floor(screenW*dpr));
    const height=Math.max(1,Math.floor(screenH*dpr));
    if(canvas.width!==width)canvas.width=width;
    if(canvas.height!==height)canvas.height=height;
    canvas.style.width=screenW+'px';
    canvas.style.height=screenH+'px';
    canvas.style.imageRendering=imageRendering;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.imageSmoothingEnabled=smoothing;
    CONFIG.roundPixels=roundPixels;
    syncViewportCss();
    const zoom=applyZoom(source||'viewport');
    const key=[screenW,screenH,dpr,zoom].join(':');
    if(key!==lastViewportKey){
      lastViewportKey=key;
      emit('kelo:viewportchange',{source:source||'viewport',width:screenW,height:screenH,dpr,orientation:orientation(),baseZoom,effectiveZoom:zoom});
      try{root.dispatchEvent(new CustomEvent('kelo:world-audit'));}catch(e){}
    }
    return snapshot();
  }
  function scheduleViewportSync(source){
    if(viewportScheduled)return;
    viewportScheduled=true;
    requestAnimationFrame(()=>{viewportScheduled=false;syncViewport(source||'scheduled-resize');});
  }
  function setBaseZoom(value,source){
    const next=Number(value);
    if(!Number.isFinite(next)||next<=0)return applyZoom(source||'invalid-base');
    baseZoom=next;
    return applyZoom(source||'set-base');
  }
  function nearestPresetIndex(value){
    let best=0,dist=Infinity;
    ZOOM_PRESETS.forEach((z,i)=>{const d=Math.abs(z-value);if(d<dist){dist=d;best=i;}});
    return best;
  }
  function cycleZoom(source){
    const i=nearestPresetIndex(baseZoom);
    const next=ZOOM_PRESETS[(i+1)%ZOOM_PRESETS.length];
    setBaseZoom(next,source||'cycle');
    if(typeof showToast==='function')showToast('Zoom '+next+(orientation()==='landscape'?' · cámara adaptada':''));
    if(typeof closeMenu==='function')closeMenu();
    return next;
  }
  function setTarget(x,y,options){
    const nx=Number(x),ny=Number(y),opts=options||{};
    if(!Number.isFinite(nx)||!Number.isFinite(ny))return false;
    managedTargetX=nx;managedTargetY=ny;
    if(opts.snap===true){camera.x=nx;camera.y=ny;camera.lookOffsetX=0;camera.lookOffsetY=0;}
    emit('kelo:cameratargetchange',{source:opts.source||'api',x:nx,y:ny,snap:opts.snap===true});
    return true;
  }
  function focus(value,options){if(!value)return false;return setTarget(value.x,value.y,options);}
  function setFollowTuning(next){
    const values=next||{};
    for(const key of ['dampX','dampY','deadXRatio','deadYRatio','lookAheadDist','lookAheadDecay']){
      const value=Number(values[key]);if(Number.isFinite(value))CONFIG[key]=value;
    }
    return Object.freeze({dampX:CONFIG.dampX,dampY:CONFIG.dampY,deadXRatio:CONFIG.deadXRatio,deadYRatio:CONFIG.deadYRatio,lookAheadDist:CONFIG.lookAheadDist,lookAheadDecay:CONFIG.lookAheadDecay});
  }
  function screenToWorldPoint(sx,sy){
    const z=effectiveZoom||1;
    return{x:camera.x+(Number(sx)-screenW/2)/z,y:camera.y+(Number(sy)-screenH/2)/z};
  }
  function worldToScreenPoint(wx,wy){
    const z=effectiveZoom||1;
    return{x:(Number(wx)-camera.x)*z+screenW/2,y:(Number(wy)-camera.y)*z+screenH/2};
  }
  function update(dt){if(legacyUpdateCamera)legacyUpdateCamera(dt);}
  function refreshZoom(source){return applyZoom(source||'refresh');}
  function snapshot(){return Object.freeze({version:VERSION,x:camera.x,y:camera.y,targetX:managedTargetX,targetY:managedTargetY,baseZoom,effectiveZoom,orientation:orientation(),screenW,screenH,dpr:activeDpr(),dprCap,pixelPerfect,roundPixels,smoothing});}

  root.updateCamera=update;
  root.resize=()=>syncViewport('legacy-resize-call');
  root.cycleZoom=()=>cycleZoom('legacy-cycle');
  root.addEventListener('resize',()=>scheduleViewportSync('resize'),{passive:true});
  root.visualViewport?.addEventListener('resize',()=>scheduleViewportSync('visualViewport'),{passive:true});

  root.KeloCamera=Object.freeze({
    version:VERSION,
    setTarget,focus,setFollowTuning,
    setBaseZoom,getBaseZoom:()=>baseZoom,getEffectiveZoom:()=>effectiveZoom,
    cycleZoom,refreshZoom,getOrientation:orientation,
    configureViewport,syncViewport,scheduleViewportSync,syncViewportCss,
    activeDpr,pixelPerfectZoom,
    screenToWorld:screenToWorldPoint,worldToScreen:worldToScreenPoint,
    snapshot
  });
  root.KELO_CAMERA_AUDIT=Object.freeze({version:VERSION,owner:'KeloCamera',legacyFollowMath:true,legacyTargetAdapter:true,legacyZoomAdapter:true,updateCameraOwner:true,viewportOwner:true,zoomOwner:true,targetOwner:true,screenWorldOwner:true});
})(typeof globalThis!=='undefined'?globalThis:window);
