/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: fixed-seed regression guard for decoration and building-block district spatial coherence
 * public-api: CLI
 * consumes: map-forge recipes + pure core + quality scorer
 * state-owned: none
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

function ownerAt(map,p){let owner=null,best=Infinity;for(const d of map.districts||[]){const dx=p.x-d.center.x,dy=p.y-d.center.y,cost=(dx*dx+dy*dy)/Math.max(.2,Number(d.weight)||1);if(cost<best){best=cost;owner=d.id;}}return owner;}
function mismatchCount(map){let n=0;for(const row of map.decorations||[])if(ownerAt(map,row)!==row.district)n++;return n;}
function blockMismatchCount(map){let n=0;for(const block of map.blocks||[]){const r=block.bounds,p={x:r.x+r.w/2,y:r.y+r.h/2};if(ownerAt(map,p)!==block.district)n++;}return n;}

const BASELINE_DECORATIONS=54597;
const BASELINE_MISMATCHES=13052;
const stats={};
let mapsChecked=0,totalDecorations=0,totalMismatches=0,totalDistrictRejects=0,totalBlocks=0,totalBlockMismatches=0,totalDeterminismChecks=0,validMaps=0;
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES)){
  let decorations=0,mismatches=0,districtRejects=0,blocks=0,blockMismatches=0,minCoherence=100,maxCoherence=0,valid=0;
  for(let seed=1;seed<=100;seed++){
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
    const mismatch=mismatchCount(map),blockMismatch=blockMismatchCount(map),coherence=map.quality?.breakdown?.districtCoherence,rejects=map.generationStats?.decorationDistrictRejects;
    assert.ok(Number.isFinite(coherence),`${id}/${seed} must expose districtCoherence`);
    assert.equal(mismatch,0,`${id}/${seed} decorations must remain inside their weighted spatial district`);
    assert.equal(coherence,100,`${id}/${seed} districtCoherence must be perfect after placement filtering`);
    assert.ok(Number.isFinite(rejects)&&rejects>=0,`${id}/${seed} must expose decorationDistrictRejects`);
    if(map.validation?.valid){valid++;validMaps++;}
    mapsChecked++;decorations+=map.decorations.length;mismatches+=mismatch;districtRejects+=rejects;blocks+=map.blocks.length;blockMismatches+=blockMismatch;totalDecorations+=map.decorations.length;totalMismatches+=mismatch;totalDistrictRejects+=rejects;totalBlocks+=map.blocks.length;totalBlockMismatches+=blockMismatch;
    minCoherence=Math.min(minCoherence,coherence);maxCoherence=Math.max(maxCoherence,coherence);
  }
  assert.equal(valid,100,`${id} must keep 100/100 fixed-seed maps valid`);
  stats[id]={seeds:100,valid,decorations,mismatches,mismatchRate:Number((mismatches/Math.max(1,decorations)*100).toFixed(2)),districtRejects,blocks,blockMismatches,blockMismatchRate:Number((blockMismatches/Math.max(1,blocks)*100).toFixed(2)),coherenceRange:[minCoherence,maxCoherence]};
}
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES))for(const seed of [7,42,1337,20260910]){
  const a=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'}),b=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(a.metadata.layoutHash,b.metadata.layoutHash,`${id}/${seed} layout hash must stay deterministic`);
  assert.equal(a.quality.breakdown.districtCoherence,b.quality.breakdown.districtCoherence,`${id}/${seed} coherence score must stay deterministic`);
  assert.equal(a.generationStats.decorationDistrictRejects,b.generationStats.decorationDistrictRejects,`${id}/${seed} district rejects must stay deterministic`);
  totalDeterminismChecks++;
}
assert.equal(mapsChecked,Object.keys(MAP_FORGE_RECIPES).length*100,'audit must inspect 100 seeds per recipe');
assert.equal(validMaps,mapsChecked,'all fixed-seed maps must remain valid');
assert.ok(totalDecorations>=BASELINE_DECORATIONS*.8,`decoration population collapsed: ${totalDecorations} vs baseline ${BASELINE_DECORATIONS}`);
assert.equal(totalMismatches,0,`district leakage regressed from expected 0: ${totalMismatches}`);
assert.ok(totalDistrictRejects>0,'fixed-seed corpus must exercise the district placement guard');
console.log(JSON.stringify({ok:true,mapsChecked,validMaps,totalDecorations,baselineDecorations:BASELINE_DECORATIONS,decorationRetentionPct:Number((totalDecorations/BASELINE_DECORATIONS*100).toFixed(2)),baselineMismatches:BASELINE_MISMATCHES,totalMismatches,mismatchRate:Number((totalMismatches/Math.max(1,totalDecorations)*100).toFixed(2)),totalDistrictRejects,totalBlocks,totalBlockMismatches,blockMismatchRate:Number((totalBlockMismatches/Math.max(1,totalBlocks)*100).toFixed(2)),determinismChecks:totalDeterminismChecks,stats},null,2));
