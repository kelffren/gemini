/* KELO-INDEX
 * area: CREATORS / EXTERNAL CONTENT / AMBIENTCG
 * owner: Kelo Universal Content Bridge
 * keys: AMBIENTCG V3 CC0 PBR HDRI MODEL TEXTURE LAZY MOBILE
 * purpose: search ambientCG through its official v3 API while returning metadata/thumbnails only; heavy archives remain source-resolved on explicit user action
 */
import {fetchProviderJson,mobilePageBudget,clearExternalProviderRuntimeCache} from './external-provider-runtime.mjs?v=1';

const API='https://ambientcg.com/api/v3/assets';
function clean(value){return String(value??'').trim();}
function firstThumbnail(value){if(Array.isArray(value))return value.find(x=>x?.url)?.url||null;if(value&&typeof value==='object')return value['256-WEBP']||value['256-PNG']||value['512-WEBP']||Object.values(value).find(v=>typeof v==='string')||null;return null;}
function rowsOf(data){if(Array.isArray(data))return data;if(Array.isArray(data?.assets))return data.assets;if(Array.isArray(data?.foundAssets))return data.foundAssets;if(Array.isArray(data?.results))return data.results;return[];}
function kindOf(type=''){const value=clean(type).toLowerCase();if(value==='3d-model')return'model';if(value==='hdri'||value==='hdri-element')return'hdri';if(value==='atlas'||value==='decal'||value==='plain-image'||value==='brush')return'image';return'texture';}
function dimensionsOf(raw){if(!raw||typeof raw!=='object')return null;const width=Number(raw.width||raw.x||0),height=Number(raw.height||raw.y||0);return width&&height?`${width}×${height}`:null;}
function normalize(item,index){const id=clean(item?.id||item?.assetId||`asset-${index}`),type=clean(item?.type||item?.dataType||'material'),preview=firstThumbnail(item?.thumbnails||item?.previewData),source=clean(item?.url)||`https://ambientcg.com/view?id=${encodeURIComponent(id)}`;return{id:`ambientcg:${id}`,provider:'ambientcg',externalId:id,name:clean(item?.title||item?.displayName||id),category:type||'material',contentKind:kindOf(type),previewKind:'image',tags:Array.isArray(item?.tags)?item.tags.slice(0,30):[],previewUrl:preview,downloadUrl:null,sourceUrl:source,license:'CC0-1.0',author:'ambientCG',attributionRequired:false,ownership:'discovered',description:clean(item?.shortDescription||item?.longDescription||''),dimensions:dimensionsOf(item?.dimensions),downloadable:false,integrationReady:false,verified:true,catalogOnly:true,heavyExternal:true};}

export async function searchAmbientCgAssets(query='',options={}){
  const requested=Math.max(1,Number(options.limit)||24),limit=mobilePageBudget(requested,{heavy:true}),offset=Math.max(0,Number(options.offset)||0),params=new URLSearchParams({limit:String(limit),offset:String(offset),sort:'popular',include:'type,title,url,thumbnails,tags,dimensions,shortDescription'});
  if(clean(query))params.set('q',clean(query));
  const url=`${API}?${params.toString()}`,data=await fetchProviderJson('ambientcg',url,{ttlMs:10*60*1000,maxBytes:900_000,cacheKey:`ambientcg:${params.toString()}`}),rows=rowsOf(data),assets=rows.map(normalize).filter(a=>a.externalId);
  return{assets,offset,limit,total:Number(data?.total||data?.totalAssets||data?.numberOfResults||0)||null,hasMore:rows.length>=limit,engine:'ambientcg-v3-bounded'};
}
export function clearAmbientCgCache(){clearExternalProviderRuntimeCache('ambientcg:');}
