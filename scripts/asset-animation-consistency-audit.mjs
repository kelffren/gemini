/* KELO-INDEX
 * area: QA / CREATOR ASSET QUALITY
 * owner: Kelo Creator Asset Bridge
 * keys: ANIMATION CONSISTENCY FLICKER ANCHOR SILHOUETTE PALETTE ALPHA AUDIT
 * purpose: regression-test temporal asset metrics against stable motion, anchor jumps and one-frame alpha flashes
 * public-api: CLI audit
 * state-owned: none
 * online: N/A; deterministic build-time audit
 */

import assert from 'node:assert/strict';
import {analyzeAnimationConsistency,judgeAnimationConsistency} from '../src/creators/assets/asset-animation-consistency.mjs';

function makeFrame(id,shift=0,options={}){
  const width=16,height=16,rgba=Buffer.alloc(width*height*4);
  if(options.flash){for(let i=0;i<width*height;i+=1){const o=i*4;rgba[o]=42;rgba[o+1]=120;rgba[o+2]=220;rgba[o+3]=255;}}
  else{
    for(let y=4;y<12;y+=1){for(let x=5+shift;x<11+shift;x+=1){const o=(y*width+x)*4;rgba[o]=42;rgba[o+1]=120;rgba[o+2]=220;rgba[o+3]=255;}}
    const footY=12,footX=shift%2?10+shift:5+shift;for(let x=footX;x<Math.min(width,footX+2);x+=1){const o=(footY*width+x)*4;rgba[o]=230;rgba[o+1]=190;rgba[o+2]=70;rgba[o+3]=255;}
  }
  return{id,width,height,rgba,anchor:options.anchor??{x:8,y:13}};
}

const stable=[makeFrame('f0',0),makeFrame('f1',1),makeFrame('f2',0),makeFrame('f3',-1),makeFrame('f4',0),makeFrame('f5',1)];
const stableReport=analyzeAnimationConsistency(stable,{outlierZ:3.5});
const limits={requireSameDimensions:true,minMaskIoU:0.6,maxAlphaCoverageDelta:0.05,maxAlphaMassDeltaRatio:0.12,maxCentroidDistance:2,minPaletteJaccard:0.6,maxAnchorDrift:0,rejectRobustOutliers:true};
const stableVerdict=judgeAnimationConsistency(stableReport,limits);
assert.equal(stableVerdict.pass,true,`stable animation rejected: ${stableVerdict.reasons.join(',')}`);

const anchorBroken=stable.map(frame=>({...frame,rgba:Buffer.from(frame.rgba),anchor:{...frame.anchor}}));
anchorBroken[3].anchor={x:13,y:13};
const anchorReport=analyzeAnimationConsistency(anchorBroken);
const anchorVerdict=judgeAnimationConsistency(anchorReport,limits);
assert.equal(anchorVerdict.pass,false,'anchor jump must fail');
assert.ok(anchorVerdict.reasons.includes('anchor-drift'),'anchor jump reason missing');
assert.ok(anchorReport.temporal.maxAnchorDrift>=5,'anchor drift magnitude missing');

const flashed=stable.map(frame=>({...frame,rgba:Buffer.from(frame.rgba),anchor:{...frame.anchor}}));
flashed[3]=makeFrame('f3-flash',0,{flash:true,anchor:{x:8,y:13}});
const flashReport=analyzeAnimationConsistency(flashed,{outlierZ:3});
const flashVerdict=judgeAnimationConsistency(flashReport,limits);
assert.equal(flashVerdict.pass,false,'one-frame alpha flash must fail');
assert.ok(flashVerdict.reasons.some(reason=>['alpha-coverage-jump','alpha-mass-jump','temporal-outlier'].includes(reason)),'flash reason missing');

console.log(JSON.stringify({
  status:'ASSET_ANIMATION_CONSISTENCY_AUDIT_OK',
  stable:{pass:stableVerdict.pass,minMaskIoU:stableReport.temporal.minMaskIoU,maxCentroidDistance:stableReport.temporal.maxCentroidDistance,maxAnchorDrift:stableReport.temporal.maxAnchorDrift},
  anchorJump:{pass:anchorVerdict.pass,reasons:anchorVerdict.reasons,maxAnchorDrift:anchorReport.temporal.maxAnchorDrift},
  flash:{pass:flashVerdict.pass,reasons:flashVerdict.reasons,maxAlphaCoverageDelta:flashReport.temporal.maxAlphaCoverageDelta,outliers:flashReport.temporal.alphaCoverageOutlierFrames}
},null,2));
