/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: fixed-seed regression guard for decoration-to-district spatial coherence
 * public-api: CLI
 * consumes: map-forge recipes + pure core + quality scorer
 * state-owned: none
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';
import {scoreMapDefinition} from '../src/world/map-forge/map-forge-quality.mjs';

function ownerAt(map,p){let owner=null,best=Infinity;for(const d of map.districts||[]){const dx=p.x-d.center.x,dy=p.y-d.center.y,cost=(dx*dx+dy*dy)/Math.max(.2,Number(d.weight)||1);if(cost<best){best=cost;owner=d.id;}}return owner;}
function mismatchCount(map){let n=0;for(const row of map.decorations||[])if(ownerAt(map,row)!==row.district)n++;return n;}

const stats={};
let mapsChecked=0,totalDecorations=0,totalMismatches=0,totalDeterminismChecks=0,sensitivityChecks=0;
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES)){
  let decorations=0,mismatches=0,minCoherence=100,maxCoherence=0;
  for(let seed=1;seed<=100;seed++){
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
    const mismatch=mismatchCount(map),coherence=map.quality?.breakdown?.districtCoherence;
    assert.ok(Number.isFinite(coherence),`${id}/${seed} must expose districtCoherence`);
    assert.ok(coherence>=45&&coherence<=100,`${id}/${seed} districtCoherence must stay normalized`);
    mapsChecked++;decorations+=map.decorations.length;mismatches+=mismatch;totalDecorations+=map.decorations.length;totalMismatches+=mismatch;
    minCoherence=Math.min(minCoherence,coherence);maxCoherence=Math.max(maxCoherence,coherence);
    if(mismatch>0){
      const corrected=structuredClone(map);
      for(const row of corrected.decorations)row.district=ownerAt(corrected,row);
      const correctedScore=scoreMapDefinition(corrected,recipe).breakdown.districtCoherence;
      assert.equal(correctedScore,100,`${id}/${seed} corrected ownership should score 100`);
      assert.ok(correctedScore>coherence,`${id}/${seed} scorer must prefer coherent decoration ownership`);
      sensitivityChecks++;
    }
  }
  stats[id]={seeds:100,decorations,mismatches,mismatchRate:Number((mismatches/Math.max(1,decorations)*100).toFixed(2)),coherenceRange:[minCoherence,maxCoherence]};
}
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES))for(const seed of [7,42,1337,20260910]){
  const a=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'}),b=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(a.layoutHash,b.layoutHash,`${id}/${seed} layout hash must stay deterministic`);
  assert.equal(a.quality.breakdown.districtCoherence,b.quality.breakdown.districtCoherence,`${id}/${seed} coherence score must stay deterministic`);
  totalDeterminismChecks++;
}
assert.equal(mapsChecked,Object.keys(MAP_FORGE_RECIPES).length*100,'audit must inspect 100 seeds per recipe');
assert.ok(totalDecorations>0,'audit must inspect generated decorations');
assert.ok(totalMismatches>0,'fixed-seed corpus must exercise cross-district decoration leakage');
assert.ok(sensitivityChecks>0,'new scorer must be sensitivity-tested on at least one leaky map');
console.log(JSON.stringify({ok:true,mapsChecked,totalDecorations,totalMismatches,mismatchRate:Number((totalMismatches/totalDecorations*100).toFixed(2)),sensitivityChecks,determinismChecks:totalDeterminismChecks,stats},null,2));
