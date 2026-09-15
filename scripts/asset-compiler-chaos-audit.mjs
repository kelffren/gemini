import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {inspectAssetContainer,assertSafeAssetInput} from '../src/creators/sprite-compiler/asset-safe-decode.mjs';
import {fingerprintAssetBuild} from '../src/creators/sprite-compiler/asset-build-fingerprint.mjs';
import {createAssetJobRunner} from '../src/creators/sprite-compiler/asset-job-runner.mjs';
import {createAssetTransaction} from '../src/creators/sprite-compiler/asset-transaction.mjs';
import {createAssetVerificationLedger,verifyAssetVerificationLedger} from '../src/creators/sprite-compiler/asset-verification-ledger.mjs';
import {chooseAssetBackend} from '../src/creators/sprite-compiler/asset-backend-contract.mjs';
import {createAssetReviewPacket,resolveAssetReviewPacket} from '../src/creators/sprite-compiler/asset-human-review.mjs';
import {evaluateRuntimeCanary} from '../src/creators/sprite-compiler/asset-runtime-canary.mjs';
import {createIsolatedAssetWorkerClient} from '../src/creators/sprite-compiler/asset-isolated-worker-client.mjs';
import {assertPinnedAssetOracle,evaluateOracleShadow} from '../src/creators/sprite-compiler/asset-oracle-governance.mjs';
import {evaluateAssetSourceAttestation} from '../src/creators/sprite-compiler/asset-source-attestation.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const makePng=(width,height)=>{const bytes=new Uint8Array(33);bytes.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,13,0x49,0x48,0x44,0x52]);bytes[16]=(width>>>24)&255;bytes[17]=(width>>>16)&255;bytes[18]=(width>>>8)&255;bytes[19]=width&255;bytes[20]=(height>>>24)&255;bytes[21]=(height>>>16)&255;bytes[22]=(height>>>8)&255;bytes[23]=height&255;bytes[24]=8;bytes[25]=6;return bytes;};

// Parser totality: arbitrary bytes may be rejected but must not throw.
let state=0x4b454c4f;const rand=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)>>>0);let randomRejected=0;
for(let n=0;n<5000;n++){const length=1+(rand()%1024),bytes=new Uint8Array(length);for(let i=0;i<length;i++)bytes[i]=rand()&255;const result=inspectAssetContainer(bytes);assert.equal(typeof result.valid,'boolean');if(!result.valid)randomRejected++;}
assert.ok(randomRejected>4900);

// Decompression-bomb style dimensions must fail before decode.
const huge=new Blob([makePng(0xffffffff,0xffffffff)],{type:'image/png'});Object.defineProperty(huge,'name',{value:'huge.png'});await assert.rejects(()=>assertSafeAssetInput(huge),/ASSET_DIMENSION_LIMIT|ASSET_PIXEL_LIMIT|ASSET_DECODE_MEMORY_LIMIT/);

// Declared WebP container size mismatch must fail closed.
const webp=new Uint8Array(30);webp.set([...Buffer.from('RIFF'),99,0,0,0,...Buffer.from('WEBPVP8X'),10,0,0,0],0);webp[24]=31;webp[27]=15;const badWebp=new Blob([webp],{type:'image/webp'});Object.defineProperty(badWebp,'name',{value:'bad.webp'});await assert.rejects(()=>assertSafeAssetInput(badWebp),/ASSET_CONTAINER_SIZE_MISMATCH/);

// Content addressing ignores filename and private analysis state, but rejects non-private binary config.
const sourceBytes=makePng(32,16),fileA=new Blob([sourceBytes],{type:'image/png'}),fileB=new Blob([sourceBytes],{type:'image/png'});Object.defineProperty(fileA,'name',{value:'one.png'});Object.defineProperty(fileB,'name',{value:'renamed.png'});const cryptoRoot={crypto:webcrypto};const fpA=await fingerprintAssetBuild(fileA,{config:{b:2,a:1,_foreground:new Uint8Array([1,2,3])},compilerVersion:'7.0.0',root:cryptoRoot}),fpB=await fingerprintAssetBuild(fileB,{config:{a:1,b:2},compilerVersion:'7.0.0',root:cryptoRoot});assert.equal(fpA.hash,fpB.hash);assert.equal(fpA.sourceHash,fpB.sourceHash);await assert.rejects(()=>fingerprintAssetBuild(fileA,{config:{pixels:new Uint8Array([1])},compilerVersion:'7.0.0',root:cryptoRoot}),/BINARY_CONFIG_UNSUPPORTED/);

// Timeout and supersession: late async results cannot become successful jobs.
const runner=createAssetJobRunner({defaultTimeoutMs:120});const started=Date.now();await assert.rejects(()=>runner.run([{name:'hang',run:()=>sleep(500)}]),/ASSET_JOB_ABORTED:timeout/);assert.ok(Date.now()-started<450);
const first=runner.run([{name:'slow',run:()=>sleep(250)}]);await sleep(10);const second=runner.run([{name:'fast',run:async()=>42}]);await assert.rejects(()=>first,/ASSET_JOB_ABORTED:superseded|ASSET_JOB_STALE/);assert.equal((await second).value,42);

// Dedicated-worker isolation provides a true hard-timeout boundary for CPU-bound backend tasks.
let hardWorker=null;class SilentWorker{constructor(){this.terminated=false;hardWorker=this;}postMessage(){}terminate(){this.terminated=true;}}
const isolated=createIsolatedAssetWorkerClient({workerFactory:()=>new SilentWorker(),defaultTimeoutMs:110});await assert.rejects(()=>isolated.run({task:'hang'}),/ASSET_WORKER_HARD_TIMEOUT/);assert.equal(hardWorker.terminated,true);assert.equal(isolated.activeCount,0);
let echoTerminated=false;class EchoWorker{postMessage(message){queueMicrotask(()=>this.onmessage?.({data:{id:message.id,ok:true,value:message.payload}}));}terminate(){echoTerminated=true;}}
const echo=createIsolatedAssetWorkerClient({workerFactory:()=>new EchoWorker()});assert.deepEqual(await echo.run({hello:'world'}),{hello:'world'});assert.equal(echoTerminated,true);

// Failed gates can never expose staged output.
const tx=createAssetTransaction({id:'chaos'});tx.stage('asset',{secret:'not-published'});tx.gate('security',false);assert.throws(()=>tx.commit(),/ASSET_TRANSACTION_GATE_FAILED/);assert.equal(tx.state,'ROLLED_BACK');assert.deepEqual(tx.snapshot().keys,[]);

// Ledger tampering must be detectable.
const ledger=createAssetVerificationLedger({assetId:'chaos',root:{crypto:webcrypto},clock:()=>1});await ledger.append('input',{ok:true});await ledger.append('compile',{ok:true});const entries=ledger.entries().map(item=>({...item}));entries[0]={...entries[0],payload:{ok:false}};const tampered=await verifyAssetVerificationLedger(entries,{root:{crypto:webcrypto}});assert.equal(tampered.valid,false);

// AI backend cannot satisfy a security-capability trust contract.
const backend=chooseAssetBackend([{id:'ai-decoder',trust:'advisory',capabilities:['decode-untrusted'],isolation:'none',deterministic:false}],{capability:'decode-untrusted',minTrust:'advisory'});assert.notEqual(backend.status,'READY');
const sandboxed=chooseAssetBackend([{id:'safe-wasm',trust:'sandboxed',capabilities:['decode-untrusted'],isolation:'wasm-component',deterministic:true}],{capability:'decode-untrusted',minTrust:'sandboxed',requireIsolation:true,requireDeterministic:true});assert.equal(sandboxed.status,'READY');

// Neither AI nor human review can override hard safety failures.
const packet=createAssetReviewPacket({assetId:'x',releaseDecision:{rejected:['ASSET_DECODE_MEMORY_LIMIT'],reviewRequired:['STYLE_AMBIGUOUS']}});assert.equal(packet.status,'QUARANTINED');const resolution=resolveAssetReviewPacket(packet,{approvals:['STYLE_AMBIGUOUS'],reviewer:'human'});assert.equal(resolution.status,'QUARANTINED');assert.equal(resolution.resolved,false);

// Real-device canary fails on context loss or insufficient coverage and passes only on measured success.
const goodSamples=Array.from({length:5},(_,i)=>({deviceClass:'iphone',platform:'ios',api:'webgl2',decodeMs:20+i,uploadMs:12+i,firstRenderMs:40+i,peakMemoryMiB:20+i,textureUploadOk:true,renderOk:true,contextLost:false}));const canaryGood=evaluateRuntimeCanary(goodSamples,{minimumSamples:5,requiredDeviceClasses:['iphone'],budgets:{maxDecodeP95Ms:50,maxUploadP95Ms:50,maxFirstRenderP95Ms:100,maxPeakMemoryP95MiB:40}});assert.equal(canaryGood.pass,true);
const canaryBad=evaluateRuntimeCanary([...goodSamples.slice(0,4),{...goodSamples[4],contextLost:true}],{minimumSamples:5,requiredDeviceClasses:['iphone']});assert.equal(canaryBad.pass,false);assert.ok(canaryBad.reasons.includes('CANARY_RUNTIME_FAILURE'));

// AI oracle versions must be pinned; new versions are shadow-tested and never auto-promoted.
assert.throws(()=>assertPinnedAssetOracle({id:'seg',model:'sam',version:'latest',promptPolicyHash:'x'}),/ASSET_ORACLE_UNPINNED/);const baseline={id:'seg-v1',provider:'test',model:'seg',version:'1.0.0',promptPolicyHash:'abc'},candidate={...baseline,id:'seg-v2',version:'2.0.0'};const shadowCases=Array.from({length:30},(_,i)=>({baseline:{label:i%2},candidate:{label:i%2},baselinePass:true,candidatePass:true,critical:i<4}));const shadow=evaluateOracleShadow({baseline,candidate,cases:shadowCases});assert.equal(shadow.status,'ELIGIBLE_FOR_HUMAN_PROMOTION');assert.equal(shadow.autoPromote,false);

// Visual AI cannot prove usage rights; external source without an explicit declaration/license remains review-required.
const sourceDecision=evaluateAssetSourceAttestation({sourceType:'external',sourceUri:'example',declaration:false});assert.equal(sourceDecision.pass,false);assert.ok(sourceDecision.reasons.includes('SOURCE_LICENSE_EVIDENCE_REQUIRED'));

console.log(JSON.stringify({ok:true,randomCases:5000,randomRejected,contentAddressed:true,timeoutFailClosed:true,staleProtected:true,hardWorkerKill:true,transactionRollback:true,ledgerTamperDetected:true,aiSecurityAuthorityDenied:true,humanHardOverrideDenied:true,realDeviceCanary:true,modelDriftGoverned:true,sourceRightsNotGuessed:true}));
