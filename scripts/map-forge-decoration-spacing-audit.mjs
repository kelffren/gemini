/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: fixed-seed regression guard proving visually stacked props cannot retain elite scores
 * public-api: CLI
 * consumes: Map Forge recipes + core + quality scorer
 * state-owned: none
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';
import {scoreMapDefinition,validateMapDefinition} from '../src/world/map-forge/map-forge-quality.mjs';

const recipe=MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1;
const seeds=[81746291,12345,424242,29011987];
const clone=value=>JSON.parse(JSON.stringify(value));
const familyHistogram=rows=>Object.fromEntries([...rows.reduce((m,row)=>m.set(row.family,(m.get(row.family)||0)+1),new Map()).entries()].sort(([a],[b])=>String(a).localeCompare(String(b))));
const results=[];

for(const seed of seeds){
  const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(map.validation.valid,true,`${seed}: production candidate must remain valid`);
  assert.ok(map.quality.breakdown.decorationSpacing>=88,`${seed}: production candidate has excessive prop overlap: ${map.quality.breakdown.decorationSpacing}`);
  assert.ok(map.generationStats.decorationNaturalClusterAttemptCount>0,`${seed}: natural decoration clustering was not exercised`);
  assert.ok(map.generationStats.decorationNaturalClusterAcceptedCount>=8,`${seed}: too few deterministic natural clusters were accepted`);
  const stacked=clone(map),originalFamilies=familyHistogram(map.decorations||[]),byDistrict=new Map();
  for(const row of stacked.decorations||[]){if(!byDistrict.has(row.district))byDistrict.set(row.district,[]);byDistrict.get(row.district).push(row);}
  for(const rows of byDistrict.values()){if(rows.length<2)continue;const anchor={x:rows[0].x,y:rows[0].y};for(const row of rows){row.x=anchor.x;row.y=anchor.y;}}
  const structural=validateMapDefinition(stacked,recipe);
  assert.equal(structural.valid,true,`${seed}: adversarial overlap fixture must stay structurally valid so scoring gate is exercised`);
  const score=scoreMapDefinition(stacked,recipe,structural);
  assert.deepEqual(familyHistogram(stacked.decorations||[]),originalFamilies,`${seed}: fixture must preserve exact decoration-family counts while changing only positions`);
  assert.equal(stacked.decorations.length,map.decorations.length,`${seed}: fixture must preserve decoration density`);
  assert.ok(score.breakdown.decorationSpacing<=65,`${seed}: stacked fixture must expose severe spacing defect, got ${score.breakdown.decorationSpacing}`);
  assert.ok(score.total<=89,`${seed}: visually stacked but structurally valid map must not score 90+, got ${score.total}`);
  results.push({seed,normalScore:map.quality.total,normalSpacing:map.quality.breakdown.decorationSpacing,naturalClusterAttempts:map.generationStats.decorationNaturalClusterAttemptCount,naturalClusterAccepted:map.generationStats.decorationNaturalClusterAcceptedCount,stackedScore:score.total,stackedSpacing:score.breakdown.decorationSpacing,decorations:map.decorations.length,families:originalFamilies});
}
console.log(JSON.stringify({ok:true,seeds:results},null,2));
