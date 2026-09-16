#!/usr/bin/env node
/* KELO-INDEX
 * area: BUILD / CREATOR ASSET DELIVERY
 * owner: Kelo Creator Asset Bridge
 * keys: BATCH DELIVERY PNG LOSSLESS SHA256 METADATA REGISTRY CANDIDATE CONTENT CACHE ABI
 * purpose: compile many PNG SOURCE assets into independently verified strict-lossless DELIVERY candidates, reusing outputs only under the shared semantic cache contract
 * public-api: CLI only
 * state-owned: disposable candidate artifacts + reports under --report and disposable optimizer cache under --cache
 * online: N/A; build/publish-time compiler
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {decodePngRgba,optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';
import {profileAssetImage} from '../src/creators/assets/asset-image-profiler.mjs';
import {pngRenderMetadataFingerprint} from '../src/creators/assets/png-render-metadata.mjs';
import {buildOptimizationCacheKey,readOptimizationCache,writeOptimizationCache} from '../src/creators/assets/asset-optimization-cache.mjs';
import {BATCH_DELIVERY_CACHE_ABI,batchDeliveryLosslessOptions,buildBatchDeliveryCacheNamespace} from '../src/creators/assets/asset-batch-delivery-cache-contract.mjs';

const args=process.argv.slice(2);
const argument=(name,fallback)=>{const prefix=`--${name}=`,token=args.find(v=>v.startsWith(prefix));return token?token.slice(prefix.length):fallback;};
const has=name=>args.includes(`--${name}`);
const inputRoot=path.resolve(argument('input','assets'));
const outputDir=path.resolve(argument('report','test-results/asset-batch-delivery'));
const maxFiles=Math.max(1,Number(argument('max-files','80'))||80);
const maxSourceBytes=Math.max(1,Number(argument('max-source-bytes',String(8*1024*1024)))||8*1024*1024);
const minSavingBytes=Math.max(1,Number(argument('min-saving-bytes','1024'))||1024);
const minSavingPercent=Math.max(0,Number(argument('min-saving-percent','0.1'))||0);
const cacheEnabled=!has('no-cache');
const cachePath=path.resolve(argument('cache','.cache/asset-batch-delivery'));
const startedAt=Date.now();

function sha256(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
function rel(file){return path.relative(process.cwd(),file).replaceAll('\\','/');}
function candidateId(sourcePath,sourceHash){return crypto.createHash('sha256').update(`${sourcePath}:${sourceHash}`).digest('hex').slice(0,20);}
function pct(saved,before){return before?saved/before*100:0;}

assert.ok(fs.existsSync(inputRoot),`input not found: ${inputRoot}`);
const cacheNamespace=buildBatchDeliveryCacheNamespace({inputRoot,maxFiles,root:process.cwd()});
const {engineFingerprint,toolchain,sourceSetFingerprint}=cacheNamespace;
const files=cacheNamespace.files,records=[];
fs.rmSync(outputDir,{recursive:true,force:true});fs.mkdirSync(outputDir,{recursive:true});if(cacheEnabled)fs.mkdirSync(cachePath,{recursive:true});
let decodedFiles=0,skippedLarge=0,decodeSkipped=0,candidateCount=0,rejectedSafety=0,totalSourceBytes=0,totalProjectedBytes=0,candidateSourceBytes=0,candidateDeliveryBytes=0,cacheHits=0,cacheMisses=0;

for(const file of files){
  const source=fs.readFileSync(file),sourcePath=rel(file),sourceHash=sha256(source);totalSourceBytes+=source.length;
  if(source.length>maxSourceBytes){skippedLarge+=1;totalProjectedBytes+=source.length;records.push({file:sourcePath,status:'skipped-large',sourceBytes:source.length,cacheHit:false});continue;}
  let decoded;
  try{decoded=decodePngRgba(source);}catch(error){decodeSkipped+=1;totalProjectedBytes+=source.length;records.push({file:sourcePath,status:'decode-skipped',sourceBytes:source.length,cacheHit:false,error:String(error?.message||error)});continue;}
  decodedFiles+=1;
  const profile=profileAssetImage(decoded.rgba,decoded.ihdr.width,decoded.ihdr.height,{sourceName:sourcePath});
  const losslessOptions=batchDeliveryLosslessOptions(profile);
  const descriptor=buildOptimizationCacheKey(source,{engineFingerprint,toolchainFingerprint:toolchain.sha256,mode:'strict-delivery',effort:'fast',profileKind:profile.kind,qualityPolicy:'strict',extra:{cacheAbi:BATCH_DELIVERY_CACHE_ABI,losslessOptions,uniqueColors:profile?.metrics?.uniqueColors??null}});
  let optimized,cacheHit=false;
  try{
    const cached=cacheEnabled?readOptimizationCache(cachePath,descriptor):null;
    if(cached){optimized={buffer:cached.buffer,report:cached.report};cacheHit=true;cacheHits+=1;}
    else{optimized=optimizePngLossless(source,losslessOptions);if(cacheEnabled)cacheMisses+=1;}
  }catch(error){decodeSkipped+=1;totalProjectedBytes+=source.length;records.push({file:sourcePath,status:'optimizer-skipped',sourceBytes:source.length,cacheHit,error:String(error?.message||error)});continue;}
  const delivery=optimized.buffer,deliveryDecoded=decodePngRgba(delivery);
  const dimensionsExact=decoded.ihdr.width===deliveryDecoded.ihdr.width&&decoded.ihdr.height===deliveryDecoded.ihdr.height;
  const exactPixels=dimensionsExact&&decoded.rgba.equals(deliveryDecoded.rgba);
  const sourceMetadata=pngRenderMetadataFingerprint(decoded),deliveryMetadata=pngRenderMetadataFingerprint(deliveryDecoded),metadataPreserved=sourceMetadata===deliveryMetadata;
  if(!exactPixels||!metadataPreserved){rejectedSafety+=1;assert.fail(`${sourcePath}: strict DELIVERY safety regression exact=${exactPixels} metadata=${metadataPreserved}`);}
  if(cacheEnabled&&!cacheHit)writeOptimizationCache(cachePath,descriptor,optimized);
  const savedBytes=source.length-delivery.length,savedPercent=pct(savedBytes,source.length),qualifies=savedBytes>=minSavingBytes&&savedPercent>=minSavingPercent;
  totalProjectedBytes+=qualifies?delivery.length:source.length;
  if(!qualifies){records.push({file:sourcePath,status:'no-material-win',sourceBytes:source.length,deliveryBytes:delivery.length,savedBytes,savedPercent,profile:profile.kind,cacheHit,winner:optimized.report?.winner||null});continue;}

  const id=candidateId(sourcePath,sourceHash),dir=path.join(outputDir,'candidates',id);fs.mkdirSync(dir,{recursive:true});
  const assetFile=path.join(dir,'asset.png'),manifestFile=path.join(dir,'delivery-manifest.json'),reportFile=path.join(dir,'report.json');fs.writeFileSync(assetFile,delivery);
  const deliveryHash=sha256(delivery),winner=optimized.report?.winner||null;
  const manifest={
    version:'kelo-png-delivery-manifest-v1',
    source:{path:sourcePath,sha256:sourceHash,bytes:source.length,width:decoded.ihdr.width,height:decoded.ihdr.height},
    delivery:{kind:'png',file:'asset.png',strategy:'strict-lossless',sha256:deliveryHash,bytes:delivery.length,width:deliveryDecoded.ihdr.width,height:deliveryDecoded.ihdr.height,renderMetadataFingerprint:deliveryMetadata,pngWinner:winner},
    quality:{exactPixels:true,hiddenTransparentRgbChanges:0,renderMetadataPreserved:true},
    build:{optimizerCacheHit:cacheHit,cacheAbi:BATCH_DELIVERY_CACHE_ABI,engineFingerprint,toolchainFingerprint:toolchain.sha256,sourceSetFingerprint},
    promotion:{runtimeActive:false,policy:'separate-explicit-step'}
  };
  const report={status:'ASSET_PNG_DELIVERY_CANDIDATE_OK',version:'kelo-png-delivery-candidate-v1',source:sourcePath,profile:profile.kind,sourceBytes:source.length,deliveryBytes:delivery.length,savedBytes,savedPercent,exactPixels:true,hiddenTransparentRgbChanges:0,renderMetadataPreserved:true,renderMetadataFingerprint:deliveryMetadata,bytePromotionCandidate:true,sourceSha256:sourceHash,deliverySha256:deliveryHash,optimizerCacheHit:cacheHit,winner};
  fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
  candidateCount+=1;candidateSourceBytes+=source.length;candidateDeliveryBytes+=delivery.length;
  records.push({file:sourcePath,status:'approved-candidate',sourceBytes:source.length,deliveryBytes:delivery.length,savedBytes,savedPercent,profile:profile.kind,cacheHit,candidateDir:rel(dir),deliverySha256:deliveryHash,winner});
  console.log(`BATCH_DELIVERY ${cacheHit?'CACHE_HIT':'CACHE_MISS'} WIN ${sourcePath} ${source.length}->${delivery.length} saved=${savedBytes} (${savedPercent.toFixed(3)}%)`);
}

const savedBytes=totalSourceBytes-totalProjectedBytes,positiveSavings=records.filter(r=>(r.savedBytes||0)>0),belowThresholdPositive=positiveSavings.filter(r=>r.status!=='approved-candidate'),allPositiveSavingBytes=positiveSavings.reduce((sum,r)=>sum+r.savedBytes,0),discardedPositiveSavingsBytes=belowThresholdPositive.reduce((sum,r)=>sum+r.savedBytes,0),summary={
  status:'ASSET_BATCH_DELIVERY_COMPILER_OK',version:'kelo-batch-png-delivery-v1',input:rel(inputRoot),maxFiles,maxSourceBytes,minSavingBytes,minSavingPercent,
  scannedFiles:files.length,decodedFiles,skippedLarge,decodeSkipped,rejectedSafety,candidateCount,positiveSavingFiles:positiveSavings.length,belowThresholdPositiveFiles:belowThresholdPositive.length,
  totalSourceBytes,totalProjectedBytes,savedBytes,savedPercent:pct(savedBytes,totalSourceBytes),allPositiveSavingBytes,discardedPositiveSavingsBytes,capturedPositiveSavingsPercent:allPositiveSavingBytes?pct(savedBytes,allPositiveSavingBytes):100,
  candidateSourceBytes,candidateDeliveryBytes,candidateSavedBytes:candidateSourceBytes-candidateDeliveryBytes,candidateSavedPercent:pct(candidateSourceBytes-candidateDeliveryBytes,candidateSourceBytes),
  cacheEnabled,cachePath:cacheEnabled?rel(cachePath):null,cachePolicy:'semantic-abi-optimizer-bytes-only',cacheAbi:BATCH_DELIVERY_CACHE_ABI,cacheNamespaceKey:cacheNamespace.key,cacheRestorePrefix:cacheNamespace.restorePrefix,sourceSetFingerprint,cacheHits,cacheMisses,engineFingerprint,toolchainFingerprint:toolchain.sha256,elapsedMs:Date.now()-startedAt,
  runtimeActiveCandidates:0,records
};
fs.writeFileSync(path.join(outputDir,'report.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({...summary,records:undefined}));
