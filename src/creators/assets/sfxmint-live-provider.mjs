/* KELO-INDEX
 * area: CREATORS / EXTERNAL CONTENT / SFXMINT
 * owner: Kelo Universal Content Bridge
 * keys: SFXMINT CC0 AUDIO SFX CORS IMMUTABLE SEARCH LAZY MOBILE
 * purpose: search SFXMint without mirroring its catalog; direct CC0 audio is previewed/downloaded only after explicit user interaction
 */
import {fetchProviderJson,mobilePageWindow,clearExternalProviderRuntimeCache} from './external-provider-runtime.mjs?v=1';

const API='https://sfxmint.com/api/v1/search';
function clean(value){return String(value??'').trim();}
function rowsOf(data){if(Array.isArray(data))return data;if(Array.isArray(data?.results))return data.results;if(Array.isArray(data?.candidates))return data.candidates;if(Array.isArray(data?.sounds))return data.sounds;if(Array.isArray(data?.matches))return data.matches;return[];}
function tagsOf(row){return Array.isArray(row?.tags)?row.tags.map(tag=>clean(tag?.name||tag)).filter(Boolean).slice(0,30):[];}
function normalize(row,index){
  const slug=clean(row?.slug||row?.id||`sound-${index}`),mp3=clean(row?.mp3_url||row?.mp3Url||row?.urls?.mp3||row?.download_urls?.mp3),wav=clean(row?.wav_url||row?.wavUrl||row?.urls?.wav||row?.download_urls?.wav),audio=mp3||wav,license=clean(row?.license||'CC0-1.0').toUpperCase().includes('CC0')?'CC0-1.0':clean(row?.license||'CC0-1.0');
  return{id:`sfxmint:${slug}`,provider:'sfxmint',externalId:slug,name:clean(row?.title||row?.name||slug),category:clean(row?.category||'sound-effect').toLowerCase(),contentKind:'sfx',previewKind:'audio',tags:tagsOf(row),previewUrl:audio||null,downloadUrl:audio||null,sourceUrl:`https://sfxmint.com/api/v1/sounds/${encodeURIComponent(slug)}`,license,author:'SFXMint',attributionRequired:false,ownership:'discovered',description:clean(row?.prompt||row?.description||''),downloadable:!!audio,integrationReady:!!audio,verified:license==='CC0-1.0',catalogOnly:false,mime:mp3?'audio/mpeg':wav?'audio/wav':null,durationHint:Number(row?.duration_ms||row?.durationMs||0)>0?Number(row?.duration_ms||row?.durationMs)/1000:Number(row?.duration||0)||null,loop:row?.loopable===true||row?.loop===true,wavUrl:wav||null,immutableRemote:true};
}

export async function searchSfxMintAssets(query='',options={}){
  const q=clean(query);if(!q)return{assets:[],offset:0,limit:0,total:0,hasMore:false,requiresQuery:true,engine:'sfxmint-v1-bounded'};
  const window=mobilePageWindow(Math.max(1,Number(options.limit)||24),Math.max(0,Number(options.offset)||0),{heavy:false});
  // SFXMint search is relevance-limited rather than offset-paged; only page 1 is queried so mobile paging can never repeat or skip assets.
  if(window.pageIndex>0)return{assets:[],offset:window.offset,limit:window.limit,total:null,hasMore:false,requiresQuery:true,engine:'sfxmint-v1-bounded'};
  const params=new URLSearchParams({q,limit:String(window.limit)}),data=await fetchProviderJson('sfxmint',`${API}?${params.toString()}`,{ttlMs:12*60*1000,maxBytes:650_000,cacheKey:`sfxmint:${params.toString()}`}),rows=rowsOf(data),assets=rows.map(normalize).filter(row=>row.externalId&&row.previewUrl);
  return{assets,offset:0,limit:window.limit,total:Number(data?.total||data?.result_count||0)||null,hasMore:false,requiresQuery:true,engine:'sfxmint-v1-bounded'};
}
export function clearSfxMintCache(){clearExternalProviderRuntimeCache('sfxmint:');}
