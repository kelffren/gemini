/* KELO-INDEX
 * area: TEST / MAP FORGE / SCENE PREFABS
 * owner: Map Forge CI
 * purpose: prove resolved authored landmark-scene members remain inside their prefab road-band across a deterministic corpus
 * public-api: CLI regression guard
 * consumes: Map Forge recipes + generator core + authored scene patterns
 * state-owned: none
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';
import {SCENE_PREFAB_PATTERNS} from '../src/world/map-forge/map-forge-scene-prefabs.mjs';

function nearestRoadDistance(point,roads){
  let best=Infinity;
  for(const road of roads||[]){
    const pts=road.polyline||[];
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
      const t=den?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/den)):0;
      const x=a.x+dx*t,y=a.y+dy*t;
      best=Math.min(best,Math.hypot(x-point.x,y-point.y));
    }
  }
  return best;
}

const FIXED_SEEDS=[1,2,3,5,8,13,21,34,55,89,12345,424242,81746291,29011987];
let maps=0,scenes=0,members=0;
for(const recipe of Object.values(MAP_FORGE_RECIPES)){
  for(const seed of FIXED_SEEDS){
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
    assert.equal(map.validation.valid,true,`${recipe.id}:${seed}: candidate must remain structurally valid`);
    const landmarks=new Map((map.landmarks||[]).map(row=>[row.id,row]));
    for(const scene of map.scenePrefabs||[]){
      if(scene.sceneType==='arrival')continue;
      const landmark=landmarks.get(scene.landmarkId);
      const pattern=SCENE_PREFAB_PATTERNS[landmark?.type];
      assert.ok(pattern,`${recipe.id}:${seed}:${scene.id}: resolved landmark scene must have an authored pattern`);
      const [declaredMin=0,declaredMax=Infinity]=pattern.roadBand||[];
      const district=(map.districts||[]).find(row=>row.id===scene.district);
      const urban=district?.kind==='plaza'||district?.kind==='royal'||district?.kind==='commerce';
      const minRoad=Math.max(Number(declaredMin)||0,urban?35:22);
      const maxRoad=Math.min(Number(declaredMax)||Infinity,urban?190:Infinity);
      for(const member of scene.members||[]){
        const decoration=(map.decorations||[]).find(row=>row.id===member.decorationId);
        assert.ok(decoration,`${recipe.id}:${seed}:${scene.id}:${member.decorationId}: scene member must resolve to a decoration`);
        const distance=nearestRoadDistance(decoration,map.roads);
        assert.ok(distance>=minRoad-0.11&&distance<=maxRoad+0.11,`${recipe.id}:${seed}:${scene.id}:${member.role}: resolved member violates authored road band (${distance.toFixed(2)} not in ${minRoad}-${maxRoad})`);
        members++;
      }
      scenes++;
    }
    maps++;
  }
}
assert.ok(scenes>0&&members>0,'deterministic corpus must exercise authored landmark scenes');
console.log(JSON.stringify({ok:true,maps,scenes,members,seeds:FIXED_SEEDS},null,2));
