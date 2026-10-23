/* KELO-INDEX
 * area: ENVIRONMENT / WORLD ZONES
 * owner: KELO_WORLD_ZONES
 * purpose: viajes reversibles a una aldea authored; arte por Generic Props y colisiones por KELO_COLLISION
 */
(function(){
'use strict';
const layers=window.KELO_ENVIRONMENT_LAYERS;
if(!layers?.register){console.error('[Kelo zones] environment layers unavailable');return;}
const MAP2=window.KELO_ALDEA_MAP;
if(!MAP2||!window.KELO_COLLISION||!window.KeloSimulation)return;
const REAL_MAPS=Object.freeze([MAP2]);
const COLLISION_OWNER='world-zones:map2';
const PLAZA_SPAWN=Object.freeze({x:1400,y:1600});
let active='plaza',cooldownUntil=0;
const PLAZA_PORTAL=Object.freeze({x:1710,y:1570,r:54,label:'MAPA 2'});
const MAP2_PORTAL=MAP2.portal;

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
layers.register({id:'kelo-plaza-map2-portal',phase:'props_front',priority:95,required:false,ownership:'KELO_WORLD_ZONES',visibleDuringReset:true,draw:drawPlazaPortal,bounds:[{id:'plaza-map2-portal',x:PLAZA_PORTAL.x-60,y:PLAZA_PORTAL.y-60,w:120,h:150}]});
function drawReturnPortal(g){if(active==='map2')drawPortal(g,MAP2_PORTAL,MAP2_PORTAL.label);}
layers.register({id:'kelo-map2-return-portal',phase:'props_front',priority:95,required:false,visibleDuringReset:true,ownership:'KELO_WORLD_ZONES',draw:drawReturnPortal,bounds:[{id:'map2-return',x:MAP2_PORTAL.x-65,y:MAP2_PORTAL.y-65,w:130,h:160}]});

// KELO-INDEX WORLD/POSE travel uses the existing discontinuous-position owner.
function teleport(x,y,source){
  window.KeloPlayerPosition.teleport(x,y,{source,stopMotion:true});
  window.KeloCamera?.setTarget(x,y,{source,snap:true});
  window.KELO_GENERIC_PROPS?.syncResidency();
}
function enterMap2(){
  if(!window.KeloPlayerPosition)return false;
  cooldownUntil=Date.now()+1200;active='map2';
  window.KELO_COLLISION.replaceOwner(COLLISION_OWNER,MAP2.colliders);
  teleport(MAP2.spawn.x,MAP2.spawn.y,'kelo-zones:enter-map2');
  window.dispatchEvent(new CustomEvent('kelo:zonechange',{detail:{zoneId:MAP2.id,revision:MAP2.revision}}));
  window.showToast?.(MAP2.name);return true;
}
function returnPlaza(){
  if(!window.KeloPlayerPosition)return false;
  cooldownUntil=Date.now()+1200;active='plaza';
  window.KELO_COLLISION.clearOwner(COLLISION_OWNER);
  teleport(PLAZA_SPAWN.x,PLAZA_SPAWN.y,'kelo-zones:return-plaza');
  window.dispatchEvent(new CustomEvent('kelo:zonechange',{detail:{zoneId:'plaza'}}));
  window.showToast?.('Plaza Central');return true;
}
function near(p){return typeof localPlayer!=='undefined'&&Math.hypot(localPlayer.x-p.x,localPlayer.y-p.y)<=p.r+24;}
function tick(){
  if(Date.now()>=cooldownUntil){
    if(active==='plaza'&&near(PLAZA_PORTAL))enterMap2();
    else if(active==='map2'&&near(MAP2_PORTAL))returnPlaza();
  }

}
window.KeloSimulation.after('world-zones:portals',tick,90);
window.KELO_WORLD_ZONES=Object.freeze({version:'zones-v3-authored-aldea',realMaps:REAL_MAPS,selectMap(){return MAP2;},get selectedMap(){return MAP2;},maps:Object.freeze({plaza:Object.freeze({id:'plaza',name:'Plaza Central'}),map2:MAP2}),get active(){return active;},enterMap2,returnPlaza,go(id){return id==='map2'||id===MAP2.id?enterMap2():returnPlaza();}});
window.addEventListener('kelo:world-zone-map2',enterMap2);
window.addEventListener('kelo:world-zone-plaza',returnPlaza);
})();