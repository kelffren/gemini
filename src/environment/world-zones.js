/* KELO-INDEX
 * area: ENVIRONMENT / WORLD ZONES
 * owner: KELO_WORLD_ZONES
 * purpose: second-map proof without replacing Plaza; travel is explicit and reversible
 */
(function(){
'use strict';
const layers=window.KELO_ENVIRONMENT_LAYERS;
if(!layers?.register){console.error('[Kelo zones] environment layers unavailable');return;}
const MAP2=Object.freeze({id:'sketch-town-test',name:'Sketch Town · Mapa 2',x:2280,y:180,w:1120,h:900,spawn:{x:2820,y:650}});
const PLAZA_SPAWN=Object.freeze({x:1400,y:1600});
let active='plaza';

function drawTown(g){
  if(active!=='map2')return;
  const r=MAP2;
  g.save();
  g.fillStyle='#9fcf72';g.fillRect(r.x,r.y,r.w,r.h);
  g.fillStyle='#d9c79d';
  g.fillRect(r.x+80,r.y+390,r.w-160,120);
  g.fillRect(r.x+500,r.y+70,120,r.h-140);
  g.fillStyle='#79b8d1';g.fillRect(r.x+40,r.y+80,210,250);
  g.fillStyle='#6d9f4b';
  [[300,120],[360,180],[850,120],[930,210],[180,650],[890,680],[1020,590]].forEach(([x,y])=>{g.beginPath();g.arc(r.x+x,r.y+y,38,0,Math.PI*2);g.fill();});
  const houses=[[300,270,150,110],[690,230,170,125],[250,580,180,130],[680,590,190,135]];
  for(const [x,y,w,h] of houses){g.fillStyle='#d8b06f';g.fillRect(r.x+x,r.y+y,w,h);g.fillStyle='#8d5542';g.beginPath();g.moveTo(r.x+x-12,r.y+y);g.lineTo(r.x+x+w/2,r.y+y-65);g.lineTo(r.x+x+w+12,r.y+y);g.closePath();g.fill();}
  g.fillStyle='#efe5bd';g.fillRect(r.x+470,r.y+360,180,180);
  g.strokeStyle='#6c5b45';g.lineWidth=3;g.strokeRect(r.x,r.y,r.w,r.h);
  g.fillStyle='rgba(10,18,14,.78)';g.fillRect(r.x+20,r.y+18,260,44);
  g.fillStyle='#fff';g.font='bold 22px sans-serif';g.fillText('MAPA 2 · SKETCH TOWN',r.x+34,r.y+48);
  g.restore();
}
layers.register({id:'kelo-map2-sketch-town-proof',phase:'paths_floors',priority:90,required:false,ownership:'KELO_WORLD_ZONES',draw:drawTown,bounds:[{id:'map2',x:MAP2.x,y:MAP2.y,w:MAP2.w,h:MAP2.h}]});

function teleport(x,y,source){
  if(window.KeloPlayerPosition?.teleport)window.KeloPlayerPosition.teleport(x,y,{source,stopMotion:true});
  else {localPlayer.x=x;localPlayer.y=y;localPlayer.vx=0;localPlayer.vy=0;}
  if(window.KeloCamera?.setTarget)window.KeloCamera.setTarget(x,y,{source});
  else {camera.targetX=x;camera.targetY=y;}
}
function enterMap2(){active='map2';teleport(MAP2.spawn.x,MAP2.spawn.y,'kelo-zones:enter-map2');window.showToast?.('Mapa 2 · Sketch Town');}
function returnPlaza(){active='plaza';teleport(PLAZA_SPAWN.x,PLAZA_SPAWN.y,'kelo-zones:return-plaza');window.showToast?.('Plaza Central');}
window.KELO_WORLD_ZONES=Object.freeze({version:'zones-v1-proof',maps:Object.freeze({plaza:Object.freeze({id:'plaza',name:'Plaza Central'}),map2:MAP2}),get active(){return active;},enterMap2,returnPlaza,go(id){return id==='map2'?enterMap2():returnPlaza();}});
window.addEventListener('kelo:world-zone-map2',enterMap2);
window.addEventListener('kelo:world-zone-plaza',returnPlaza);
})();