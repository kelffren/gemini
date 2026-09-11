/* KELO-INDEX
 * area: TEST / MAP FORGE / ROYAL CAPITAL
 * owner: Map Forge CI
 * purpose: lock the visually approved Royal Capital road hierarchy and street-furniture composition across representative deterministic seeds
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

const EXPECTED_ARTERIAL_WIDTH=100;
const EXPECTED_COLLECTOR_WIDTH=72;
const EXPECTED_DECORATION=0.60;
const PRIMARY_SEED=81746291;
const SEEDS=[PRIMARY_SEED,12345,424242,29011987];
const recipe=MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1;

assert.equal(recipe.road.arterialWidth,EXPECTED_ARTERIAL_WIDTH,'Royal Capital champion must keep the approved slimmer arterial width');
assert.equal(recipe.road.collectorWidth,EXPECTED_COLLECTOR_WIDTH,'Royal Capital champion must keep the approved slimmer collector width');
assert.equal(recipe.style.decoration,EXPECTED_DECORATION,'Royal Capital champion must keep the approved decoration density');
const results=[];
let representativeBenchSwaps=0;
for(const seed of SEEDS){
  const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(map.validation.valid,true,`${seed}: generated map must remain valid`);
  const arterials=map.roads.filter(road=>road.class==='arterial');
  const collectors=map.roads.filter(road=>road.class==='collector');
  assert.ok(arterials.length>0,`${seed}: representative map must contain arterial roads`);
  assert.ok(collectors.length>0,`${seed}: representative map must contain collector roads`);
  assert.ok(arterials.every(road=>road.width===EXPECTED_ARTERIAL_WIDTH),`${seed}: every arterial must use ${EXPECTED_ARTERIAL_WIDTH}px`);
  assert.ok(collectors.every(road=>road.width===EXPECTED_COLLECTOR_WIDTH),`${seed}: every collector must use ${EXPECTED_COLLECTOR_WIDTH}px`);
  assert.ok((map.generationStats.decorationStreetLampSwapCount||0)>0,`${seed}: approved lamp/flower road-affinity pass must stay active`);
  assert.ok((map.generationStats.decorationStreetLampRoadGain||0)>=36,`${seed}: lamp pass must retain a meaningful road-affinity gain`);
  const benchSwaps=map.generationStats.decorationStreetBenchSwapCount||0;
  const benchRoadGain=map.generationStats.decorationStreetBenchRoadGain||0;
  representativeBenchSwaps+=benchSwaps;
  if(seed===PRIMARY_SEED){
    assert.ok(benchSwaps>=3,`${seed}: primary visual seed must keep the approved second-pass roadside seating improvement`);
    assert.ok(benchRoadGain>=170,`${seed}: primary visual seed must keep the expanded bench road-affinity gain`);
  }
  const lampCount=map.decorations.filter(row=>row.family==='lamp').length;
  const flowerCount=map.decorations.filter(row=>row.family==='flower').length;
  const benchCount=map.decorations.filter(row=>row.family==='bench').length;
  assert.ok(lampCount>0&&flowerCount>0&&benchCount>0,`${seed}: representative map must retain lamps, flowers and benches`);
  results.push({seed,roadCount:map.roads.length,blockCount:map.blocks.length,decorationCount:map.decorations.length,arterialCount:arterials.length,collectorCount:collectors.length,arterialWidths:[...new Set(arterials.map(road=>road.width))],collectorWidths:[...new Set(collectors.map(road=>road.width))],decoration:recipe.style.decoration,streetFamilySwaps:map.generationStats.decorationStreetFamilySwapCount,streetFamilyRoadGain:map.generationStats.decorationStreetFamilyRoadGain,lampSwaps:map.generationStats.decorationStreetLampSwapCount,lampRoadGain:map.generationStats.decorationStreetLampRoadGain,benchSwaps,benchRoadGain,lampCount,flowerCount,benchCount,quality:map.quality.total});
}
assert.ok(representativeBenchSwaps>=4,'Representative seeds must retain the approved second-pass roadside seating improvement');
console.log(JSON.stringify({ok:true,expectedArterialWidth:EXPECTED_ARTERIAL_WIDTH,expectedCollectorWidth:EXPECTED_COLLECTOR_WIDTH,expectedDecoration:EXPECTED_DECORATION,primarySeed:PRIMARY_SEED,seeds:SEEDS,representativeBenchSwaps,results},null,2));