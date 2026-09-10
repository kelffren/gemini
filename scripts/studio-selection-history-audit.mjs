import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeSelectionSnapshot, stepSelectionHistory } from '../src/studio/input/studio-selection-history-controller.mjs';

assert.deepEqual(normalizeSelectionSnapshot(['tree-a','tree-a','rock-b','']),['tree-a','rock-b'],'selection snapshots must be stable, deduplicated and non-empty');
assert.deepEqual(normalizeSelectionSnapshot(null),[],'invalid selection snapshots must remain safe');

const history=[['tree-a'],['rock-b'],['tree-c','tree-d']];
assert.equal(stepSelectionHistory(history,2,-1),1,'back must move exactly one selection snapshot');
assert.equal(stepSelectionHistory(history,1,-1),0,'back must reach the oldest snapshot');
assert.equal(stepSelectionHistory(history,0,-1),0,'back must clamp at the oldest snapshot');
assert.equal(stepSelectionHistory(history,0,1),1,'forward must move exactly one selection snapshot');
assert.equal(stepSelectionHistory(history,2,1),2,'forward must clamp at the newest snapshot');
assert.equal(stepSelectionHistory([],0,-1),-1,'empty history must remain inert');

const source=fs.readFileSync(new URL('../src/studio/input/studio-selection-history-controller.mjs',import.meta.url),'utf8');
assert.match(source,/const MAX_HISTORY=40/,'selection history must stay bounded for long Studio sessions');
assert.match(source,/history=history\.slice\(0,index\+1\)/,'new selections after going back must discard stale forward history');
assert.match(source,/kernel\.selection\.set\(snapshot\)/,'history navigation must reuse the Studio selection owner');
assert.match(source,/kernel\.document\?\.entities/,'replay must filter ids against the live document');
assert.match(source,/key!== '\['/u,'keyboard navigation must expose the previous-selection shortcut');
assert.match(source,/key!== '\]'/u,'keyboard navigation must expose the next-selection shortcut');
assert.match(source,/EDITABLE_SELECTOR/,'selection history shortcuts must not hijack property editing');
assert.match(source,/unsubscribe\?\.\(\)/,'controller destroy must release the selection subscription');
assert.match(source,/removeEventListener/,'controller destroy must release the keyboard listener');
assert.doesNotMatch(source,/kernel\.execute\(/,'selection history must not create world commands or pollute undo');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'selection history must remain authority-isolated');

console.log(JSON.stringify({ok:true,bounded:true,branchingHistory:true,liveEntityFilter:true,keyboardBackForward:true,editableSafe:true,undoIsolated:true,authorityIsolated:true,cleanup:true},null,2));
