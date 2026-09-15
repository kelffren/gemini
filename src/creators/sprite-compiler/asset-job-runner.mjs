/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / HARDENING
 * purpose: cancellable, timeout-bounded staged compilation with stale-result protection
 * public-api: createAssetJobRunner()
 */
const F=Object.freeze;const now=()=>globalThis.performance?.now?.()??Date.now();
export function createAssetJobRunner({defaultTimeoutMs=15000,onEvent=null}={}){
 let generation=0,active=null;
 const emit=event=>onEvent?.(F(event));
 const cancel=reason=>'ASSET_JOB_CANCELLED'&&(active?.controller.abort(reason),active=null,generation++);
 async function run(stages,{signal=null,timeoutMs=defaultTimeoutMs,label='asset-compile'}={}){
   if(!Array.isArray(stages)||!stages.length)throw new Error('ASSET_JOB_STAGES_REQUIRED');
   cancel('superseded');const id=++generation,controller=new AbortController(),started=now();active={id,controller};
   const externalAbort=()=>controller.abort(signal?.reason||'external-abort');signal?.addEventListener?.('abort',externalAbort,{once:true});
   const timer=setTimeout(()=>controller.abort('timeout'),Math.max(100,Number(timeoutMs)||defaultTimeoutMs));
   let value=null;const timeline=[];
   try{
     for(const stage of stages){if(id!==generation)throw new Error('ASSET_JOB_STALE');if(controller.signal.aborted)throw new Error(`ASSET_JOB_ABORTED:${controller.signal.reason||'unknown'}`);const stageStart=now(),name=String(stage?.name||'stage');emit({type:'stage-start',id,label,name});value=await stage.run({value,signal:controller.signal,id});const elapsed=now()-stageStart;timeline.push(F({name,elapsedMs:Math.round(elapsed*100)/100}));emit({type:'stage-end',id,label,name,elapsedMs:elapsed});}
     if(id!==generation)throw new Error('ASSET_JOB_STALE');return F({id,label,value,timeline:F(timeline),elapsedMs:Math.round((now()-started)*100)/100,status:'completed'});
   } finally {clearTimeout(timer);signal?.removeEventListener?.('abort',externalAbort);if(active?.id===id)active=null;}
 }
 return F({run,cancel,get generation(){return generation;},get active(){return active?F({id:active.id}):null;}});
}
