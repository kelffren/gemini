/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / HARDENING
 * purpose: stable cache/build identity for source + config + compiler version
 * public-api: fingerprintAssetBuild()
 */
const F=Object.freeze;
function stable(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;}
function hex(bytes){return [...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function digest(bytes,root){const subtle=root?.crypto?.subtle;if(!subtle)throw new Error('ASSET_FINGERPRINT_CRYPTO_UNAVAILABLE');return new Uint8Array(await subtle.digest('SHA-256',bytes));}
export async function fingerprintAssetBuild(file,{config={},compilerVersion='unknown',root=globalThis}={}){
 if(!file||typeof file.arrayBuffer!=='function')throw new Error('ASSET_FINGERPRINT_FILE_REQUIRED');
 const source=new Uint8Array(await file.arrayBuffer()),meta=new TextEncoder().encode(stable({compilerVersion,config,name:String(file.name||''),type:String(file.type||''),size:Number(file.size)||source.length})),joined=new Uint8Array(source.length+meta.length);joined.set(source);joined.set(meta,source.length);const hash=hex(await digest(joined,root));
 return F({schema:'kelo-asset-build-fingerprint-v1',algorithm:'sha-256',hash,id:`asset-${hash.slice(0,24)}`,compilerVersion,sourceBytes:source.length});
}
export const __assetBuildFingerprint=F({stable,hex});