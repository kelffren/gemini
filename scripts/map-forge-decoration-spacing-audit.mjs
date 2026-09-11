/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: fixed-seed regression guard proving visually crowded props cannot retain elite scores
 * public-api: CLI
 * consumes: Map Forge recipes + core + quality scorer
 * state-owned: none
 * fixture: preserves density/family counts while compressing same-district props onto a realistic 90px grid
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
  if(seed===81746291)assert.ok(map.quality.total<95,`${seed}: fixed-seed runtime evidence is visibly crowded and must not retain a 95+ score, got ${map.quality.total}`);

  const crowded=clone(map),originalFamilies=familyHistogram(map.decorations||[]),byDistrict=new Map();
  for(const row of crowded.decorations||[]){if(!byDistrict.has(row.district))byDistrict.set(row.district,[]);byDistrict.get(row.district).push(row);}
  for(const rows of byDistrict.values()){
    if(rows.length<4)continue;
    const anchor={x:rows[0].x,y:rows[0].y};
    for(let i=0;i<rows.length;i++){
      rows[i].x=anchor.x+(i%4)*90;
      rows[i].y=anchor.y+Math.floor(i/4)*90;
    }
  }
  const structural=validateMapDefinition(crowded,recipe);
  assert.equal(structural.valid,true,`${seed}: adversarial crowding fixture must stay structurally valid so scoring gate is exercised`);
  const score=scoreMapDefinition(crowded,recipe,structural);
  assert.deepEqual(familyHistogram(crowded.decorations||[]),originalFamilies,`${seed}: fixture must preserve exact decoration-family counts while changing only positions`);
  assert.equal(crowded.decorations.length,map.decorations.length,`${seed}: fixture must preserve decoration density`);
  assert.equal(score.breakdown.decorationSpacing,map.quality.breakdown.decorationSpacing,`${seed}: crowding gate must not perturb the normal spacing metric or candidate ranking`);
  assert.ok(score.total<=89,`${seed}: visibly crowded but structurally valid map must not score 90+, got ${score.total}`);
  results.push({seed,normalScore:map.quality.total,normalSpacing:map.quality.breakdown.decorationSpacing,crowdedScore:score.total,crowdedSpacing:score.breakdown.decorationSpacing,decorations:map.decorations.length,families:originalFamilies});
}
console.log(JSON.stringify({ok:true,seeds:results},null,2));
