/* KELO-INDEX
 * area: TEST / MAP FORGE / ROYAL CAPITAL
 * owner: Map Forge CI
 * purpose: lock the visually approved Royal Capital road hierarchy, decoration density and street-edge furnishing rhythm across representative deterministic seeds
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';
import {nearestRoadDistance} from '../src/world/map-forge/map-forge-geometry.mjs';

const EXPECTED_ARTERIAL_WIDTH=104;
const EXPECTED_COLLECTOR_WIDTH=74;
const EXPECTED_DECORATION=0.60;
const STREET_EDGE_FAMILIES=new Set(['lamp','bench']);
const STREET_EDGE_MAX_DISTANCE=179;
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
  const streetEdge=map.decorations.filter(row=>STREET_EDGE_FAMILIES.has(row.family));
  const streetDistances=streetEdge.map(row=>nearestRoadDistance(row,map.roads));
  assert.ok(arterials.length>0,`${seed}: representative map must contain arterial roads`);
  assert.ok(collectors.length>0,`${seed}: representative map must contain collector roads`);
  assert.ok(arterials.every(road=>road.width===EXPECTED_ARTERIAL_WIDTH),`${seed}: every arterial must use ${EXPECTED_ARTERIAL_WIDTH}px`);
  assert.ok(collectors.every(road=>road.width===EXPECTED_COLLECTOR_WIDTH),`${seed}: every collector must use ${EXPECTED_COLLECTOR_WIDTH}px`);
  assert.ok(streetEdge.length>0,`${seed}: representative map must contain lamp/bench street furniture`);
  assert.ok((map.generationStats.decorationStreetEdgeNudgeCount||0)>0,`${seed}: street-edge refinement must actively improve at least one urban prop`);
  assert.ok(Math.max(...streetDistances)<=STREET_EDGE_MAX_DISTANCE,`${seed}: lamp/bench props must remain visually tied to the road network`);
  results.push({seed,roadCount:map.roads.length,blockCount:map.blocks.length,decorationCount:map.decorations.length,arterialCount:arterials.length,collectorCount:collectors.length,arterialWidths:[...new Set(arterials.map(road=>road.width))],collectorWidths:[...new Set(collectors.map(road=>road.width))],decoration:recipe.style.decoration,streetEdgeCount:streetEdge.length,streetEdgeNudged:map.generationStats.decorationStreetEdgeNudgeCount,maxStreetEdgeDistance:Number(Math.max(...streetDistances).toFixed(2)),quality:map.quality.total});
}
console.log(JSON.stringify({ok:true,expectedArterialWidth:EXPECTED_ARTERIAL_WIDTH,expectedCollectorWidth:EXPECTED_COLLECTOR_WIDTH,expectedDecoration:EXPECTED_DECORATION,streetEdgeMaxDistance:STREET_EDGE_MAX_DISTANCE,seeds:SEEDS,results},null,2));
