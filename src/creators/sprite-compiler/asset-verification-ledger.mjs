/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / TRUST
 * purpose: append-only hash-chained evidence ledger with externally anchorable trusted head
 * public-api: createAssetVerificationLedger(), verifyAssetVerificationLedger()
 */
const F=Object.freeze;
function stable(value,seen=new WeakSet()){
 if(value===null)return'null';const type=typeof value;if(type==='string'||type==='boolean')return JSON.stringify(value);if(type==='number'){if(!Number.isFinite(value))throw new Error('ASSET_LEDGER_NONFINITE_NUMBER');return JSON.stringify(Object.is(value,-0)?0:value);}if(type==='undefined'||type==='function'||type==='symbol'||type==='bigint')throw new Error('ASSET_LEDGER_NON_JSON_VALUE');if(type!=='object')throw new Error('ASSET_LEDGER_VALUE_UNSUPPORTED');if(seen.has(value))throw new Error('ASSET_LEDGER_CYCLE');if(ArrayBuffer.isView(value)||value instanceof ArrayBuffer)throw new Error('ASSET_LEDGER_BINARY_VALUE_UNSUPPORTED');seen.add(value);try{if(Array.isArray(value))return`[${value.map(item=>stable(item,seen)).join(',')}]`;const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)throw new Error('ASSET_LEDGER_NONPLAIN_OBJECT');return`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stable(value[k],seen)}`).join(',')}}`;}finally{seen.delete(value);}
}
function hex(bytes){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function sha256(value,root=globalThis){if(!root.crypto?.subtle)throw new Error('ASSET_LEDGER_CRYPTO_UNAVAILABLE');return hex(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(value))));}

export function createAssetVerificationLedger({assetId='unknown',root=globalThis,clock=()=>Date.now()}={}){
 let entries=[];const id=String(assetId);
 async function append(type,payload={},meta={}){const previousHash=entries.at(-1)?.hash||null,index=entries.length,record=F({index,assetId:id,type:String(type),payload,meta,timestamp:Number(clock()),previousHash}),hash=await sha256(record,root),entry=F({...record,hash});entries=[...entries,entry];return entry;}
 function seal(){return F({schema:'kelo-asset-ledger-head-v1',assetId:id,entries:entries.length,head:entries.at(-1)?.hash||null});}
 return F({append,seal,entries:()=>F([...entries]),async verify(options={}){return verifyAssetVerificationLedger(entries,{root,...options});}});
}

export async function verifyAssetVerificationLedger(entries,{root=globalThis,expectedHead=null,expectedEntries=null}={}){
 let previousHash=null;for(let index=0;index<(entries||[]).length;index++){const entry=entries[index];if(entry.index!==index||entry.previousHash!==previousHash)return F({valid:false,index,reason:'CHAIN_LINK_MISMATCH'});const {hash,...record}=entry,expected=await sha256(record,root);if(hash!==expected)return F({valid:false,index,reason:'HASH_MISMATCH'});previousHash=hash;}
 if(expectedEntries!==null&&Number(expectedEntries)!==(entries||[]).length)return F({valid:false,index:(entries||[]).length,reason:'ENTRY_COUNT_MISMATCH',head:previousHash});if(expectedHead!==null&&String(expectedHead)!==String(previousHash))return F({valid:false,index:(entries||[]).length,reason:'TRUSTED_HEAD_MISMATCH',head:previousHash});return F({valid:true,entries:(entries||[]).length,head:previousHash,anchored:expectedHead!==null});
}

export const __assetVerificationLedger=F({stable,sha256});
