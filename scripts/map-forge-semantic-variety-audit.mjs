/* KELO-INDEX
 * area: TEST / MAP FORGE / STUDIO HANDOFF
 * owner: Map Forge Studio handoff contract audit
 * purpose: prove declared semantic asset variants are actually used deterministically across real generated worlds
 */
import assert from 'node:assert/strict';
import {generateBestOf} from '../src/world/map-forge/map-forge-core.mjs';
import {getMapForgeRecipe} from '../src/world/map-forge/map-forge-recipes.mjs';
import {mapDefinitionToWorldDraftSnapshot} from '../src/studio/adapters/map-forge-draft-importer.mjs';

const VARIANTS=Object.freeze({
  fountain:['imperial:fuente-justicia','imperial:fuente-astral','imperial:fuente-leones'],
  tree:['imperial:arbol-florido-blanco','imperial:arbol-florido-azul'],
  lamp:['imperial:farola','imperial:farola-monumental']
});
const SIZES=Object.freeze({
  'imperial:fuente-justicia':[128,128],
  'imperial:fuente-astral':[128,128],
  'imperial:fuente-leones':[128,128],
  'imperial:arbol-florido-blanco':[128,128],
  'imperial:arbol-florido-azul':[128,128],
  'imperial:farola':[64,96],
  'imperial:farola-monumental':[64,96]
});
const extras=[
  ['imperial:kiosco',160,160],['imperial:banco',128,96],['imperial:jardinera-curva',160,160],
  ['imperial:topiario',96,96],['imperial:puente',160,128],['imperial:obelisco',96,128]
];
const templates=[
  ...Object.entries(SIZES).map(([id,[width,height]])=>({id,label:id,family:id,category:'decor',width,height,placeable:true})),
  ...extras.map(([id,width,height])=>({id,label:id,family:id,category:'decor',width,height,placeable:true}))
];
const catalog={version:'semantic-variety-audit-v1',list:()=>templates,get:id=>templates.find(row=>row.id===id)||null};
const recipes=['KELO_ROYAL_CAPITAL_V1','KELO_VILLAGE_V1','KELO_FOREST_V1'];
const usage=Object.fromEntries(Object.keys(VARIANTS).map(kind=>[kind,new Map()]));
const counts=Object.fromEntries(Object.keys(VARIANTS).map(kind=>[kind,0]));
let worlds=0;

function semanticKind(row){
  const text=String([row?.kind,row?.type,row?.family,row?.name,row?.label,row?.role].filter(Boolean).join(' ')).toLowerCase();
  if(/\b(fountain|fuente)\b/.test(text))return'fountain';
  if(/\b(ancient tree|tree|arbol|grove)\b/.test(text))return'tree';
  if(/\b(lamp|farola|light)\b/.test(text))return'lamp';
  return null;
}
function inspectRows(map,snapshot,collection,placementKind){
  const byId=new Map(snapshot.placements.map(row=>[row.placementId,row]));
  for(const [index,row] of collection.entries()){
    const kind=semanticKind(row); if(!kind)continue;
    const placementId=`map-forge:${placementKind}:${String(row?.id||index)}`;
    const placement=byId.get(placementId);
    assert(placement,`missing semantic placement ${placementId}`);
    assert(VARIANTS[kind].includes(placement.assetId),`${kind} resolved unexpected asset ${placement.assetId}`);
    counts[kind]+=1;
    usage[kind].set(placement.assetId,(usage[kind].get(placement.assetId)||0)+1);
  }
}

for(const recipeId of recipes){
  const recipe=getMapForgeRecipe(recipeId);
  for(let seed=1;seed<=20;seed++){
    const run=generateBestOf(recipe,{seed,count:4,assetCatalogVersion:catalog.version});
    assert(run.best?.validation?.valid,`${recipeId} seed ${seed} must produce a valid best candidate`);
    const snapshot=mapDefinitionToWorldDraftSnapshot(run.best,{assetCatalog:catalog});
    inspectRows(run.best,snapshot,run.best.landmarks||[],'landmark');
    inspectRows(run.best,snapshot,run.best.decorations||[],'decoration');
    if(seed===1){
      const replay=generateBestOf(recipe,{seed,count:4,assetCatalogVersion:catalog.version});
      const replaySnapshot=mapDefinitionToWorldDraftSnapshot(replay.best,{assetCatalog:catalog});
      assert.deepEqual(replaySnapshot.placements,snapshot.placements,`${recipeId} semantic asset selection must be seed deterministic`);
    }
    worlds+=1;
  }
}

const observedKinds=Object.keys(VARIANTS).filter(kind=>counts[kind]>0);
assert(observedKinds.length>=2,'representative corpus must exercise at least two multi-variant semantic families');
let available=0,beforeDistinct=0,afterDistinct=0;
const families={};
for(const kind of observedKinds){
  const allowed=VARIANTS[kind];
  const used=usage[kind];
  available+=allowed.length;
  beforeDistinct+=1;
  afterDistinct+=used.size;
  const dominant=Math.max(...used.values())/counts[kind];
  families[kind]={count:counts[kind],beforeDistinct:1,afterDistinct:used.size,available:allowed.length,dominantShare:Number(dominant.toFixed(4)),usage:Object.fromEntries(used)};
  assert(used.size>=2,`${kind} must use more than the legacy first semantic asset`);
}
const beforeCoverage=beforeDistinct/available;
const afterCoverage=afterDistinct/available;
assert(afterCoverage>beforeCoverage,`semantic asset variety must improve: ${beforeCoverage} -> ${afterCoverage}`);

console.log(JSON.stringify({
  ok:true,
  worlds,
  recipes:recipes.length,
  seedsPerRecipe:20,
  deterministicReplays:recipes.length,
  metric:'declared semantic variant coverage',
  before:Number((beforeCoverage*100).toFixed(2)),
  after:Number((afterCoverage*100).toFixed(2)),
  families
},null,2));