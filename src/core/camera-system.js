/* KELO-INDEX
 * area: CORE / CAMERA
 * owner: KeloCamera
 * keys: CAMERA VIEWPORT ZOOM DPR FOCUS RESTORE SCREEN WORLD ORIENTATION FOUNDATION DEADZONE REVERSAL LOOKAHEAD PVP AIM COMPOSITION
 * purpose: owner único para comandos de cámara, zoom, viewport/Canvas y conversiones screen↔world; compensa dead-zone legacy, acelera carry contrario al invertir y compone aim PvP perpendicular sin tocar gameplay
 * public-api: KeloCamera
 * consumes: camera, CONFIG, canvas, ctx, screenW/screenH, KeloInput combat snapshot y updateCamera legacy de engine-a
 * state-owned: targetX/Y, posición comandada, follow tuning, zoom efectivo/base, viewport policy, DPR policy, foco y transient camera follow intent
 * extension-points: setTarget/focus/restoreState/setBaseZoom/configureViewport/syncViewport/setFollowTuning/worldView
 * reuse: gameplay pide foco/restore/zoom al owner; render/culling consulta worldView(); UI/orientación delegan viewport y framing aquí
 * legacy: engine-a conserva temporalmente la matemática interna de follow; deadXRatio/deadYRatio se adaptan a world-space, lookAheadDecay recibe boost transitorio en reversal y el input de cámara se adapta solo durante legacyUpdateCamera
 * do-not: NO escribir camera.targetX/Y, camera.x/y por comandos externos, CONFIG.zoom/camera tuning, canvas.width/height o reemplazar resize desde features nuevas
 */
(function(root){
  'use strict';
  if(root.KeloCamera)return;
  if(typeof camera==='undefined'||typeof CONFIG==='undefined'||typeof canvas==='undefined'||typeof ctx==='undefined')throw new Error('KeloCamera: legacy camera/canvas core unavailable');

  const VERSION='kelo-camera-v1.7.0-pvp-aim-composition-a';
  const ZOOM_PRESETS=Object.freeze([0.7,0.82,1]);
  const TUNING_KEYS=Object.freeze(['dampX','dampY','deadXRatio','deadYRatio','lookAheadDist','lookAheadDecay']);
  const SCREEN_SPACE_DEADZONE_KEYS=new Set(['deadXRatio','deadYRatio']);
  const LOOKAHEAD_REVERSAL_DECAY_MULTIPLIER=2.5;
  const REVERSAL_EPSILON=0.01;
  const PVP_AIM_PERP_WEIGHT=0.5;
  const PVP_AIM_EPSILON=0.18;
  const legacyUpdateCamera=typeof updateCamera==='function'?updateCamera:null;
  let baseZoom=Number.isFinite(Number(CONFIG.zoom))&&Number(CONFIG.zoom)>0?Number(CONFIG.zoom):0.82;
  let effectiveZoom=baseZoom;
  let managedTargetX=Number(camera.targetX)||0,managedTargetY=Number(camera.targetY)||0;
  const managedTuning=Object.fromEntries(TUNING_KEYS.map(key=>[key,Number(CONFIG[key])]));
  let transientLookAheadDecayMultiplier=1;
  let reversalActiveX=false,reversalActiveY=false;
  let combatFramingActive=false,lastCameraIntentX=0,lastCameraIntentY=0;
  let dprCap=3,pixelPerfect=false,roundPixels=!!CONFIG.roundPixels,smoothing=true,imageRendering='auto',viewportScheduled=false,lastEffectiveZoom=null,lastViewportKey='';

  Object.defineProperty(camera,'targetX',{configurable:true,enumerable:true,get:()=>managedTargetX,set:value=>{const n=Number(value);if(Number.isFinite(n))managedTargetX=n;}});
  Object.defineProperty(camera,'targetY',{configurable:true,enumerable:true,get:()=>managedTargetY,set:value=>{const n=Number(value);if(Number.isFinite(n))managedTargetY=n;}});
  Object.defineProperty(CONFIG,'zoom',{configurable:true,enumerable:true,get:()=>effectiveZoom,set:value=>{const n=Number(value);if(Number.isFinite(n)&&n>0)effectiveZoom=n;}});
  function legacyTuningValue(key){
    const value=managedTuning[key];
    if(key==='lookAheadDecay')return value*transientLookAheadDecayMultiplier;
    if(!SCREEN_SPACE_DEADZONE_KEYS.has(key))return value;
    const zoom=Math.max(0.0001,Number(effectiveZoom)||1);
    return value/zoom;
  }
  for(const key of TUNING_KEYS)Object.defineProperty(CONFIG,key,{configurable:true,enumerable:true,get:()=>legacyTuningValue(key),set:value=>{const n=Number(value);if(Number.isFinite(n))managedTuning[key]=n;}});

  function orientation(){return root.innerWidth>=root.innerHeight?'landscape':'portrait';}
  function activeDpr(){return Math.max(1,Math.min(Number(root.devicePixelRatio)||1,Math.max(1,Number(dprCap)||1)));}
  function pixelPerfectZoom(target){const dpr=activeDpr(),physicalScale=Math.max(1,Math.round((Number(target)||1)*dpr));return physicalScale/dpr;}
  function effectiveZoomFor(base,mode){const b=Math.max(0.05,Number(base)||1);if(mode!=='landscape')return b;const w=Math.max(1,root.innerWidth),h=Math.max(1,root.innerHeight);return b*(h/w);}
  function emit(name,detail){try{root.dispatchEvent(new CustomEvent(name,{detail}));}catch(e){}}
  function syncViewportCss(){const rootEl=document.documentElement;rootEl.style.setProperty('--kelo-vw',`${root.innerWidth}px`);rootEl.style.setProperty('--kelo-vh',`${root.innerHeight}px`);}
  function applyZoom(source){const mode=orientation();effectiveZoom=effectiveZoomFor(baseZoom,mode);document.documentElement.style.setProperty('--kelo-camera-zoom',String(effectiveZoom));const changed=!Number.isFinite(lastEffectiveZoom)||Math.abs(lastEffectiveZoom-effectiveZoom)>0.0001;lastEffectiveZoom=effectiveZoom;if(changed)emit('kelo:camerazoomchange',{source:source||'camera',orientation:mode,baseZoom,effectiveZoom,verticalWorldSpan:root.innerHeight/effectiveZoom,portraitReferenceWorldSpan:Math.max(root.innerWidth,root.innerHeight)/baseZoom});return effectiveZoom;}
  function configureViewport(options){const opts=options||{};if(Number.isFinite(Number(opts.dprCap))&&Number(opts.dprCap)>0)dprCap=Number(opts.dprCap);if(typeof opts.pixelPerfect==='boolean')pixelPerfect=opts.pixelPerfect;if(typeof opts.roundPixels==='boolean')roundPixels=opts.roundPixels;if(typeof opts.smoothing==='boolean')smoothing=opts.smoothing;if(typeof opts.imageRendering==='string')imageRendering=opts.imageRendering;CONFIG.roundPixels=roundPixels;return snapshot();}
  function syncViewport(source){screenW=root.innerWidth;screenH=root.innerHeight;const dpr=activeDpr(),width=Math.max(1,Math.floor(screenW*dpr)),height=Math.max(1,Math.floor(screenH*dpr));if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;canvas.style.width=screenW+'px';canvas.style.height=screenH+'px';canvas.style.imageRendering=imageRendering;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=smoothing;CONFIG.roundPixels=roundPixels;syncViewportCss();const zoom=applyZoom(source||'viewport'),key=[screenW,screenH,dpr,zoom].join(':');if(key!==lastViewportKey){lastViewportKey=key;emit('kelo:viewportchange',{source:source||'viewport',width:screenW,height:screenH,dpr,orientation:orientation(),baseZoom,effectiveZoom:zoom});try{root.dispatchEvent(new CustomEvent('kelo:world-audit'));}catch(e){}}return snapshot();}
  function scheduleViewportSync(source){if(viewportScheduled)return;viewportScheduled=true;requestAnimationFrame(()=>{viewportScheduled=false;syncViewport(source||'scheduled-resize');});}
  function setBaseZoom(value,source){const next=Number(value);if(!Number.isFinite(next)||next<=0)return applyZoom(source||'invalid-base');baseZoom=next;return applyZoom(source||'set-base');}
  function nearestPresetIndex(value){let best=0,dist=Infinity;ZOOM_PRESETS.forEach((z,i)=>{const d=Math.abs(z-value);if(d<dist){dist=d;best=i;}});return best;}
  function cycleZoom(source){const i=nearestPresetIndex(baseZoom),next=ZOOM_PRESETS[(i+1)%ZOOM_PRESETS.length];setBaseZoom(next,source||'cycle');if(typeof showToast==='function')showToast('Zoom '+next+(orientation()==='landscape'?' · cámara adaptada':''));if(typeof closeMenu==='function')closeMenu();return next;}
  function setTarget(x,y,options){const nx=Number(x),ny=Number(y),opts=options||{};if(!Number.isFinite(nx)||!Number.isFinite(ny))return false;managedTargetX=nx;managedTargetY=ny;if(opts.snap===true){camera.x=nx;camera.y=ny;camera.lookOffsetX=0;camera.lookOffsetY=0;}emit('kelo:cameratargetchange',{source:opts.source||'api',x:nx,y:ny,snap:opts.snap===true});return true;}
  function focus(value,options){if(!value)return false;return setTarget(value.x,value.y,options);}
  function restoreState(value,options){const v=value||{},opts=options||{};const x=Number(v.x),y=Number(v.y),tx=Number(v.targetX),ty=Number(v.targetY);if(!Number.isFinite(x)||!Number.isFinite(y))return false;camera.x=x;camera.y=y;managedTargetX=Number.isFinite(tx)?tx:x;managedTargetY=Number.isFinite(ty)?ty:y;if(Number.isFinite(Number(v.lookOffsetX)))camera.lookOffsetX=Number(v.lookOffsetX);else if(opts.resetLook!==false)camera.lookOffsetX=0;if(Number.isFinite(Number(v.lookOffsetY)))camera.lookOffsetY=Number(v.lookOffsetY);else if(opts.resetLook!==false)camera.lookOffsetY=0;emit('kelo:camerarestore',{source:opts.source||'restore',x,y,targetX:managedTargetX,targetY:managedTargetY});return true;}
  function setFollowTuning(next){const values=next||{};for(const key of TUNING_KEYS){const value=Number(values[key]);if(Number.isFinite(value))managedTuning[key]=value;}return getFollowTuning();}
  function getFollowTuning(){return Object.freeze(Object.fromEntries(TUNING_KEYS.map(key=>[key,managedTuning[key]])));}
  function screenToWorldPoint(sx,sy){const z=effectiveZoom||1;return{x:camera.x+(Number(sx)-screenW/2)/z,y:camera.y+(Number(sy)-screenH/2)/z};}
  function worldToScreenPoint(wx,wy){const z=effectiveZoom||1;return{x:(Number(wx)-camera.x)*z+screenW/2,y:(Number(wy)-camera.y)*z+screenH/2};}
  function worldView(){const z=effectiveZoom||1,w=screenW/z,h=screenH/z,cx=Number(camera.x)||0,cy=Number(camera.y)||0,left=cx-w/2,top=cy-h/2;return Object.freeze({x:left,y:top,w,h,left,top,right:left+w,bottom:top+h,centerX:cx,centerY:cy,zoom:z,screenW,screenH});}
  function axisReversing(inputAxis,lookOffset){return Math.abs(Number(inputAxis)||0)>REVERSAL_EPSILON&&Math.abs(Number(lookOffset)||0)>REVERSAL_EPSILON&&Number(inputAxis)*Number(lookOffset)<0;}
  function combatCameraIntent(ix,iy){
    combatFramingActive=false;
    const moveLen=Math.hypot(ix,iy);
    if(moveLen<=REVERSAL_EPSILON||!root.KELO_COMBAT_ENABLED||!root.KeloInput||!root.KeloInput.combat||typeof root.KeloInput.combat.snapshot!=='function')return{x:ix,y:iy};
    let snap=null;try{snap=root.KeloInput.combat.snapshot();}catch(e){return{x:ix,y:iy};}
    const aim=snap&&snap.aim||{},aimMag=Number(aim.magnitude)||0,ax=Number(aim.x)||0,ay=Number(aim.y)||0;
    if(aimMag<PVP_AIM_EPSILON||Math.hypot(ax,ay)<=REVERSAL_EPSILON)return{x:ix,y:iy};
    const mx=ix/moveLen,my=iy/moveLen,dot=ax*mx+ay*my,px=ax-mx*dot,py=ay-my*dot;
    const x=Math.max(-1,Math.min(1,ix+px*PVP_AIM_PERP_WEIGHT*aimMag));
    const y=Math.max(-1,Math.min(1,iy+py*PVP_AIM_PERP_WEIGHT*aimMag));
    combatFramingActive=Math.abs(x-ix)>REVERSAL_EPSILON||Math.abs(y-iy)>REVERSAL_EPSILON;
    return{x,y};
  }
  function update(dt){
    const ix=typeof input!=='undefined'?Number(input.normX)||0:0,iy=typeof input!=='undefined'?Number(input.normY)||0:0;
    reversalActiveX=axisReversing(ix,camera.lookOffsetX);
    reversalActiveY=axisReversing(iy,camera.lookOffsetY);
    transientLookAheadDecayMultiplier=(reversalActiveX||reversalActiveY)?LOOKAHEAD_REVERSAL_DECAY_MULTIPLIER:1;
    const intent=combatCameraIntent(ix,iy);lastCameraIntentX=intent.x;lastCameraIntentY=intent.y;
    const canAdapt=typeof input!=='undefined'&&input&&combatFramingActive;
    if(canAdapt){input.normX=intent.x;input.normY=intent.y;}
    try{if(legacyUpdateCamera)legacyUpdateCamera(dt);}finally{if(canAdapt){input.normX=ix;input.normY=iy;}transientLookAheadDecayMultiplier=1;}
  }
  function refreshZoom(source){return applyZoom(source||'refresh');}
  function snapshot(){return Object.freeze({version:VERSION,x:camera.x,y:camera.y,targetX:managedTargetX,targetY:managedTargetY,lookOffsetX:Number(camera.lookOffsetX)||0,lookOffsetY:Number(camera.lookOffsetY)||0,baseZoom,effectiveZoom,orientation:orientation(),screenW,screenH,dpr:activeDpr(),dprCap,pixelPerfect,roundPixels,smoothing,follow:getFollowTuning(),reversalResponse:Object.freeze({multiplier:LOOKAHEAD_REVERSAL_DECAY_MULTIPLIER,activeX:reversalActiveX,activeY:reversalActiveY}),combatFraming:Object.freeze({active:combatFramingActive,aimPerpWeight:PVP_AIM_PERP_WEIGHT,intentX:lastCameraIntentX,intentY:lastCameraIntentY})});}

  root.updateCamera=update;
  root.resize=()=>syncViewport('legacy-resize-call');
  root.cycleZoom=()=>cycleZoom('legacy-cycle');
  root.screenToWorld=screenToWorldPoint;
  root.worldToScreen=worldToScreenPoint;
  root.addEventListener('resize',()=>scheduleViewportSync('resize'),{passive:true});
  root.visualViewport?.addEventListener('resize',()=>scheduleViewportSync('visualViewport'),{passive:true});

  root.KeloCamera=Object.freeze({version:VERSION,setTarget,focus,restoreState,setFollowTuning,getFollowTuning,setBaseZoom,getBaseZoom:()=>baseZoom,getEffectiveZoom:()=>effectiveZoom,cycleZoom,refreshZoom,getOrientation:orientation,configureViewport,syncViewport,scheduleViewportSync,syncViewportCss,activeDpr,pixelPerfectZoom,screenToWorld:screenToWorldPoint,worldToScreen:worldToScreenPoint,worldView,snapshot});
  root.KELO_CAMERA_AUDIT=Object.freeze({version:VERSION,owner:'KeloCamera',legacyFollowMath:true,screenSpaceDeadZone:true,lookAheadReversalResponse:true,lookAheadReversalDecayMultiplier:LOOKAHEAD_REVERSAL_DECAY_MULTIPLIER,pvpAimComposition:true,pvpAimPerpWeight:PVP_AIM_PERP_WEIGHT,legacyTargetAdapter:true,legacyZoomAdapter:true,legacyTuningAdapter:true,updateCameraOwner:true,viewportOwner:true,zoomOwner:true,targetOwner:true,restoreOwner:true,screenWorldOwner:true,worldViewOwner:true});
})(typeof globalThis!=='undefined'?globalThis:window);
