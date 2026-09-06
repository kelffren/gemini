/* KELO-INDEX
 * area: INSTANCES
 * keys: SCENE RUNTIME HOUSE WORLD CAMERA BOUNDS
 * hace: cambia el runtime visual entre mundo e instancia sin cambiar el loop principal
 * online: no contiene transporte; solo consume el contexto de instancia activo
 */
(function(){
  'use strict';
  const L=window.KELO_ENVIRONMENT_LAYERS;
  let worldState=null,clampTimer=null;
  const clone=v=>JSON.parse(JSON.stringify(v));
  function captureWorld(){if(worldState)return;worldState={player:(typeof localPlayer!=='undefined'&&localPlayer)?{x:localPlayer.x,y:localPlayer.y}:null,camera:(typeof camera!=='undefined'&&camera)?{x:camera.x,y:camera.y,targetX:camera.targetX,targetY:camera.targetY}:null};}
  function centerOn(x,y){if(typeof localPlayer!=='undefined'&&localPlayer){localPlayer.x=x;localPlayer.y=y;}if(typeof camera!=='undefined'&&camera){camera.x=x;camera.y=y;camera.targetX=x;camera.targetY=y;}}
  function stopClamp(){if(clampTimer){clearInterval(clampTimer);clampTimer=null;}}
  function startClamp(instance){stopClamp();clampTimer=setInterval(()=>{try{if(!window.KELO_SCENE_CONTEXT?.isInstance('house'))return;const b=instance?.config?.bounds;if(!b||typeof localPlayer==='undefined'||!localPlayer)return;const pad=18;localPlayer.x=Math.max(b.x+pad,Math.min(b.x+b.w-pad,Number(localPlayer.x)||b.x+b.w/2));localPlayer.y=Math.max(b.y+pad,Math.min(b.y+b.h-pad,Number(localPlayer.y)||b.y+b.h/2));}catch(err){console.error('[Kelo house runtime] clamp',err);}},50);}
  async function enter(instance){captureWorld();const b=instance?.config?.bounds||{x:0,y:0,w:800,h:600};const spawn=instance?.config?.spawn||{x:b.x+b.w/2,y:b.y+b.h-72};document.body.classList.add('kelo-house-instance');centerOn(spawn.x,spawn.y);startClamp(instance);try{window.KELO_PROPERTY_SYSTEM?.refreshSceneColliders?.();}catch(e){}return clone(worldState);}
  async function leave(){stopClamp();document.body.classList.remove('kelo-house-instance');if(worldState){if(worldState.player&&typeof localPlayer!=='undefined'&&localPlayer){localPlayer.x=worldState.player.x;localPlayer.y=worldState.player.y;}if(worldState.camera&&typeof camera!=='undefined'&&camera){Object.assign(camera,worldState.camera);}}worldState=null;try{window.KELO_PROPERTY_SYSTEM?.refreshSceneColliders?.();}catch(e){}return true;}
  function drawHouse(g){if(!window.KELO_SCENE_CONTEXT?.isInstance('house'))return;const i=window.KELO_INSTANCES?.current?.();const b=i?.config?.bounds;if(!b)return;g.save();g.fillStyle='#071012';g.fillRect(b.x-2200,b.y-2200,b.w+4400,b.h+4400);g.fillStyle='#182423';g.fillRect(b.x,b.y,b.w,b.h);g.fillStyle='#263531';g.fillRect(b.x+14,b.y+14,b.w-28,b.h-28);g.strokeStyle='rgba(231,197,106,.45)';g.lineWidth=10;g.strokeRect(b.x+8,b.y+8,b.w-16,b.h-16);g.strokeStyle='rgba(255,244,214,.08)';g.lineWidth=1;for(let x=b.x+32;x<b.x+b.w;x+=32){g.beginPath();g.moveTo(x,b.y+18);g.lineTo(x,b.y+b.h-18);g.stroke();}for(let y=b.y+32;y<b.y+b.h;y+=32){g.beginPath();g.moveTo(b.x+18,y);g.lineTo(b.x+b.w-18,y);g.stroke();}const doorW=96;g.fillStyle='#071012';g.fillRect(b.x+b.w/2-doorW/2,b.y+b.h-18,doorW,28);g.restore();}
  if(L&&typeof L.register==='function')L.register({id:'house-instance-backdrop',phase:'props_back',priority:-500,required:false,ready:()=>true,draw:drawHouse,ownership:'instance-runtime-v1',bounds:()=>[]});
  window.KELO_INSTANCE_RUNTIME=Object.freeze({version:'instance-runtime-bridge-v1.0.0',enter,leave,get worldState(){return clone(worldState);}});
})();