/* KELO-INDEX
 * area: CREATORS / EXTERNAL ASSET PROVIDERS / OPENGAMEART
 * owner: Kelo Creator Asset Bridge
 * keys: OPENGAMEART CC0 CURATED VERIFIED DOWNLOAD ON DEMAND
 * purpose: Expose only verified OpenGameArt assets through a tiny local metadata index; never scrape OGA from client devices.
 */

const INDEX_URL='../../../data/opengameart-cc0-curated.json?v=1';
let indexPromise=null;

const clean=v=>String(v??'').trim();
const lower=v=>clean(v).toLowerCase();

async function loadIndex(){
  if(indexPromise)return indexPromise;
  indexPromise=fetch(INDEX_URL,{cache:'no-store'}).then(async response=>{
    if(!response.ok)throw new Error('OGA_INDEX_'+response.status);
    const json=await response.json();
    if(!Array.isArray(json?.assets))throw new Error('OGA_INDEX_INVALID');
    return json;
  }).catch(error=>{indexPromise=null;throw error;});
  return indexPromise;
}

function normalize(row){
  return {
    id:`opengameart:${clean(row.id)}`,
    provider:'opengameart',
    externalId:clean(row.id),
    name:clean(row.name),
    category:clean(row.category)||'2d',
    tags:Array.isArray(row.tags)?row.tags:[],
    description:`${clean(row.artType||'2D Art')} · verified OpenGameArt CC0`,
    previewUrl:row.previewUrl||row.downloadUrl||null,
    downloadUrl:row.downloadUrl||null,
    sourceUrl:row.sourceUrl||'https://opengameart.org/',
    license:clean(row.license)||'UNKNOWN',
    author:clean(row.author)||null,
    attributionRequired:!!row.attributionRequired,
    ownership:'discovered',
    downloadable:!!row.downloadUrl,
    integrationReady:!!row.downloadUrl,
    bytesHint:Number(row.bytesHint||0)||0,
    fileName:clean(row.fileName)||null,
    verification:'kelo-curated-source-license-direct-file'
  };
}

export async function searchOpenGameArtAssets(query='',options={}){
  const data=await loadIndex();
  const q=lower(query),limit=Math.max(1,Math.min(Number(options.limit)||160,320));
  let rows=data.assets.map(normalize);
  if(q){
    const tokens=q.split(/\s+/).filter(Boolean);
    rows=rows.filter(asset=>{
      const hay=lower(`${asset.name} ${asset.category} ${asset.author||''} ${(asset.tags||[]).join(' ')}`);
      return tokens.every(token=>hay.includes(token));
    });
  }
  return rows.slice(0,limit);
}

export function clearOpenGameArtCache(){indexPromise=null;}
export const OPENGAMEART_LIVE_PROVIDER=Object.freeze({search:searchOpenGameArtAssets,clearCache:clearOpenGameArtCache,indexUrl:INDEX_URL});
