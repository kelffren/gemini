(function(){
'use strict';
const base=window.KELO_WORLD_RENDERER;
if(!base||typeof base.draw!=='function'){console.error('[Kelo environment layers] world renderer missing');return;}
const PHASES=Object.freeze(['ground','ground_variation','transitions','paths_floors','decals_details','props_back','props_front','vfx_weather_lighting']);
const phaseRank=new Map(PHASES.map((name,i)=>[name,i]));
const layers=[];
function sortLayers(){layers.sort((a,b)=>(phaseRank.get(a.phase)??999)-(phaseRank.get(b.phase)??999)||(a.priority||0)-(b.priority||0)||a.id.localeCompare(b.id));}
function registerLayer(spec){
  if(!spec||!spec.id||typeof spec.draw!=='function'||!phaseRank.has(spec.phase))throw new Error('[Kelo environment layers] invalid layer');
  if(layers.some(l=>l.id===spec.id))throw new Error('[Kelo environment layers] duplicate layer '+spec.id);
  const layer=Object.freeze({id:String(spec.id),phase:spec.phase,priority:Number(spec.priority)||0,required:spec.required!==false,draw:spec.draw,ready:typeof spec.ready==='function'?spec.ready:()=>true});
  layers.push(layer);sortLayers();syncAudit();return layer.id;
}
function syncAudit(){
  if(!window.KELO_ENVIRONMENT_LAYER_AUDIT)return;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.layerCount=layers.length;
  window.KELO_ENVIRONMENT_LAYER_AUDIT.layers=layers.map(l=>Object.freeze({id:l.id,phase:l.phase,priority:l.priority,required:l.required,ready:!!l.ready()}));
}
function draw(g){
  const drew=base.draw(g);
  if(!drew)return false;
  for(const layer of layers){if(layer.ready())layer.draw(g);}
  syncAudit();return true;
}
window.KELO_ENVIRONMENT_LAYER_AUDIT={version:'environment-layer-stack-v1',ready:true,mode:'formal-environment-layer-order-v1',phases:PHASES,layerCount:0,layers:[]};
window.KELO_ENVIRONMENT_LAYERS=Object.freeze({version:'environment-layer-stack-v1',phases:PHASES,register:registerLayer,get layers(){return layers.slice();}});
window.KELO_WORLD_RENDERER=Object.freeze({draw,districts:base.districts,chunkSize:base.chunkSize,get ready(){return base.ready&&layers.every(l=>!l.required||l.ready());},environmentLayerStack:true});
syncAudit();
})();
