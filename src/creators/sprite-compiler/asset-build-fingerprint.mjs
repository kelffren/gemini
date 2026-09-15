/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / HARDENING
 * purpose: stable content/build identity for source + canonical config + compiler version
 * public-api: fingerprintAssetBuild()
 */
const F=Object.freeze;
function canonicalize(value,{depth=0,maxDepth=20,seen=new WeakSet()}={}){
 if(depth>maxDepth)throw new Error('ASSET_FINGERPRINT_CONFIG_DEPTH_LIMIT');if(value===null)return null;const type=typeof value;
 if(type==='string'||type==='boolean')return value;if(type==='number'){if(!Number.isFinite(value))throw new Error('ASSET_FINGERPRINT_NONFINITE_NUMBER');return Object.is(value,-0)?0:value;}
 if(type==='undefined'||type==='function'||type==='symbol')return undefined;if(type==='bigint')throw new Error('ASSET_FINGERPRINT_BIGINT_UNSUPPORTED');
 if(ArrayBuffer.isView(value)||value instanceof ArrayBuffer)throw new Error('ASSET_FINGERPRINT_BINARY_CONFIG_UNSUPPORTED');if(value instanceof Date)return value.toISOString();if(type!=='object')throw new Error('ASSET_FINGERPRINT_CONFIG_UNSUPPORTED');if(seen.has(value))throw new Error('ASSET_FINGERPRINT_CONFIG_CYCLE');seen.add(value);
 try{if(Array.isArray(value))return value.map(item=>canonicalize(item,{depth:depth+1,maxDepth,seen})??null);const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)throw new Error('ASSET_FINGERPRINT_NONPLAIN_CONFIG');const out={};for(const key of Object.keys(value).sort()){if(key.startsWith('_'))continue;const normalized=canonicalize(value[key],{depth:depth+1,maxDepth,seen});if(normalized!==undefined)out[key]=normalized;}return out;}finally{seen.delete(value);}
}
function stable(value,options={}){return JSON.stringify(canonicalize(value,options));}
function hex(bytes){return [...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function digest(bytes,root){const subtle=root?.crypto?.subtle;if(!subtle)throw new Error('ASSET_FINGERPRINT_CRYPTO_UNAVAILABLE');return new Uint8Array(await subtle.digest('SHA-256',bytes));}
export async function fingerprintAssetBuild(file,{config={},compilerVersion='unknown',root=globalThis,maxCanonicalConfigBytes=1024*1024}={}){
 if(!file||typeof file.arrayBuffer!=='function')throw new Error('ASSET_FINGERPRINT_FILE_REQUIRED');const source=new Uint8Array(await file.arrayBuffer()),sourceHash=hex(await digest(source,root)),canonicalConfig=stable(config),configBytes=new TextEncoder().encode(canonicalConfig);if(configBytes.length>maxCanonicalConfigBytes)throw new Error('ASSET_FINGERPRINT_CONFIG_TOO_LARGE');const meta=new TextEncoder().encode(stable({sourceHash,compilerVersion:String(compilerVersion),config:JSON.parse(canonicalConfig)})),buildHash=hex(await digest(meta,root));
 return F({schema:'kelo-asset-build-fingerprint-v2',algorithm:'sha-256',hash:buildHash,buildHash,sourceHash,id:`asset-${buildHash.slice(0,24)}`,compilerVersion:String(compilerVersion),sourceBytes:source.length,canonicalConfigBytes:configBytes.length});
}
export const __assetBuildFingerprint=F({canonicalize,stable,hex});