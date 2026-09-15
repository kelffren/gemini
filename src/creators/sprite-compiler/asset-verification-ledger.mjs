/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / TRUST
 * purpose: append-only hash-chained evidence ledger for asset compilation and review
 * public-api: createAssetVerificationLedger(), verifyAssetVerificationLedger()
 */
const F=Object.freeze;
function stable(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;}
function hex(bytes){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function sha256(value,root=globalThis){if(!root.crypto?.subtle)throw new Error('ASSET_LEDGER_CRYPTO_UNAVAILABLE');return hex(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(value))));}

export function createAssetVerificationLedger({assetId='unknown',root=globalThis,clock=()=>Date.now()}={}){
 let entries=[];
 async function append(type,payload={},meta={}){const previousHash=entries.at(-1)?.hash||null,index=entries.length,record=F({index,assetId:String(assetId),type:String(type),payload,meta,timestamp:Number(clock()),previousHash}),hash=await sha256(record,root),entry=F({...record,hash});entries=[...entries,entry];return entry;}
 return F({append,entries:()=>F([...entries]),async verify(){return verifyAssetVerificationLedger(entries,{root});}});
}

export async function verifyAssetVerificationLedger(entries,{root=globalThis}={}){
 let previousHash=null;for(let index=0;index<(entries||[]).length;index++){const entry=entries[index];if(entry.index!==index||entry.previousHash!==previousHash)return F({valid:false,index,reason:'CHAIN_LINK_MISMATCH'});const {hash,...record}=entry,expected=await sha256(record,root);if(hash!==expected)return F({valid:false,index,reason:'HASH_MISMATCH'});previousHash=hash;}
 return F({valid:true,entries:(entries||[]).length,head:previousHash});
}

export const __assetVerificationLedger=F({stable,sha256});
