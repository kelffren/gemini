import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveStudioNudgeStep, mergeStudioNudgeSerialization } from '../src/studio/input/studio-nudge-controller.mjs';
import { createHistoryManager } from '../src/studio/core/history-manager.mjs';
import { createCommandBus } from '../src/studio/core/command-bus.mjs';
import { createMoveEntityCommand } from '../src/studio/document/document-commands.mjs';

const fakeRoot={document:{querySelector:()=>({value:'16'})}};
const fakeKernel={document:{settings:{tileSize:32}}};
assert.equal(resolveStudioNudgeStep({root:fakeRoot,kernel:fakeKernel}),16,'nudge must follow the live Snap selector');
assert.equal(resolveStudioNudgeStep({root:fakeRoot,kernel:fakeKernel,shiftKey:true}),1,'Shift+nudge must always provide 1px precision');
assert.equal(resolveStudioNudgeStep({root:fakeRoot,kernel:fakeKernel,altKey:true}),64,'Alt+nudge must move by four live Snap steps');
assert.equal(resolveStudioNudgeStep({root:fakeRoot,kernel:fakeKernel,shiftKey:true,altKey:true}),1,'Shift precision must win over coarse Alt mode');
assert.equal(resolveStudioNudgeStep({root:{document:{querySelector:()=>null}},kernel:fakeKernel}),32,'nudge must fall back to world tile size');
assert.equal(resolveStudioNudgeStep({root:{document:{querySelector:()=>null}},kernel:fakeKernel,altKey:true}),128,'Alt+nudge must also scale the tile-size fallback');

const mergedSingle=mergeStudioNudgeSerialization(
  {type:'entity.move',id:'a',from:{x:0,y:0},to:{x:16,y:0}},
  {type:'entity.move',id:'a',from:{x:16,y:0},to:{x:48,y:0}}
);
assert.deepEqual(mergedSingle,{type:'entity.move',id:'a',from:{x:0,y:0},to:{x:48,y:0}},'held single-object nudge must serialize initial -> final as a normal move');
const mergedBatch=mergeStudioNudgeSerialization(
  {type:'entity.batch.nudge',label:'Nudge 2 objects',commands:[{type:'entity.move',id:'a',from:{x:0,y:0},to:{x:16,y:0}},{type:'entity.move',id:'b',from:{x:8,y:8},to:{x:24,y:8}}]},
  {type:'entity.batch.nudge',label:'Nudge 2 objects',commands:[{type:'entity.move',id:'a',from:{x:16,y:0},to:{x:48,y:0}},{type:'entity.move',id:'b',from:{x:24,y:8},to:{x:56,y:8}}]}
);
assert.equal(mergedBatch.type,'entity.batch.nudge','multi-object held nudge must retain the known authority batch type');
assert.deepEqual(mergedBatch.commands.map(row=>row.from),[{x:0,y:0},{x:8,y:8}],'batch merge must retain each original position');
assert.deepEqual(mergedBatch.commands.map(row=>row.to),[{x:48,y:0},{x:56,y:8}],'batch merge must retain each final position');
assert.equal(mergeStudioNudgeSerialization({type:'entity.patch'},{type:'entity.move',id:'a'}),null,'unrelated command shapes must refuse coalescing');

const document={entities:[{id:'a',transform:{x:0,y:0},bounds:{w:16,h:16}}]};
const history=createHistoryManager();
const bus=createCommandBus({history});
const context={document};
for(const x of [16,32,48]){
  const command=createMoveEntityCommand('a',{x,y:0});
  command.historyMergeKey='audit-hold-1';
  command.historyMergeWindowMs=10000;
  command.historyMergeSerialized=mergeStudioNudgeSerialization;
  await bus.execute(command,context);
}
assert.equal(document.entities[0].transform.x,48,'held burst must reach the final repeated position');
assert.equal(history.undoDepth,1,'three repeated nudges in one hold must consume one Undo entry');
const undone=await history.undo();
assert.equal(document.entities[0].transform.x,0,'one Undo must restore the pre-hold position');
assert.equal(undone.serialized.type,'entity.move','coalesced history must remain authority-compatible entity.move serialization');
assert.deepEqual(undone.serialized.from,{x:0,y:0},'authority serialization must retain the initial position');
assert.deepEqual(undone.serialized.to,{x:48,y:0},'authority serialization must retain the final position');
await history.redo();
assert.equal(document.entities[0].transform.x,48,'one Redo must restore the final held position');

const source=fs.readFileSync(new URL('../src/studio/input/studio-nudge-controller.mjs',import.meta.url),'utf8');
assert.match(source,/ArrowLeft:\{x:-1,y:0\}/,'left arrow must be wired');
assert.match(source,/ArrowRight:\{x:1,y:0\}/,'right arrow must be wired');
assert.match(source,/ArrowUp:\{x:0,y:-1\}/,'up arrow must be wired');
assert.match(source,/ArrowDown:\{x:0,y:1\}/,'down arrow must be wired');
assert.match(source,/COARSE_MULTIPLIER=4/,'coarse nudge multiplier must stay explicit and auditable');
assert.match(source,/HOLD_REPEAT_INTERVAL_MS=70/,'held nudge must throttle browser repeat to a bounded cadence');
assert.match(source,/HOLD_MERGE_WINDOW_MS=900/,'held nudge must expose an explicit short history merge window');
assert.match(source,/input,textarea,select,\[contenteditable="true"\]/,'nudge must never steal arrows while editing UI fields');
assert.match(source,/event\.metaKey\|\|event\.ctrlKey\|\|editableTarget/,'Ctrl/Meta shortcuts and editable fields must retain arrow ownership');
assert.doesNotMatch(source,/if\(event\.repeat\)return/,'held arrows must no longer be discarded entirely');
assert.match(source,/event\.repeat\|\|!hold/,'fresh keydown and browser repeats must share an explicit hold session');
assert.match(source,/document\.addEventListener\('keyup',onKeyUp,true\)/,'keyup must end the coalescing session');
assert.match(source,/root\.addEventListener\?\.\('blur',clearHolds\)/,'window blur must clear stale held-key state');
assert.match(source,/createCompositeCommand\(commands,\{type:'entity\.batch\.nudge'/,'multi-selection nudges must be one reversible batch');
assert.match(source,/await kernel\.execute\(command\)/,'every persistent repeated move must still flow through Kernel CommandBus');
assert.match(source,/command\.historyMergeSerialized=mergeStudioNudgeSerialization/,'held history merge must provide domain-safe serialization');
assert.match(source,/\[data-ext="snap"\]/,'nudge must read the creator Snap control instead of inventing a second precision setting');
assert.match(source,/altKey:event\.altKey/,'keyboard handler must pass Alt state to step resolution');

const historySource=fs.readFileSync(new URL('../src/studio/core/history-manager.mjs',import.meta.url),'utf8');
assert.match(historySource,/typeof wrapped\.mergeSerialized === 'function'/,'history must refuse opaque merges that cannot preserve authority serialization');
assert.doesNotMatch(historySource,/history\.coalesced/,'history must not invent an authority-unknown serialized command type');
const busSource=fs.readFileSync(new URL('../src/studio/core/command-bus.mjs',import.meta.url),'utf8');
assert.match(busSource,/command\.historyMergeSerialized/,'CommandBus must forward only command-provided merge serialization');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioNudgeController/,'Studio entry must install nudge input');
assert.match(entry,/nudgeController\.destroy\(\)/,'Studio close must release nudge input');
assert.match(entry,/kelo-studio-foundation-v\d+\.\d+\.\d+/,'Studio must expose a current foundation version without pinning this focused audit to an obsolete release');

console.log(JSON.stringify({ok:true,arrowNudge:true,shiftFine:true,altCoarse:true,holdRepeat:true,repeatThrottleMs:70,coalescedUndo:true,authoritySerialization:true,multiSelectionBatch:true,commandBus:true},null,2));
