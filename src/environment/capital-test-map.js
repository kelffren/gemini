/* KELO-INDEX
 * area: ENVIRONMENT / WORLD
 * owner: KELO_WORLD_RENDERER via KELO_ENVIRONMENT_LAYERS
 * keys: CAPITAL TEST MAP PLAZA ASSET LAYER OCCLUSION MOBILE
 * purpose: composición de prueba de Capital V1 usando assets reales sobre el suelo LIVE
 * public-api: KELO_CAPITAL_TEST_MAP_AUDIT
 * consumes: KELO_ENVIRONMENT_LAYERS, KELO_ATLAS_CONTRACT, KELO_TILE_REGISTRY
 * state-owned: solo readiness visual local de los assets de esta composición
 * extension-points: placements data-driven dentro de CAPITAL_TREES; futuros distritos deben migrar a contracts de contenido
 * reuse: prueba visual temporal; no crea renderer paralelo ni autoridad gameplay
 * online: N/A; presentación local, sin estado compartido ni economía
 * do-not: NO envolver render, NO tocar posición del jugador, NO escribir obstacles
 */
(function(){
'use strict';
const L=window.KELO_ENVIRONMENT_LAYERS,A=window.KELO_ATLAS_CONTRACT,R=window.KELO_TILE_REGISTRY;
if(!L?.register||!A?.register||!A?.acquire||!R?.atlases?.plazaNature){console.error('[Kelo capital test] environment layers / atlas contract / registry missing');return;}

const BASE_KEY='capitalTestPlazaBase';
const BASE_ASSET=Object.freeze({
  id:'capital-test-plaza-base',
  src:'assets/plaza.PNG?art=215cfdef',
  width:1254,height:1254,worldWidth:800,worldHeight:800,
  family:'capital-test-floor'
});
const PLAZA=Object.freeze({x:1040,y:1120,w:800,h:800});
const NATURE=R.atlases.plazaNature;

const CAPITAL_TREES=Object.freeze([
  Object.freeze({id:'capital-tree-nw-a',frame:'tree_large',x:920,y:1120,w:132,h:176,baseY:1296}),
  Object.freeze({id:'capital-tree-nw-b',frame:'tree_pink',x:1000,y:1032,w:126,h:160,baseY:1192}),
  Object.freeze({id:'capital-tree-ne-a',frame:'tree_large',x:1848,y:1118,w:132,h:176,baseY:1294}),
  Object.freeze({id:'capital-tree-ne-b',frame:'tree_cypress',x:1780,y:1000,w:82,h:210,baseY:1210}),
  Object.freeze({id:'capital-tree-sw-a',frame:'tree_medium',x:930,y:1752,w:126,h:170,baseY:1922}),
  Object.freeze({id:'capital-tree-sw-b',frame:'tree_pink',x:1018,y:1824,w:128,h:160,baseY:1984}),
  Object.freeze({id:'capital-tree-se-a',frame:'tree_large',x:1838,y:1740,w:132,h:176,baseY:1916}),
  Object.freeze({id:'capital-tree-se-b',frame:'tree_small',x:1764,y:1840,w:106,h:142,baseY:1982}),
  Object.freeze({id:'capital-tree-west-gate',frame:'tree_cypress',x:866,y:1420,w:82,h:210,baseY:1630}),
  Object.freeze({id:'capital-tree-east-gate',frame:'tree_cypress',x:1952,y:1420,w:82,h:210,baseY:1630})
]);

let plazaImg=null,natureImg=null,ready=false,failed=false;
const audit=window.KELO_CAPITAL_TEST_MAP_AUDIT={
  version:'capital-test-map-v1.0.1',ready:false,failed:false,mode:'asset-composition-test-v1',
  plazaAsset:BASE_ASSET.src,sourceSize:Object.freeze({w:BASE_ASSET.width,h:BASE_ASSET.height}),plazaBounds:PLAZA,treeCount:CAPITAL_TREES.length,
  layers:Object.freeze(['paths_floors','props_back','props_front']),
  usesRealAssets:true,rendererWrapper:false,collisionWrites:false,visibleDuringReset:true,
  lastFrontOccluderCount:0
};

function frameRect(name){
  const f=NATURE.frames?.[name];
  if(!f)return null;
  return{x:Number(f.x)||0,y:Number(f.y)||0,w:Number(f.w)||0,h:Number(f.h)||0};
}
function drawTree(g,p){
  if(!natureImg)return false;
  const s=frameRect(p.frame);if(!s||!(s.w>0&&s.h>0))return false;
  g.drawImage(natureImg,s.x,s.y,s.w,s.h,p.x,p.y,p.w,p.h);return true;
}
function drawPlaza(g){
  if(!ready||failed||!plazaImg)return;
  g.save();g.imageSmoothingEnabled=false;g.drawImage(plazaImg,0,0,BASE_ASSET.width,BASE_ASSET.height,PLAZA.x,PLAZA.y,PLAZA.w,PLAZA.h);g.restore();
}
function drawTreesBack(g){
  if(!ready||failed||!natureImg)return;
  g.save();g.imageSmoothingEnabled=false;for(const p of CAPITAL_TREES)drawTree(g,p);g.restore();
}
function actorOverlapsTree(actor,p){
  if(!actor)return false;const r=Math.max(18,Number(actor.radius)||20);
  return actor.x+r>p.x&&actor.x-r<p.x+p.w&&actor.y+r>p.y&&actor.y-r<p.y+p.h;
}
function drawTreesFront(g){
  if(!ready||failed||!natureImg)return;
  const actors=[];
  if(typeof localPlayer!=='undefined'&&localPlayer)actors.push(localPlayer);
  if(typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))actors.push(...simulatedPlayers);
  let count=0;g.save();g.imageSmoothingEnabled=false;
  for(const p of CAPITAL_TREES){
    const shouldOcclude=actors.some(actor=>actorOverlapsTree(actor,p)&&(Number(actor.y)||0)<p.baseY);
    if(shouldOcclude&&drawTree(g,p))count++;
  }
  g.restore();audit.lastFrontOccluderCount=count;
}
function boundsForTrees(){return CAPITAL_TREES.map(p=>({id:p.id,x:p.x,y:p.y,w:p.w,h:p.h}));}

try{
  L.register({id:'capital-test-plaza-floor',phase:'paths_floors',priority:6,required:true,visibleDuringReset:true,ready:()=>ready&&!failed,draw:drawPlaza,ownership:'capital-test-map-v1',bounds:()=>[{id:'capital-test-plaza',...PLAZA}]});
  L.register({id:'capital-test-trees-back',phase:'props_back',priority:6,required:true,visibleDuringReset:true,ready:()=>ready&&!failed,draw:drawTreesBack,ownership:'capital-test-map-v1',bounds:boundsForTrees});
  L.register({id:'capital-test-trees-front',phase:'props_front',priority:6,required:true,visibleDuringReset:true,ready:()=>ready&&!failed,draw:drawTreesFront,ownership:'capital-test-map-v1',bounds:boundsForTrees});
}catch(err){failed=true;audit.failed=true;console.error('[Kelo capital test] layer registration failed',err);return;}

if(!A.describe(BASE_KEY))A.register(BASE_KEY,BASE_ASSET,{role:'core'});
Promise.all([A.acquire(BASE_KEY),A.acquire('plazaNature')]).then(([base,nature])=>{
  plazaImg=base;natureImg=nature;ready=true;audit.ready=true;
  try{window.dispatchEvent(new CustomEvent('kelo:capital-test-map-ready'));}catch{}
}).catch(err=>{failed=true;audit.failed=true;console.error('[Kelo capital test] asset load failed',err);});
})();
