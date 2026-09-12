/* KELO-INDEX
 * area: TEST / MAP FORGE / SCENE PREFABS
 * owner: Map Forge CI
 * purpose: lock authored scene materialization, real member movement and road-entry connectors across representative Royal Capital seeds
 * public-api: CLI regression guard
 * consumes: Map Forge recipes + pure generator core
 * state-owned: none
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

const PRIMARY_SEED=81746291;
const SEEDS=[PRIMARY_SEED,12345,424242,29011987];
const recipe=MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1;
const results=[];
let totalScenes=0,totalMembers=0,totalMoved=0,totalConnectors=0,totalImprovement=0;

for(const seed of SEEDS){
  const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(map.validation.valid,true,`${seed}: map must remain valid after authored scene materialization`);
  assert.equal(map.metadata.generatorVersion,'1.4.0',`${seed}: authored scene prefab guard targets generator 1.4.0`);

  const stats=map.generationStats||{};
  const evaluated=Number(stats.scenePrefabEvaluatedCount||0);
  const scenes=Number(stats.scenePrefabSceneCount||0);
  const members=Number(stats.scenePrefabMemberCount||0);
  const moved=Number(stats.scenePrefabMovedCount||0);
  const connectors=Number(stats.scenePrefabConnectorCount||0);
  const improvement=Number(stats.scenePrefabDistanceImprovement||0);
  const movement=Number(stats.scenePrefabMovementDistance||0);
  const prefabs=map.scenePrefabs||[];

  assert.ok(evaluated>=4,`${seed}: Royal Capital must evaluate multiple authored landmark prefab patterns`);
  assert.equal(prefabs.length,scenes,`${seed}: scenePrefabSceneCount must match scenePrefabs payload`);
  assert.ok(scenes>=1,`${seed}: at least one authored scene prefab must resolve`);
  assert.ok(members>=2,`${seed}: resolved authored scenes must contain multiple semantic members`);
  assert.equal(connectors,scenes,`${seed}: every resolved scene must expose its road-entry connector`);
  assert.ok(improvement>=0,`${seed}: authored scene distance improvement cannot be negative`);
  assert.ok(movement>=0,`${seed}: authored scene movement cannot be negative`);

  const ids=new Set();
  for(const scene of prefabs){
    assert.ok(scene.id&&!ids.has(scene.id),`${seed}: scene prefab IDs must be unique`);ids.add(scene.id);
    assert.ok(scene.prefabId&&scene.kit&&scene.variant,`${seed}: scene prefab must expose authored identity, kit and variant`);
    assert.ok(Array.isArray(scene.members)&&scene.members.length>=2,`${seed}: scene prefab needs at least two resolved members`);
    const roadConnectors=(scene.connectors||[]).filter(row=>row.kind==='road'&&row.required===true&&row.roadId);
    assert.equal(roadConnectors.length,1,`${seed}: each authored scene must have exactly one required road-entry connector`);
    assert.ok(Number.isFinite(roadConnectors[0].position?.x)&&Number.isFinite(roadConnectors[0].position?.y),`${seed}: road connector must expose a concrete point`);
    for(const member of scene.members){
      const decoration=map.decorations.find(row=>row.id===member.decorationId);
      assert.ok(decoration,`${seed}: ${member.decorationId} must resolve to a real decoration`);
      assert.equal(decoration.scenePrefabId,scene.id,`${seed}: real decoration must retain scene ownership`);
      assert.equal(decoration.sceneRole,member.role,`${seed}: real decoration must retain authored semantic role`);
      assert.equal(decoration.sceneKit,scene.kit,`${seed}: real decoration must retain district scene kit`);
    }
  }

  if(seed===PRIMARY_SEED){
    assert.ok(scenes>=2,`${seed}: primary visual seed must materially contain multiple authored scenes`);
    assert.ok(moved>0,`${seed}: primary visual seed must physically move authored scene members`);
    assert.ok(improvement>0,`${seed}: primary visual seed must move members closer to authored targets`);
    assert.ok(connectors>=2,`${seed}: primary visual seed must expose multiple real road-entry connectors`);
  }

  totalScenes+=scenes;totalMembers+=members;totalMoved+=moved;totalConnectors+=connectors;totalImprovement+=improvement;
  results.push({seed,evaluated,scenes,members,moved,connectors,improvement,movement,safetyRejected:Number(stats.scenePrefabSafetyRejectedCount||0),rhythmProtected:Number(stats.scenePrefabRhythmProtectedCount||0),prefabs:prefabs.map(scene=>({id:scene.id,prefabId:scene.prefabId,kit:scene.kit,variant:scene.variant,memberCount:scene.memberCount,movedCount:scene.movedCount,distanceImprovement:scene.distanceImprovement,connectorRoadId:scene.connectors?.[0]?.roadId||null}))});
}

assert.ok(totalScenes>=SEEDS.length,'representative seeds must all resolve authored scenes');
assert.ok(totalMoved>0,'representative seeds must physically use authored placement');
assert.ok(totalConnectors>=totalScenes,'representative authored scenes must remain connected to roads');
assert.ok(totalImprovement>0,'representative authored scenes must retain positive composition gain');
console.log(JSON.stringify({ok:true,primarySeed:PRIMARY_SEED,seeds:SEEDS,totalScenes,totalMembers,totalMoved,totalConnectors,totalImprovement,results},null,2));
