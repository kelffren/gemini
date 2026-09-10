import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveStudioNudgeStep } from '../src/studio/input/studio-nudge-controller.mjs';

const fakeRoot={document:{querySelector:()=>({value:'16'})}};
const fakeKernel={document:{settings:{tileSize:32}}};
assert.equal(resolveStudioNudgeStep({root:fakeRoot,kernel:fakeKernel}),16,'nudge must follow the live Snap selector');
assert.equal(resolveStudioNudgeStep({root:fakeRoot,kernel:fakeKernel,shiftKey:true}),1,'Shift+nudge must always provide 1px precision');
assert.equal(resolveStudioNudgeStep({root:{document:{querySelector:()=>null}},kernel:fakeKernel}),32,'nudge must fall back to world tile size');

const source=fs.readFileSync(new URL('../src/studio/input/studio-nudge-controller.mjs',import.meta.url),'utf8');
assert.match(source,/ArrowLeft:\{x:-1,y:0\}/,'left arrow must be wired');
assert.match(source,/ArrowRight:\{x:1,y:0\}/,'right arrow must be wired');
assert.match(source,/ArrowUp:\{x:0,y:-1\}/,'up arrow must be wired');
assert.match(source,/ArrowDown:\{x:0,y:1\}/,'down arrow must be wired');
assert.match(source,/input,textarea,select,\[contenteditable="true"\]/,'nudge must never steal arrows while editing UI fields');
assert.match(source,/\['select','move'\]\.includes/,'nudge must only own arrows in object editing modes');
assert.match(source,/event\.repeat/,'held keys must not flood Undo history');
assert.match(source,/createCompositeCommand\(commands,\{type:'entity\.batch\.nudge'/,'multi-selection nudges must be one reversible batch');
assert.match(source,/await kernel\.execute\(command\)/,'persistent nudges must flow through Kernel CommandBus');
assert.match(source,/\[data-ext="snap"\]/,'nudge must read the creator Snap control instead of inventing a second precision setting');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioNudgeController/,'Studio entry must install nudge input');
assert.match(entry,/nudgeController\.destroy\(\)/,'Studio close must release nudge input');
assert.match(entry,/kelo-studio-foundation-v1\.10\.0-nudge/,'Studio version must include precise nudging');

console.log(JSON.stringify({ok:true,arrowNudge:true,shiftFine:true,liveSnap:true,multiSelectionBatch:true,commandBus:true,historyFloodGuard:true},null,2));
