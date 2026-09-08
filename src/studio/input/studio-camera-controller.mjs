/* KELO-INDEX
 * area: STUDIO / CAMERA
 * owns: editor-only camera pan, zoom-in, focus and touch navigation
 * does-not-own: gameplay camera follow, player movement or world rendering
 * public-api: createStudioCameraController()
 * online: local-only; restores runtime camera settings on suspend/destroy
 */

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createStudioCameraController({root=globalThis,onNavigateStart=()=>{},isUi=()=>false}={}){
  const document=root.document,camera=root.camera,config=root.CONFIG,canvas=document?.getElementById?.('game-canvas');
  if(!document||!camera||!config)throw new Error('STUDIO_CAMERA_RUNTIME_REQUIRED');
  const saved={deadXRatio:config.deadXRatio,deadYRatio:config.deadYRatio,transform:canvas?.style?.transform||'',transformOrigin:canvas?.style?.transformOrigin||''};
  const pointers=new Map(),navTouchIds=new Set();let enabled=true,zoom=1,space=false,mousePan=null,pinch=null;
  const viewport=()=>({w:Number(root.screenW)||root.innerWidth||1,h:Number(root.screenH)||root.innerHeight||1});
  function freezeFollow(){config.deadXRatio=1e6;config.deadYRatio=1e6;camera.targetX=Number(camera.x)||0;camera.targetY=Number(camera.y)||0;camera.lookOffsetX=0;camera.lookOffsetY=0;}
  function restoreFollow(){config.deadXRatio=saved.deadXRatio;config.deadYRatio=saved.deadYRatio;}
  function applyCanvasZoom(){if(!canvas)return;canvas.style.transformOrigin='50% 50%';canvas.style.transform=zoom===1?'':`scale(${zoom})`;}
  function clampCenter(x,y){const {w,h}=viewport(),halfW=w/(2*zoom),halfH=h/(2*zoom),worldW=Math.max(w,Number(config.worldWidth)||w),worldH=Math.max(h,Number(config.worldHeight)||h);return{x:clamp(Number(x)||0,halfW,Math.max(halfW,worldW-halfW)),y:clamp(Number(y)||0,halfH,Math.max(halfH,worldH-halfH))};}
  function setCenter(x,y){const p=clampCenter(x,y);camera.x=p.x;camera.y=p.y;camera.targetX=p.x;camera.targetY=p.y;camera.lookOffsetX=0;camera.lookOffsetY=0;return p;}
  function toWorld(clientX,clientY){const {w,h}=viewport();return{x:(Number(camera.x)||0)+((Number(clientX)||0)-w/2)/zoom,y:(Number(camera.y)||0)+((Number(clientY)||0)-h/2)/zoom};}
  function panScreen(dx,dy){if(!enabled)return;setCenter((Number(camera.x)||0)-(Number(dx)||0)/zoom,(Number(camera.y)||0)-(Number(dy)||0)/zoom);}
  function setZoom(next,{anchorX,anchorY}={}){if(!enabled)return zoom;const {w,h}=viewport(),ax=Number.isFinite(Number(anchorX))?Number(anchorX):w/2,ay=Number.isFinite(Number(anchorY))?Number(anchorY):h/2,before=toWorld(ax,ay);zoom=clamp(Number(next)||1,1,2);applyCanvasZoom();const after=toWorld(ax,ay);setCenter((Number(camera.x)||0)+(before.x-after.x),(Number(camera.y)||0)+(before.y-after.y));return zoom;}
  function focusRect(rect,{padding=80}={}){if(!rect)return null;const w=Math.max(1,Number(rect.w)||1),h=Math.max(1,Number(rect.h)||1),cx=(Number(rect.x)||0)+w/2,cy=(Number(rect.y)||0)+h/2,{w:vw,h:vh}=viewport(),fit=Math.min((vw-Math.max(0,padding)*2)/w,(vh-Math.max(0,padding)*2)/h);setZoom(clamp(fit,1,2));return setCenter(cx,cy);}
  function consume(e){e.preventDefault?.();e.stopImmediatePropagation?.();}
  function keydown(e){if(e.code==='Space'&&!isUi(e)){space=true;e.preventDefault();}}
  function keyup(e){if(e.code==='Space')space=false;}
  function wheel(e){if(!enabled||isUi(e))return;onNavigateStart();const factor=Math.exp(-Number(e.deltaY||0)*0.0012);setZoom(zoom*factor,{anchorX:e.clientX,anchorY:e.clientY});consume(e);}
  function pointerdown(e){if(!enabled||isUi(e))return;if(e.pointerType==='touch'){pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){onNavigateStart();for(const id of pointers.keys())navTouchIds.add(id);const [a,b]=[...pointers.values()],cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;pinch={cx,cy,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom};consume(e);}return;}if(e.button===1||(e.button===0&&space)){onNavigateStart();mousePan={id:e.pointerId,x:e.clientX,y:e.clientY};consume(e);}}
  function pointermove(e){if(!enabled)return;if(e.pointerType==='touch'&&pointers.has(e.pointerId)){pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>=2&&pinch){for(const id of pointers.keys())navTouchIds.add(id);const [a,b]=[...pointers.values()].slice(0,2),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,d=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));panScreen(cx-pinch.cx,cy-pinch.cy);setZoom(pinch.zoom*(d/pinch.d),{anchorX:cx,anchorY:cy});pinch={...pinch,cx,cy};consume(e);}else if(navTouchIds.has(e.pointerId))consume(e);return;}if(mousePan&&e.pointerId===mousePan.id){const dx=e.clientX-mousePan.x,dy=e.clientY-mousePan.y;mousePan.x=e.clientX;mousePan.y=e.clientY;panScreen(dx,dy);consume(e);}}
  function pointerup(e){if(e.pointerType==='touch'){const wasNav=navTouchIds.has(e.pointerId);pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(wasNav){navTouchIds.delete(e.pointerId);consume(e);}if(!pointers.size)navTouchIds.clear();return;}if(mousePan&&e.pointerId===mousePan.id){mousePan=null;consume(e);}}
  function resume(){if(enabled)return;enabled=true;freezeFollow();applyCanvasZoom();}
  function suspend(){if(!enabled)return;enabled=false;restoreFollow();mousePan=null;pinch=null;pointers.clear();navTouchIds.clear();if(canvas){canvas.style.transform=saved.transform;canvas.style.transformOrigin=saved.transformOrigin;}}
  function destroy(){suspend();document.removeEventListener('keydown',keydown,true);document.removeEventListener('keyup',keyup,true);document.removeEventListener('wheel',wheel,true);document.removeEventListener('pointerdown',pointerdown,true);document.removeEventListener('pointermove',pointermove,true);document.removeEventListener('pointerup',pointerup,true);document.removeEventListener('pointercancel',pointerup,true);}
  freezeFollow();applyCanvasZoom();document.addEventListener('keydown',keydown,true);document.addEventListener('keyup',keyup,true);document.addEventListener('wheel',wheel,{capture:true,passive:false});document.addEventListener('pointerdown',pointerdown,{capture:true,passive:false});document.addEventListener('pointermove',pointermove,{capture:true,passive:false});document.addEventListener('pointerup',pointerup,{capture:true,passive:false});document.addEventListener('pointercancel',pointerup,{capture:true,passive:false});
  return Object.freeze({toWorld,panScreen,setCenter,setZoom,focusRect,resume,suspend,destroy,get zoom(){return zoom;},get enabled(){return enabled;}});
}
