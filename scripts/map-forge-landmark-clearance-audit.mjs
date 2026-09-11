/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: fixed-seed regression guard for landmark focal clearance against generated building blocks
 * public-api: CLI
 * consumes: map-forge recipes + deterministic core
 * state-owned: none
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

function rectIntersectsCircle(r,c,radius){const x=Math.max(r.x,Math.min(c.x,r.x+r.w)),y=Math.max(r.y,Math.min(c.y,r.y+r.h)),dx=x-c.x,dy=y-c.y;return dx*dx+dy*dy<radius*radius;}
function clearanceViolations(map){let n=0;for(const block of map.blocks||[])for(const landmark of map.landmarks||[]){const radius=Math.max(0,Number(landmark.clearance?.radius)||0);if(radius&&rectIntersectsCircle(block.bounds,landmark.position,radius)){n++;break;}}return n;}

let mapsChecked=0,validMaps=0,totalBlocks=0,totalViolations=0,determinismChecks=0;
const stats={};
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES)){
  let blocks=0,violations=0,valid=0;
  for(let seed=1;seed<=100;seed++){
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
    const found=clearanceViolations(map);
    mapsChecked++;blocks+=map.blocks.length;violations+=found;totalBlocks+=map.blocks.length;totalViolations+=found;
    if(map.validation?.valid){valid++;validMaps++;}
  }
  assert.equal(valid,100,`${id} must keep 100/100 fixed-seed maps valid`);
  stats[id]={seeds:100,valid,blocks,violations,violationRate:Number((violations/Math.max(1,blocks)*100).toFixed(3))};
}
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES))for(const seed of [7,42,1337,20260910]){
  const a=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'}),b=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(a.metadata.layoutHash,b.metadata.layoutHash,`${id}/${seed} must remain deterministic`);determinismChecks++;
}
assert.equal(validMaps,mapsChecked,'all fixed-seed maps must remain valid');
console.log(JSON.stringify({ok:true,mapsChecked,validMaps,totalBlocks,totalViolations,violationRate:Number((totalViolations/Math.max(1,totalBlocks)*100).toFixed(3)),determinismChecks,stats},null,2));