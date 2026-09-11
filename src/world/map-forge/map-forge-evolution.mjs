/* KELO-INDEX
 * area: WORLD / MAP FORGE / EVOLUTION
 * owner: KeloMapForge evolution adapter
 * purpose: evolve style, roads, district weights and landmark clearance through multi-seed champion/challenger evaluation
 * public-api: MAP_FORGE_EVOLUTION_PROFILE, createMapForgeGenome, applyMapForgeGenome, evaluateMapForgeGenome, proposeMapForgeGenomeMutations, evolveMapForgeStyle
 * consumes: KeloEvolution gate + Map Forge generator/scorer + golden seed bank + optional experiment memory
 * state-owned: none; returns immutable reports/genomes
 * online: deterministic candidate identity and metrics can be evaluated remotely; persistence/publish stay outside
 * do-not: no source rewriting, DOM, renderer, Property, collision, publish or bypass of Map Forge validation
 */
import {createEvolutionMetricProfile,scoreEvolutionMetrics,runEvolutionCycle} from '../../creators/evolution/evolution-engine.mjs';
import {mutationFailureCount} from '../../creators/evolution/evolution-memory.mjs';
import {generateBestOf} from './map-forge-core.mjs';
import {getMapForgeGoldenSeeds} from './map-forge-golden-seeds.mjs';
import {clamp,round,freezeDeep,createRng,seed32,stableStringify,hashString} from './map-forge-prng.mjs';

export const MAP_FORGE_EVOLVABLE_STYLE_KEYS=Object.freeze(['monumentality','organicRoads','density','vegetation','exploration','decoration']);
export const MAP_FORGE_EVOLUTION_PROFILE=createEvolutionMetricProfile([
  {id:'meanQuality',weight:4,min:0,max:100},
  {id:'worstQuality',weight:2.5,min:0,max:100},
  {id:'meanVisual',weight:2,min:0,max:100},
  {id:'worstVisual',weight:1.25,min:0,max:100},
  {id:'navigationFloor',weight:1.5,min:0,max:100,hardMin:60},
  {id:'complexitySafety',weight:1,min:0,max:100,hardMin:55},
  {id:'stability',weight:1,min:0,max:100},
  {id:'validRate',weight:2,min:0,max:100,hardMin:100}
]);

const numeric=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const standardDeviation=values=>{if(values.length<2)return 0;const avg=mean(values);return Math.sqrt(mean(values.map(value=>(value-avg)**2)));};
const visualScore=map=>{const m=map?.quality?.breakdown||{},keys=['visualComposition','landmarkQuality','districtVariety','densityBalance','negativeSpace','assetVariety','scenicVistas','districtCoherence'];return mean(keys.map(key=>numeric(m[key],0)));};
const clone=value=>JSON.parse(JSON.stringify(value));
const geneMatches=(id,patterns=[])=>patterns.some(pattern=>{const p=String(pattern||'');return p.endsWith('*')?id.startsWith(p.slice(0,-1)):id===p;});

export function createMapForgeGeneCatalog(recipe){
  if(!recipe?.id)throw new Error('MAP_FORGE_EVOLUTION_RECIPE_REQUIRED');
  const rows=[];
  for(const key of MAP_FORGE_EVOLVABLE_STYLE_KEYS)rows.push({id:`style.${key}`,scope:'style',min:0,max:1,step:.1,value:numeric(recipe.style?.[key],.5)});
  rows.push({id:'road.loopRatio',scope:'roads',min:.05,max:.72,step:.08,value:numeric(recipe.road?.loopRatio,.25)});
  rows.push({id:'road.curvature',scope:'roads',min:.05,max:1,step:.1,value:numeric(recipe.road?.curvature,.5)});
  for(const district of recipe.districts||[])rows.push({id:`district.${district.id}.weight`,scope:'districts',min:.55,max:1.65,step:.11,value:numeric(district.weight,1)});
  for(const landmark of recipe.landmarks||[])rows.push({id:`landmark.${landmark.id}.keepClearRadius`,scope:'landmarks',min:48,max:360,step:18,value:numeric(landmark.keepClearRadius,120)});
  return freezeDeep(rows);
}

export function createMapForgeGenome(recipe,{style={},genes={}}={}){
  const catalog=createMapForgeGeneCatalog(recipe),values={};
  for(const descriptor of catalog){const key=descriptor.id,styleKey=key.startsWith('style.')?key.slice(6):null,requested=Object.prototype.hasOwnProperty.call(genes,key)?genes[key]:(styleKey&&Object.prototype.hasOwnProperty.call(style,styleKey)?style[styleKey]:descriptor.value);values[key]=round(clamp(numeric(requested,descriptor.value),descriptor.min,descriptor.max),4);}
  return freezeDeep({schema:'kelo-map-forge-genome-v2',recipeId:recipe.id,genes:values});
}

export function applyMapForgeGenome(recipe,genomeInput){
  const genome=createMapForgeGenome(recipe,{genes:genomeInput?.genes||genomeInput||{}}),variant=clone(recipe);
  for(const [id,value] of Object.entries(genome.genes)){
    const parts=id.split('.');
    if(parts[0]==='style')variant.style[parts[1]]=value;
    else if(parts[0]==='road')variant.road[parts[1]]=value;
    else if(parts[0]==='district'){const row=variant.districts.find(item=>item.id===parts[1]);if(row)row.weight=value;}
    else if(parts[0]==='landmark'){const row=variant.landmarks.find(item=>item.id===parts[1]);if(row)row.keepClearRadius=value;}
  }
  return freezeDeep(variant);
}

function evaluationSeedBank(recipe,{seed=1,validationSeeds=2,goldenSeeds=4}={}){
  const rows=[...getMapForgeGoldenSeeds(recipe.id,{limit:Math.max(1,Math.min(8,Math.floor(numeric(goldenSeeds,4))))})],extra=Math.max(0,Math.min(8,Math.floor(numeric(validationSeeds,2))));
  for(let index=0;index<extra;index++)rows.push(index===0?seed32(seed):seed32(`${seed}|map-forge-evolution-validation|${index}`));
  return Object.freeze([...new Set(rows)]);
}
function complexityScore(map){const areaMillions=Math.max(.25,(map.worldBounds?.w||1)*(map.worldBounds?.h||1)/1e6),density=(map.decorations?.length||0)/areaMillions,roads=map.roads?.length||0,blocks=map.blocks?.length||0,parcels=map.parcels?.length||0,penalty=Math.max(0,density-34)*.9+Math.max(0,roads-18)*1.2+Math.max(0,blocks-40)*.5+Math.max(0,parcels-80)*.12;return clamp(100-penalty,35,100);}
function navigationFloor(map){const m=map?.quality?.breakdown||{};return Math.min(numeric(m.navigation,0),numeric(m.connectivity,0),numeric(m.roadQuality,0));}

export function evaluateMapForgeGenome(recipe,{genome=null,style={},seed=1,validationSeeds=2,goldenSeeds=4,bestOf=3,assetCatalogVersion='catalog-unbound',constraints={}}={}){
  const normalized=createMapForgeGenome(recipe,genome?{genes:genome.genes||genome}:{style}),variantRecipe=applyMapForgeGenome(recipe,normalized),seeds=evaluationSeedBank(recipe,{seed,validationSeeds,goldenSeeds}),runs=[];
  for(const validationSeed of seeds){
    const t0=globalThis.performance?.now?.()??0,batch=generateBestOf(variantRecipe,{seed:validationSeed,count:clamp(Math.floor(numeric(bestOf,3)),1,8),assetCatalogVersion,style:variantRecipe.style,constraints}),elapsed=(globalThis.performance?.now?.()??t0)-t0,best=batch.best;
    runs.push(Object.freeze({seed:validationSeed,valid:Boolean(best?.validation?.valid),quality:numeric(best?.quality?.total,0),visual:best?round(visualScore(best),3):0,navigation:best?round(navigationFloor(best),3):0,complexity:best?round(complexityScore(best),3):0,generationMs:round(elapsed,3),layoutHash:best?.metadata?.layoutHash||null,validCount:batch.validCount,rejectedCount:batch.rejectedCount}));
  }
  const validRuns=runs.filter(run=>run.valid),qualities=validRuns.map(run=>run.quality),visuals=validRuns.map(run=>run.visual),measurements={meanQuality:round(mean(qualities),3),worstQuality:round(qualities.length?Math.min(...qualities):0,3),meanVisual:round(mean(visuals),3),worstVisual:round(visuals.length?Math.min(...visuals):0,3),navigationFloor:round(validRuns.length?Math.min(...validRuns.map(run=>run.navigation)):0,3),complexitySafety:round(mean(validRuns.map(run=>run.complexity)),3),stability:round(clamp(100-standardDeviation(qualities)*5,0,100),3),validRate:round(validRuns.length/runs.length*100,3)},scored=scoreEvolutionMetrics(MAP_FORGE_EVOLUTION_PROFILE,measurements),performance={meanGenerationMs:round(mean(runs.map(run=>run.generationMs)),3),worstGenerationMs:round(Math.max(0,...runs.map(run=>run.generationMs)),3)};
  return freezeDeep({valid:scored.valid,score:scored.score,metrics:measurements,performance,failures:scored.failures,genome:normalized,style:Object.fromEntries(MAP_FORGE_EVOLVABLE_STYLE_KEYS.map(key=>[key,normalized.genes[`style.${key}`]])),runs});
}
export const evaluateMapForgeStyle=(recipe,options={})=>evaluateMapForgeGenome(recipe,options);

function weightedPick(rng,rows,memory){
  const weights=rows.map(row=>1/(1+mutationFailureCount(memory||{},row.id)*.45)),total=weights.reduce((a,b)=>a+b,0),needle=rng.float(0,total);let cursor=0;
  for(let i=0;i<rows.length;i++){cursor+=weights[i];if(needle<=cursor)return rows[i];}return rows.at(-1);
}
export function proposeMapForgeGenomeMutations(recipe,{genome=null,style={},seed=1,generation=0,population=8,mutationStep=1,lockedGenes=[],focusScopes=[],focusGenes=[],memory=null}={}){
  const base=createMapForgeGenome(recipe,genome?{genes:genome.genes||genome}:{style}),catalog=createMapForgeGeneCatalog(recipe),eligible=catalog.filter(row=>!geneMatches(row.id,lockedGenes)&&(!focusScopes.length||focusScopes.includes(row.scope))&&(!focusGenes.length||geneMatches(row.id,focusGenes)));
  if(!eligible.length)throw new Error('MAP_FORGE_EVOLUTION_NO_MUTABLE_GENES');
  const rng=createRng(seed32(`${seed}|generation|${generation}`),'map-forge-genome-evolution'),count=clamp(Math.floor(numeric(population,8)),2,24),scale=clamp(numeric(mutationStep,1),.1,3),seen=new Set([stableStringify(base.genes)]),candidates=[];
  for(let index=0;index<count;index++){
    let attempts=0,candidateGenes,mutations=[];
    do{
      const draft={...base.genes},mutationCount=rng.chance(.22)?3:(rng.chance(.38)?2:1),used=new Set();mutations=[];
      for(let m=0;m<Math.min(mutationCount,eligible.length);m++){
        let descriptor=weightedPick(rng,eligible.filter(row=>!used.has(row.id)),memory);if(!descriptor)break;used.add(descriptor.id);
        const before=draft[descriptor.id],magnitude=descriptor.step*scale*rng.float(.55,1.15),after=round(clamp(before+(rng.chance(.5)?-1:1)*magnitude,descriptor.min,descriptor.max),4);draft[descriptor.id]=after;mutations.push(Object.freeze({geneId:descriptor.id,scope:descriptor.scope,before,after,delta:round(after-before,4)}));
      }
      candidateGenes=draft;attempts++;
    }while(seen.has(stableStringify(candidateGenes))&&attempts<16);
    const signature=stableStringify(candidateGenes);if(seen.has(signature))continue;seen.add(signature);
    candidates.push(freezeDeep({id:`mf-evo:${generation}:${index}:${hashString(signature).slice(0,8)}`,genome:createMapForgeGenome(recipe,{genes:candidateGenes}),mutations}));
  }
  return freezeDeep(candidates);
}
export function proposeMapForgeStyleMutations(recipe,options={}){return proposeMapForgeGenomeMutations(recipe,options).map(candidate=>freezeDeep({...candidate,style:Object.fromEntries(MAP_FORGE_EVOLVABLE_STYLE_KEYS.map(key=>[key,candidate.genome.genes[`style.${key}`]]))}));}

export async function evolveMapForgeStyle(recipe,{genome=null,style={},seed=1,generations=3,population=8,mutationStep=1,validationSeeds=2,goldenSeeds=4,bestOf=3,minImprovement=.3,minScore=0,assetCatalogVersion='catalog-unbound',constraints={},lockedGenes=[],focusScopes=[],focusGenes=[],memory=null}={}){
  if(!recipe?.id)throw new Error('MAP_FORGE_EVOLUTION_RECIPE_REQUIRED');
  const original=freezeDeep({id:'baseline',genome:createMapForgeGenome(recipe,genome?{genes:genome.genes||genome}:{style}),mutations:[]}),history=[];let current=original,step=clamp(numeric(mutationStep,1),.1,3),acceptedGenerations=0;
  const generationCount=clamp(Math.floor(numeric(generations,3)),1,10),evaluate=candidate=>evaluateMapForgeGenome(recipe,{genome:candidate.genome,seed,validationSeeds,goldenSeeds,bestOf,assetCatalogVersion,constraints});
  for(let generation=0;generation<generationCount;generation++){
    const cycle=await runEvolutionCycle({baseline:current,propose:()=>proposeMapForgeGenomeMutations(recipe,{genome:current.genome,seed,generation,population,mutationStep:step,lockedGenes,focusScopes,focusGenes,memory}),evaluate,policy:{minImprovement,minScore}}),selected=cycle.selected;
    history.push(freezeDeep({generation,accepted:cycle.accepted,baselineScore:cycle.baselineEvaluation.score,candidateScore:selected?.evaluation?.score??null,delta:selected?.comparison?.delta??0,selectedId:selected?.candidate?.id||null,mutations:selected?.candidate?.mutations||[],candidateCount:cycle.evaluated.length,step:round(step,4)}));
    if(cycle.accepted){current=cycle.result;acceptedGenerations++;step=clamp(step*.88,.1,3);}else step=clamp(step*.68,.1,3);
  }
  const baselineEvaluation=evaluate(original),bestEvaluation=evaluate(current),bestStyle=Object.fromEntries(MAP_FORGE_EVOLVABLE_STYLE_KEYS.map(key=>[key,current.genome.genes[`style.${key}`]]));
  return freezeDeep({version:'kelo-map-forge-evolution-v2',recipeId:recipe.id,seed:seed32(seed),accepted:acceptedGenerations>0,acceptedGenerations,generations:generationCount,originalGenome:original.genome,bestGenome:current.genome,originalStyle:Object.fromEntries(MAP_FORGE_EVOLVABLE_STYLE_KEYS.map(key=>[key,original.genome.genes[`style.${key}`]])),bestStyle,baselineEvaluation,bestEvaluation,improvement:round(bestEvaluation.score-baselineEvaluation.score,4),history,locks:{lockedGenes:[...lockedGenes],focusScopes:[...focusScopes],focusGenes:[...focusGenes]}});
}
