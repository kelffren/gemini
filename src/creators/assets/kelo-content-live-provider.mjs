/* KELO-INDEX
 * area: CREATORS / UNIVERSAL CONTENT PROVIDERS
 * owner: Kelo Universal Content Bridge
 * keys: KELO CONTENT ABILITY SCENE PREFAB INLINE PAGINATION DESCRIPTOR SHA256 SIZE PUBLISHED
 * purpose: Expose tiny native declarative content packs through the same personal vault flow with published digest+size descriptors and a compatibility fallback.
 */
const INDEX_URL=new URL('../../../data/kelo-content-starter-catalog.json?v=3',import.meta.url).href;
const DESCRIPTORS_URL=new URL('../../../data/kelo-content-descriptors.json?v=1',import.meta.url).href;
let indexPromise=null;
const clean=v=>String(v??'').trim();
const lower=v=>clean(v).toLowerCase();
const encoder=new TextEncoder();
async function describeInlineManifest(value){
  if(!value)return{expectedBytes:null,expectedSha256:null,descriptorSource:'none'};
  const bytes=encoder.encode(JSON.stringify(value));
  if(!globalThis.crypto?.subtle)return{expectedBytes:bytes.byteLength,expectedSha256:null,descriptorSource:'client-fallback'};
  const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  const hex=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
  return{expectedBytes:bytes.byteLength,expectedSha256:`sha256:${hex}`,descriptorSource:'client-fallback'};
}
async function loadPublishedDescriptors(){
  try{
    const response=await fetch(DESCRIPTORS_URL,{cache:'no-store'});
    if(!response.ok)return null;
    const set=await response.json();
    if(set?.schema!=='kelo-content-descriptors-v1'||set?.algorithm!=='sha256'||!Array.isArray(set.descriptors))return null;
    const map=new Map();
    for(const descriptor of set.descriptors){
      const id=clean(descriptor?.id),size=Number(descriptor?.size),digest=clean(descriptor?.digest);
      if(!id||!Number.isSafeInteger(size)||size<0||!/^sha256:[0-9a-f]{64}$/.test(digest))return null;
      if(map.has(id))return null;
      map.set(id,{expectedBytes:size,expectedSha256:digest,descriptorSource:'published'});
    }
    return{set,map};
  }catch{return null;}
}
async function loadIndex(){
  if(indexPromise)return indexPromise;
  indexPromise=Promise.all([
    fetch(INDEX_URL,{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error('KELO_CONTENT_INDEX_'+r.status);return r.json();}),
    loadPublishedDescriptors()
  ]).then(async([json,published])=>{
    if(!Array.isArray(json?.assets))throw new Error('KELO_CONTENT_INDEX_INVALID');
    const publishedUsable=published&&Number(published.set.sourceVersion)===Number(json.version)&&published.map.size===json.assets.length;
    const assets=await Promise.all(json.assets.map(async row=>{
      const descriptor=publishedUsable?published.map.get(clean(row.id)):null;
      return{...row,...(descriptor||await describeInlineManifest(row.inlineManifest))};
    }));
    return{...json,assets,descriptorSource:publishedUsable?'published':'client-fallback'};
  }).catch(error=>{indexPromise=null;throw error;});
  return indexPromise;
}
function normalize(row){
  const kind=clean(row.contentKind||row.category||'other').toLowerCase(),expectedBytes=Number.isSafeInteger(row.expectedBytes)&&row.expectedBytes>=0?row.expectedBytes:null;
  return {id:`kelo-content:${clean(row.id)}`,provider:'kelo-content',externalId:clean(row.id),name:clean(row.name||row.id),category:clean(row.category||kind),contentKind:kind,tags:Array.isArray(row.tags)?row.tags:[],description:`Kelo declarative ${kind} · no executable code`,previewUrl:null,previewKind:'manifest',downloadUrl:null,sourceUrl:'https://github.com/kelffren/gemini',license:clean(row.license||'KELO-NATIVE'),author:clean(row.author||'Kelo World'),attributionRequired:false,ownership:'discovered',downloadable:true,integrationReady:true,inlineManifest:row.inlineManifest||null,expectedBytes,bytes:expectedBytes||0,expectedSha256:clean(row.expectedSha256)||null,descriptorSource:clean(row.descriptorSource)||'unknown'};
}
export async function searchKeloContent(query='',options={}){
  const data=await loadIndex(),q=lower(query),limit=Math.max(1,Math.min(Number(options.limit)||80,320)),offset=Math.max(0,Number(options.offset)||0);let rows=data.assets.map(normalize);
  if(q){const tokens=q.split(/\s+/).filter(Boolean);rows=rows.filter(a=>{const hay=lower(`${a.name} ${a.category} ${a.contentKind} ${(a.tags||[]).join(' ')}`);return tokens.every(t=>hay.includes(t));});}
  if(options.contentKind&&options.contentKind!=='all')rows=rows.filter(a=>a.contentKind===options.contentKind);
  return rows.slice(offset,offset+limit);
}
export function clearKeloContentCache(){indexPromise=null;}
export const KELO_CONTENT_LIVE_PROVIDER=Object.freeze({search:searchKeloContent,clearCache:clearKeloContentCache,indexUrl:INDEX_URL,descriptorsUrl:DESCRIPTORS_URL});
