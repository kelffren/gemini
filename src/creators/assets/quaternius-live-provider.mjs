/* KELO-INDEX
 * area: CREATORS / EXTERNAL CONTENT PROVIDERS
 * owner: Kelo Universal Content Bridge
 * keys: QUATERNIUS CC0 3D MODEL CURATED LAZY CATALOG FEDERATED DOWNLOADABLE PREVIEW
 * purpose: Search a verified Quaternius CC0 pack index without loading model binaries,
 *          and expose per-pack Google Drive download folders so the federated vault
 *          can actually download and integrate packs instead of only opening the source.
 */
const INDEX_URL=new URL('../../../data/quaternius-curated.json?v=2',import.meta.url).href;
const PREVIEW_BASE='https://quaternius.com';
let cache=null;
const clean=v=>String(v??'').trim();
function matches(row,q){if(!q)return true;const hay=`${row.name} ${row.category} ${row.description||''} ${(row.tags||[]).join(' ')} ${(row.formats||[]).join(' ')}`.toLowerCase();return q.split(/\s+/).filter(Boolean).every(token=>hay.includes(token));}
async function load(){if(cache)return cache;cache=fetch(INDEX_URL,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('QUATERNIUS_INDEX_'+r.status);return r.json();}).then(json=>Array.isArray(json.assets)?json.assets:[]).catch(error=>{cache=null;throw error;});return cache;}
function toAsset(row){const preview=row.previewPath?PREVIEW_BASE+row.previewPath:null;return{...row,provider:'quaternius',externalId:clean(row.id).replace(/^quaternius:/,''),license:'CC0-1.0',author:'Quaternius',attributionRequired:false,ownership:'discovered',previewKind:'image',previewUrl:preview,downloadUrl:row.driveUrl||null,sourceUrl:row.sourceUrl||null,downloadable:!!row.driveUrl,integrationReady:false,catalogOnly:false,verified:true,heavyExternal:true};}
export async function searchQuaterniusAssets(query='',options={}){const offset=Math.max(0,Number(options.offset)||0),limit=Math.max(1,Math.min(Number(options.limit)||80,320)),q=clean(query).toLowerCase();let rows=(await load()).filter(row=>matches(row,q));if(options.contentKind&&options.contentKind!=='all')rows=rows.filter(row=>row.contentKind===options.contentKind);const assets=rows.slice(offset,offset+limit).map(toAsset);return{assets,offset,limit,total:rows.length,hasMore:offset+assets.length<rows.length,engine:'curated-cc0-pack-index-v2'};}
export function clearQuaterniusCache(){cache=null;}
