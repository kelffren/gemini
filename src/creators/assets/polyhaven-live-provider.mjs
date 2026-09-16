/* KELO-INDEX
 * area: CREATORS / EXTERNAL CONTENT / POLY HAVEN
 * owner: Kelo Universal Content Bridge
 * keys: POLY HAVEN CC0 SEARCH API MODEL TEXTURE HDRI LAZY MOBILE PAGING KIND-GATE
 * purpose: query Poly Haven without ever downloading its full catalog; top ranked slugs hydrate metadata with bounded concurrency and cached detail calls
 */
import {fetchProviderJson,mobilePageWindow,clearExternalProviderRuntimeCache} from './external-provider-runtime.mjs?v=3';

const API='https://api.polyhaven.com';
const SUPPORTED_KINDS=new Set(['texture','model','hdri']);
function clean(value){return String(value??'').trim();}
function typeKind(type){const n=Number(type);return n===0?'hdri':n===2?'model':'texture';}
function resultRows(data){return Array.isArray(data?.results)?data.results:Array.isArray(data)?data:[];}
function normalize(slug,info={}){const id=clean(slug),authors=info?.authors&&typeof info.authors==='object'?Object.keys(info.authors):[];return{id:`polyhaven:${id}`,provider:'polyhaven',externalId:id,name:clean(info?.name||id),category:clean(info?.category||typeKind(info?.type)),contentKind:typeKind(info?.type),previewKind:'image',tags:Array.isArray(info?.tags)?info.tags.slice(0,30):[],previewUrl:clean(info?.thumbnail_url)||`https://cdn.polyhaven.com/asset_img/thumbs/${encodeURIComponent(id)}.png?width=256&height=256`,downloadUrl:null,sourceUrl:`https://polyhaven.com/a/${encodeURIComponent(id)}`,license:'CC0-1.0',author:authors.join(', ')||'Poly Haven contributors',authors,attributionRequired:false,ownership:'discovered',description:clean(info?.description||''),downloadable:false,integrationReady:false,verified:true,catalogOnly:true,heavyExternal:true,apiCredit:'Powered by Poly Haven'};}

export async function searchPolyHavenAssets(query='',options={}){
  const q=clean(query);if(!q)return{assets:[],offset:0,limit:0,total:0,hasMore:false,requiresQuery:true,engine:'polyhaven-search-v1'};
  const contentKind=clean(options.contentKind).toLowerCase();if(contentKind&&contentKind!=='all'&&!SUPPORTED_KINDS.has(contentKind))return{assets:[],offset:Math.max(0,Number(options.offset)||0),limit:0,total:0,hasMore:false,kindSkipped:true,engine:'polyhaven-search-v1'};
  const requested=Math.max(1,Number(options.limit)||16),window=mobilePageWindow(requested,options.offset,{heavy:true}),limit=window.limit,apiOffset=window.offset,rankLimit=Math.min(60,apiOffset+limit),searchParams=new URLSearchParams({q:q.toLowerCase(),limit:String(rankLimit)}),search=await fetchProviderJson('polyhaven',`${API}/search?${searchParams.toString()}`,{ttlMs:10*60*1000,maxBytes:250_000,cacheKey:`polyhaven:search:${searchParams.toString()}`}),ranked=resultRows(search).slice(apiOffset,apiOffset+limit),details=await Promise.allSettled(ranked.map(row=>{const slug=clean(row?.slug||row?.id||row);return slug?fetchProviderJson('polyhaven',`${API}/info/${encodeURIComponent(slug)}`,{ttlMs:30*60*1000,maxBytes:180_000,cacheKey:`polyhaven:info:${slug}`}):Promise.reject(new Error('POLYHAVEN_SLUG_MISSING'));})),assets=[];
  for(let i=0;i<ranked.length;i++){const slug=clean(ranked[i]?.slug||ranked[i]?.id||ranked[i]);const detail=details[i];if(slug&&detail?.status==='fulfilled')assets.push(normalize(slug,detail.value));}
  const total=Math.max(assets.length,Number(search?.total||0)||0);return{assets,offset:window.sourceOffset,limit,total,hasMore:apiOffset+ranked.length<total,engine:'polyhaven-search-v1'};
}
export function clearPolyHavenCache(){clearExternalProviderRuntimeCache('polyhaven:');}
