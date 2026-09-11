/* KELO-INDEX
 * area: QA / MAP FORGE / EVOLUTION / AUTOPILOT
 * owner: KeloEvolution CI-side champion challenger runner
 * purpose: evolve current Map Forge champions on golden seeds and write source overrides only when a measured improvement wins
 * public-api: CLI; writes champion override module + memory only when accepted and always writes test-results report
 * consumes: Map Forge recipes/evolution + experiment memory
 * state-owned: CI checkout files only; GitHub workflow owns branch/PR persistence
 * online: N/A gameplay; promotion authority is GitHub PR review/checks
 * do-not: no direct main push, no merge, no secrets, no runtime mutation
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {MAP_FORGE_RECIPES} from '../src/world/map-forge/map-forge-recipes.mjs';
import {MAP_FORGE_CHAMPION_OVERRIDES} from '../src/world/map-forge/map-forge-champion-overrides.mjs';
import {evolveMapForgeStyle} from '../src/world/map-forge/map-forge-evolution.mjs';
import {createEvolutionMemory,recordEvolutionExperiment,promoteEvolutionChampion} from '../src/creators/evolution/evolution-memory.mjs';

const memoryPath=path.resolve('docs/evolution/map-forge-memory.json'),championPath=path.resolve('src/world/map-forge/map-forge-champion-overrides.mjs'),reportPath=path.resolve('test-results/map-forge-evolution-autopilot.json');
const sourceSha=String(process.env.GITHUB_SHA||process.env.KELO_SOURCE_SHA||'local').trim();
async function readMemory(){try{return createEvolutionMemory(JSON.parse(await fs.readFile(memoryPath,'utf8')));}catch{return createEvolutionMemory({systemId:'map-forge'});}}
function championModule(overrides){return `/* KELO-INDEX\n * area: WORLD / MAP FORGE / EVOLUTION / CHAMPION\n * owner: KeloMapForge champion data registry\n * purpose: store only evolution overrides that passed golden-seed gates and GitHub review\n * public-api: MAP_FORGE_CHAMPION_OVERRIDES\n * consumes: Map Forge recipe ids\n * state-owned: immutable approved override data\n * online: base-world recipe data only; server/runtime deltas remain separate\n * do-not: no generator logic, runtime writes or auto-merge authority\n */\nexport const MAP_FORGE_CHAMPION_OVERRIDES=Object.freeze(${JSON.stringify(overrides,null,2)});\n`;}

let memory=await readMemory(),overrides=JSON.parse(JSON.stringify(MAP_FORGE_CHAMPION_OVERRIDES)),acceptedAny=false;const reports=[];
for(const recipe of Object.values(MAP_FORGE_RECIPES)){
  const result=await evolveMapForgeStyle(recipe,{seed:`autopilot:${recipe.id}`,generations:3,population:8,mutationStep:1,goldenSeeds:6,validationSeeds:2,bestOf:4,minImprovement:.2,assetCatalogVersion:'autopilot-catalog',memory});
  const winningMutations=result.history.filter(row=>row.accepted).flatMap(row=>row.mutations||[]),candidateId=`${recipe.id}:${result.bestEvaluation.score}:${sourceSha.slice(0,8)}`;
  memory=recordEvolutionExperiment(memory,{id:`${recipe.id}:${sourceSha}`,sourceSha,candidateId,accepted:result.accepted,baselineScore:result.baselineEvaluation.score,candidateScore:result.bestEvaluation.score,delta:result.improvement,mutations:result.history.flatMap(row=>row.mutations||[]),metrics:result.bestEvaluation.metrics,failures:result.bestEvaluation.failures});
  if(result.accepted){
    acceptedAny=true;const previous=overrides[recipe.id]||{};overrides[recipe.id]={revision:Math.max(0,Number(previous.revision)||0)+1,sourceSha,score:result.bestEvaluation.score,genes:result.bestGenome.genes};
    memory=promoteEvolutionChampion(memory,{candidateId,score:result.bestEvaluation.score,fingerprint:result.bestEvaluation.runs.map(row=>row.layoutHash).join(':'),metadata:{recipeId:recipe.id,mutations:winningMutations}});
  }
  reports.push({recipeId:recipe.id,accepted:result.accepted,improvement:result.improvement,baselineScore:result.baselineEvaluation.score,bestScore:result.bestEvaluation.score,performance:result.bestEvaluation.performance,history:result.history,bestGenome:result.bestGenome});
}
await fs.mkdir(path.dirname(reportPath),{recursive:true});await fs.writeFile(reportPath,JSON.stringify({schema:'kelo-map-forge-autopilot-v1',sourceSha,acceptedAny,reports},null,2)+'\n');
if(acceptedAny){await fs.mkdir(path.dirname(memoryPath),{recursive:true});await fs.writeFile(memoryPath,JSON.stringify(memory,null,2)+'\n');await fs.writeFile(championPath,championModule(overrides));}
console.log(JSON.stringify({ok:true,acceptedAny,sourceSha,recipes:reports.map(row=>({recipeId:row.recipeId,accepted:row.accepted,improvement:row.improvement,baselineScore:row.baselineScore,bestScore:row.bestScore}))},null,2));
