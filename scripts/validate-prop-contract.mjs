import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const files=['src/environment/prop-contract.js','src/environment/generic-props.js','src/environment/plaza-nature.js','src/environment/rural-ground.js','src/environment/environment-layer-stack.js','engine-c.js','index.html'];
for(const f of files){if(!fs.existsSync(f))throw new Error(`missing ${f}`);if(f.endsWith('.js'))new vm.Script(read(f),{filename:f});}
const contractSrc=read('src/environment/prop-contract.js');
for(const token of ['family:','asset:','frame:','position:','anchor:','visualBounds:','footprint:','collider:','layers:','priority:','district:','occlusion:','layerGroups','layerGroup:','ruralProps','ruralBoundary','sources','ruralFarmBoundary','buildRuralFarmBoundary','instances:function()']){
  if(!contractSrc.includes(token))throw new Error(`prop contract missing ${token}`);
}
if(!contractSrc.includes("version:'1.3.0'")||!contractSrc.includes("mode:'generic-prop-contract-v3'"))throw new Error('prop contract is not dynamic layer-stack v1.3');
if(contractSrc.includes("renderMode:'immediate'"))throw new Error('prop contract reintroduced immediate rendering');
const genericSrc=read('src/environment/generic-props.js');
for(const token of ['C.layerGroups','group.back.phase','group.front.phase','group.ownership','group.priority','propsFor(groupKey)','sourcePropsFor(groupKey)','source.instances()','imageSmoothingEnabled=false','p.occlusion','drawInstances','isAssetReady','dynamicSourceCount','backDrawCountByGroup']){
  if(!genericSrc.includes(token))throw new Error(`generic renderer missing ${token}`);
}
if(genericSrc.includes("if(p.family==='tree')")||genericSrc.includes("if(p.asset==='plazaNature')")||genericSrc.includes("if(p.asset==='ruralProps')"))throw new Error('generic renderer contains prop-specific branch');
const legacy=read('src/environment/plaza-nature.js');
for(const forbidden of ['function drawProp','function drawBack','function drawFrontOcclusion','g.drawImage(img']){
  if(legacy.includes(forbidden))throw new Error(`specialized plaza renderer still present: ${forbidden}`);
}
for(const token of ['genericPropContract:true',"backLayerId:'plaza-nature-back'","frontLayerId:'plaza-nature-front'"]){if(!legacy.includes(token))throw new Error(`plaza nature compatibility contract missing ${token}`);}
const rural=read('src/environment/rural-ground.js');
for(const forbidden of ['const PROP_ATLAS=','const P=REGISTRY?.ruralPropTiles','function propTile','function drawBoundary','new Image(); props','props.src=','GENERIC_PROPS.drawInstances']){
  if(rural.includes(forbidden))throw new Error(`specialized/immediate rural prop renderer still present: ${forbidden}`);
}
for(const token of ['PROP_CONTRACT?.sources?.ruralFarmBoundary','GENERIC_PROPS.isAssetReady','genericPropContract:true',"boundaryMode:'environment-layer-stack-props-back-v1'",'immediateBoundaryDraw:false']){if(!rural.includes(token))throw new Error(`rural formal prop integration missing ${token}`);}
const stack=read('src/environment/environment-layer-stack.js');
if(!stack.includes("PRE_ACTOR_PHASES=new Set(['props_back'])")||!stack.includes('drawPreActors'))throw new Error('formal props_back pre-actor phase missing');
const engine=read('engine-c.js');
if(!engine.includes('KELO_WORLD_RENDERER.drawPreActors(ctx)')||engine.indexOf('KELO_WORLD_RENDERER.drawPreActors(ctx)')>engine.indexOf('renderAvatar(arenaPvP.rival'))throw new Error('engine does not execute props_back before actors');
const html=read('index.html');
const engineAt=html.indexOf('engine-c.js?v=226');
const stackAt=html.indexOf('src/environment/environment-layer-stack.js?v=3');
const contractAt=html.indexOf('src/environment/prop-contract.js?v=4');
const genericAt=html.indexOf('src/environment/generic-props.js?v=4');
const ruralAt=html.indexOf('src/environment/rural-ground.js?v=173');
if(engineAt<0||stackAt<0||contractAt<0||genericAt<0||ruralAt<0||!(stackAt<contractAt&&contractAt<genericAt&&genericAt<ruralAt))throw new Error('formal prop bootstrap/cache contract is stale or out of order');
console.log('Generic Prop Contract validation PASS: static + dynamic props share formal props_back/props_front stack');
