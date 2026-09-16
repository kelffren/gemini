/* KELO-INDEX
 * area: CREATORS / UNIVERSAL CONTENT PROVIDERS
 * owner: Kelo Universal Content Bridge
 * keys: KELO CONTENT ABILITY SCENE PREFAB INLINE PAGINATION DESCRIPTOR SHA256 SIZE
 * purpose: Expose tiny native declarative content packs through the same personal vault flow with verified digest+size descriptors.
 */
const INDEX_URL=new URL('../../../data/kelo-content-starter-catalog.json?v=3',import.meta.url).href;
let indexPromise=null;
const clean=v=>String(v??'').trim();
const lower=v=>clean(v).toLowerCase();
const encoder=new TextEncoder();
async function describeInlineManifest(value){
  if(!value)return{expectedBytes:null,expectedSha256:null};
  const bytes=encoder.encode(JSON.stringify(value));
  if(!globalThis.crypto?.subtle)return{expectedBytes:bytes.byteLength,expectedSha256:null};
  const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  const hex=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
  return{expectedBytes:bytes.byteLength,expectedSha256:`sha256:${hex}`};
}
async function loadIndex(){
  if(indexPromise)return indexPromise;
  indexPromise=fetch(INDEX_URL,{cache:'no-store'}).then(async r=>{
    if(!r.ok)throw new Error('KELO_CONTENT_INDEX_'+r.status);
    const json=await r.json();
    if(!Array.isArray(json?.assets))throw new Error('KELO_CONTENT_INDEX_INVALID');
    const assets=await Promise.all(json.assets.map(async row=>({...row,...await describeInlineManifest(row.inlineManifest)})));
    return{...json,assets};
  }).catch(error=>{indexPromise=null;throw error;});
  return indexPromise;
}
function normalize(row){
  const kind=clean(row.contentKind||row.category||'other').toLowerCase(),expectedBytes=Number.isSafeInteger(row.expectedBytes)&&row.expectedBytes>=0?row.expectedBytes:null;
  return {id:`kelo-content:${clean(row.id)}`,provider:'kelo-content',externalId:clean(row.id),name:clean(row.name||row.id),category:clean(row.category||kind),contentKind:kind,tags:Array.isArray(row.tags)?row.tags:[],description:`Kelo declarative ${kind} · no executable code`,previewUrl:null,previewKind:'manifest',downloadUrl:null,sourceUrl:'https://github.com/kelffren/gemini',license:clean(row.license||'KELO-NATIVE'),author:clean(row.author||'Kelo World'),attributionRequired:false,ownership:'discovered',downloadable:true,integrationReady:true,inlineManifest:row.inlineManifest||null,expectedBytes,bytes:expectedBytes||0,expectedSha256:clean(row.expectedSha256)||null};
}
export async function searchKeloContent(query='',options={}){
  const data=await loadIndex(),q=lower(query),limit=Math.max(1,Math.min(Number(options.limit)||80,320)),offset=Math.max(0,Number(options.offset)||0);let rows=data.assets.map(normalize);
  if(q){const tokens=q.split(/\s+/).filter(Boolean);rows=rows.filter(a=>{const hay=lower(`${a.name} ${a.category} ${a.contentKind} ${(a.tags||[]).join(' ')}`);return tokens.every(t=>hay.includes(t));});}
  if(options.contentKind&&options.contentKind!=='all')rows=rows.filter(a=>a.contentKind===options.contentKind);
  return rows.slice(offset,offset+limit);
}
export function clearKeloContentCache(){indexPromise=null;}
export const KELO_CONTENT_LIVE_PROVIDER=Object.freeze({search:searchKeloContent,clearCache:clearKeloContentCache,indexUrl:INDEX_URL});
