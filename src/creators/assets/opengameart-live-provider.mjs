/* KELO-INDEX
 * area: CREATORS / EXTERNAL CONTENT PROVIDERS / OPENGAMEART
 * owner: Kelo Universal Content Bridge
 * keys: OPENGAMEART CC0 CURATED VERIFIED IMAGE ANIMATION AUDIO MUSIC AMBIENCE SFX PAGINATION
 * purpose: Expose only verified OpenGameArt content through a tiny local metadata index; never scrape OGA from client devices.
 */
const INDEX_URL=new URL('../../../data/opengameart-cc0-curated.json?v=3',import.meta.url).href;
let indexPromise=null;
const clean=v=>String(v??'').trim();const lower=v=>clean(v).toLowerCase();
async function loadIndex(){if(indexPromise)return indexPromise;indexPromise=fetch(INDEX_URL,{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('OGA_INDEX_'+response.status);const json=await response.json();if(!Array.isArray(json?.assets))throw new Error('OGA_INDEX_INVALID');return json;}).catch(error=>{indexPromise=null;throw error;});return indexPromise;}
function normalize(row){
  const contentKind=clean(row.contentKind||row.category||'image').toLowerCase();const audio=['sfx','music','ambience'].includes(contentKind);
  return {id:`opengameart:${clean(row.id)}`,provider:'opengameart',externalId:clean(row.id),name:clean(row.name),category:clean(row.category)||contentKind,contentKind,tags:Array.isArray(row.tags)?row.tags:[],description:`${clean(row.artType||'Content')} · verified OpenGameArt CC0`,previewUrl:row.previewUrl||row.downloadUrl||null,previewKind:audio?'audio':'image',downloadUrl:row.downloadUrl||null,sourceUrl:row.sourceUrl||'https://opengameart.org/',license:clean(row.license)||'UNKNOWN',author:clean(row.author)||null,attributionRequired:!!row.attributionRequired,ownership:'discovered',downloadable:!!row.downloadUrl,integrationReady:!!row.downloadUrl,bytesHint:Number(row.bytesHint||0)||0,fileName:clean(row.fileName)||null,loop:row.loop===true,verification:'kelo-curated-source-license-direct-file'};
}
export async function searchOpenGameArtAssets(query='',options={}){
  const data=await loadIndex(),q=lower(query),limit=Math.max(1,Math.min(Number(options.limit)||80,320)),offset=Math.max(0,Number(options.offset)||0);let rows=data.assets.map(normalize);
  if(q){const tokens=q.split(/\s+/).filter(Boolean);rows=rows.filter(asset=>{const hay=lower(`${asset.name} ${asset.category} ${asset.contentKind} ${asset.author||''} ${(asset.tags||[]).join(' ')}`);return tokens.every(token=>hay.includes(token));});}
  if(options.contentKind&&options.contentKind!=='all')rows=rows.filter(a=>a.contentKind===options.contentKind);
  return rows.slice(offset,offset+limit);
}
export function clearOpenGameArtCache(){indexPromise=null;}
export const OPENGAMEART_LIVE_PROVIDER=Object.freeze({search:searchOpenGameArtAssets,clearCache:clearOpenGameArtCache,indexUrl:INDEX_URL});
