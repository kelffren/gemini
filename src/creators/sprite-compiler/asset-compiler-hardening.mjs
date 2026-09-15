/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / HARDENING
 * purpose: wrap existing compilers with safe input, fingerprinting, evidence authority and atomic commit
 * public-api: compileAssetHardened(), createHardenedAssetCompiler()
 */
import {assertSafeAssetInput} from './asset-safe-decode.mjs';
import {fingerprintAssetBuild} from './asset-build-fingerprint.mjs';
import {normalizeAssetMetadata} from './asset-metadata-schema.mjs';
import {createAssetJobRunner} from './asset-job-runner.mjs';
import {createAssetTransaction} from './asset-transaction.mjs';
import {verifyAssetRelease} from './asset-release-verifier.mjs';
import {createAssetVerificationLedger} from './asset-verification-ledger.mjs';

const F=Object.freeze;
const summary=compiled=>F({width:compiled?.width??null,height:compiled?.height??null,type:compiled?.type??null,status:compiled?.status??null,reviewRequired:compiled?.reviewRequired===true,reviewReasons:F([...(compiled?.reviewReasons||[])])});

export function createHardenedAssetCompiler({compiler,compilerVersion='unknown',timeoutMs=15000,onEvent=null,limits={}}={}){
 if(typeof compiler!=='function')throw new Error('HARDENED_ASSET_COMPILER_REQUIRED');
 const jobs=createAssetJobRunner({defaultTimeoutMs:timeoutMs,onEvent});
 async function compile(file,config={},options={}){
   const root=options.root||globalThis,tx=createAssetTransaction({id:`asset:${String(file?.name||'unnamed')}`}),ledgerAvailable=!!root.crypto?.subtle;
   if(options.requireLedger===true&&!ledgerAvailable)throw new Error('ASSET_VERIFICATION_LEDGER_REQUIRED');
   const ledger=ledgerAvailable&&options.verificationLedger!==false?createAssetVerificationLedger({assetId:String(file?.name||'unnamed'),root}):null;
   const log=async(type,payload,meta={})=>ledger?ledger.append(type,payload,meta):null;
   const stages=[
    {name:'safe-input',run:async()=>{const input=tx.stage('input',await assertSafeAssetInput(file,{...limits,...(options.limits||{})}));await log('safe-input',{format:input.format,width:input.width,height:input.height,pixels:input.pixels,decodedBytes:input.decodedBytes});return input;}},
    {name:'fingerprint',run:async()=>{const fingerprint=tx.stage('fingerprint',await fingerprintAssetBuild(file,{config,compilerVersion,root}));await log('fingerprint',{id:fingerprint.id,sourceHash:fingerprint.sourceHash,buildHash:fingerprint.buildHash,algorithm:fingerprint.algorithm||null,compilerVersion});return fingerprint;}},
    {name:'compile',run:async({signal})=>{if(signal.aborted)throw new Error('ASSET_COMPILE_ABORTED');const compiled=tx.stage('compiled',await compiler(file,config,{...options,root,signal}));await log('compiled',summary(compiled));return compiled;}},
    {name:'release-gates',run:async()=>{
      const input=tx.read('input'),compiled=tx.read('compiled'),fingerprint=tx.read('fingerprint');
      tx.gate('compile-completed',!!compiled);tx.gate('compiler-review-gate',compiled?.reviewRequired!==true,{reviewReasons:compiled?.reviewReasons||[]});tx.gate('runtime-dimensions',Number(compiled?.width)>0&&Number(compiled?.height)>0,{width:compiled?.width,height:compiled?.height});tx.gate('runtime-output',!!compiled?.blob||!!compiled?.canvas,{type:compiled?.type||null});
      const releaseDecision=verifyAssetRelease({input,compiled,budget:options.budget||null,regression:options.regression||null,temporal:options.temporal||null,defects:options.defects||null,canary:options.canary||null,backendSelection:options.backendSelection||null,aiSuggestions:options.aiSuggestions||null,humanApprovals:options.humanApprovals||[],requiredDomains:options.requiredEvidenceDomains||['security','runtime']});
      tx.stage('releaseDecision',releaseDecision);tx.gate('authority-policy',releaseDecision.approved,releaseDecision);
      const metadata=normalizeAssetMetadata(null,{assetId:fingerprint.id,fingerprint,compilerVersion,runtime:{width:compiled?.width??null,height:compiled?.height??null,type:compiled?.type??null,columns:compiled?.columns??null,rows:compiled?.rows??null},provenance:{...(options.provenance||{}),authorityPolicy:releaseDecision.policyVersion,authorityDecision:releaseDecision.decision}});tx.stage('metadata',metadata);await log('release-decision',{decision:releaseDecision.decision,rejected:releaseDecision.rejected,reviewRequired:releaseDecision.reviewRequired,warnings:releaseDecision.warnings});return metadata;
    }}
   ];
   try{
    const run=await jobs.run(stages,{signal:options.signal,timeoutMs:options.timeoutMs||timeoutMs,label:'hardened-asset-compile'}),compiled=tx.read('compiled'),fingerprint=tx.read('fingerprint'),metadata=tx.read('metadata'),releaseDecision=tx.read('releaseDecision'),committed=tx.commit();await log('commit',{assetId:fingerprint.id,gates:committed.gates.map(g=>({name:g.name,pass:g.pass}))});const ledgerVerification=ledger?await ledger.verify():F({valid:null,reason:'LEDGER_DISABLED'}),ledgerSeal=ledger?ledger.seal():null;
    return F({status:'COMMITTED',assetId:fingerprint.id,fingerprint,metadata,compiled,releaseDecision,transaction:F({id:committed.id,gates:committed.gates}),verificationLedger:ledger?F({verification:ledgerVerification,seal:ledgerSeal,entries:ledger.entries()}):null,job:F({id:run.id,elapsedMs:run.elapsedMs,timeline:run.timeline})});
   }catch(error){if(tx.state==='OPEN')tx.rollback(error?.message||'compile-failed');try{await log('rollback',{reason:String(error?.message||error)})}catch{}throw error;}
 }
 return F({compile,cancel:jobs.cancel,get active(){return jobs.active;}});
}

export async function compileAssetHardened(file,config,{compiler,compilerVersion='unknown',...options}={}){return createHardenedAssetCompiler({compiler,compilerVersion,timeoutMs:options.timeoutMs,onEvent:options.onEvent,limits:options.limits}).compile(file,config,options);}
