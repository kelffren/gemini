#!/usr/bin/env node
/* KELO-INDEX
 * area: BUILD / CREATOR ASSET DELIVERY
 * owner: Kelo Creator Asset Bridge
 * keys: BATCH DELIVERY PNG LOSSLESS SHA256 METADATA REGISTRY CANDIDATE
 * purpose: compile many PNG SOURCE assets into independently verified strict-lossless DELIVERY candidates without runtime activation
 * public-api: CLI only
 * state-owned: disposable candidate artifacts + reports under --report
 * online: N/A; build/publish-time compiler
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {decodePngRgba,optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';
import {PALETTE_ORDER_FAST} from '../src/creators/assets/png-palette-order.mjs';
import {profileAssetImage} from '../src/creators/assets/asset-image-profiler.mjs';
import {pngRenderMetadataFingerprint} from '../src/creators/assets/png-render-metadata.mjs';

const args=process.argv.slice(2);
const argument=(name,fallback)=>{const prefix=`--${name}=`,token=args.find(v=>v.startsWith(prefix));return token?token.slice(prefix.length):fallback;};
const inputRoot=path.resolve(argument('input','assets'));
const outputDir=path.resolve(argument('report','test-results/asset-batch-delivery'));
const maxFiles=Math.max(1,Number(argument('max-files','80'))||80);
const maxSourceBytes=Math.max(1,Number(argument('max-source-bytes',String(8*1024*1024)))||8*1024*1024);
const minSavingBytes=Math.max(1,Number(argument('min-saving-bytes','1024'))||1024);
const minSavingPercent=Math.max(0,Number(argument('min-saving-percent','0.1'))||0);

function walkPngs(target){
  if(!fs.existsSync(target))return[];
  const stat=fs.statSync(target);if(stat.isFile())return/\.png$/i.test(target)?[target]:[];
  const found=[],stack=[target];
  while(stack.length&&found.length<maxFiles){
    const dir=stack.pop(),entries=fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name));
    for(const entry of entries){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()){
        if(!['node_modules','.git','dist','test-results','.cache'].includes(entry.name))stack.push(full);
      }else if(entry.isFile()&&/\.png$/i.test(entry.name)){
        found.push(full);if(found.length>=maxFiles)break;
      }
    }
  }
  return found.sort();
}
function sha256(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
function rel(file){return path.relative(process.cwd(),file).replaceAll('\\','/');}
function candidateId(sourcePath,sourceHash){return crypto.createHash('sha256').update(`${sourcePath}:${sourceHash}`).digest('hex').slice(0,20);}
function pct(saved,before){return before?saved/before*100:0;}

assert.ok(fs.existsSync(inputRoot),`input not found: ${inputRoot}`);
fs.rmSync(outputDir,{recursive:true,force:true});fs.mkdirSync(outputDir,{recursive:true});
const files=walkPngs(inputRoot),records=[];
let decodedFiles=0,skippedLarge=0,decodeSkipped=0,candidateCount=0,rejectedSafety=0,totalSourceBytes=0,totalProjectedBytes=0,candidateSourceBytes=0,candidateDeliveryBytes=0;

for(const file of files){
  const source=fs.readFileSync(file),sourcePath=rel(file),sourceHash=sha256(source);totalSourceBytes+=source.length;
  if(source.length>maxSourceBytes){skippedLarge+=1;totalProjectedBytes+=source.length;records.push({file:sourcePath,status:'skipped-large',sourceBytes:source.length});continue;}
  let decoded;
  try{decoded=decodePngRgba(source);}catch(error){decodeSkipped+=1;totalProjectedBytes+=source.length;records.push({file:sourcePath,status:'decode-skipped',sourceBytes:source.length,error:String(error?.message||error)});continue;}
  decodedFiles+=1;
  const profile=profileAssetImage(decoded.rgba,decoded.ihdr.width,decoded.ihdr.height,{sourceName:sourcePath});
  let optimized;
  try{
    optimized=optimizePngLossless(source,{filterStrategies:['adaptive'],paletteOrderStrategies:PALETTE_ORDER_FAST,disablePalette:(profile?.metrics?.uniqueColors||4097)>64});
  }catch(error){decodeSkipped+=1;totalProjectedBytes+=source.length;records.push({file:sourcePath,status:'optimizer-skipped',sourceBytes:source.length,error:String(error?.message||error)});continue;}
  const delivery=optimized.buffer,deliveryDecoded=decodePngRgba(delivery);
  const dimensionsExact=decoded.ihdr.width===deliveryDecoded.ihdr.width&&decoded.ihdr.height===deliveryDecoded.ihdr.height;
  const exactPixels=dimensionsExact&&decoded.rgba.equals(deliveryDecoded.rgba);
  const sourceMetadata=pngRenderMetadataFingerprint(decoded),deliveryMetadata=pngRenderMetadataFingerprint(deliveryDecoded),metadataPreserved=sourceMetadata===deliveryMetadata;
  if(!exactPixels||!metadataPreserved){rejectedSafety+=1;assert.fail(`${sourcePath}: strict DELIVERY safety regression exact=${exactPixels} metadata=${metadataPreserved}`);}
  const savedBytes=source.length-delivery.length,savedPercent=pct(savedBytes,source.length),qualifies=savedBytes>=minSavingBytes&&savedPercent>=minSavingPercent;
  totalProjectedBytes+=qualifies?delivery.length:source.length;
  if(!qualifies){records.push({file:sourcePath,status:'no-material-win',sourceBytes:source.length,deliveryBytes:delivery.length,savedBytes,savedPercent,profile:profile.kind,winner:optimized.report?.winner||null});continue;}

  const id=candidateId(sourcePath,sourceHash),dir=path.join(outputDir,'candidates',id);fs.mkdirSync(dir,{recursive:true});
  const assetFile=path.join(dir,'asset.png'),manifestFile=path.join(dir,'delivery-manifest.json'),reportFile=path.join(dir,'report.json');fs.writeFileSync(assetFile,delivery);
  const deliveryHash=sha256(delivery),winner=optimized.report?.winner||null;
  const manifest={
    version:'kelo-png-delivery-manifest-v1',
    source:{path:sourcePath,sha256:sourceHash,bytes:source.length,width:decoded.ihdr.width,height:decoded.ihdr.height},
    delivery:{kind:'png',file:'asset.png',strategy:'strict-lossless',sha256:deliveryHash,bytes:delivery.length,width:deliveryDecoded.ihdr.width,height:deliveryDecoded.ihdr.height,renderMetadataFingerprint:deliveryMetadata,pngWinner:winner},
    quality:{exactPixels:true,hiddenTransparentRgbChanges:0,renderMetadataPreserved:true},
    promotion:{runtimeActive:false,policy:'separate-explicit-step'}
  };
  const report={status:'ASSET_PNG_DELIVERY_CANDIDATE_OK',version:'kelo-png-delivery-candidate-v1',source:sourcePath,profile:profile.kind,sourceBytes:source.length,deliveryBytes:delivery.length,savedBytes,savedPercent,exactPixels:true,hiddenTransparentRgbChanges:0,renderMetadataPreserved:true,renderMetadataFingerprint:deliveryMetadata,bytePromotionCandidate:true,sourceSha256:sourceHash,deliverySha256:deliveryHash,winner};
  fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
  candidateCount+=1;candidateSourceBytes+=source.length;candidateDeliveryBytes+=delivery.length;
  records.push({file:sourcePath,status:'approved-candidate',sourceBytes:source.length,deliveryBytes:delivery.length,savedBytes,savedPercent,profile:profile.kind,candidateDir:rel(dir),deliverySha256:deliveryHash,winner});
  console.log(`BATCH_DELIVERY WIN ${sourcePath} ${source.length}->${delivery.length} saved=${savedBytes} (${savedPercent.toFixed(3)}%)`);
}

const savedBytes=totalSourceBytes-totalProjectedBytes,positiveSavings=records.filter(r=>(r.savedBytes||0)>0),belowThresholdPositive=positiveSavings.filter(r=>r.status!=='approved-candidate'),allPositiveSavingBytes=positiveSavings.reduce((sum,r)=>sum+r.savedBytes,0),discardedPositiveSavingsBytes=belowThresholdPositive.reduce((sum,r)=>sum+r.savedBytes,0),summary={
  status:'ASSET_BATCH_DELIVERY_COMPILER_OK',version:'kelo-batch-png-delivery-v1',input:rel(inputRoot),maxFiles,maxSourceBytes,minSavingBytes,minSavingPercent,
  scannedFiles:files.length,decodedFiles,skippedLarge,decodeSkipped,rejectedSafety,candidateCount,positiveSavingFiles:positiveSavings.length,belowThresholdPositiveFiles:belowThresholdPositive.length,
  totalSourceBytes,totalProjectedBytes,savedBytes,savedPercent:pct(savedBytes,totalSourceBytes),allPositiveSavingBytes,discardedPositiveSavingsBytes,capturedPositiveSavingsPercent:allPositiveSavingBytes?pct(savedBytes,allPositiveSavingBytes):100,
  candidateSourceBytes,candidateDeliveryBytes,candidateSavedBytes:candidateSourceBytes-candidateDeliveryBytes,candidateSavedPercent:pct(candidateSourceBytes-candidateDeliveryBytes,candidateSourceBytes),
  runtimeActiveCandidates:0,records
};
fs.writeFileSync(path.join(outputDir,'report.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({...summary,records:undefined}));
