import assert from 'node:assert/strict';
import {applyAssetTemplateMetadata,createAssetTemplateSeed,evaluateTemplateCompliance,inferAssetTemplateId,listAssetTemplates} from '../src/creators/assets/asset-template-registry.mjs';
import {createKeloAssetManifest,evaluateAsset} from '../src/creators/assets/kelo-asset-contract.mjs';

assert.ok(listAssetTemplates().some(template=>template.id==='helmet'));
assert.ok(listAssetTemplates().some(template=>template.id==='pants'));
assert.equal(inferAssetTemplateId({name:'Luxury Casco Gold',category:'wearable'}),'helmet');
assert.equal(inferAssetTemplateId({name:'Pantalón rojo',category:'wearable'}),'pants');
assert.equal(inferAssetTemplateId({name:'Street lamp',category:'prop'}),'prop');

const helmet=applyAssetTemplateMetadata({name:'Casco negro',category:'wearable',tags:['luxury']});
assert.equal(helmet.templateId,'helmet');
assert.equal(helmet.authoring.slot,'head');
assert.ok(helmet.tags.includes('head'));
assert.ok(helmet.tags.includes('helmet'));
assert.ok(helmet.authoring.occludes.includes('hair'));
assert.deepEqual(helmet.authoring.directions,['down','left','right','up']);

const pantsSeed=createAssetTemplateSeed('pants');
assert.equal(pantsSeed.slot,'legs');
assert.ok(pantsSeed.layers.includes('pelvis-guide'));
assert.ok(pantsSeed.previewStates.includes('walk'));

const pantsManifest=createKeloAssetManifest({name:'Pantalón rojo',category:'wearable',width:32,height:32,tags:['red']});
assert.equal(pantsManifest.authoring.templateId,'pants');
assert.equal(pantsManifest.authoring.slot,'legs');
assert.ok(pantsManifest.tags.includes('pants'));
assert.ok(pantsManifest.tags.includes('legs'));

const pixels=new Uint8ClampedArray(32*32*4);
for(let y=12;y<31;y++)for(let x=8;x<24;x++){
  const i=(y*32+x)*4;pixels[i]=190;pixels[i+1]=20;pixels[i+2]=30;pixels[i+3]=255;
}
const report=evaluateAsset({width:32,height:32,data:pixels,manifest:pantsManifest});
assert.ok(report.score>0);
assert.ok(!report.issues.some(issue=>issue.code==='TEMPLATE_CATEGORY'));

const badMetrics={width:32,height:32,bounds:{x:0,y:0,width:32,height:32}};
const compliance=evaluateTemplateCompliance({metrics:badMetrics,manifest:pantsManifest});
assert.ok(compliance.issues.some(issue=>issue.code==='TEMPLATE_SAFE_AREA'));

console.log('asset-template-registry: ok');
