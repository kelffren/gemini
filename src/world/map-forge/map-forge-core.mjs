/* KELO-INDEX
 * area: WORLD / MAP FORGE
 * owner: KeloMapForge deterministic generator core
 * purpose: orchestrate pure MapDefinition generation, hashing, validation, scoring and best-of-N selection
 * public-api: MAP_FORGE_GENERATOR_VERSION, generateMapCandidate, generateBestOf, serializeMapDefinition, deserializeMapDefinition
 * consumes: recipe data + map-forge builder/quality primitives
 * state-owned: none
 * extension-points: future lock regeneration and worker adapter call this same pure API
 * online: metadata uniquely identifies the base generated world; server/runtime deltas remain separate
 * do-not: no DOM, renderer, collision writes, camera, PropertySystem, wall-clock fields or Math.random
 */
import {clamp,freezeDeep,stableStringify,hashString,seed32,createRng} from './map-forge-prng.mjs';
import {createMapIntent,buildCandidateParts} from './map-forge-builder.mjs';
import {validateMapDefinition,scoreMapDefinition} from './map-forge-quality.mjs';
export const MAP_FORGE_GENERATOR_VERSION='1.0.0';
export {createMapIntent} from './map-forge-builder.mjs';
export {createRng,stableStringify} from './map-forge-prng.mjs';
export {validateMapDefinition,scoreMapDefinition} from './map-forge-quality.mjs';
export function generateMapCandidate(recipe,{seed=1,assetCatalogVersion='catalog-unbound',style={},constraints={}}={}){const intent=createMapIntent(recipe,{seed,assetCatalogVersion,style,constraints}),parts=buildCandidateParts(recipe,intent,createRng(intent.seed,'map-forge')),base={metadata:{mapId:`map:${recipe.id}:${intent.seed}`,seed:intent.seed,generatorVersion:MAP_FORGE_GENERATOR_VERSION,recipeId:recipe.id,recipeVersion:recipe.version,assetCatalogVersion:intent.assetCatalogVersion,layoutHash:null},worldBounds:{...intent.worldBounds},...parts};const hashPayload={...base,metadata:{...base.metadata,layoutHash:null}};base.metadata.layoutHash=hashString(stableStringify(hashPayload));base.validation=validateMapDefinition(base,recipe);base.quality=scoreMapDefinition(base,recipe);return freezeDeep(base);}
function deriveCandidateSeed(seed,index){return seed32(`${seed}|candidate|${index}`);}
export function generateBestOf(recipe,{seed=1,count=8,assetCatalogVersion='catalog-unbound',style={},constraints={}}={}){const n=clamp(Math.floor(count),1,32),candidates=[];for(let i=0;i<n;i++){const s=i===0?seed:deriveCandidateSeed(seed,i),map=generateMapCandidate(recipe,{seed:s,assetCatalogVersion,style,constraints});if(map.validation.valid)candidates.push(map);}const sorted=[...candidates].sort((a,b)=>b.quality.total-a.quality.total||String(a.metadata.layoutHash).localeCompare(String(b.metadata.layoutHash))),pick=maximizer=>sorted.length?[...sorted].sort((a,b)=>maximizer(b)-maximizer(a)||b.quality.total-a.quality.total)[0]:null;return freezeDeep({requested:n,validCount:sorted.length,rejectedCount:n-sorted.length,best:sorted[0]||null,selections:{bestOverall:sorted[0]||null,mostMonumental:pick(m=>m.quality.breakdown.landmarkQuality+m.quality.breakdown.visualComposition),mostOrganic:pick(m=>m.quality.breakdown.negativeSpace+m.quality.breakdown.scenicVistas),mostExplorable:pick(m=>m.quality.breakdown.navigation+m.quality.breakdown.districtVariety),mostCompact:pick(m=>100-(m.generationStats.roadCount+m.generationStats.blockCount))},candidates:sorted});}
export function serializeMapDefinition(map){return stableStringify(map);}
export function deserializeMapDefinition(json){return freezeDeep(JSON.parse(json));}
