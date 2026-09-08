/* KELO-INDEX
 * area: QA / CAMERA
 * owner: FOUNDATION CI
 * keys: CAMERA VIEWPORT ZOOM DPR TARGET SCREEN WORLD ORIENTATION CONTRACT
 * purpose: valida owner único KeloCamera y compatibilidad determinista sin arrancar el juego completo
 * public-api: CLI
 * consumes: camera-system, engine-h, mobile-orientation, index.html
 * state-owned: ninguno
 * extension-points: invariantes KeloCamera
 * reuse: Foundation CI
 * legacy: simula camera/CONFIG/updateCamera de engine-a
 * do-not: no sustituir browser smoke de rotación/viewport
 */
'use strict';
const fs=require('fs');
const vm=require('vm');
function ok(cond,msg){if(!cond)throw new Error(msg);}
const source=fs.readFileSync('src/core/camera-system.js','utf8');
const hd=fs.readFileSync('engine-h.js','utf8');
const orientation=fs.readFileSync('src/ui/mobile-orientation.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const trace=[];
const events=[];
const styleValues={};
const context={
  console,innerWidth:390,innerHeight:844,devicePixelRatio:2,screenW:390,screenH:844,
  camera:{x:100,y:200,targetX:100,targetY:200,lookOffsetX:0,lookOffsetY:0},
  CONFIG:{zoom:.82,roundPixels:false,dampX:10,dampY:8,deadXRatio:.2,deadYRatio:.16,lookAheadDist:45,lookAheadDecay:7},
  canvas:{width:390,height:844,style:{}},
  ctx:{imageSmoothingEnabled:true,setTransform:(...args)=>trace.push('transform:'+args.join(','))},
  updateCamera(dt){trace.push('legacy-update:'+dt);context.camera.x+=1;},
  resize(){trace.push('legacy-resize');},cycleZoom(){trace.push('legacy-cycle');},
  document:{documentElement:{style:{setProperty:(k,v)=>{styleValues[k]=v;}}}},
  CustomEvent:function(name,init){this.type=name;this.detail=init?.detail;},
  addEventListener(){},dispatchEvent(event){events.push(event);},visualViewport:{addEventListener(){}},
  requestAnimationFrame(fn){fn();return 1;},showToast(){},closeMenu(){}
};
context.window=context;context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'camera-system.js'});
ok(context.KeloCamera&&context.KELO_CAMERA_AUDIT?.owner==='KeloCamera','OWNER_NOT_INSTALLED');
ok(context.KeloCamera.version.startsWith('kelo-camera-v1.'),'VERSION');
ok(typeof context.KeloCamera.setTarget==='function'&&typeof context.KeloCamera.screenToWorld==='function'&&typeof context.KeloCamera.worldToScreen==='function','PUBLIC_API');
context.KeloCamera.setTarget(500,600,{source:'test'});
ok(context.camera.targetX===500&&context.camera.targetY===600,'TARGET_API');
context.camera.targetX=700;context.camera.targetY=800;
ok(context.KeloCamera.snapshot().targetX===700&&context.KeloCamera.snapshot().targetY===800,'LEGACY_TARGET_ADAPTER');
context.KeloCamera.setFollowTuning({dampX:12,lookAheadDist:60});
ok(context.CONFIG.dampX===12&&context.CONFIG.lookAheadDist===60,'FOLLOW_TUNING_API');
context.CONFIG.dampY=9;
ok(context.KeloCamera.getFollowTuning().dampY===9,'LEGACY_TUNING_ADAPTER');
trace.length=0;context.updateCamera(.25);ok(trace.includes('legacy-update:0.25'),'LEGACY_FOLLOW_CALLED_ONCE');
context.KeloCamera.configureViewport({dprCap:2,pixelPerfect:true,roundPixels:true,smoothing:false,imageRendering:'pixelated'});
context.KeloCamera.setBaseZoom(1,'test-portrait');context.KeloCamera.syncViewport('test-portrait');
ok(context.canvas.width===780&&context.canvas.height===1688,'PORTRAIT_DPR_VIEWPORT');
ok(Math.abs(context.KeloCamera.getEffectiveZoom()-1)<1e-9,'PORTRAIT_ZOOM');
ok(context.CONFIG.roundPixels===true&&context.ctx.imageSmoothingEnabled===false,'HD_POLICY');
const world={x:525,y:640};const screen=context.KeloCamera.worldToScreen(world.x,world.y);const roundTrip=context.KeloCamera.screenToWorld(screen.x,screen.y);
ok(Math.abs(roundTrip.x-world.x)<1e-9&&Math.abs(roundTrip.y-world.y)<1e-9,'SCREEN_WORLD_ROUNDTRIP');
const portraitBase=context.KeloCamera.getBaseZoom();context.innerWidth=844;context.innerHeight=390;context.KeloCamera.syncViewport('test-landscape');
const expected=portraitBase*(390/844);
ok(Math.abs(context.KeloCamera.getBaseZoom()-portraitBase)<1e-9,'BASE_ZOOM_STABLE_ON_ROTATE');
ok(Math.abs(context.KeloCamera.getEffectiveZoom()-expected)<1e-9,'LANDSCAPE_EQUIVALENT_ZOOM');
ok(context.canvas.width===1688&&context.canvas.height===780,'LANDSCAPE_DPR_VIEWPORT');
const before=context.KeloCamera.getBaseZoom();context.cycleZoom();
ok(Math.abs(context.KeloCamera.getBaseZoom()-before)>1e-6,'GLOBAL_CYCLE_OWNED');
ok(styleValues['--kelo-vw']==='844px'&&styleValues['--kelo-vh']==='390px','VIEWPORT_CSS_OWNER');
ok(events.some(e=>e.type==='kelo:viewportchange')&&events.some(e=>e.type==='kelo:camerazoomchange'),'OBSERVABILITY_EVENTS');
ok(hd.includes("cameraOwner = window.KeloCamera")&&hd.includes('cameraOwner.configureViewport')&&hd.includes('cameraOwner.syncViewport'),'ENGINE_H_CONSUMES_OWNER');
ok(!/\bCONFIG\.zoom\s*=/.test(hd),'ENGINE_H_DIRECT_ZOOM_WRITE');
ok(!/\b(?:window\.)?resize\s*=/.test(hd),'ENGINE_H_RESIZE_OVERRIDE');
ok(!/\b(?:window\.)?cycleZoom\s*=/.test(hd),'ENGINE_H_ZOOM_OVERRIDE');
ok(!/canvas\.(?:width|height)\s*=/.test(hd),'ENGINE_H_CANVAS_WRITE');
ok(orientation.includes("viewportOwner:'KeloCamera'")&&orientation.includes("zoomOwner:'KeloCamera'"),'ORIENTATION_OWNER_DECLARATION');
ok(!/\bCONFIG\.zoom\s*=/.test(orientation),'ORIENTATION_DIRECT_ZOOM_WRITE');
ok(!/canvas\.(?:width|height)\s*=/.test(orientation),'ORIENTATION_CANVAS_WRITE');
ok(!/\bwindow\.cycleZoom\s*=/.test(orientation),'ORIENTATION_CYCLE_OVERRIDE');
ok(!/\bwindow\.resize\s*=/.test(orientation),'ORIENTATION_RESIZE_OVERRIDE');
const iA=html.indexOf('engine-a.js'),iC=html.indexOf('engine-c.js'),iCamera=html.indexOf('src/core/camera-system.js'),iAvatar=html.indexOf('src/core/avatar-render-system.js'),iH=html.indexOf('engine-h.js'),iOrientation=html.indexOf('src/ui/mobile-orientation.js');
ok(iA>=0&&iC>iA&&iCamera>iC&&iAvatar>iCamera&&iH>iCamera&&iOrientation>iCamera,'LOAD_ORDER');
console.log('CAMERA_SYSTEM_OK: owner + target + tuning + viewport + DPR + equivalent orientation zoom + screen/world contract passed');
