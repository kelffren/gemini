/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / HARDENING
 * purpose: wrap existing compilers with safe input, fingerprinting, metadata gates and atomic commit
 * public-api: compileAssetHardened(), createHardenedAssetCompiler()
 */
import {assertSafeAssetInput} from './asset-safe-decode.mjs';
import {fingerprintAssetBuild} from './asset-build-fingerprint.mjs';
import {normalizeAssetMetadata} from './asset-metadata-schema.mjs';
import {createAssetJobRunner} from './asset-job-runner.mjs';
import {createAssetTransaction} from './asset-transaction.mjs';

const F=Object.freeze;

export function createHardenedAssetCompiler({compiler,compilerVersion='unknown',timeoutMs=15000,onEvent=null,limits={}}={}){
 if(typeof compiler!=='function')throw new Error('HARDENED_ASSET_COMPILER_REQUIRED');
 const jobs=createAssetJobRunner({defaultTimeoutMs:timeoutMs,onEvent});
 async function compile(file,config={},options={}){
   const tx=createAssetTransaction({id:`asset:${String(file?.name||'unnamed')}`});
   const stages=[
    {name:'safe-input',run:async()=>tx.stage('input',await assertSafeAssetInput(file,limits))},
    {name:'fingerprint',run:async()=>tx.stage('fingerprint',await fingerprintAssetBuild(file,{config,compilerVersion,root:options.root||globalThis}))},
    {name:'compile',run:async({signal})=>{if(signal.aborted)throw new Error('ASSET_COMPILE_ABORTED');return tx.stage('compiled',await compiler(file,config,{...options,signal}));}},
    {name:'release-gates',run:async()=>{
      const compiled=tx.read('compiled'),fingerprint=tx.read('fingerprint');
      tx.gate('compile-completed',!!compiled);
      tx.gate('compiler-review-gate',compiled?.reviewRequired!==true,{reviewReasons:compiled?.reviewReasons||[]});
      tx.gate('runtime-dimensions',Number(compiled?.width)>0&&Number(compiled?.height)>0,{width:compiled?.width,height:compiled?.height});
      tx.gate('runtime-output',!!compiled?.blob||!!compiled?.canvas,{type:compiled?.type||null});
      const metadata=normalizeAssetMetadata(null,{assetId:fingerprint.id,fingerprint,compilerVersion,runtime:{width:compiled?.width??null,height:compiled?.height??null,type:compiled?.type??null,columns:compiled?.columns??null,rows:compiled?.rows??null},provenance:options.provenance||null});
      tx.stage('metadata',metadata);return metadata;
    }}
   ];
   try{
    const run=await jobs.run(stages,{signal:options.signal,timeoutMs:options.timeoutMs||timeoutMs,label:'hardened-asset-compile'}),compiled=tx.read('compiled'),fingerprint=tx.read('fingerprint'),metadata=tx.read('metadata'),committed=tx.commit();
    return F({status:'COMMITTED',assetId:fingerprint.id,fingerprint,metadata,compiled,transaction:F({id:committed.id,gates:committed.gates}),job:F({id:run.id,elapsedMs:run.elapsedMs,timeline:run.timeline})});
   }catch(error){if(tx.state==='OPEN')tx.rollback(error?.message||'compile-failed');throw error;}
 }
 return F({compile,cancel:jobs.cancel,get active(){return jobs.active;}});
}

export async function compileAssetHardened(file,config,{compiler,compilerVersion='unknown',...options}={}){return createHardenedAssetCompiler({compiler,compilerVersion,timeoutMs:options.timeoutMs,onEvent:options.onEvent,limits:options.limits}).compile(file,config,options);}
