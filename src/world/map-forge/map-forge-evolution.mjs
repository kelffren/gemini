/* KELO-INDEX
 * area: WORLD / MAP FORGE / EVOLUTION
 * owner: KeloMapForge style-evolution adapter
 * purpose: improve Map Forge style parameters by measured multi-seed quality without mutating the generator owner
 * public-api: MAP_FORGE_EVOLUTION_PROFILE, evaluateMapForgeStyle, proposeMapForgeStyleMutations, evolveMapForgeStyle
 * consumes: KeloEvolution acceptance gate + KeloMapForge generateBestOf/scorer
 * state-owned: none; returns an immutable evolution report and best style
 * online: deterministic inputs produce deterministic proposals/evaluations; persistence/publish authority stays outside
 * do-not: no code rewriting, DOM, renderer, Property, collision, publish or bypass of Map Forge validation
 */
import {createEvolutionMetricProfile,scoreEvolutionMetrics,runEvolutionCycle} from '../../creators/evolution/evolution-engine.mjs';
import {generateBestOf} from './map-forge-core.mjs';
import {clamp,round,freezeDeep,createRng,seed32,stableStringify,hashString} from './map-forge-prng.mjs';

export const MAP_FORGE_EVOLVABLE_STYLE_KEYS=Object.freeze(['monumentality','organicRoads','density','vegetation','exploration','decoration']);
export const MAP_FORGE_EVOLUTION_PROFILE=createEvolutionMetricProfile([
  {id:'meanQuality',weight:4.5,min:0,max:100},
  {id:'worstQuality',weight:2.5,min:0,max:100},
  {id:'meanVisual',weight:2,min:0,max:100},
  {id:'stability',weight:1,min:0,max:100},
  {id:'validRate',weight:1.5,min:0,max:100,hardMin:100}
]);

function numeric(value,fallback){return Number.isFinite(Number(value))?Number(value):fallback;}
function normalizeStyle(recipe,style={}){const base=recipe?.style||{};return Object.freeze(Object.fromEntries(MAP_FORGE_EVOLVABLE_STYLE_KEYS.map(key=>[key,round(clamp(numeric(style?.[key],numeric(base?.[key],.5)),0,1),4)])));}
function mean(values){return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;}
function standardDeviation(values){if(values.length<2)return 0;const avg=mean(values);return Math.sqrt(mean(values.map(value=>(value-avg)**2)));}
function visualScore(map){const m=map?.quality?.breakdown||{},keys=['visualComposition','landmarkQuality','districtVariety','densityBalance','negativeSpace','assetVariety','scenicVistas','districtCoherence'];return mean(keys.map(key=>numeric(m[key],0)));}
function evaluationSeedBank(seed,count){const n=clamp(Math.floor(numeric(count,3)),1,8);return Object.freeze(Array.from({length:n},(_,index)=>index===0?seed32(seed):seed32(`${seed}|map-forge-evolution-validation|${index}`)));}

export function evaluateMapForgeStyle(recipe,{style={},seed=1,validationSeeds=3,bestOf=3,assetCatalogVersion='catalog-unbound',constraints={}}={}){
  if(!recipe?.id)throw new Error('MAP_FORGE_EVOLUTION_RECIPE_REQUIRED');
  const normalizedStyle=normalizeStyle(recipe,style),seeds=evaluationSeedBank(seed,validationSeeds),runs=[];
  for(const validationSeed of seeds){
    const batch=generateBestOf(recipe,{seed:validationSeed,count:clamp(Math.floor(numeric(bestOf,3)),1,8),assetCatalogVersion,style:normalizedStyle,constraints}),best=batch.best;
    runs.push(Object.freeze({seed:validationSeed,valid:Boolean(best?.validation?.valid),quality:numeric(best?.quality?.total,0),visual:best?round(visualScore(best),3):0,layoutHash:best?.metadata?.layoutHash||null,validCount:batch.validCount,rejectedCount:batch.rejectedCount}));
  }
  const validRuns=runs.filter(run=>run.valid),qualities=validRuns.map(run=>run.quality),measurements={meanQuality:round(mean(qualities),3),worstQuality:round(qualities.length?Math.min(...qualities):0,3),meanVisual:round(mean(validRuns.map(run=>run.visual)),3),stability:round(clamp(100-standardDeviation(qualities)*5,0,100),3),validRate:round(validRuns.length/runs.length*100,3)},scored=scoreEvolutionMetrics(MAP_FORGE_EVOLUTION_PROFILE,measurements);
  return freezeDeep({valid:scored.valid,score:scored.score,metrics:measurements,failures:scored.failures,style:normalizedStyle,runs});
}

export function proposeMapForgeStyleMutations(recipe,{style={},seed=1,generation=0,population=8,mutationStep=.12}={}){
  const base=normalizeStyle(recipe,style),rng=createRng(seed32(`${seed}|generation|${generation}`),'map-forge-style-evolution'),count=clamp(Math.floor(numeric(population,8)),2,16),step=clamp(numeric(mutationStep,.12),.01,.35),seen=new Set([stableStringify(base)]),candidates=[];
  for(let index=0;index<count;index++){
    let attempts=0,candidateStyle,mutations;
    do{
      const draft={...base},mutationCount=rng.chance(.32)?2:1,used=new Set();mutations=[];
      for(let m=0;m<mutationCount;m++){
        let key=rng.pick(MAP_FORGE_EVOLVABLE_STYLE_KEYS);while(used.has(key)&&used.size<MAP_FORGE_EVOLVABLE_STYLE_KEYS.length)key=rng.pick(MAP_FORGE_EVOLVABLE_STYLE_KEYS);used.add(key);
        const delta=(rng.chance(.5)?-1:1)*step*rng.float(.55,1),before=draft[key],after=round(clamp(before+delta,0,1),4);draft[key]=after;mutations.push(Object.freeze({key,before,after,delta:round(after-before,4)}));
      }
      candidateStyle=Object.freeze(draft);attempts++;
    }while(seen.has(stableStringify(candidateStyle))&&attempts<12);
    const signature=stableStringify(candidateStyle);if(seen.has(signature))continue;seen.add(signature);
    candidates.push(freezeDeep({id:`mf-evo:${generation}:${index}:${hashString(signature).slice(0,8)}`,style:candidateStyle,mutations}));
  }
  return freezeDeep(candidates);
}

export async function evolveMapForgeStyle(recipe,{style={},seed=1,generations=3,population=8,mutationStep=.12,validationSeeds=3,bestOf=3,minImprovement=.35,minScore=0,assetCatalogVersion='catalog-unbound',constraints={}}={}){
  if(!recipe?.id)throw new Error('MAP_FORGE_EVOLUTION_RECIPE_REQUIRED');
  const original=freezeDeep({id:'baseline',style:normalizeStyle(recipe,style),mutations:[]}),history=[];let current=original,step=clamp(numeric(mutationStep,.12),.01,.35),acceptedGenerations=0;
  const generationCount=clamp(Math.floor(numeric(generations,3)),1,8),evaluate=candidate=>evaluateMapForgeStyle(recipe,{style:candidate.style,seed,validationSeeds,bestOf,assetCatalogVersion,constraints});
  for(let generation=0;generation<generationCount;generation++){
    const cycle=await runEvolutionCycle({baseline:current,propose:()=>proposeMapForgeStyleMutations(recipe,{style:current.style,seed,generation,population,mutationStep:step}),evaluate,policy:{minImprovement,minScore}});
    const selected=cycle.selected,record={generation,accepted:cycle.accepted,baselineScore:cycle.baselineEvaluation.score,candidateScore:selected?.evaluation?.score??null,delta:selected?.comparison?.delta??0,selectedId:selected?.candidate?.id||null,mutations:selected?.candidate?.mutations||[],candidateCount:cycle.evaluated.length,step:round(step,4)};
    history.push(freezeDeep(record));
    if(cycle.accepted){current=cycle.result;acceptedGenerations++;step=clamp(step*.88,.01,.35);}else step=clamp(step*.68,.01,.35);
  }
  const baselineEvaluation=evaluate(original),bestEvaluation=evaluate(current);
  return freezeDeep({version:'kelo-map-forge-evolution-v1',recipeId:recipe.id,seed:seed32(seed),accepted:acceptedGenerations>0,acceptedGenerations,generations:generationCount,originalStyle:original.style,bestStyle:current.style,baselineEvaluation,bestEvaluation,improvement:round(bestEvaluation.score-baselineEvaluation.score,4),history});
}
