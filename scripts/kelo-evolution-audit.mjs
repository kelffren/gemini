/* KELO-INDEX
 * area: QA / EVOLUTION
 * owner: Kelo Evolution CI audit
 * purpose: prove weighted gates, champion/challenger, rollback, memory, patch bounds and deterministic multi-gene Map Forge evolution
 * public-api: CLI
 * consumes: KeloEvolution + Map Forge evolution/golden seeds
 * state-owned: none
 * do-not: no browser, publish, network or LIVE state mutation
 */
import assert from 'node:assert/strict';
import {createEvolutionMetricProfile,scoreEvolutionMetrics,runEvolutionCycle,runChampionChallengerTournament} from '../src/creators/evolution/evolution-engine.mjs';
import {createEvolutionMemory,recordEvolutionExperiment,mutationFailureCount,summarizeEvolutionMemory} from '../src/creators/evolution/evolution-memory.mjs';
import {createCodePatchCandidate,validateCodePatchCandidate} from '../src/creators/evolution/code-patch-candidate.mjs';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {getMapForgeGoldenSeeds} from '../src/world/map-forge/map-forge-golden-seeds.mjs';
import {createMapForgeGenome,evolveMapForgeStyle,proposeMapForgeGenomeMutations} from '../src/world/map-forge/map-forge-evolution.mjs';

const profile=createEvolutionMetricProfile([{id:'quality',weight:3,min:0,max:100,hardMin:60},{id:'latency',weight:1,min:0,max:100,direction:'minimize',hardMax:80}]),good=scoreEvolutionMetrics(profile,{quality:80,latency:20}),unsafe=scoreEvolutionMetrics(profile,{quality:55,latency:20});
assert.equal(good.valid,true);assert.ok(good.score>70);assert.equal(unsafe.valid,false);assert.ok(unsafe.failures.some(x=>x.startsWith('metric_below_hard_min:quality')));

let prepared=0,cleaned=0;const accepted=await runEvolutionCycle({baseline:{id:'base',value:70},propose:()=>[{id:'worse',value:68},{id:'winner',value:76}],prepare:async candidate=>{prepared++;return{id:candidate.id};},cleanup:async()=>{cleaned++;},evaluate:candidate=>({valid:true,score:candidate.value}),policy:{minImprovement:.5}});
assert.equal(accepted.accepted,true);assert.equal(accepted.result.id,'winner');assert.equal(prepared,3,'baseline and challengers must pass through prepare');assert.equal(cleaned,3,'all prepared sandboxes must clean');
const tournament=await runChampionChallengerTournament({champion:{id:'champ',value:80},challengers:[{id:'low',value:79},{id:'high',value:84}],evaluate:candidate=>({valid:true,score:candidate.value}),policy:{minImprovement:1}});assert.equal(tournament.changed,true);assert.equal(tournament.championAfter.id,'high');assert.equal(tournament.ranking[0].candidate.id,'high');

let liveState={id:'base',value:70};const rollbackCycle=await runEvolutionCycle({baseline:liveState,propose:()=>[{id:'candidate',value:82}],evaluate:candidate=>({valid:true,score:candidate.value}),policy:{minImprovement:1},apply:async candidate=>{liveState=candidate;throw new Error('synthetic_apply_failure');},rollback:async baseline=>{liveState=baseline;}});assert.equal(rollbackCycle.accepted,false);assert.equal(rollbackCycle.rolledBack,true);assert.equal(liveState.id,'base');

let memory=createEvolutionMemory({systemId:'map-forge'});memory=recordEvolutionExperiment(memory,{id:'r1',candidateId:'c1',accepted:false,baselineScore:70,candidateScore:69,delta:-1,mutations:[{geneId:'road.curvature'}]});memory=recordEvolutionExperiment(memory,{id:'r2',candidateId:'c2',accepted:true,baselineScore:70,candidateScore:72,delta:2,mutations:[{geneId:'style.vegetation'}]});assert.equal(mutationFailureCount(memory,'road.curvature'),1);assert.equal(summarizeEvolutionMemory(memory).experiments,2);
const deniedPatch=validateCodePatchCandidate(createCodePatchCandidate({id:'bad',baseSha:'abc',changes:[{path:'.env',beforeHash:'x',afterContent:'x'}]}));assert.equal(deniedPatch.valid,false);assert.ok(deniedPatch.errors.some(error=>error.includes('path_')));

const mapForge=[];
for(const recipe of Object.values(MAP_FORGE_RECIPES)){
  const golden=getMapForgeGoldenSeeds(recipe.id,{limit:3});assert.equal(golden.length,3);assert.equal(new Set(golden).size,3);
  const baseGenome=createMapForgeGenome(recipe),roadOnly=proposeMapForgeGenomeMutations(recipe,{genome:baseGenome,seed:99,generation:0,population:4,focusScopes:['roads'],memory});assert.ok(roadOnly.length>=2);assert.ok(roadOnly.every(candidate=>candidate.mutations.every(mutation=>mutation.scope==='roads')));
  const locked=proposeMapForgeGenomeMutations(recipe,{genome:baseGenome,seed:101,generation:0,population:4,lockedGenes:['road.*'],focusScopes:['style','roads']});assert.ok(locked.every(candidate=>candidate.mutations.every(mutation=>mutation.scope==='style')));
  const options={seed:424242,generations:1,population:3,mutationStep:.8,validationSeeds:1,goldenSeeds:2,bestOf:2,minImprovement:.1,assetCatalogVersion:'ci-evolution-catalog',memory},first=await evolveMapForgeStyle(recipe,options),repeat=await evolveMapForgeStyle(recipe,options);
  assert.deepEqual(first.bestGenome,repeat.bestGenome,`${recipe.id}: genome evolution must be deterministic`);assert.equal(first.bestEvaluation.score,repeat.bestEvaluation.score);assert.ok(first.bestEvaluation.score+1e-9>=first.baselineEvaluation.score);assert.equal(first.baselineEvaluation.metrics.validRate,100);assert.ok(Number.isFinite(first.bestEvaluation.performance.meanGenerationMs));
  if(first.accepted)assert.ok(first.improvement>=options.minImprovement);
  mapForge.push({recipeId:recipe.id,accepted:first.accepted,baseline:first.baselineEvaluation.score,best:first.bestEvaluation.score,improvement:first.improvement,mutations:first.history.flatMap(row=>row.mutations)});
}
console.log(JSON.stringify({ok:true,engine:'kelo-evolution-v2',weightedGate:{goodScore:good.score,unsafeFailures:unsafe.failures},tournament:{champion:tournament.championAfter.id},sandboxHooks:{prepared,cleaned},rollback:{rolledBack:rollbackCycle.rolledBack,state:liveState},memory:summarizeEvolutionMemory(memory),patchGuard:{errors:deniedPatch.errors},mapForge},null,2));
