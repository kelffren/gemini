/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: fixed-seed regression guard proving stacked or urban-crowded props cannot retain elite scores
 * public-api: CLI
 * consumes: Map Forge recipes + core + quality scorer
 * state-owned: none
 * fixture: preserves density/family counts while compressing urban props onto a 90px grid
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate} from '../src/world/map-forge/map-forge-core.mjs';
import {scoreMapDefinition,validateMapDefinition} from '../src/world/map-forge/map-forge-quality.mjs';

const recipe=MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1;
// This audit owns decoration spacing/crowding only. Re-score the exact same generated
// capital geometry with capital-only urban-fabric penalties disabled so a fabric defect
// cannot make the spacing assertions pass trivially. Fabric has its own dedicated gate.
const spacingRecipe=Object.freeze({...recipe,type:'spacing-audit'});
const seeds=[81746291,12345,424242,29011987];
const clone=value=>JSON.parse(JSON.stringify(value));
const familyHistogram=rows=>Object.fromEntries([...rows.reduce((m,row)=>m.set(row.family,(m.get(row.family)||0)+1),new Map()).entries()].sort(([a],[b])=>String(a).localeCompare(String(b))));
const results=[],normalScores=[];

for(const seed of seeds){
  const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
  assert.equal(map.validation.valid,true,`${seed}: production candidate must remain valid`);
  assert.ok(map.quality.breakdown.decorationSpacing>=88,`${seed}: production candidate has excessive prop overlap: ${map.quality.breakdown.decorationSpacing}`);
  assert.ok(map.generationStats.decorationNaturalClusterAttemptCount>0,`${seed}: natural decoration clustering was not exercised`);
  assert.ok(map.generationStats.decorationNaturalClusterAcceptedCount>=8,`${seed}: too few deterministic natural clusters were accepted`);

  const normalStructural=validateMapDefinition(map,spacingRecipe);
  assert.equal(normalStructural.valid,true,`${seed}: spacing-control candidate must remain structurally valid`);
  const normalScore=scoreMapDefinition(map,spacingRecipe,normalStructural);
  normalScores.push(normalScore.total);

  const stacked=clone(map),originalFamilies=familyHistogram(map.decorations||[]),stackedByDistrict=new Map();
  for(const row of stacked.decorations||[]){if(!stackedByDistrict.has(row.district))stackedByDistrict.set(row.district,[]);stackedByDistrict.get(row.district).push(row);}
  for(const rows of stackedByDistrict.values()){if(rows.length<2)continue;const anchor={x:rows[0].x,y:rows[0].y};for(const row of rows){row.x=anchor.x;row.y=anchor.y;}}
  const stackedStructural=validateMapDefinition(stacked,spacingRecipe);
  assert.equal(stackedStructural.valid,true,`${seed}: adversarial overlap fixture must stay structurally valid so scoring gate is exercised`);
  const stackedScore=scoreMapDefinition(stacked,spacingRecipe,stackedStructural);
  assert.deepEqual(familyHistogram(stacked.decorations||[]),originalFamilies,`${seed}: stacked fixture must preserve exact decoration-family counts`);
  assert.equal(stacked.decorations.length,map.decorations.length,`${seed}: stacked fixture must preserve decoration density`);
  assert.ok(stackedScore.breakdown.decorationSpacing<=65,`${seed}: stacked fixture must expose severe spacing defect, got ${stackedScore.breakdown.decorationSpacing}`);
  assert.ok(stackedScore.total<=89,`${seed}: visually stacked but structurally valid map must not score 90+, got ${stackedScore.total}`);
  assert.ok(stackedScore.total<normalScore.total,`${seed}: severe spacing defect must score below its unchanged control, ${stackedScore.total} vs ${normalScore.total}`);

  const crowded=clone(map),urbanKinds=new Set(['plaza','royal','commerce']);
  for(const district of crowded.districts||[]){
    if(!urbanKinds.has(district.kind))continue;
    const rows=(crowded.decorations||[]).filter(row=>row.district===district.id);
    if(rows.length<4)continue;
    const cols=4,spacing=90,rowCount=Math.ceil(rows.length/cols),cx=district.center.x,cy=district.center.y;
    for(let i=0;i<rows.length;i++){
      const col=i%cols,r=Math.floor(i/cols);
      rows[i].x=cx+(col-(cols-1)/2)*spacing;
      rows[i].y=cy+(r-(rowCount-1)/2)*spacing;
    }
  }
  const crowdedStructural=validateMapDefinition(crowded,spacingRecipe);
  assert.equal(crowdedStructural.valid,true,`${seed}: urban crowding fixture must stay structurally valid so scoring gate is exercised`);
  const crowdedScore=scoreMapDefinition(crowded,spacingRecipe,crowdedStructural);
  assert.deepEqual(familyHistogram(crowded.decorations||[]),originalFamilies,`${seed}: crowding fixture must preserve exact decoration-family counts`);
  assert.equal(crowded.decorations.length,map.decorations.length,`${seed}: crowding fixture must preserve decoration density`);
  assert.ok(crowdedScore.breakdown.decorationSpacing>=88,`${seed}: 90px crowding fixture must evade the legacy <24px overlap metric, got ${crowdedScore.breakdown.decorationSpacing}`);
  assert.ok(crowdedScore.breakdown.districtCoherence>=70,`${seed}: fixture must preserve district ownership so the crowding gate is isolated, got ${crowdedScore.breakdown.districtCoherence}`);
  assert.ok(crowdedScore.total<=94,`${seed}: visually crowded urban streetscape must not retain 95+, got ${crowdedScore.total}`);
  assert.ok(crowdedScore.total<normalScore.total,`${seed}: urban crowding defect must score below its unchanged control, ${crowdedScore.total} vs ${normalScore.total}`);

  results.push({seed,productionScore:map.quality.total,normalScore:normalScore.total,normalSpacing:map.quality.breakdown.decorationSpacing,naturalClusterAttempts:map.generationStats.decorationNaturalClusterAttemptCount,naturalClusterAccepted:map.generationStats.decorationNaturalClusterAcceptedCount,stackedScore:stackedScore.total,stackedSpacing:stackedScore.breakdown.decorationSpacing,crowdedScore:crowdedScore.total,crowdedSpacing:crowdedScore.breakdown.decorationSpacing,crowdedCoherence:crowdedScore.breakdown.districtCoherence,decorations:map.decorations.length,families:originalFamilies});
}
assert.ok(normalScores.every(score=>score>=89),`spacing controls must not hit a severe visual-defect cap: ${normalScores.join(', ')}`);
console.log(JSON.stringify({ok:true,seeds:results},null,2));