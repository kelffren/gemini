/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / ISOLATION
 * purpose: hard-isolated worker entry for avatar analysis, compilation and exact-canvas post-processing
 * protocol: {id,payload:{task,file,config,options}}
 */
import {analyzeUniversalAvatarAsset,compileUniversalAvatarRuntime} from '../avatar/kelo-universal-asset-compiler.mjs';
import {analyzeRawSingleFrameAsset} from '../avatar/raw-single-frame-analysis.mjs';
import {acceptConfirmedRawImageRuntime} from '../avatar/raw-image-intent-gate.mjs';
import {reframeCompiledRuntimeExact} from './sprite-exact-canvas.mjs';
import {createWorkerCanvasRoot} from './asset-worker-canvas-root.mjs';

const scope=globalThis;
const safeError=error=>({name:String(error?.name||'Error'),code:String(error?.code||error?.message||'ASSET_WORKER_FAILED'),message:String(error?.message||error||'ASSET_WORKER_FAILED')});
const progress=(id,value)=>scope.postMessage({id,type:'progress',progress:value});
function workerSafeCompiled(compiled){const {canvas,...rest}=compiled||{};return {...rest,canvas:null,isolatedWorker:true,canvasReturned:false};}
async function compileNative(file,config,root,onProgress,options){let compiled=await compileUniversalAvatarRuntime(file,config,{root,onProgress,oracle:options?.oracle||null});return acceptConfirmedRawImageRuntime(compiled,config);}
async function compileExact(native,config,root,onProgress){if(!config?.exactCanvas?.enabled)return native;onProgress({stage:'exact-canvas',message:`Ajustando runtime exacto ${config.exactCanvas.width}×${config.exactCanvas.height}px…`});return reframeCompiledRuntimeExact(root,native,config.exactCanvas);}

scope.onmessage=async event=>{
 const message=event?.data||{},id=message.id,payload=message.payload||{};if(!Number.isInteger(id))return;
 try{
   if(!payload.file)throw new Error('ASSET_WORKER_FILE_REQUIRED');
   const root=createWorkerCanvasRoot(scope),config=payload.config||null,onProgress=value=>progress(id,value),task=String(payload.task||'');
   if(task==='analyze-avatar'){
     const value=await analyzeUniversalAvatarAsset(payload.file,{root,onProgress,rigHint:payload.options?.rigHint||null,sourceDirectionOrder:payload.options?.sourceDirectionOrder||null});
     return scope.postMessage({id,ok:true,value});
   }
   if(task==='analyze-raw-avatar'){
     const value=await analyzeRawSingleFrameAsset(payload.file,{root,onProgress});
     return scope.postMessage({id,ok:true,value});
   }
   if(task==='compile-avatar-preview'){
     const native=await compileNative(payload.file,config,root,onProgress,payload.options);
     const exact=await compileExact(native,config,root,onProgress);
     return scope.postMessage({id,ok:true,value:{native:workerSafeCompiled(native),exact:workerSafeCompiled(exact)}});
   }
   if(task==='compile-avatar'){
     const native=await compileNative(payload.file,config,root,onProgress,payload.options),exact=await compileExact(native,config,root,onProgress);
     return scope.postMessage({id,ok:true,value:workerSafeCompiled(exact)});
   }
   throw new Error(`ASSET_WORKER_TASK_UNSUPPORTED:${task}`);
 }catch(error){scope.postMessage({id,ok:false,error:safeError(error)});}
};
