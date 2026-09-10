/* KELO-INDEX
 * area: QA / MAP FORGE
 * owner: Map Forge CI
 * purpose: deterministic, fuzz and quality audit for the pure Map Forge core
 * public-api: CLI
 * consumes: map-forge recipes + pure core
 * state-owned: none
 * do-not: no browser/runtime assertions in this headless core audit
 */
import assert from 'node:assert/strict';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {generateMapCandidate,generateBestOf,serializeMapDefinition,deserializeMapDefinition} from '../src/world/map-forge/map-forge-core.mjs';
import {scoreMapDefinition,validateMapDefinition} from '../src/world/map-forge/map-forge-quality.mjs';

const cap=MAP_FORGE_RECIPES.KELO_ROYAL_CAPITAL_V1;
const a=generateMapCandidate(cap,{seed:81746291,assetCatalogVersion:'ci-catalog'});
const b=generateMapCandidate(cap,{seed:81746291,assetCatalogVersion:'ci-catalog'});
assert.equal(a.metadata.layoutHash,b.metadata.layoutHash,'same seed must reproduce layoutHash');
assert.equal(serializeMapDefinition(a),serializeMapDefinition(b),'same seed must reproduce serialized MapDefinition');
assert.deepEqual(a.chunkIndex,b.chunkIndex,'chunk lookup must be deterministic');
const c=generateMapCandidate(cap,{seed:81746292,assetCatalogVersion:'ci-catalog'});
assert.notEqual(a.metadata.layoutHash,c.metadata.layoutHash,'different seed should normally change layoutHash');
assert.equal(a.validation.valid,true,JSON.stringify(a.validation));
for(const id of cap.districts.filter(d=>d.required!==false).map(d=>d.id))assert.ok(a.districts.some(d=>d.id===id),`required district ${id}`);
for(const node of a.semanticGraph.nodes.filter(n=>n.required))assert.ok(node.id,'required semantic node must have stable id');
assert.ok(a.roads.some(r=>r.source==='mst'),'MST road edges must exist');
assert.ok(a.roads.some(r=>r.source==='loop'),'strategic loop road must exist for Royal Capital');
assert.ok(a.parcels.length>0,'parcels must be generated');
assert.ok(a.parcels.every(p=>p.id&&p.blockId&&p.buildableArea.w>0&&p.buildableArea.h>0),'parcels must be valid data');
assert.ok(a.scenicVistas.some(v=>v.fromRef==='spawn'&&v.toRef==='fountain'&&v.reserved),'spawn → fountain vista must be reserved');
assert.ok(a.scenicVistas.some(v=>v.fromRef==='fountain'&&v.toRef==='castle'&&v.reserved),'fountain → castle vista must be reserved');
const roundTrip=deserializeMapDefinition(serializeMapDefinition(a));
assert.equal(roundTrip.metadata.layoutHash,a.metadata.layoutHash,'serialization roundtrip must preserve layout hash');
assert.equal(serializeMapDefinition(roundTrip),serializeMapDefinition(a),'serialization roundtrip must be exact');
const best=generateBestOf(cap,{seed:12345,count:8,assetCatalogVersion:'ci-catalog'});
assert.equal(best.requested,8);assert.equal(best.validCount,8);assert.ok(best.best.quality.total>=best.candidates.at(-1).quality.total);
assert.ok(best.selections.bestOverall&&best.selections.mostMonumental&&best.selections.mostOrganic&&best.selections.mostExplorable&&best.selections.mostCompact,'best-of selectors must resolve');

// Fixed-seed visual-score regressions: structurally valid maps must not earn elite scores
// after introducing obvious prop spam or breaking semantic landmark placement.
const spammed=structuredClone(a),spamOrigin=spammed.landmarks.find(l=>l.id==='fountain')?.position||spammed.spawnPoints[0];
spammed.decorations=[...spammed.decorations,...Array.from({length:900},(_,i)=>({id:`regression-spam:${i}`,district:'central',family:'lamp',x:spamOrigin.x+(i%3),y:spamOrigin.y+(i%5),rotation:0,scale:1}))];
assert.equal(validateMapDefinition(spammed,cap).valid,true,'prop-spam fixture must stay structurally valid so this tests visual scoring');
const spamScore=scoreMapDefinition(spammed,cap);
assert.ok(spamScore.total<95,`visually spammed valid map must never score 95+; got ${spamScore.total}`);
assert.ok(spamScore.breakdown.densityBalance<60||spamScore.breakdown.negativeSpace<60||spamScore.breakdown.scenicVistas<60,'prop spam must trigger a measurable visual penalty');

const semanticallyBroken=structuredClone(a);
semanticallyBroken.landmarks=semanticallyBroken.landmarks.map(l=>({...l,district:'central'}));
assert.equal(validateMapDefinition(semanticallyBroken,cap).valid,true,'semantic-placement fixture must stay structurally valid so this tests visual scoring');
const semanticScore=scoreMapDefinition(semanticallyBroken,cap);
assert.ok(semanticScore.total<95,`semantically misplaced landmarks must never score 95+; got ${semanticScore.total}`);
assert.ok(semanticScore.breakdown.landmarkQuality<60,`semantic landmark penalty must be visible; got ${semanticScore.breakdown.landmarkQuality}`);

const stats={};
for(const [id,recipe] of Object.entries(MAP_FORGE_RECIPES)){
  const scores=[],times=[];let valid=0,min=Infinity,max=-Infinity;
  for(let seed=1;seed<=100;seed++){
    const t0=performance.now();
    const map=generateMapCandidate(recipe,{seed,assetCatalogVersion:'ci-catalog'});
    times.push(performance.now()-t0);
    if(map.validation.valid)valid++;
    scores.push(map.quality.total);min=Math.min(min,map.quality.total);max=Math.max(max,map.quality.total);
  }
  scores.sort((x,y)=>x-y);
  stats[id]={validRate:valid/100,avgScore:+(scores.reduce((s,x)=>s+x,0)/100).toFixed(2),medianScore:+scores[49].toFixed(2),minScore:+min.toFixed(2),bestScore:+max.toFixed(2),avgGenerationMs:+(times.reduce((s,x)=>s+x,0)/100).toFixed(2)};
  assert.ok(valid>=99,`${id} valid rate ${valid}/100 is below 99%`);
  assert.ok(max-min>.5,`${id} scorer must distinguish candidate quality; range=${(max-min).toFixed(2)}`);
}
console.log(JSON.stringify({ok:true,generator:'map-forge-core-v1',royalCapital:{seed:a.metadata.seed,layoutHash:a.metadata.layoutHash,score:a.quality.total,roads:a.roads.length,loops:a.generationStats.roadLoops,parcels:a.parcels.length,decorations:a.decorations.length},bestOf8:{score:best.best.quality.total,seed:best.best.metadata.seed,layoutHash:best.best.metadata.layoutHash},regressions:{spamScore:spamScore.total,semanticScore:semanticScore.total},stats},null,2));
