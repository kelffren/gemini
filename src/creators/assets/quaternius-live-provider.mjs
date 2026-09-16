/* KELO-INDEX
 * area: CREATORS / EXTERNAL CONTENT PROVIDERS
 * owner: Kelo Universal Content Bridge
 * keys: QUATERNIUS CC0 3D MODEL CURATED LAZY CATALOG
 * purpose: Search a small verified Quaternius CC0 pack index without loading model binaries.
 */
const INDEX_URL=new URL('../../../data/quaternius-curated.json?v=1',import.meta.url).href;
let cache=null;
const clean=v=>String(v??'').trim();
function matches(row,q){if(!q)return true;const hay=`${row.name} ${row.category} ${row.description||''} ${(row.tags||[]).join(' ')} ${(row.formats||[]).join(' ')}`.toLowerCase();return q.split(/\s+/).filter(Boolean).every(token=>hay.includes(token));}
async function load(){if(cache)return cache;cache=fetch(INDEX_URL,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('QUATERNIUS_INDEX_'+r.status);return r.json();}).then(json=>Array.isArray(json.assets)?json.assets:[]).catch(error=>{cache=null;throw error;});return cache;}
export async function searchQuaterniusAssets(query='',options={}){const offset=Math.max(0,Number(options.offset)||0),limit=Math.max(1,Math.min(Number(options.limit)||80,320)),q=clean(query).toLowerCase();let rows=(await load()).filter(row=>matches(row,q));if(options.contentKind&&options.contentKind!=='all')rows=rows.filter(row=>row.contentKind===options.contentKind);const assets=rows.slice(offset,offset+limit).map(row=>({...row,provider:'quaternius',externalId:row.id.replace(/^quaternius:/,''),license:'CC0-1.0',author:'Quaternius',attributionRequired:false,ownership:'discovered',previewKind:'model',downloadUrl:null,downloadable:false,integrationReady:false,catalogOnly:true,verified:true}));return{assets,offset,limit,total:rows.length,hasMore:offset+assets.length<rows.length,engine:'curated-cc0-pack-index'};}
export function clearQuaterniusCache(){cache=null;}
