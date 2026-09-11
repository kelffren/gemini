/* KELO-INDEX
 * area: TEST / MAP FORGE / ROYAL CAPITAL
 * owner: Map Forge CI
 * purpose: lock the visually approved Royal Capital arterial width across representative deterministic seeds
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';

const EXPECTED_ARTERIAL_WIDTH=104;
const SEEDS=[81746291,12345,424242,29011987];
const recipe=MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1;

assert.equal(recipe.road.arterialWidth,EXPECTED_ARTERIAL_WIDTH,'Royal Capital champion must keep the approved slimmer arterial width');
const results=[];
for(const seed of SEEDS){
  const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(map.validation.valid,true,`${seed}: generated map must remain valid`);
  const arterials=map.roads.filter(road=>road.class==='arterial');
  assert.ok(arterials.length>0,`${seed}: representative map must contain arterial roads`);
  assert.ok(arterials.every(road=>road.width===EXPECTED_ARTERIAL_WIDTH),`${seed}: every arterial must use ${EXPECTED_ARTERIAL_WIDTH}px`);
  results.push({seed,roadCount:map.roads.length,arterialCount:arterials.length,arterialWidths:[...new Set(arterials.map(road=>road.width))],quality:map.quality.total});
}
console.log(JSON.stringify({ok:true,expectedArterialWidth:EXPECTED_ARTERIAL_WIDTH,seeds:SEEDS,results},null,2));
