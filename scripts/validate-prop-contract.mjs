import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const files=['src/environment/prop-contract.js','src/environment/generic-props.js','src/environment/plaza-nature.js','src/environment/rural-ground.js','index.html'];
for(const f of files){if(!fs.existsSync(f))throw new Error(`missing ${f}`);if(f.endsWith('.js'))new vm.Script(read(f),{filename:f});}
const contractSrc=read('src/environment/prop-contract.js');
for(const token of ['family:','asset:','frame:','position:','anchor:','visualBounds:','footprint:','collider:','layers:','priority:','district:','occlusion:','layerGroups','layerGroup:','ruralProps','ruralBoundary','sources','ruralFarmBoundary','buildRuralFarmBoundary']){
  if(!contractSrc.includes(token))throw new Error(`prop contract missing ${token}`);
}
if(!contractSrc.includes("version:'1.2.0'")||!contractSrc.includes("mode:'generic-prop-contract-v2'"))throw new Error('prop contract version/mode not upgraded');
const genericSrc=read('src/environment/generic-props.js');
for(const token of ['C.layerGroups','group.back.phase','group.front.phase','group.ownership','group.priority','propsFor(groupKey)','imageSmoothingEnabled=false','p.occlusion','drawInstances','isAssetReady','renderMode']){
  if(!genericSrc.includes(token))throw new Error(`generic renderer missing ${token}`);
}
if(genericSrc.includes("if(p.family==='tree')")||genericSrc.includes("if(p.asset==='plazaNature')")||genericSrc.includes("if(p.asset==='ruralProps')"))throw new Error('generic renderer contains prop-specific branch');
const legacy=read('src/environment/plaza-nature.js');
for(const forbidden of ['function drawProp','function drawBack','function drawFrontOcclusion','g.drawImage(img']){
  if(legacy.includes(forbidden))throw new Error(`specialized plaza renderer still present: ${forbidden}`);
}
for(const token of ['genericPropContract:true',"backLayerId:'plaza-nature-back'","frontLayerId:'plaza-nature-front'"]){if(!legacy.includes(token))throw new Error(`plaza nature compatibility contract missing ${token}`);}
const rural=read('src/environment/rural-ground.js');
for(const forbidden of ['const PROP_ATLAS=','const P=REGISTRY?.ruralPropTiles','function propTile','function drawBoundary','new Image(); props','props.src=']){
  if(rural.includes(forbidden))throw new Error(`specialized rural prop renderer still present: ${forbidden}`);
}
for(const token of ['PROP_CONTRACT?.sources?.ruralFarmBoundary','GENERIC_PROPS.drawInstances','GENERIC_PROPS.isAssetReady','genericPropContract:true',"boundaryMode:'generic-prop-contract-v1'"]){if(!rural.includes(token))throw new Error(`rural generic prop integration missing ${token}`);}
const html=read('index.html');
const contractAt=html.indexOf('src/environment/prop-contract.js?v=3');
const genericAt=html.indexOf('src/environment/generic-props.js?v=3');
const ruralAt=html.indexOf('src/environment/rural-ground.js?v=172');
if(contractAt<0||genericAt<0||ruralAt<0||!(contractAt<genericAt&&genericAt<ruralAt))throw new Error('generic prop bootstrap order is not first-class before rural-ground');
console.log('Generic Prop Contract validation PASS: plaza nature + rural boundary share one renderer');
