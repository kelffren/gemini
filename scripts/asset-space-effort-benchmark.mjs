/* KELO-INDEX
 * area: BUILD / CREATOR ASSET PERFORMANCE
 * owner: Kelo Creator Asset Bridge
 * keys: FAST AUTO BALANCED DEEP BENCHMARK CPU TIME MARGINAL SAVING
 * purpose: measure whether AUTO/deeper exact PNG search earns enough additional bytes to justify CPU on representative real assets
 * public-api: CLI report
 * state-owned: report only
 * online: N/A; CI/build-time observability
 * do-not: write source assets or promote a slower effort tier without measured benefit
 */

import fs from 'node:fs';
import path from 'node:path';
import {decodePngRgba,optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';
import {profileAssetImage} from '../src/creators/assets/asset-image-profiler.mjs';
import {optimizePngWithAdaptiveEffort} from '../src/creators/assets/asset-effort-controller.mjs';

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
  if(effort==='deep')return{};
  if(effort==='balanced')return{filterStrategies:['adaptive',0,4]};
  return{filterStrategies:['adaptive'],disablePalette:(profile?.metrics?.uniqueColors||4097)>64};
}
function record(source,result,elapsedMs){return{
  elapsedMs:Number(elapsedMs.toFixed(3)),
  outputBytes:result.buffer.length,
  savedBytes:source.length-result.buffer.length,
  savedPercent:Number((((source.length-result.buffer.length)/source.length)*100).toFixed(4)),
  candidateCount:result.report.candidates?.length??null,
  winner:result.report.winner,
  savedBytesPerSecond:elapsedMs>0?Number(((source.length-result.buffer.length)/(elapsedMs/1000)).toFixed(1)):null,
  effortController:result.report.effortController||null
};}

const rows=[];
for(const file of files){
  const source=fs.readFileSync(file);
  const decoded=decodePngRgba(source);
  const profile=profileAssetImage(decoded.rgba,decoded.ihdr.width,decoded.ihdr.height,{sourceName:rel(file)});
  const efforts={};
  for(const effort of ['fast','balanced','deep']){
    const start=now();
    const result=optimizePngLossless(source,optionsFor(effort,profile));
    const elapsedMs=ms(start,now());
    if(result.report.exactPixels!==true)throw new Error(`ASSET_SPACE_EFFORT_NOT_EXACT:${rel(file)}:${effort}`);
    efforts[effort]=record(source,result,elapsedMs);
  }
  const autoStart=now();
  const autoResult=optimizePngWithAdaptiveEffort(source,{profile});
  const autoElapsed=ms(autoStart,now());
  if(autoResult.report.exactPixels!==true)throw new Error(`ASSET_SPACE_EFFORT_NOT_EXACT:${rel(file)}:auto`);
  efforts.auto=record(source,autoResult,autoElapsed);

  const fast=efforts.fast,balanced=efforts.balanced,deep=efforts.deep,auto=efforts.auto;
  rows.push({
    file:rel(file),sourceBytes:source.length,megapixels:Number(((decoded.ihdr.width*decoded.ihdr.height)/1e6).toFixed(3)),
    profile:{kind:profile.kind,policy:profile.adaptivePolicy,uniqueColors:profile.metrics.uniqueColors,transparentRatio:profile.metrics.transparentRatio},
    efforts,
    marginal:{
      balancedVsFast:{savedBytes:fast.outputBytes-balanced.outputBytes,extraMs:Number((balanced.elapsedMs-fast.elapsedMs).toFixed(3))},
      deepVsFast:{savedBytes:fast.outputBytes-deep.outputBytes,extraMs:Number((deep.elapsedMs-fast.elapsedMs).toFixed(3))},
      autoVsFast:{savedBytes:fast.outputBytes-auto.outputBytes,extraMs:Number((auto.elapsedMs-fast.elapsedMs).toFixed(3))},
      autoVsBalanced:{savedBytes:balanced.outputBytes-auto.outputBytes,elapsedMsSaved:Number((balanced.elapsedMs-auto.elapsedMs).toFixed(3))}
    }
  });
  console.log(`EFFORT ${rel(file)} fast=${fast.outputBytes}/${fast.elapsedMs}ms auto=${auto.outputBytes}/${auto.elapsedMs}ms[${auto.effortController?.stages?.map(s=>s.effort).join('>')||'-'}] balanced=${balanced.outputBytes}/${balanced.elapsedMs}ms deep=${deep.outputBytes}/${deep.elapsedMs}ms`);
}

const totals={};
for(const effort of ['fast','auto','balanced','deep']){
  const outputBytes=rows.reduce((sum,row)=>sum+row.efforts[effort].outputBytes,0),sourceBytes=rows.reduce((sum,row)=>sum+row.sourceBytes,0),elapsedMs=rows.reduce((sum,row)=>sum+row.efforts[effort].elapsedMs,0);
  totals[effort]={sourceBytes,outputBytes,elapsedMs:Number(elapsedMs.toFixed(3)),savedBytes:sourceBytes-outputBytes,savedPercent:sourceBytes?Number((((sourceBytes-outputBytes)/sourceBytes)*100).toFixed(4)):0,savedBytesPerSecond:elapsedMs>0?Number(((sourceBytes-outputBytes)/(elapsedMs/1000)).toFixed(1)):null};
}
function delta(a,b){return{extraSavedBytes:totals[a].outputBytes-totals[b].outputBytes,extraMs:Number((totals[b].elapsedMs-totals[a].elapsedMs).toFixed(3))};}
const report={version:'kelo-asset-space-effort-benchmark-v2',generatedAt:new Date().toISOString(),fileCount:rows.length,totals,frontier:{autoVsFast:delta('fast','auto'),balancedVsFast:delta('fast','balanced'),deepVsFast:delta('fast','deep'),autoVsBalanced:{sameBytes:totals.auto.outputBytes===totals.balanced.outputBytes,elapsedMsSaved:Number((totals.balanced.elapsedMs-totals.auto.elapsedMs).toFixed(3)),cpuPercentSaved:totals.balanced.elapsedMs>0?Number(((1-totals.auto.elapsedMs/totals.balanced.elapsedMs)*100).toFixed(2)):0}},files:rows};
fs.mkdirSync(reportDir,{recursive:true});
fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify(report,null,2));
console.log(`ASSET_SPACE_EFFORT_BENCHMARK_DONE fast=-${totals.fast.savedPercent}% auto=-${totals.auto.savedPercent}% balanced=-${totals.balanced.savedPercent}% deep=-${totals.deep.savedPercent}% autoVsBalancedCpuSaved=${report.frontier.autoVsBalanced.cpuPercentSaved}%`);
