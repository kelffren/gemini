import assert from 'node:assert/strict';
import {normalizeSceneManifest,resolveSceneDependencies,stageScene,prepareSceneImport,sceneHealth} from '../src/studio/integration/scene-fabric.mjs';

const manifest={id:'scene:plaza:test',version:2,instances:[
 {instanceId:'tree:a',assetId:'asset:tree',x:10,y:20,layer:'nature'},
 {instanceId:'bench:a',assetId:'asset:bench',transform:{x:30,y:40,rotation:90}}
]};
const normalized=normalizeSceneManifest(manifest);
assert.deepEqual(normalized.dependencies,['asset:bench','asset:tree']);
assert.equal(normalized.instances.length,2);
let cache=new Set(['asset:tree']);
let resolved=resolveSceneDependencies(normalized,{hasAsset:id=>cache.has(id)});
assert.equal(resolved.ready,false);
assert.equal(resolved.reuseRatio,.5);
let staged=stageScene(normalized,{hasAsset:id=>cache.has(id)});
assert.equal(staged.status,'blocked');
assert.equal(sceneHealth(staged).reusePercent,50);
const prepared=await prepareSceneImport(normalized,{hasAsset:id=>cache.has(id),ensureAsset:async id=>cache.add(id)});
assert.equal(prepared.status,'ready');
assert.equal(sceneHealth(prepared).reusePercent,100);
const duplicate={...manifest,instances:[manifest.instances[0],{...manifest.instances[1],instanceId:'tree:a'}]};
assert.match(stageScene(duplicate,{hasAsset:()=>true}).errors.join('|'),/DUPLICATE_INSTANCE/);
assert.equal(stageScene({...manifest,instances:Array.from({length:3},(_,i)=>({assetId:'asset:tree',instanceId:'x'+i}))},{hasAsset:()=>true,maxInstances:2}).status,'blocked');
console.log('PASS scene-fabric-audit: manifests resolve dependencies and block unsafe scene imports before mutation');
