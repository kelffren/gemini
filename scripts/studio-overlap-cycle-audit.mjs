import assert from 'node:assert/strict';
import fs from 'node:fs';
import { overlappingEntitiesAtPoint, nextOverlapSelection } from '../src/studio/input/studio-overlap-cycle-controller.mjs';

const entities=[{id:'bottom'},{id:'middle'},{id:'top'}];
const rects=new Map([
  ['bottom',{rect:{x:0,y:0,w:100,h:100}}],
  ['middle',{rect:{x:20,y:20,w:60,h:60}}],
  ['top',{rect:{x:30,y:30,w:40,h:40}}]
]);
const spatial={get:id=>rects.get(id)};

assert.deepEqual(overlappingEntitiesAtPoint({entities,spatial},50,50).map(row=>row.id),['top','middle','bottom'],'overlap candidates must follow topmost-last document order');
assert.deepEqual(overlappingEntitiesAtPoint({entities,spatial},10,10).map(row=>row.id),['bottom'],'point filtering must exclude entities outside the pointer');
assert.equal(nextOverlapSelection(overlappingEntitiesAtPoint({entities,spatial},50,50),'top').id,'middle','cycling must move from top to next entity');
assert.equal(nextOverlapSelection(overlappingEntitiesAtPoint({entities,spatial},50,50),'bottom').id,'top','cycling must wrap back to the topmost entity');
assert.equal(nextOverlapSelection(overlappingEntitiesAtPoint({entities,spatial},50,50),'missing').id,'top','cycling without a current candidate must select topmost first');

const source=fs.readFileSync(new URL('../src/studio/input/studio-overlap-cycle-controller.mjs',import.meta.url),'utf8');
assert.match(source,/event\.altKey/,'overlap cycling must require an intentional Alt/Option gesture');
assert.match(source,/event\.pointerType==='touch'/,'desktop overlap gesture must not hijack touch editing');
assert.match(source,/screenToWorld/,'pointer selection must use the camera owner coordinate conversion');
assert.match(source,/\['select','move'\]\.includes/,'cycling must only run in object editing modes');
assert.match(source,/kernel\.selection\.set/,'feature must mutate local selection only');
assert.doesNotMatch(source,/kernel\.execute|createMoveEntityCommand|createPatchEntityCommand|worldEditRequest/,'overlap cycling must not create world commands or authority writes');
assert.match(source,/stopImmediatePropagation/,'successful cycling must prevent the ordinary click selector from immediately replacing the result');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioOverlapCycleController/,'Studio entry must install overlap cycling');
assert.match(entry,/overlapCycleController\.destroy\(\)/,'Studio close must remove the overlap controller');
assert.match(entry,/kelo-studio-foundation-v1\.11\.0-overlap-cycle/,'Studio version must include the overlap-cycle release');

console.log(JSON.stringify({ok:true,deterministicOrder:true,wrap:true,localSelectionOnly:true,intentionalGesture:true,inputCleanup:true},null,2));
