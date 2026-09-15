/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / HARDENING
 * purpose: cancellable, timeout-bounded staged compilation with stale-result protection
 * public-api: createAssetJobRunner()
 * note: hard interruption of synchronous CPU work requires an isolated Worker/Wasm backend; this runner still prevents late publication
 */
const F=Object.freeze;const now=()=>globalThis.performance?.now?.()??Date.now();
const abortError=signal=>new Error(`ASSET_JOB_ABORTED:${String(signal?.reason||'unknown')}`);
function raceAbort(promise,signal){
 if(signal?.aborted)return Promise.reject(abortError(signal));
 let listener=null;const aborted=new Promise((_,reject)=>{listener=()=>reject(abortError(signal));signal?.addEventListener?.('abort',listener,{once:true});});
 return Promise.race([Promise.resolve(promise),aborted]).finally(()=>signal?.removeEventListener?.('abort',listener));
}
export function createAssetJobRunner({defaultTimeoutMs=15000,onEvent=null}={}){
 let generation=0,active=null;
 const emit=event=>onEvent?.(F(event));
 const cancel=(reason='cancelled')=>{const current=active;if(current){current.controller.abort(reason);active=null;}generation++;return F({cancelled:!!current,generation,reason:String(reason)});};
 async function run(stages,{signal=null,timeoutMs=defaultTimeoutMs,label='asset-compile'}={}){
   if(!Array.isArray(stages)||!stages.length)throw new Error('ASSET_JOB_STAGES_REQUIRED');
   cancel('superseded');const id=++generation,controller=new AbortController(),started=now();active={id,controller};
   const externalAbort=()=>controller.abort(signal?.reason||'external-abort');signal?.addEventListener?.('abort',externalAbort,{once:true});
   const deadline=Math.max(100,Number(timeoutMs)||defaultTimeoutMs),timer=setTimeout(()=>controller.abort('timeout'),deadline);
   let value=null;const timeline=[];
   try{
     for(const stage of stages){
       if(id!==generation)throw new Error('ASSET_JOB_STALE');if(controller.signal.aborted)throw abortError(controller.signal);
       const stageStart=now(),name=String(stage?.name||'stage');emit({type:'stage-start',id,label,name});
       value=await raceAbort(Promise.resolve().then(()=>stage.run({value,signal:controller.signal,id})),controller.signal);
       if(id!==generation)throw new Error('ASSET_JOB_STALE');if(controller.signal.aborted)throw abortError(controller.signal);
       const elapsed=now()-stageStart;timeline.push(F({name,elapsedMs:Math.round(elapsed*100)/100}));emit({type:'stage-end',id,label,name,elapsedMs:elapsed});
     }
     if(id!==generation)throw new Error('ASSET_JOB_STALE');return F({id,label,value,timeline:F(timeline),elapsedMs:Math.round((now()-started)*100)/100,status:'completed'});
   } finally {clearTimeout(timer);signal?.removeEventListener?.('abort',externalAbort);if(active?.id===id)active=null;}
 }
 return F({run,cancel,get generation(){return generation;},get active(){return active?F({id:active.id}):null;}});
}

export const __assetJobRunner=F({raceAbort,abortError});