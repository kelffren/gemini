(function(){
'use strict';
const base=window.KELO_WORLD_RENDERER;
if(!base||typeof base.draw!=='function'){console.error('[Kelo environment layers] world renderer missing');return;}
const PHASES=Object.freeze(['ground','ground_variation','transitions','paths_floors','decals_details','props_back','props_front','vfx_weather_lighting']);
const POST_ACTOR_PHASES=new Set(['props_front','vfx_weather_lighting']);
const ORDERING_POLICY='phase-priority-id-v1';
const SPATIAL_POLICY='same-phase-priority-aabb-v1';
const phaseRank=new Map(PHASES.map((name,i)=>[name,i]));
const layers=[];
function sortLayers(){layers.sort((a,b)=>(phaseRank.get(a.phase)??999)-(phaseRank.get(b.phase)??999)||(a.priority||0)-(b.priority||0)||a.id.localeCompare(b.id));}
function normalizeBounds(value){
  const raw=typeof value==='function'?value():value;
  if(!Array.isArray(raw))return [];
  return raw.filter(Boolean).map((b,i)=>Object.freeze({id:String(b.id||i),x:Number(b.x)||0,y:Number(b.y)||0,w:Math.max(0,Number(b.w)||0),h:Math.max(0,Number(b.h)||0)})).filter(b=>b.w>0&&b.h>0);
}
function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function registerLayer(spec){
  if(!spec||!spec.id||typeof spec.draw!=='function'||!phaseRank.has(spec.phase))throw new Error('[Kelo environment layers] invalid layer');
  if(layers.some(l=>l.id===spec.id))throw new Error('[Kelo environment layers] duplicate layer '+spec.id);
  const layer=Object.freeze({id:String(spec.id),phase:spec.phase,priority:Number(spec.priority)||0,required:spec.required!==false,draw:spec.draw,ready:typeof spec.ready==='function'?spec.ready:()=>true,bounds:spec.bounds||null,ownership:String(spec.ownership||'unspecified')});
  layers.push(layer);sortLayers();syncAudit();return layer.id;
}
function priorityTies(){
  const groups=new Map();
  for(const layer of layers){const key=`${layer.phase}:${layer.priority}`;const list=groups.get(key)||[];list.push(layer.id);groups.set(key,list);}
  return Array.from(groups.entries()).filter(([,ids])=>ids.length>1).map(([key,ids])=>Object.freeze({key,ids:Object.freeze(ids.slice().sort())}));
}
function spatialTies(){
  const out=[];
  for(let i=0;i<layers.length;i++)for(let j=i+1;j<layers.length;j++){
    const a=layers[i],b=layers[j];
    if(a.phase!==b.phase||a.priority!==b.priority)continue;
    const ab=normalizeBounds(a.bounds),bb=normalizeBounds(b.bounds);
    const hits=[];
    for(const x of ab)for(const y of bb)if(overlaps(x,y))hits.push(Object.freeze({a:x.id,b:y.id,x:Math.max(x.x,y.x),y:Math.max(x.y,y.y),w:Math.min(x.x+x.w,y.x+y.w)-Math.max(x.x,y.x),h:Math.min(x.y+x.h,y.y+y.h)-Math.max(x.y,y.y)}));
    if(hits.length)out.push(Object.freeze({key:`${a.phase}:${a.priority}`,a:a.id,b:b.id,aOwnership:a.ownership,bOwnership:b.ownership,overlapCount:hits.length,overlaps:Object.freeze(hits)}));
  }
  return out;
}
function syncAudit(){
  if(!window.KELO_ENVIRONMENT_LAYER_AUDIT)return;
  const ties=priorityTies(),spatial=spatialTies();
  window.KELO_ENVIRONMENT_LAYER_AUDIT.layerCount=layers.length;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.preActorLayerCount=layers.filter(l=>!POST_ACTOR_PHASES.has(l.phase)).length;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.postActorLayerCount=layers.filter(l=>POST_ACTOR_PHASES.has(l.phase)).length;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.priorityTieCount=ties.length;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.priorityTies=ties;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.spatialTieCount=spatial.length;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.spatialTies=spatial;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.layers=layers.map((l,index)=>Object.freeze({id:l.id,phase:l.phase,priority:l.priority,required:l.required,ready:!!l.ready(),timing:POST_ACTOR_PHASES.has(l.phase)?'post_actor':'pre_actor',ownership:l.ownership,boundsCount:normalizeBounds(l.bounds).length,orderIndex:index,orderKey:`${String(phaseRank.get(l.phase)).padStart(2,'0')}:${String(l.priority).padStart(4,'0')}:${l.id}`}));
}
function drawPhaseSet(g,postActor){
  for(const layer of layers){if(POST_ACTOR_PHASES.has(layer.phase)!==postActor)continue;if(layer.ready())layer.draw(g);}
}
function draw(g){
  const drew=base.draw(g);
  if(!drew)return false;
  drawPhaseSet(g,false);
  syncAudit();return true;
}
function drawPostActors(g){drawPhaseSet(g,true);syncAudit();return true;}
window.KELO_ENVIRONMENT_LAYER_AUDIT={version:'environment-layer-stack-v2.1',ready:true,mode:'formal-pre-post-actor-layer-order-v1',orderingPolicy:ORDERING_POLICY,spatialPolicy:SPATIAL_POLICY,phases:PHASES,postActorPhases:Array.from(POST_ACTOR_PHASES),layerCount:0,preActorLayerCount:0,postActorLayerCount:0,priorityTieCount:0,priorityTies:[],spatialTieCount:0,spatialTies:[],layers:[]};
window.KELO_ENVIRONMENT_LAYERS=Object.freeze({version:'environment-layer-stack-v2.1',orderingPolicy:ORDERING_POLICY,spatialPolicy:SPATIAL_POLICY,phases:PHASES,postActorPhases:Object.freeze(Array.from(POST_ACTOR_PHASES)),register:registerLayer,drawPostActors,get layers(){return layers.slice();}});
window.KELO_WORLD_RENDERER=Object.freeze({draw,drawPostActors,districts:base.districts,chunkSize:base.chunkSize,get ready(){return base.ready&&layers.every(l=>!l.required||l.ready());},environmentLayerStack:true,postActorLayerStack:true});
syncAudit();
})();