/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / ISOLATION
 * purpose: execute one asset task per dedicated Worker so CPU-bound failures can be terminated from the UI thread
 * public-api: createIsolatedAssetWorkerClient()
 */
const F=Object.freeze;
const errorFrom=value=>value instanceof Error?value:new Error(String(value||'ASSET_WORKER_FAILED'));
export function createIsolatedAssetWorkerClient({workerFactory,defaultTimeoutMs=10000}={}){
 if(typeof workerFactory!=='function')throw new Error('ASSET_WORKER_FACTORY_REQUIRED');let sequence=0,active=new Map();
 async function run(payload,{timeoutMs=defaultTimeoutMs,signal=null,transfer=[],onProgress=null}={}){
   const id=++sequence,worker=workerFactory(),deadline=Math.max(100,Number(timeoutMs)||defaultTimeoutMs);if(!worker||typeof worker.postMessage!=='function'||typeof worker.terminate!=='function')throw new Error('ASSET_WORKER_INVALID');
   return new Promise((resolve,reject)=>{
     let settled=false,timer=null;
     const finish=(fn,value)=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);signal?.removeEventListener?.('abort',abort);active.delete(id);try{worker.terminate();}catch{}fn(value);};
     const abort=()=>finish(reject,new Error(`ASSET_WORKER_ABORTED:${String(signal?.reason||'external')}`));
     const cancel=reason=>finish(reject,new Error(`ASSET_WORKER_TERMINATED:${String(reason||'manual')}`));
     timer=setTimeout(()=>finish(reject,new Error('ASSET_WORKER_HARD_TIMEOUT')),deadline);active.set(id,F({worker,cancel}));
     worker.onmessage=event=>{const message=event?.data||{};if(message.id!==id)return;if(message.type==='progress'){try{onProgress?.(message.progress);}catch{}return;}if(message.ok===false)return finish(reject,errorFrom(message.error?.code||message.error?.message||'ASSET_WORKER_TASK_FAILED'));if(message.ok!==true)return;finish(resolve,message.value);};
     worker.onerror=event=>finish(reject,errorFrom(event?.message||'ASSET_WORKER_RUNTIME_ERROR'));
     if(signal?.aborted)return abort();signal?.addEventListener?.('abort',abort,{once:true});
     try{worker.postMessage({id,payload},transfer);}catch(error){finish(reject,error);}
   });
 }
 function terminateAll(reason='manual'){const entries=[...active.values()];for(const entry of entries)entry.cancel(reason);return F({terminated:entries.length,reason:String(reason)});}
 return F({run,terminateAll,get activeCount(){return active.size;}});
}
