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

import fs from 'node:fs';
const bridgeSource=fs.readFileSync(new URL('../src/studio/integration/library-build-bridge.mjs',import.meta.url),'utf8');
assert.match(bridgeSource,/prepareSceneImport/,'library scene handoff must stage before prefab preview');
assert.match(bridgeSource,/maxInstances:2500/,'library scene handoff must enforce a bounded mobile scene size');
assert.match(bridgeSource,/sceneHealth\(staged\)/,'library scene handoff must expose measurable scene health');
assert.doesNotMatch(bridgeSource,/KELO_WORLD_EDIT/,'Scene Fabric handoff must never bypass Studio authority');
console.log('PASS scene-fabric-library-gate: one-tap scenes are staged before canonical prefab placement');
