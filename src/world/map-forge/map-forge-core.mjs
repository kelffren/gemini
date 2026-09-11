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
export const MAP_FORGE_GENERATOR_VERSION='1.1.4';
export {createMapIntent} from './map-forge-builder.mjs';
export {createRng,stableStringify} from './map-forge-prng.mjs';
export {validateMapDefinition,scoreMapDefinition} from './map-forge-quality.mjs';

const DIRECTIONAL_DECORATION_FAMILIES=new Set(['bench','market_prop']);
const DECORATION_DECLUSTER_RADIUS=240;
const DECORATION_DECLUSTER_GAIN=20;
const decorationDistance=(a,b)=>Math.hypot(Number(a?.x||0)-Number(b?.x||0),Number(a?.y||0)-Number(b?.y||0));
function nearestFamilyDistance(rows,index,family){const current=rows[index];let best=Infinity;for(let i=0;i<rows.length;i++){if(i===index)continue;const row=rows[i];if(row.district!==current.district||row.family!==family)continue;best=Math.min(best,decorationDistance(current,row));}return best;}
function declusterDecorationFamilies(parts){
  const rows=(parts.decorations||[]).map(row=>({...row}));let swaps=0;
  for(let i=0;i<rows.length;i++){
    const current=rows[i],nearest=nearestFamilyDistance(rows,i,current.family);
    if(nearest>DECORATION_DECLUSTER_RADIUS)continue;
    let bestIndex=-1,bestGain=0;
    for(let j=i+1;j<rows.length;j++){
      const candidate=rows[j];if(candidate.district!==current.district||candidate.family===current.family)continue;
      const before=Math.min(nearestFamilyDistance(rows,i,current.family),nearestFamilyDistance(rows,j,candidate.family));
      const aFamily=current.family,aAsset=current.assetRef,bFamily=candidate.family,bAsset=candidate.assetRef;
      current.family=bFamily;current.assetRef=bAsset;candidate.family=aFamily;candidate.assetRef=aAsset;
      const after=Math.min(nearestFamilyDistance(rows,i,current.family),nearestFamilyDistance(rows,j,candidate.family));
      current.family=aFamily;current.assetRef=aAsset;candidate.family=bFamily;candidate.assetRef=bAsset;
      const gain=after-before;if(gain>bestGain){bestGain=gain;bestIndex=j;}
    }
    if(bestIndex<0||bestGain<DECORATION_DECLUSTER_GAIN)continue;
    const candidate=rows[bestIndex],family=current.family,assetRef=current.assetRef;
    current.family=candidate.family;current.assetRef=candidate.assetRef;candidate.family=family;candidate.assetRef=assetRef;swaps++;
  }
  return{...parts,decorations:rows,generationStats:{...parts.generationStats,decorationDeclusterSwapCount:swaps}};
}
function nearestRoadVector(p,roads){let best=null;for(const road of roads||[]){const points=road.polyline||[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den,0,1):0,x=a.x+dx*t,y=a.y+dy*t,vx=x-p.x,vy=y-p.y,distance=Math.hypot(vx,vy);if(!best||distance<best.distance)best={vx,vy,distance};}}return best;}
function roadFacingRotation(p,roads,fallback=0){const frame=nearestRoadVector(p,roads);if(!frame||frame.distance<1e-6)return fallback;const degrees=Math.atan2(-frame.vx,frame.vy)*180/Math.PI;return((Math.round(degrees/90)*90)%360+360)%360;}
function orientDirectionalDecorations(parts){let oriented=0;const decorations=(parts.decorations||[]).map(row=>{if(!DIRECTIONAL_DECORATION_FAMILIES.has(row.family))return row;oriented++;return{...row,rotation:roadFacingRotation(row,parts.roads,row.rotation)};});return{...parts,decorations,generationStats:{...parts.generationStats,decorationRoadFacingCount:oriented}};}

export function generateMapCandidate(recipe,{seed=1,assetCatalogVersion='catalog-unbound',style={},constraints={}}={}){const intent=createMapIntent(recipe,{seed,assetCatalogVersion,style,constraints}),rawParts=buildCandidateParts(recipe,intent,createRng(intent.seed,'map-forge')),declustered=declusterDecorationFamilies(rawParts),parts=orientDirectionalDecorations(declustered),base={metadata:{mapId:`map:${recipe.id}:${intent.seed}`,seed:intent.seed,generatorVersion:MAP_FORGE_GENERATOR_VERSION,recipeId:recipe.id,recipeVersion:recipe.version,assetCatalogVersion:intent.assetCatalogVersion,layoutHash:null},worldBounds:{...intent.worldBounds},...parts};const hashPayload={...base,metadata:{...base.metadata,layoutHash:null}};base.metadata.layoutHash=hashString(stableStringify(hashPayload));base.validation=validateMapDefinition(base,recipe);base.quality=scoreMapDefinition(base,recipe,base.validation);return freezeDeep(base);}
function deriveCandidateSeed(seed,index){return seed32(`${seed}|candidate|${index}`);}
function visualTieScore(map){const m=map?.quality?.breakdown||{};return Number(m.visualComposition||0)*1.35+Number(m.scenicVistas||0)*1.25+Number(m.negativeSpace||0)*1.05+Number(m.assetVariety||0)+Number(m.districtCoherence||0);}
function candidateComparator(a,b){return b.quality.total-a.quality.total||visualTieScore(b)-visualTieScore(a)||String(a.metadata.layoutHash).localeCompare(String(b.metadata.layoutHash));}
function specialtyPick(sorted,maximizer,used){if(!sorted.length)return null;const ranked=[...sorted].sort((a,b)=>maximizer(b)-maximizer(a)||candidateComparator(a,b)),fresh=ranked.find(map=>!used.has(map.metadata.layoutHash)),chosen=fresh||ranked[0];used.add(chosen.metadata.layoutHash);return chosen;}
export function generateBestOf(recipe,{seed=1,count=8,assetCatalogVersion='catalog-unbound',style={},constraints={}}={}){const n=clamp(Math.floor(count),1,32),candidates=[];for(let i=0;i<n;i++){const s=i===0?seed:deriveCandidateSeed(seed,i),map=generateMapCandidate(recipe,{seed:s,assetCatalogVersion,style,constraints});if(map.validation.valid)candidates.push(map);}const sorted=[...candidates].sort(candidateComparator),used=new Set(),bestOverall=sorted[0]||null;if(bestOverall)used.add(bestOverall.metadata.layoutHash);const selections={bestOverall,mostMonumental:specialtyPick(sorted,m=>m.quality.breakdown.landmarkQuality+m.quality.breakdown.visualComposition,used),mostOrganic:specialtyPick(sorted,m=>m.quality.breakdown.negativeSpace+m.quality.breakdown.scenicVistas,used),mostExplorable:specialtyPick(sorted,m=>m.quality.breakdown.navigation+m.quality.breakdown.districtVariety,used),mostCompact:specialtyPick(sorted,m=>100-(m.generationStats.roadCount+m.generationStats.blockCount),used)};return freezeDeep({requested:n,validCount:sorted.length,rejectedCount:n-sorted.length,best:bestOverall,selections,candidates:sorted});}
export function serializeMapDefinition(map){return stableStringify(map);}
export function deserializeMapDefinition(json){return freezeDeep(JSON.parse(json));}