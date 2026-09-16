/* KELO-INDEX
 * area: QA / CREATOR ASSET QUALITY
 * owner: Kelo Creator Asset Bridge
 * keys: GOLDEN CORPUS QUALITY ALPHA SEAM RENDER EXACT COMPOSITED
 * purpose: pin expected Quality Agent behaviour for exact pixels, hidden transparent RGB, visible changes, alpha and seam-sensitive borders
 * online: N/A; deterministic CI audit
 */

import assert from 'node:assert/strict';
import {evaluatePixelFidelity,judgePixelFidelity} from '../src/creators/assets/png-quality-agent.mjs';

const width=32,height=32,count=width*height;
function baseImage(){const rgba=Buffer.alloc(count*4);for(let y=0;y<height;y+=1)for(let x=0;x<width;x+=1){const o=(y*width+x)*4;rgba[o]=(x*9)&255;rgba[o+1]=(y*11)&255;rgba[o+2]=((x+y)*7)&255;rgba[o+3]=(x<4&&y<4)?0:255;}return rgba;}
const source=baseImage();
const exact=Buffer.from(source),exactMetrics=evaluatePixelFidelity(source,exact,width,height);assert.equal(judgePixelFidelity(exactMetrics,'strict').pass,true);assert.equal(exactMetrics.compositedMeanAbsRgb,0);

const hidden=Buffer.from(source);for(let y=0;y<4;y+=1)for(let x=0;x<4;x+=1){const o=(y*width+x)*4;hidden[o]^=255;hidden[o+1]^=127;hidden[o+2]^=63;}
const hiddenMetrics=evaluatePixelFidelity(source,hidden,width,height);assert.equal(judgePixelFidelity(hiddenMetrics,'strict').pass,false);assert.equal(judgePixelFidelity(hiddenMetrics,'render-exact').pass,true);assert.equal(hiddenMetrics.renderChangedPixels,0);assert.ok(hiddenMetrics.hiddenTransparentRgbChangedPixels>0);assert.equal(hiddenMetrics.compositedMeanAbsRgb,0);

const visible=Buffer.from(source);visible[(10*width+10)*4]+=20;const visibleMetrics=evaluatePixelFidelity(source,visible,width,height);assert.equal(judgePixelFidelity(visibleMetrics,'render-exact').pass,false);assert.ok(visibleMetrics.compositedMeanAbsRgb>0);

const alpha=Buffer.from(source);alpha[(12*width+12)*4+3]=220;const alphaMetrics=evaluatePixelFidelity(source,alpha,width,height);assert.equal(judgePixelFidelity(alphaMetrics,'balanced').pass,false);assert.ok(alphaMetrics.compositedMeanAbsRgb>0);assert.ok(alphaMetrics.premultipliedMeanAbsRgb>0);

const seam=Buffer.from(source);seam[0]=Math.min(255,seam[0]+8);seam[3]=255;const seamMetrics=evaluatePixelFidelity(source,seam,width,height);assert.equal(judgePixelFidelity(seamMetrics,'seam-safe').pass,false);assert.ok(seamMetrics.borderChangedPixels>0);

console.log(JSON.stringify({status:'ASSET_QUALITY_GOLDEN_CORPUS_OK',cases:{exact:{score:judgePixelFidelity(exactMetrics,'strict').score},hidden:{strict:judgePixelFidelity(hiddenMetrics,'strict').pass,renderExact:judgePixelFidelity(hiddenMetrics,'render-exact').pass},visible:{renderExact:judgePixelFidelity(visibleMetrics,'render-exact').pass},alpha:{balanced:judgePixelFidelity(alphaMetrics,'balanced').pass,compositedMean:alphaMetrics.compositedMeanAbsRgb},seam:{pass:judgePixelFidelity(seamMetrics,'seam-safe').pass,borderChanged:seamMetrics.borderChangedPixels}}},null,2));
