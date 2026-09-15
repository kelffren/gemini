/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / ISOLATION
 * purpose: hard-isolated worker entry for the existing universal avatar compiler and its heavy post-processing
 * protocol: {id,payload:{task:'compile-avatar',file,config,options}}
 */
import {compileUniversalAvatarRuntime} from '../avatar/kelo-universal-asset-compiler.mjs';
import {acceptConfirmedRawImageRuntime} from '../avatar/raw-image-intent-gate.mjs';
import {reframeCompiledRuntimeExact} from './sprite-exact-canvas.mjs';
import {createWorkerCanvasRoot} from './asset-worker-canvas-root.mjs';

const scope=globalThis;
const safeError=error=>({name:String(error?.name||'Error'),code:String(error?.code||error?.message||'ASSET_WORKER_COMPILE_FAILED'),message:String(error?.message||error||'ASSET_WORKER_COMPILE_FAILED')});
function workerSafeCompiled(compiled){const {canvas,...rest}=compiled||{};return {...rest,canvas:null,isolatedWorker:true,canvasReturned:false};}

scope.onmessage=async event=>{
 const message=event?.data||{},id=message.id,payload=message.payload||{};if(!Number.isInteger(id))return;
 try{
   if(payload.task!=='compile-avatar')throw new Error(`ASSET_WORKER_TASK_UNSUPPORTED:${String(payload.task||'')}`);
   if(!payload.file)throw new Error('ASSET_WORKER_FILE_REQUIRED');
   const root=createWorkerCanvasRoot(scope),config=payload.config||null,onProgress=progress=>scope.postMessage({id,type:'progress',progress});
   let compiled=await compileUniversalAvatarRuntime(payload.file,config,{root,onProgress,oracle:payload.options?.oracle||null});
   compiled=acceptConfirmedRawImageRuntime(compiled,config);
   if(config?.exactCanvas?.enabled){
     onProgress({stage:'exact-canvas',message:`Ajustando runtime exacto ${config.exactCanvas.width}×${config.exactCanvas.height}px…`});
     compiled=await reframeCompiledRuntimeExact(root,compiled,config.exactCanvas);
   }
   scope.postMessage({id,ok:true,value:workerSafeCompiled(compiled)});
 }catch(error){scope.postMessage({id,ok:false,error:safeError(error)});}
};
