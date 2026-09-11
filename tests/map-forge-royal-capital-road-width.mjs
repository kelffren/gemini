/* KELO-INDEX
 * area: TEST / MAP FORGE / ROYAL CAPITAL
 * owner: Map Forge CI
 * purpose: lock the visually approved Royal Capital road hierarchy and focal breathing room across representative deterministic seeds
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

const EXPECTED_ARTERIAL_WIDTH=104;
const EXPECTED_COLLECTOR_WIDTH=76;
const EXPECTED_ANCIENT_TREE_CLEARANCE=125;
const SEEDS=[81746291,12345,424242,29011987];
const recipe=MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1;
const ancientTree=recipe.landmarks.find(item=>item.id==='ancient_tree');

assert.equal(recipe.road.arterialWidth,EXPECTED_ARTERIAL_WIDTH,'Royal Capital champion must keep the approved slimmer arterial width');
assert.equal(recipe.road.collectorWidth,EXPECTED_COLLECTOR_WIDTH,'Royal Capital champion must keep the approved slimmer collector width');
assert.equal(ancientTree?.keepClearRadius,EXPECTED_ANCIENT_TREE_CLEARANCE,'Royal Capital ancient tree must keep the approved focal breathing room');
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
  results.push({seed,roadCount:map.roads.length,arterialCount:arterials.length,collectorCount:collectors.length,arterialWidths:[...new Set(arterials.map(road=>road.width))],collectorWidths:[...new Set(collectors.map(road=>road.width))],ancientTreeClearance:ancientTree.keepClearRadius,quality:map.quality.total});
}
console.log(JSON.stringify({ok:true,expectedArterialWidth:EXPECTED_ARTERIAL_WIDTH,expectedCollectorWidth:EXPECTED_COLLECTOR_WIDTH,expectedAncientTreeClearance:EXPECTED_ANCIENT_TREE_CLEARANCE,seeds:SEEDS,results},null,2));
