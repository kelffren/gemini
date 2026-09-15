/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / TRUST
 * purpose: select decoder/optimizer/oracle backends by capability and trust without letting AI become a security boundary
 * public-api: normalizeAssetBackend(), createAssetBackendRegistry(), chooseAssetBackend()
 */
const F=Object.freeze;
const TRUST=F({untrusted:0,advisory:1,validated:2,sandboxed:3});
const SECURITY_CAPABILITIES=F(['decode-untrusted','container-validate','pixel-canonicalize','runtime-encode']);
const ADVISORY_CAPABILITIES=F(['semantic-segmentation','depth-estimation','style-classification','repair-suggestion']);
const list=value=>F([...new Set((Array.isArray(value)?value:[]).map(String).filter(Boolean))]);
export function normalizeAssetBackend(raw={}){
 const trust=Object.hasOwn(TRUST,String(raw.trust))?String(raw.trust):'untrusted',capabilities=list(raw.capabilities),isolation=['worker','wasm-component','process','none'].includes(raw.isolation)?raw.isolation:'none';
 return F({id:String(raw.id||'backend'),version:String(raw.version||'unknown'),kind:String(raw.kind||'generic'),trust,isolation,capabilities,network:raw.network===true,filesystem:raw.filesystem===true,deterministic:raw.deterministic===true,authoritative:raw.authoritative===true});
}
export function chooseAssetBackend(backends,{capability,minTrust='validated',requireIsolation=false,requireDeterministic=false,allowNetwork=false}={}){
 const needed=String(capability||'');if(!needed)throw new Error('ASSET_BACKEND_CAPABILITY_REQUIRED');const threshold=TRUST[minTrust]??TRUST.validated;
 const candidates=(backends||[]).map(normalizeAssetBackend).filter(item=>item.capabilities.includes(needed)&&TRUST[item.trust]>=threshold&&(!requireIsolation||item.isolation!=='none')&&(!requireDeterministic||item.deterministic)&& (allowNetwork||!item.network));
 candidates.sort((a,b)=>TRUST[b.trust]-TRUST[a.trust]||(b.deterministic-a.deterministic)||a.id.localeCompare(b.id));const selected=candidates[0]||null;
 if(!selected)return F({selected:null,status:'UNAVAILABLE',capability:needed,reason:'NO_BACKEND_MEETS_TRUST_CONTRACT'});
 if(SECURITY_CAPABILITIES.includes(needed)&&selected.trust==='advisory')return F({selected:null,status:'REJECTED',capability:needed,reason:'ADVISORY_BACKEND_CANNOT_OWN_SECURITY'});
 return F({selected,status:'READY',capability:needed});
}
export function createAssetBackendRegistry(initial=[]){
 const map=new Map();for(const item of initial){const backend=normalizeAssetBackend(item);map.set(backend.id,backend);}return F({register(raw){const backend=normalizeAssetBackend(raw);map.set(backend.id,backend);return backend;},remove(id){return map.delete(String(id));},list(){return F([...map.values()].sort((a,b)=>a.id.localeCompare(b.id)));},choose(options){return chooseAssetBackend([...map.values()],options);}});
}
export const ASSET_BACKEND_TRUST=F({levels:TRUST,securityCapabilities:SECURITY_CAPABILITIES,advisoryCapabilities:ADVISORY_CAPABILITIES});
