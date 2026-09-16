/* KELO-INDEX
 * area: CREATORS / ASSET PERFORMANCE
 * owner: Kelo Creator Asset Bridge
 * keys: EFFORT CONTROLLER FAST BALANCED DEEP MARGINAL BYTES CPU
 * purpose: stop expensive PNG search when additional CPU is not producing enough additional bytes saved
 * public-api: optimizePngWithAdaptiveEffort()
 * state-owned: none
 * online: N/A; build/publish-time capability
 */

import {performance} from 'node:perf_hooks';
import {optimizePngLossless} from './png-space-optimizer.mjs';

function run(buffer,label,options){const started=performance.now(),result=optimizePngLossless(buffer,options);return{label,elapsedMs:Number((performance.now()-started).toFixed(3)),result};}
function saved(sourceBytes,result){return Math.max(0,sourceBytes-(result?.buffer?.length??sourceBytes));}
function stagePublic(stage,sourceBytes){return{effort:stage.label,elapsedMs:stage.elapsedMs,outputBytes:stage.result.buffer.length,savedBytes:saved(sourceBytes,stage.result),savedPercent:sourceBytes?Number((saved(sourceBytes,stage.result)/sourceBytes*100).toFixed(4)):0,winner:stage.result.report?.winner||null,status:stage.result.report?.status||null};}

export function optimizePngWithAdaptiveEffort(buffer,options={}){
  const profile=options.profile||null,sourceBytes=buffer.length,minExtraBytes=options.minExtraBytes??4096,minBytesPerExtraSecond=options.minBytesPerExtraSecond??4096,maxBalancedSourceBytes=options.maxBalancedSourceBytes??16*1024*1024;
  const fastOptions={...(options.losslessOptions||{}),filterStrategies:['adaptive'],disablePalette:(profile?.metrics?.uniqueColors||4097)>64};
  const fast=run(buffer,'fast',fastOptions),stages=[fast];
  const opportunity=sourceBytes<=maxBalancedSourceBytes&&(
    (profile?.metrics?.uniqueColors||4097)<=512||
    (profile?.metrics?.transparentRatio||0)>0.01||
    saved(sourceBytes,fast.result)<sourceBytes*0.05||
    ['original','refilter'].includes(fast.result.report?.winner?.kind)
  );
  let best=fast,decision='fast-sufficient';
  if(opportunity){
    const balanced=run(buffer,'balanced',{...(options.losslessOptions||{}),filterStrategies:['adaptive',0,4]});stages.push(balanced);
    if(balanced.result.buffer.length<best.result.buffer.length)best=balanced;
    const extraBytes=Math.max(0,fast.result.buffer.length-balanced.result.buffer.length),extraMs=Math.max(0.001,balanced.elapsedMs),bytesPerExtraSecond=extraBytes/(extraMs/1000);
    const deepWorthTesting=options.forceDeep===true||(extraBytes>=minExtraBytes&&bytesPerExtraSecond>=minBytesPerExtraSecond);
    decision=deepWorthTesting?'deep-probe-justified':'balanced-marginal-stop';
    if(deepWorthTesting){const deep=run(buffer,'deep',{...(options.losslessOptions||{})});stages.push(deep);if(deep.result.buffer.length<best.result.buffer.length)best=deep;decision=best===deep?'deep-won':'deep-no-win';}
  }
  return{buffer:best.result.buffer,report:{...best.result.report,effortController:{version:'kelo-asset-effort-controller-v1',selected:best.label,decision,thresholds:{minExtraBytes,minBytesPerExtraSecond,maxBalancedSourceBytes},stages:stages.map(stage=>stagePublic(stage,sourceBytes))}}};
}
