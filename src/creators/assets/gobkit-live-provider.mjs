/* KELO-INDEX
 * area: CREATORS / EXTERNAL CONTENT / GOBKIT
 * owner: Kelo Universal Content Bridge
 * keys: GOBKIT CC0 GLB RIGGED ANIMATION MANIFEST LAZY MOBILE
 * purpose: expose Gobkit free model metadata without loading GLB bytes until a future explicit 3D integration flow requests them
 */
import {fetchProviderJson,mobilePageBudget,clearExternalProviderRuntimeCache} from './external-provider-runtime.mjs?v=1';

const API='https://gobkit.com/api/free';
function clean(value){return String(value??'').trim();}
function flatten(data){const rows=[];for(const pack of Array.isArray(data?.packs)?data.packs:[]){for(const model of Array.isArray(pack?.models)?pack.models:[])rows.push({pack,model});}return rows;}
function normalize({pack,model}){const id=clean(model?.id||model?.name),animations=Array.isArray(model?.animations)?model.animations.map(row=>clean(row?.name)).filter(Boolean):[];return{id:`gobkit:${clean(pack?.id||'free')}:${id}`,provider:'gobkit',externalId:id,name:clean(model?.name||id),category:clean(pack?.kind||'3d-model'),contentKind:'model',previewKind:'image',tags:[pack?.kind,model?.rigged?'rigged':null,model?.lowPoly?'low-poly':null,...animations].filter(Boolean).map(String),previewUrl:null,downloadUrl:null,sourceUrl:'https://gobkit.com/freebies',license:'CC0-1.0',author:'Gobkit',attributionRequired:false,ownership:'discovered',description:`${clean(pack?.name||'Gobkit Free')} · ${model?.rigged?'rigged':'static'}${animations.length?` · ${animations.join(', ')}`:''}`,downloadable:false,integrationReady:false,verified:true,catalogOnly:true,heavyExternal:true,remoteCdnUrl:clean(model?.url)||null,rigged:model?.rigged===true,lowPoly:model?.lowPoly===true,fps:Number(model?.fps||pack?.fps||0)||null,animations:Array.isArray(model?.animations)?model.animations:[]};}
function matches(row,q){if(!q)return true;const hay=`${row.name} ${row.category} ${(row.tags||[]).join(' ')} ${row.description}`.toLowerCase();return q.split(/\s+/).filter(Boolean).every(token=>hay.includes(token));}

export async function searchGobkitAssets(query='',options={}){
  const requested=Math.max(1,Number(options.limit)||24),limit=mobilePageBudget(requested,{heavy:true}),offset=Math.max(0,Number(options.offset)||0),data=await fetchProviderJson('gobkit',API,{ttlMs:60*60*1000,maxBytes:650_000,cacheKey:'gobkit:free:v2'}),q=clean(query).toLowerCase(),all=flatten(data).map(normalize),filtered=q?all.filter(row=>matches(row,q)):all,assets=filtered.slice(offset,offset+limit);
  return{assets,offset,limit,total:filtered.length,hasMore:offset+assets.length<filtered.length,engine:'gobkit-free-manifest-v2'};
}
export function clearGobkitCache(){clearExternalProviderRuntimeCache('gobkit:');}
