/* KELO-INDEX
 * area: CREATORS / ASSET PERFORMANCE
 * owner: Kelo Creator Asset Bridge
 * keys: EFFORT CONTROLLER FAST BALANCED DEEP MARGINAL BYTES CPU PALETTE STRUCTURAL
 * purpose: stop expensive PNG search when cheap evidence does not justify more CPU while preserving exact structural and palette-order opportunities
 * public-api: optimizePngWithAdaptiveEffort()
 * state-owned: none
 * online: N/A; build/publish-time capability
 */

import {performance} from 'node:perf_hooks';
import {optimizePngLossless} from './png-space-optimizer.mjs';
import {PALETTE_ORDER_FAST,PALETTE_ORDER_BALANCED,PALETTE_ORDER_DEEP} from './png-palette-order.mjs';

function run(buffer,label,options){const started=performance.now(),result=optimizePngLossless(buffer,options);return{label,elapsedMs:Number((performance.now()-started).toFixed(3)),result};}
function saved(sourceBytes,result){return Math.max(0,sourceBytes-(result?.buffer?.length??sourceBytes));}
function stagePublic(stage,sourceBytes){return{effort:stage.label,elapsedMs:stage.elapsedMs,outputBytes:stage.result.buffer.length,savedBytes:saved(sourceBytes,stage.result),savedPercent:sourceBytes?Number((saved(sourceBytes,stage.result)/sourceBytes*100).toFixed(4)):0,winner:stage.result.report?.winner||null,status:stage.result.report?.status||null,paletteOrderings:stage.result.report?.paletteCandidate?.orderings||[]};}
function structuralWinner(result){return String(result?.report?.winner?.kind||'').startsWith('exact-');}

export function optimizePngWithAdaptiveEffort(buffer,options={}){
  const profile=options.profile||null;
  const sourceBytes=buffer.length;
  const uniqueColors=Number(profile?.metrics?.uniqueColors||4097);
  const minExtraBytes=options.minExtraBytes??4096;
  const minBytesPerExtraSecond=options.minBytesPerExtraSecond??4096;
  const maxBalancedSourceBytes=options.maxBalancedSourceBytes??16*1024*1024;
  const maxCheapProbeSourceBytes=options.maxCheapProbeSourceBytes??512*1024;
  const maxExactPaletteColors=options.maxExactPaletteColors??256;
  const baseLossless=options.losslessOptions||{};
  const explicitPaletteOrders=baseLossless.paletteOrderStrategies||null;
  const fastOptions={...baseLossless,filterStrategies:['adaptive'],paletteOrderStrategies:explicitPaletteOrders||PALETTE_ORDER_FAST,disablePalette:uniqueColors>64};
  const fast=run(buffer,'fast',fastOptions),stages=[fast];

  const reasons=[];
  if(options.forceBalanced===true)reasons.push('forced-balanced');
  if(options.forceDeep===true)reasons.push('forced-deep');
  if(uniqueColors<=maxExactPaletteColors)reasons.push('exact-palette-possible');
  if(structuralWinner(fast.result))reasons.push('structural-winner-needs-filter-check');
  if(sourceBytes<=maxCheapProbeSourceBytes)reasons.push('cheap-small-file-probe');
  const balancedAllowed=sourceBytes<=maxBalancedSourceBytes;
  const balancedJustified=balancedAllowed&&reasons.length>0;

  let best=fast,decision=balancedAllowed?'fast-sufficient':'fast-size-cap',balancedMarginal=null;
  if(balancedJustified){
    const balanced=run(buffer,'balanced',{...baseLossless,filterStrategies:['adaptive',0,4],paletteOrderStrategies:explicitPaletteOrders||PALETTE_ORDER_BALANCED});
    stages.push(balanced);
    if(balanced.result.buffer.length<best.result.buffer.length)best=balanced;
    const extraBytes=Math.max(0,fast.result.buffer.length-balanced.result.buffer.length);
    const extraMs=Math.max(0.001,balanced.elapsedMs);
    const bytesPerExtraSecond=extraBytes/(extraMs/1000);
    balancedMarginal={extraBytes,extraMs:Number(extraMs.toFixed(3)),bytesPerExtraSecond:Number(bytesPerExtraSecond.toFixed(1))};
    const deepWorthTesting=options.forceDeep===true||(extraBytes>=minExtraBytes&&bytesPerExtraSecond>=minBytesPerExtraSecond);
    decision=deepWorthTesting?'deep-probe-justified':extraBytes>0?'balanced-won-marginal-stop':'balanced-no-win-stop';
    if(deepWorthTesting){
      const deep=run(buffer,'deep',{...baseLossless,paletteOrderStrategies:explicitPaletteOrders||PALETTE_ORDER_DEEP});
      stages.push(deep);
      if(deep.result.buffer.length<best.result.buffer.length)best=deep;
      decision=best===deep?'deep-won':'deep-no-win';
    }
  }

  return{buffer:best.result.buffer,report:{...best.result.report,effortController:{version:'kelo-asset-effort-controller-v2.1',selected:best.label,decision,opportunity:{balancedAllowed,balancedJustified,reasons,uniqueColors,sourceBytes},marginal:{balancedVsFast:balancedMarginal},thresholds:{minExtraBytes,minBytesPerExtraSecond,maxBalancedSourceBytes,maxCheapProbeSourceBytes,maxExactPaletteColors},paletteOrders:{fast:[...(explicitPaletteOrders||PALETTE_ORDER_FAST)],balanced:[...(explicitPaletteOrders||PALETTE_ORDER_BALANCED)],deep:[...(explicitPaletteOrders||PALETTE_ORDER_DEEP)]},stages:stages.map(stage=>stagePublic(stage,sourceBytes))}}};
}
