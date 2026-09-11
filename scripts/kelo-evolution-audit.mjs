/* KELO-INDEX
 * area: QA / EVOLUTION
 * owner: Kelo Evolution CI audit
 * purpose: prove weighted scoring, acceptance thresholds, rollback and deterministic Map Forge evolution
 * public-api: CLI
 * consumes: KeloEvolution + KeloMapForge style evolution adapter
 * state-owned: none
 * do-not: no browser, publish, network or LIVE state mutation
 */
import assert from 'node:assert/strict';
import {createEvolutionMetricProfile,scoreEvolutionMetrics,runEvolutionCycle} from '../src/creators/evolution/evolution-engine.mjs';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {evolveMapForgeStyle} from '../src/world/map-forge/map-forge-evolution.mjs';

const profile=createEvolutionMetricProfile([
  {id:'quality',weight:3,min:0,max:100,hardMin:60},
  {id:'latency',weight:1,min:0,max:100,direction:'minimize',hardMax:80}
]);
const good=scoreEvolutionMetrics(profile,{quality:80,latency:20});
const unsafe=scoreEvolutionMetrics(profile,{quality:55,latency:20});
assert.equal(good.valid,true);assert.ok(good.score>70,'weighted score should reward strong quality and low latency');
assert.equal(unsafe.valid,false);assert.ok(unsafe.failures.some(x=>x.startsWith('metric_below_hard_min:quality')),'hard metric gate must reject unsafe candidate');

const accepted=await runEvolutionCycle({
  baseline:{id:'base',value:70},
  propose:()=>[{id:'worse',value:68},{id:'tiny',value:70.1},{id:'winner',value:76}],
  evaluate:candidate=>({valid:true,score:candidate.value}),
  policy:{minImprovement:.5}
});
assert.equal(accepted.accepted,true);assert.equal(accepted.result.id,'winner');assert.equal(accepted.selected.comparison.delta,6);

let liveState={id:'base',value:70};
const rollbackCycle=await runEvolutionCycle({
  baseline:liveState,
  propose:()=>[{id:'candidate',value:82}],
  evaluate:candidate=>({valid:true,score:candidate.value}),
  policy:{minImprovement:1},
  apply:async candidate=>{liveState=candidate;throw new Error('synthetic_apply_failure');},
  rollback:async baseline=>{liveState=baseline;}
});
assert.equal(rollbackCycle.accepted,false);assert.equal(rollbackCycle.rolledBack,true);assert.equal(liveState.id,'base','failed apply must restore baseline');

const mapForge=[];
for(const recipe of Object.values(MAP_FORGE_RECIPES)){
  const options={seed:424242,generations:1,population:3,mutationStep:.1,validationSeeds:2,bestOf:2,minImprovement:.15,assetCatalogVersion:'ci-evolution-catalog'};
  const first=await evolveMapForgeStyle(recipe,options),repeat=await evolveMapForgeStyle(recipe,options);
  assert.deepEqual(first.bestStyle,repeat.bestStyle,`${recipe.id}: evolution must be deterministic`);
  assert.equal(first.bestEvaluation.score,repeat.bestEvaluation.score,`${recipe.id}: repeated evaluation must match`);
  assert.ok(first.bestEvaluation.score+1e-9>=first.baselineEvaluation.score,`${recipe.id}: evolution must never return a regression`);
  if(first.accepted)assert.ok(first.improvement>=options.minImprovement,`${recipe.id}: accepted evolution must clear min improvement`);
  mapForge.push({recipeId:recipe.id,accepted:first.accepted,baseline:first.baselineEvaluation.score,best:first.bestEvaluation.score,improvement:first.improvement,bestStyle:first.bestStyle});
}

console.log(JSON.stringify({ok:true,engine:'kelo-evolution-v1',weightedGate:{goodScore:good.score,unsafeFailures:unsafe.failures},selection:{winner:accepted.result.id,delta:accepted.selected.comparison.delta},rollback:{rolledBack:rollbackCycle.rolledBack,state:liveState},mapForge},null,2));
