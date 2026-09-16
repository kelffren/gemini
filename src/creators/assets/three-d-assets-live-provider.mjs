/* KELO-INDEX
 * area: CREATORS / EXTERNAL CONTENT / 3DASSETS.DEV
 * owner: Kelo Universal Content Bridge
 * keys: 3DASSETS CC0 GLB SEARCH API MODEL LAZY MOBILE
 * purpose: search the public CC0 GLB catalog without mirroring models or preloading model bytes on player devices
 */
import {fetchProviderJson,mobilePageBudget,clearExternalProviderRuntimeCache} from './external-provider-runtime.mjs?v=1';

const API='https://3dassets.dev/api/v1/assets';
function clean(value){return String(value??'').trim();}
function rowsOf(data){if(Array.isArray(data))return data;if(Array.isArray(data?.assets))return data.assets;if(Array.isArray(data?.items))return data.items;if(Array.isArray(data?.results))return data.results;return[];}
function valueName(value){if(typeof value==='string')return value;if(value&&typeof value==='object')return clean(value.name||value.title||value.slug||value.id);return'';}
function thumbnailOf(item){return clean(item?.thumbnailUrl||item?.previewUrl||item?.thumbnail?.url||item?.preview?.url||item?.image?.url||item?.posterUrl);}
function slugOf(item,index){return clean(item?.slug||item?.id||item?.assetSlug||`asset-${index}`);}
function normalize(item,index){
  const slug=slugOf(item,index),contributor=item?.contributor||item?.creator||{},category=valueName(item?.category)||'3d-model',tags=Array.isArray(item?.tags)?item.tags.map(valueName).filter(Boolean).slice(0,30):[];
  return{id:`3dassets:${slug}`,provider:'3dassets',externalId:slug,name:clean(item?.title||item?.name||slug),category,contentKind:'model',previewKind:'image',tags,previewUrl:thumbnailOf(item)||null,downloadUrl:null,sourceUrl:`https://3dassets.dev/assets/${encodeURIComponent(slug)}`,license:'CC0-1.0',author:clean(contributor?.name||contributor?.username||item?.author)||'3DAssets.dev contributor',attributionRequired:false,ownership:'discovered',description:clean(item?.summary||item?.description||''),downloadable:false,integrationReady:false,verified:true,catalogOnly:true,heavyExternal:true,remoteCdnUrl:clean(item?.cdnUrl||item?.downloadUrl)||null,bytes:Number(item?.bytes||item?.fileSize||item?.sizeBytes||0)||0};
}

export async function searchThreeDAssets(query='',options={}){
  const q=clean(query);if(!q)return{assets:[],offset:0,limit:0,total:0,hasMore:false,requiresQuery:true,engine:'3dassets-v1-bounded'};
  const requested=Math.max(1,Number(options.limit)||16),limit=mobilePageBudget(requested,{heavy:true}),offset=Math.max(0,Number(options.offset)||0),page=Math.floor(offset/limit)+1,params=new URLSearchParams({q,sort:'relevance',page:String(page),limit:String(limit)}),data=await fetchProviderJson('3dassets',`${API}?${params.toString()}`,{ttlMs:12*60*1000,maxBytes:800_000,cacheKey:`3dassets:${params.toString()}`}),rows=rowsOf(data),assets=rows.map(normalize).filter(row=>row.externalId),total=Number(data?.total||data?.count||data?.pagination?.total||data?.meta?.total||0)||null,totalPages=Number(data?.pages||data?.pageCount||data?.pagination?.pages||data?.meta?.pageCount||0)||0;
  return{assets,offset,limit,total,hasMore:totalPages?page<totalPages:total?offset+rows.length<total:rows.length>=limit,engine:'3dassets-v1-bounded'};
}
export function clearThreeDAssetsCache(){clearExternalProviderRuntimeCache('3dassets:');}
