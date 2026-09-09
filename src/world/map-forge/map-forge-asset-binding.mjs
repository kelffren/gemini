/* KELO-INDEX
 * area: WORLD / MAP FORGE / ASSET BINDING
 * owner: KeloMapForge catalog binding adapter
 * purpose: resolve semantic Map Forge decorations into immutable KELO_PROPERTY_CATALOG asset IDs before Studio handoff
 * public-api: bindMapForgeAssets(), buildMapForgeCatalogSnapshot()
 * consumes: pure MapDefinition + compact placeable catalog snapshot
 * state-owned: none
 * does-not-own: generator layout, runtime catalog, renderer, collision, PropertySystem or publish authority
 * online: server/client may bind against the same approved catalog revision; MapDefinition keeps stable revision IDs
 * do-not: no DOM, Canvas, runtime mutation or Math.random
 */
import {freezeDeep,hashString,stableStringify} from './map-forge-prng.mjs';

const ALIASES=Object.freeze({
  tree:['tree','arbol','árbol','cypress','cipres','topiary','topiario','blossom-tree'],
  bush:['bush','arbusto','shrub','seto'],
  rock:['rock','roca','stone-prop','piedra'],
  flower:['flower','floral','flor','planter','jardinera','blossom'],
  crate:['crate','caja','box','cargo'],
  lamp:['lamp','farola','lantern','lampara','lámpara','light-post'],
  bench:['bench','banco','seat','asiento'],
  market_prop:['market','mercado','cart','carrito','kiosk','kiosco','stall','puesto','vendor'],
  barrel:['barrel','barril','cask']
});
const CATEGORY_HINTS=Object.freeze({
  tree:['nature'],bush:['nature'],rock:['nature','decor'],flower:['nature','decor'],
  crate:['decor','rural'],lamp:['decor','architecture'],bench:['decor'],market_prop:['decor','architecture'],barrel:['decor','rural']
});

function normalize(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function haystack(row){return normalize([row.id,row.label,row.category,row.family,row.source,row.sourceId,...(row.tags||[])].join(' '));}
function districtCompatible(row,district){const list=Array.isArray(row.districts)?row.districts:['*'];return list.includes('*')||list.map(String).includes(String(district||''));}
function semanticScore(row,family,district){
  const text=haystack(row),aliases=ALIASES[family]||[family],categories=CATEGORY_HINTS[family]||[];
  let score=0;
  for(const alias of aliases){const token=normalize(alias);if(token&&text.includes(token))score+=12;}
  if(normalize(row.family)===normalize(family))score+=24;
  if(categories.includes(String(row.category||'')))score+=5;
  if(districtCompatible(row,district))score+=4;else score-=30;
  if(String(row.source||'')==='creator-library')score+=1;
  return score;
}
function deterministicPick(candidates,key){
  if(!candidates.length)return null;
  const sorted=[...candidates].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const h=parseInt(hashString(`${key}|${sorted.map(x=>x.id).join('|')}`).slice(0,8),16)>>>0;
  return sorted[h%sorted.length]||null;
}
function resolveDecoration(decoration,catalog,mapHash){
  const scored=catalog.map(row=>({row,score:semanticScore(row,decoration.family,decoration.district)})).filter(x=>x.score>0);
  if(!scored.length)return null;
  const best=Math.max(...scored.map(x=>x.score)),pool=scored.filter(x=>x.score>=best-2).map(x=>x.row);
  return deterministicPick(pool,`${mapHash}|${decoration.id}|${decoration.family}`);
}

export function buildMapForgeCatalogSnapshot(catalog){
  const rows=Array.isArray(catalog)?catalog:catalog?.list?.()||[];
  return rows.filter(row=>row?.id).map(row=>Object.freeze({
    id:String(row.id),label:String(row.label||row.id),category:String(row.category||'other'),family:String(row.family||'generic'),
    districts:Object.freeze([...(row.districts||['*'])].map(String)),source:String(row.source||'registry'),sourceId:String(row.sourceId||row.id),
    tags:Object.freeze([...(row.tags||[])].map(String))
  })).sort((a,b)=>a.id.localeCompare(b.id));
}

export function bindMapForgeAssets(map,catalog,{catalogVersion=null}={}){
  if(!map?.metadata?.layoutHash)throw new Error('MAP_FORGE_ASSET_BINDING_MAP_REQUIRED');
  const rows=buildMapForgeCatalogSnapshot(catalog),placements=[],unresolved=[];
  for(const dec of map.decorations||[]){
    const asset=resolveDecoration(dec,rows,map.metadata.layoutHash);
    if(!asset){unresolved.push(String(dec.id));continue;}
    placements.push(Object.freeze({
      id:`map-forge-asset:${dec.id}`,placementId:`map-forge-asset:${dec.id}`,assetId:asset.id,
      position:Object.freeze({x:Number(dec.x)||0,y:Number(dec.y)||0}),rotation:Number(dec.rotation)||0,layer:'property',
      sourceDecorationId:String(dec.id),semanticFamily:String(dec.family||'generic'),catalogSource:String(asset.source||'registry')
    }));
  }
  const version=String(catalogVersion||map.metadata.assetCatalogVersion||'catalog-unbound');
  const bindingHash=hashString(stableStringify({layoutHash:map.metadata.layoutHash,catalogVersion:version,placements:placements.map(p=>({id:p.id,assetId:p.assetId,position:p.position,rotation:p.rotation}))}));
  const next={
    ...map,
    metadata:{...map.metadata,assetCatalogVersion:version,assetBindingHash:bindingHash},
    prefabPlacements:placements,
    generationStats:{...(map.generationStats||{}),assetPlacementCount:placements.length,unresolvedDecorationCount:unresolved.length},
    assetBinding:{version:'map-forge-asset-binding-v1',catalogVersion:version,bindingHash,resolved:placements.length,unresolved:Object.freeze(unresolved)}
  };
  return freezeDeep(next);
}
