/* KELO-INDEX
 * area: CREATORS / EXTERNAL CONTENT / OPENVERSE
 * owner: Kelo Universal Content Bridge
 * keys: OPENVERSE IMAGE AUDIO CC0 PDM CC-BY LAZY DISCOVERY ATTRIBUTION PAGING
 * purpose: expose a tiny search window into Openverse's huge open-media catalog without bulk ingesting or trusting third-party license metadata as a local publication
 */
import {fetchProviderJson,mobilePageWindow,clearExternalProviderRuntimeCache} from './external-provider-runtime.mjs?v=3';

const API='https://api.openverse.org/v1';
function clean(value){return String(value??'').trim();}
function licenseLabel(row){const slug=clean(row?.license).toLowerCase(),version=clean(row?.license_version);if(slug==='cc0')return'CC0-1.0';if(slug==='pdm')return'PDM-1.0';if(slug==='by')return version?`CC-BY-${version}`:'CC-BY';return slug?slug.toUpperCase():'UNKNOWN';}
function normalize(row,index,media){const id=clean(row?.id||row?.identifier||`${media}-${index}`),license=licenseLabel(row),audio=media==='audio',creator=clean(row?.creator||row?.creator_url||'');return{id:`openverse-${media}:${id}`,provider:`openverse-${media}`,externalId:id,name:clean(row?.title||row?.original_filename||id),category:audio?'open-audio':'open-image',contentKind:audio?'sfx':'image',previewKind:audio?'audio':'image',tags:Array.isArray(row?.tags)?row.tags.map(tag=>clean(tag?.name||tag)).filter(Boolean).slice(0,30):[],previewUrl:audio?clean(row?.url):clean(row?.thumbnail||row?.url),downloadUrl:null,sourceUrl:clean(row?.foreign_landing_url||row?.detail_url||row?.url),license,author:creator||null,attributionRequired:license.startsWith('CC-BY'),ownership:'discovered',description:clean(row?.meta_data?.description||row?.description||''),downloadable:false,integrationReady:false,verified:false,catalogOnly:true,licenseReviewRequired:true,apiCredit:'Made using Openverse; not endorsed by Openverse',providerSource:clean(row?.source||row?.provider)};}

export async function searchOpenverseAssets(query='',options={}){
  const q=clean(query),media=options.media==='audio'?'audio':'images';if(!q)return{assets:[],offset:0,limit:0,total:0,hasMore:false,requiresQuery:true,engine:`openverse-${media}-v1`};
  const requested=Math.max(1,Number(options.limit)||20),window=mobilePageWindow(requested,options.offset,{heavy:false}),limit=window.limit,page=window.page,params=new URLSearchParams({q,page:String(page),page_size:String(limit),license:'cc0,pdm,by'}),providerId=`openverse-${media}`,data=await fetchProviderJson(providerId,`${API}/${media}/?${params.toString()}`,{ttlMs:8*60*1000,maxBytes:900_000,cacheKey:`${providerId}:${params.toString()}`}),rows=Array.isArray(data?.results)?data.results:[],assets=rows.map((row,index)=>normalize(row,index,media)),total=Number(data?.result_count||data?.total||0)||null,pageCount=Number(data?.page_count||0)||0;
  return{assets,offset:window.sourceOffset,limit,total,hasMore:pageCount?page<pageCount:total?window.offset+rows.length<total:rows.length>=limit,engine:`openverse-${media}-v1`};
}
export function clearOpenverseCache(){clearExternalProviderRuntimeCache('openverse-');}
