/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / HARDENING
 * purpose: stage compiler outputs and expose them only after every release gate passes
 * public-api: createAssetTransaction()
 */
const F=Object.freeze;
export function createAssetTransaction({id='asset-transaction'}={}){
 let state='OPEN',staged=new Map(),gates=[];
 const assertOpen=()=>{if(state!=='OPEN')throw new Error(`ASSET_TRANSACTION_${state}`);};
 const stage=(key,value)=>{assertOpen();if(!key)throw new Error('ASSET_TRANSACTION_KEY_REQUIRED');staged.set(String(key),value);return value;};
 const gate=(name,pass,details=null)=>{assertOpen();const item=F({name:String(name),pass:!!pass,details});gates.push(item);return item;};
 const rollback=(reason='manual')=>{if(state==='COMMITTED')throw new Error('ASSET_TRANSACTION_ALREADY_COMMITTED');state='ROLLED_BACK';staged.clear();return F({id,state,reason:String(reason),gates:F([...gates])});};
 const commit=()=>{assertOpen();const failed=gates.filter(item=>!item.pass);if(failed.length){state='ROLLED_BACK';staged.clear();throw new Error(`ASSET_TRANSACTION_GATE_FAILED:${failed.map(x=>x.name).join(',')}`);}state='COMMITTED';return F({id,state,outputs:F(Object.fromEntries(staged)),gates:F([...gates])});};
 return F({stage,gate,commit,rollback,get state(){return state;},snapshot(){return F({id,state,keys:F([...staged.keys()]),gates:F([...gates])});}});
}
