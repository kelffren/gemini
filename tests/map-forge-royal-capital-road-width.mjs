/* KELO-INDEX
 * area: TEST / MAP FORGE / ROYAL CAPITAL
 * owner: Map Forge CI
 * purpose: lock the visually approved Royal Capital road hierarchy and street-furniture composition across representative deterministic seeds
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

const EXPECTED_ARTERIAL_WIDTH=104;
const EXPECTED_COLLECTOR_WIDTH=74;
const EXPECTED_DECORATION=0.60;
const SEEDS=[81746291,12345,424242,29011987];
const recipe=MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1;

assert.equal(recipe.road.arterialWidth,EXPECTED_ARTERIAL_WIDTH,'Royal Capital champion must keep the approved slimmer arterial width');
assert.equal(recipe.road.collectorWidth,EXPECTED_COLLECTOR_WIDTH,'Royal Capital champion must keep the approved slimmer collector width');
assert.equal(recipe.style.decoration,EXPECTED_DECORATION,'Royal Capital champion must keep the approved decoration density');
const results=[];
for(const seed of SEEDS){
  const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(map.validation.valid,true,`${seed}: generated map must remain valid`);
  const arterials=map.roads.filter(road=>road.class==='arterial');
  const collectors=map.roads.filter(road=>road.class==='collector');
  assert.ok(arterials.length>0,`${seed}: representative map must contain arterial roads`);
  assert.ok(collectors.length>0,`${seed}: representative map must contain collector roads`);
  assert.ok(arterials.every(road=>road.width===EXPECTED_ARTERIAL_WIDTH),`${seed}: every arterial must use ${EXPECTED_ARTERIAL_WIDTH}px`);
  assert.ok(collectors.every(road=>road.width===EXPECTED_COLLECTOR_WIDTH),`${seed}: every collector must use ${EXPECTED_COLLECTOR_WIDTH}px`);
  assert.ok((map.generationStats.decorationStreetFamilySwapCount||0)>0,`${seed}: street-furniture organizer must improve at least one lamp/flower relationship`);
  assert.ok((map.generationStats.decorationStreetFamilyRoadGain||0)>=36,`${seed}: street-furniture organizer must produce a meaningful road-affinity gain`);
  const lampCount=map.decorations.filter(row=>row.family==='lamp').length,flowerCount=map.decorations.filter(row=>row.family==='flower').length;
  assert.ok(lampCount>0&&flowerCount>0,`${seed}: representative map must retain lamps and flowers`);
  results.push({seed,roadCount:map.roads.length,blockCount:map.blocks.length,decorationCount:map.decorations.length,arterialCount:arterials.length,collectorCount:collectors.length,arterialWidths:[...new Set(arterials.map(road=>road.width))],collectorWidths:[...new Set(collectors.map(road=>road.width))],decoration:recipe.style.decoration,streetFamilySwaps:map.generationStats.decorationStreetFamilySwapCount,streetFamilyRoadGain:map.generationStats.decorationStreetFamilyRoadGain,lampCount,flowerCount,quality:map.quality.total});
}
console.log(JSON.stringify({ok:true,expectedArterialWidth:EXPECTED_ARTERIAL_WIDTH,expectedCollectorWidth:EXPECTED_COLLECTOR_WIDTH,expectedDecoration:EXPECTED_DECORATION,seeds:SEEDS,results},null,2));
