/* KELO-INDEX
 * area: CREATORS / UNIVERSAL CONTENT PROVIDERS
 * owner: Kelo Universal Content Bridge
 * keys: KELO CONTENT ABILITY SCENE PREFAB INLINE
 * purpose: Expose tiny native declarative content packs through the same personal vault flow.
 */
const INDEX_URL='../../../data/kelo-content-starter-catalog.json?v=1';
let indexPromise=null;
const clean=v=>String(v??'').trim();
const lower=v=>clean(v).toLowerCase();

async function loadIndex(){
  if(indexPromise)return indexPromise;
  indexPromise=fetch(INDEX_URL,{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error('KELO_CONTENT_INDEX_'+r.status);const json=await r.json();if(!Array.isArray(json?.assets))throw new Error('KELO_CONTENT_INDEX_INVALID');return json;}).catch(error=>{indexPromise=null;throw error;});
  return indexPromise;
}
function normalize(row){
  const kind=clean(row.contentKind||row.category||'other').toLowerCase();
  return {id:`kelo-content:${clean(row.id)}`,provider:'kelo-content',externalId:clean(row.id),name:clean(row.name||row.id),category:clean(row.category||kind),contentKind:kind,tags:Array.isArray(row.tags)?row.tags:[],description:`Kelo declarative ${kind} · no executable code`,previewUrl:null,previewKind:'manifest',downloadUrl:null,sourceUrl:'https://github.com/kelffren/gemini',license:clean(row.license||'KELO-NATIVE'),author:clean(row.author||'Kelo World'),attributionRequired:false,ownership:'discovered',downloadable:true,integrationReady:true,inlineManifest:row.inlineManifest||null};
}
export async function searchKeloContent(query='',options={}){
  const data=await loadIndex(),q=lower(query),limit=Math.max(1,Math.min(Number(options.limit)||160,320));let rows=data.assets.map(normalize);
  if(q){const tokens=q.split(/\s+/).filter(Boolean);rows=rows.filter(a=>{const hay=lower(`${a.name} ${a.category} ${a.contentKind} ${(a.tags||[]).join(' ')}`);return tokens.every(t=>hay.includes(t));});}
  if(options.contentKind&&options.contentKind!=='all')rows=rows.filter(a=>a.contentKind===options.contentKind);
  return rows.slice(0,limit);
}
export function clearKeloContentCache(){indexPromise=null;}
export const KELO_CONTENT_LIVE_PROVIDER=Object.freeze({search:searchKeloContent,clearCache:clearKeloContentCache,indexUrl:INDEX_URL});
