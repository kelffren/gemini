#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / CREATOR ASSET PERFORMANCE
 * owner: Kelo Creator Asset Bridge
 * keys: EFFORT CONTROLLER AUTO FAST BALANCED DEEP CPU ESCALATION REGRESSION
 * purpose: prove AUTO skips unjustified expensive search while retaining exact palette, cheap-file and forced-deep escalation paths
 * online: N/A; deterministic build-time audit
 */

import assert from 'node:assert/strict';
import {decodePngRgba,encodeRgbaPng} from '../src/creators/assets/png-space-optimizer.mjs';
import {optimizePngWithAdaptiveEffort} from '../src/creators/assets/asset-effort-controller.mjs';

function image(width,height,pixel){
  const rgba=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y+=1)for(let x=0;x<width;x+=1){const o=(y*width+x)*4,c=pixel(x,y);rgba[o]=c[0];rgba[o+1]=c[1];rgba[o+2]=c[2];rgba[o+3]=c[3]??255;}
  return{rgba,png:encodeRgbaPng(rgba,width,height,{level:1,filterStrategy:0}),width,height};
}
function profile(uniqueColors){return{kind:'sprite',metrics:{uniqueColors,transparentRatio:0,pixelArtConfidence:0}};}
function proveExact(fixture,result,label){
  const decoded=decodePngRgba(result.buffer);
  assert.equal(decoded.ihdr.width,fixture.width,`${label}: width`);
  assert.equal(decoded.ihdr.height,fixture.height,`${label}: height`);
  assert.deepEqual(decoded.rgba,fixture.rgba,`${label}: exact RGBA`);
  assert.equal(result.report.exactPixels,true,`${label}: strict report`);
}

const high=image(96,96,(x,y)=>[(x*17+y*3)&255,(x*5+y*19)&255,(x*11+y*7)&255,255]);
const highFast=optimizePngWithAdaptiveEffort(high.png,{profile:profile(4097),maxCheapProbeSourceBytes:0});
proveExact(high,highFast,'high-fast');
assert.equal(highFast.report.effortController.version,'kelo-asset-effort-controller-v2');
assert.deepEqual(highFast.report.effortController.stages.map(s=>s.effort),['fast'],'large/high-color route must stop at FAST without evidence');
assert.equal(highFast.report.effortController.opportunity.balancedJustified,false);

const paletteColors=[[0,0,0,0],[25,50,90,255],[220,175,45,255],[245,245,245,255]];
const palette=image(96,96,(x,y)=>paletteColors[((x>>3)+(y>>3))%paletteColors.length]);
const paletteAuto=optimizePngWithAdaptiveEffort(palette.png,{profile:profile(4),maxCheapProbeSourceBytes:0});
proveExact(palette,paletteAuto,'palette-auto');
assert.ok(paletteAuto.report.effortController.stages.some(s=>s.effort==='balanced'),'exact palette opportunity must retain BALANCED check');
assert.ok(paletteAuto.report.effortController.opportunity.reasons.includes('exact-palette-possible'));

const cheapAuto=optimizePngWithAdaptiveEffort(high.png,{profile:profile(4097),maxCheapProbeSourceBytes:high.png.length+1});
proveExact(high,cheapAuto,'cheap-auto');
assert.ok(cheapAuto.report.effortController.stages.some(s=>s.effort==='balanced'),'cheap files may probe BALANCED');
assert.ok(cheapAuto.report.effortController.opportunity.reasons.includes('cheap-small-file-probe'));

const forced=optimizePngWithAdaptiveEffort(high.png,{profile:profile(4097),maxCheapProbeSourceBytes:0,forceDeep:true});
proveExact(high,forced,'force-deep');
assert.deepEqual(forced.report.effortController.stages.map(s=>s.effort),['fast','balanced','deep'],'forceDeep must preserve explicit exhaustive path');

console.log(JSON.stringify({status:'ASSET_EFFORT_CONTROLLER_AUDIT_OK',high:{bytes:high.png.length,stages:highFast.report.effortController.stages.map(s=>s.effort),decision:highFast.report.effortController.decision},palette:{bytes:palette.png.length,stages:paletteAuto.report.effortController.stages.map(s=>s.effort),decision:paletteAuto.report.effortController.decision,reasons:paletteAuto.report.effortController.opportunity.reasons},cheap:{stages:cheapAuto.report.effortController.stages.map(s=>s.effort)},forced:{stages:forced.report.effortController.stages.map(s=>s.effort)}}));
