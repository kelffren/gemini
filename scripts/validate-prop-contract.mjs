import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const files=['src/environment/prop-contract.js','src/environment/generic-props.js','src/environment/plaza-nature.js'];
for(const f of files){if(!fs.existsSync(f))throw new Error(`missing ${f}`);new vm.Script(read(f),{filename:f});}
const contractSrc=read('src/environment/prop-contract.js');
for(const token of ['family:','asset:','frame:','position:','anchor:','visualBounds:','footprint:','collider:','layers:','priority:','district:','occlusion:']){
  if(!contractSrc.includes(token))throw new Error(`prop contract missing ${token}`);
}
const genericSrc=read('src/environment/generic-props.js');
for(const token of ["phase:'props_back'","phase:'props_front'",'imageSmoothingEnabled=false','C.props.forEach','p.occlusion']){
  if(!genericSrc.includes(token))throw new Error(`generic renderer missing ${token}`);
}
const legacy=read('src/environment/plaza-nature.js');
for(const forbidden of ['function drawProp','function drawBack','function drawFrontOcclusion','g.drawImage(img']){
  if(legacy.includes(forbidden))throw new Error(`specialized plaza renderer still present: ${forbidden}`);
}
if(!legacy.includes('genericPropContract:true'))throw new Error('plaza nature compatibility audit does not certify generic contract');
console.log('Generic Prop Contract validation PASS');
