import assert from 'node:assert/strict';
import {planSpriteFrameNormalization} from '../src/creators/sprite-compiler/sprite-frame-normalizer.mjs';
const F=Object.freeze;
function frame(column,{touchesCanvasEdge=false,boundaryRatio=.03}={}){return F({row:0,column,direction:'s',area:600,bounds:F({x:20+column*40,y:20,w:20,h:30}),sourceRect:F({x:18+column*40,y:18,w:24,h:34}),cell:F({x:10+column*40,y:10,w:40,h:50}),boundaryRatio,touchesCanvasEdge});}
const baseRig=F({groups:F([F([frame(0),frame(1),frame(2),frame(3)])]),directionKeys:F(['s']),rowMap:F({s:0}),directions:1});
let plan=planSpriteFrameNormalization(baseRig,{sourceWidth:200,sourceHeight:100});
assert.equal(plan.sourceCropDiagnostics[0].classification,'RECOVERABLE_SOURCE_CROP');
assert.equal(plan.artDefects.length,0,'recoverable crop must not be escalated to missing source art');
plan=planSpriteFrameNormalization(baseRig,{sourceWidth:200,sourceHeight:100,framePatches:{0:{scale:1,x:0,y:0,sourceRect:{x:12,y:12,w:36,h:44}}}});
assert.equal(plan.sourceCropDiagnostics[0].classification,'RECOVERED_SOURCE_CROP');
assert.equal(plan.artDefects.length,0);
const physical=F({...baseRig,groups:F([F([frame(0,{touchesCanvasEdge:true}),frame(1),frame(2),frame(3)])])});
plan=planSpriteFrameNormalization(physical,{sourceWidth:200,sourceHeight:100});
assert.equal(plan.sourceCropDiagnostics[0].classification,'SOURCE_ART_MISSING');
assert.equal(plan.artDefects[0].code,'ART_DEFECT_REGENERATION_REQUIRED');
console.log('✓ RECOVERABLE_SOURCE_CROP stays repairable');
console.log('✓ expanded sourceRect becomes RECOVERED_SOURCE_CROP');
console.log('✓ physical image edge remains SOURCE_ART_MISSING / hard art defect');
