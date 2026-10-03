/* KELO-INDEX
 * area: ENVIRONMENT / WORLD ZONES
 * owner: KELO_WORLD_ZONES
 * purpose: second-map proof without replacing Plaza; travel is explicit and reversible
 */
(function(){
'use strict';
const layers=window.KELO_ENVIRONMENT_LAYERS;
if(!layers?.register){console.error('[Kelo zones] environment layers unavailable');return;}
const MAP2=Object.freeze({id:'kenney-town-test',name:'Kenney Town · Mapa 2',x:2280,y:180,w:1120,h:900,spawn:{x:2820,y:650}});
const REAL_MAPS=Object.freeze([
  Object.freeze({id:'tiny-town',name:'Tiny Town',src:'https://raw.githubusercontent.com/GeorgeQLe/assets-2d-city/main/assets/kenney/tiny-town/Sample.png'}),
  Object.freeze({id:'rpg-urban',name:'RPG Urban',src:'https://raw.githubusercontent.com/GeorgeQLe/assets-2d-city/main/assets/kenney/rpg-urban-pack/Sample.png'}),
  Object.freeze({id:'retro-urban',name:'Retro Urban',src:'https://raw.githubusercontent.com/GeorgeQLe/assets-2d-city/main/assets/kenney/retro-urban-kit/Sample.png'})
]);
let selectedMap=0;
const mapImages=REAL_MAPS.map(function(def){const img=new Image();img.crossOrigin='anonymous';img.decoding='async';img.src=def.src;return img;});
const PLAZA_SPAWN=Object.freeze({x:1400,y:1600});
let active='plaza',cooldownUntil=0;
const PLAZA_PORTAL=Object.freeze({x:1710,y:1570,r:54,label:'MAPA 2'});
const MAP2_PORTAL=Object.freeze({x:MAP2.x+90,y:MAP2.y+MAP2.h-90,r:54,label:'VOLVER'});

function drawPortal(g,p,label){
  const pulse=1+Math.sin(Date.now()/240)*0.08;
  g.save();g.translate(p.x,p.y);g.scale(pulse,pulse);
  g.fillStyle='rgba(95,220,255,.18)';g.strokeStyle='#73e6ff';g.lineWidth=5;
  g.beginPath();g.arc(0,0,p.r,0,Math.PI*2);g.fill();g.stroke();
  g.beginPath();g.arc(0,0,p.r*.62,0,Math.PI*2);g.stroke();
  g.fillStyle='rgba(4,14,20,.82)';g.fillRect(-66,p.r+10,132,30);
  g.fillStyle='#fff';g.font='bold 15px sans-serif';g.textAlign='center';g.fillText(label,0,p.r+31);
  g.restore();
}
function drawPlazaPortal(g){if(active==='plaza')drawPortal(g,PLAZA_PORTAL,PLAZA_PORTAL.label);}
layers.register({id:'kelo-plaza-map2-portal',phase:'props_front',priority:95,required:false,ownership:'KELO_WORLD_ZONES',draw:drawPlazaPortal,bounds:[{id:'plaza-map2-portal',x:PLAZA_PORTAL.x-60,y:PLAZA_PORTAL.y-60,w:120,h:150}]});
function drawTown(g){
  if(active!=='map2')return;
  const r=MAP2,img=mapImages[selectedMap],def=REAL_MAPS[selectedMap];
  g.save();
  g.fillStyle='#17221b';g.fillRect(r.x,r.y,r.w,r.h);
  if(img&&img.complete&&img.naturalWidth){
    const scale=Math.min((r.w-80)/img.naturalWidth,(r.h-130)/img.naturalHeight);
    const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
    g.imageSmoothingEnabled=false;
    g.drawImage(img,r.x+(r.w-w)/2,r.y+85+(r.h-115-h)/2,w,h);
  }else{
    g.fillStyle='#d7c89b';g.font='bold 24px sans-serif';g.textAlign='center';g.fillText('Cargando mapa CC0…',r.x+r.w/2,r.y+r.h/2);
  }
  g.strokeStyle='#6c5b45';g.lineWidth=3;g.strokeRect(r.x,r.y,r.w,r.h);
  g.fillStyle='rgba(10,18,14,.88)';g.fillRect(r.x+20,r.y+18,420,48);
  g.fillStyle='#fff';g.font='bold 21px sans-serif';g.textAlign='left';g.fillText('MAPA 2 · '+def.name.toUpperCase(),r.x+34,r.y+50);
  drawPortal(g,MAP2_PORTAL,MAP2_PORTAL.label);
  g.restore();
}
layers.register({id:'kelo-map2-sketch-town-proof',phase:'paths_floors',priority:90,required:false,ownership:'KELO_WORLD_ZONES',draw:drawTown,bounds:[{id:'map2',x:MAP2.x,y:MAP2.y,w:MAP2.w,h:MAP2.h}]});

function teleport(x,y,source){
  if(window.KeloPlayerPosition?.teleport)window.KeloPlayerPosition.teleport(x,y,{source,stopMotion:true});
  else {localPlayer.x=x;localPlayer.y=y;localPlayer.vx=0;localPlayer.vy=0;}
  if(window.KeloCamera?.setTarget)window.KeloCamera.setTarget(x,y,{source});
  else {camera.targetX=x;camera.targetY=y;}
}
function enterMap2(){cooldownUntil=Date.now()+1200;active='map2';teleport(MAP2.spawn.x,MAP2.spawn.y,'kelo-zones:enter-map2');window.showToast?.('Mapa 2 · Sketch Town');}
function returnPlaza(){cooldownUntil=Date.now()+1200;active='plaza';teleport(PLAZA_SPAWN.x,PLAZA_SPAWN.y,'kelo-zones:return-plaza');window.showToast?.('Plaza Central');}
function near(p){return typeof localPlayer!=='undefined'&&Math.hypot(localPlayer.x-p.x,localPlayer.y-p.y)<=p.r+24;}
function tick(){
  if(Date.now()>=cooldownUntil){
    if(active==='plaza'&&near(PLAZA_PORTAL))enterMap2();
    else if(active==='map2'&&near(MAP2_PORTAL))returnPlaza();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
window.KELO_WORLD_ZONES=Object.freeze({version:'zones-v2-real-cc0-maps',realMaps:REAL_MAPS,selectMap(id){const i=REAL_MAPS.findIndex(m=>m.id===id);if(i>=0)selectedMap=i;return REAL_MAPS[selectedMap];},get selectedMap(){return REAL_MAPS[selectedMap];},maps:Object.freeze({plaza:Object.freeze({id:'plaza',name:'Plaza Central'}),map2:MAP2}),get active(){return active;},enterMap2,returnPlaza,go(id){return id==='map2'?enterMap2():returnPlaza();}});
window.addEventListener('kelo:world-zone-map2',enterMap2);
window.addEventListener('kelo:world-zone-plaza',returnPlaza);
})();