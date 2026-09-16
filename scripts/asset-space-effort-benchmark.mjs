/* KELO-INDEX
 * area: BUILD / CREATOR ASSET PERFORMANCE
 * owner: Kelo Creator Asset Bridge
 * keys: FAST BALANCED DEEP BENCHMARK CPU TIME MARGINAL SAVING
 * purpose: measure whether deeper exact PNG search earns enough additional bytes to justify its CPU cost on representative real assets
 * public-api: CLI report
 * state-owned: report only
 * online: N/A; CI/build-time observability
 * do-not: write source assets or promote a slower effort tier without measured benefit
 */

import fs from 'node:fs';
import path from 'node:path';
import {decodePngRgba,optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';
import {profileAssetImage} from '../src/creators/assets/asset-image-profiler.mjs';

const args=process.argv.slice(2);
const argument=(name,fallback=null)=>{const token=args.find(v=>v.startsWith(`--${name}=`));return token?token.slice(name.length+3):fallback;};
const reportDir=path.resolve(argument('report','dist/asset-space-effort-benchmark'));
const requested=String(argument('files','assets/hero.PNG;assets/cespedsindivisiones.PNG;assets/world/trees/kelo-tree-pack-01/tree-apple-red.png'))
  .split(';').map(v=>v.trim()).filter(Boolean);
const files=requested.map(file=>path.resolve(file)).filter(file=>fs.existsSync(file)&&/\.png$/i.test(file));
if(!files.length){console.error('ASSET_SPACE_EFFORT_BENCHMARK_NO_FILES');process.exit(2);}

const rel=file=>path.relative(process.cwd(),file).replaceAll('\\','/');
const now=()=>process.hrtime.bigint();
const ms=(start,end)=>Number(end-start)/1e6;

function optionsFor(effort,profile){
  if(effort==='deep') return {};
  if(effort==='balanced') return {filterStrategies:['adaptive',0,4]};
  return {filterStrategies:['adaptive'],disablePalette:(profile?.metrics?.uniqueColors||4097)>64};
}

const rows=[];
for(const file of files){
  const source=fs.readFileSync(file);
  const decoded=decodePngRgba(source);
  const profile=profileAssetImage(decoded.rgba,decoded.ihdr.width,decoded.ihdr.height,{sourceName:rel(file)});
  const efforts={};
  for(const effort of ['fast','balanced','deep']){
    const start=now();
    const result=optimizePngLossless(source,optionsFor(effort,profile));
    const end=now();
    if(result.report.exactPixels!==true) throw new Error(`ASSET_SPACE_EFFORT_NOT_EXACT:${rel(file)}:${effort}`);
    const elapsedMs=ms(start,end);
    efforts[effort]={
      elapsedMs:Number(elapsedMs.toFixed(3)),
      outputBytes:result.buffer.length,
      savedBytes:source.length-result.buffer.length,
      savedPercent:Number((((source.length-result.buffer.length)/source.length)*100).toFixed(4)),
      candidateCount:result.report.candidates.length,
      winner:result.report.winner,
      savedBytesPerSecond:elapsedMs>0?Number(((source.length-result.buffer.length)/(elapsedMs/1000)).toFixed(1)):null
    };
  }
  const fast=efforts.fast,balanced=efforts.balanced,deep=efforts.deep;
  const deepMarginalBytes=fast.outputBytes-deep.outputBytes;
  const deepExtraMs=deep.elapsedMs-fast.elapsedMs;
  const balancedMarginalBytes=fast.outputBytes-balanced.outputBytes;
  const balancedExtraMs=balanced.elapsedMs-fast.elapsedMs;
  rows.push({
    file:rel(file),
    sourceBytes:source.length,
    megapixels:Number(((decoded.ihdr.width*decoded.ihdr.height)/1e6).toFixed(3)),
    profile:{kind:profile.kind,policy:profile.adaptivePolicy,uniqueColors:profile.metrics.uniqueColors},
    efforts,
    marginal:{
      balancedVsFast:{savedBytes:balancedMarginalBytes,extraMs:Number(balancedExtraMs.toFixed(3)),bytesPerExtraSecond:balancedExtraMs>0?Number((balancedMarginalBytes/(balancedExtraMs/1000)).toFixed(1)):null},
      deepVsFast:{savedBytes:deepMarginalBytes,extraMs:Number(deepExtraMs.toFixed(3)),bytesPerExtraSecond:deepExtraMs>0?Number((deepMarginalBytes/(deepExtraMs/1000)).toFixed(1)):null}
    }
  });
  console.log(`EFFORT ${rel(file)} fast=${fast.outputBytes}/${fast.elapsedMs}ms balanced=${balanced.outputBytes}/${balanced.elapsedMs}ms deep=${deep.outputBytes}/${deep.elapsedMs}ms deepMarginal=${deepMarginalBytes}B`);
}

const totals={};
for(const effort of ['fast','balanced','deep']){
  const outputBytes=rows.reduce((sum,row)=>sum+row.efforts[effort].outputBytes,0);
  const sourceBytes=rows.reduce((sum,row)=>sum+row.sourceBytes,0);
  const elapsedMs=rows.reduce((sum,row)=>sum+row.efforts[effort].elapsedMs,0);
  totals[effort]={
    sourceBytes,outputBytes,elapsedMs:Number(elapsedMs.toFixed(3)),
    savedBytes:sourceBytes-outputBytes,
    savedPercent:sourceBytes?Number((((sourceBytes-outputBytes)/sourceBytes)*100).toFixed(4)):0,
    savedBytesPerSecond:elapsedMs>0?Number(((sourceBytes-outputBytes)/(elapsedMs/1000)).toFixed(1)):null
  };
}
const marginalDeepBytes=totals.fast.outputBytes-totals.deep.outputBytes;
const marginalDeepMs=totals.deep.elapsedMs-totals.fast.elapsedMs;
const report={
  version:'kelo-asset-space-effort-benchmark-v1',
  generatedAt:new Date().toISOString(),
  fileCount:rows.length,
  totals,
  deepVsFast:{
    extraSavedBytes:marginalDeepBytes,
    extraSavedPercentOfSource:totals.fast.sourceBytes?Number(((marginalDeepBytes/totals.fast.sourceBytes)*100).toFixed(4)):0,
    extraMs:Number(marginalDeepMs.toFixed(3)),
    bytesPerExtraSecond:marginalDeepMs>0?Number((marginalDeepBytes/(marginalDeepMs/1000)).toFixed(1)):null
  },
  files:rows
};
fs.mkdirSync(reportDir,{recursive:true});
fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify(report,null,2));
console.log(`ASSET_SPACE_EFFORT_BENCHMARK_DONE fast=-${totals.fast.savedPercent}% deep=-${totals.deep.savedPercent}% deepExtra=${marginalDeepBytes}B/${marginalDeepMs.toFixed(1)}ms`);
