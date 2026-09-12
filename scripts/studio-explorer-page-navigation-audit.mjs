import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveExplorerNavigationIndex } from '../src/studio/input/studio-explorer-range-selection-controller.mjs';

const length=35;
assert.equal(resolveExplorerNavigationIndex({index:0,length,key:'PageDown'}),10,'PageDown should advance ten visible rows');
assert.equal(resolveExplorerNavigationIndex({index:10,length,key:'PageDown'}),20,'repeated PageDown should keep advancing by ten rows');
assert.equal(resolveExplorerNavigationIndex({index:30,length,key:'PageDown'}),34,'PageDown should clamp to the last visible row');
assert.equal(resolveExplorerNavigationIndex({index:20,length,key:'PageUp'}),10,'PageUp should move back ten visible rows');
assert.equal(resolveExplorerNavigationIndex({index:5,length,key:'PageUp'}),0,'PageUp should clamp to the first visible row');
assert.equal(resolveExplorerNavigationIndex({index:17,length,key:'ArrowDown'}),18,'ArrowDown must retain one-row navigation');
assert.equal(resolveExplorerNavigationIndex({index:17,length,key:'ArrowUp'}),16,'ArrowUp must retain one-row navigation');
assert.equal(resolveExplorerNavigationIndex({index:17,length,key:'Home'}),0,'Home must retain first-row navigation');
assert.equal(resolveExplorerNavigationIndex({index:17,length,key:'End'}),34,'End must retain last-row navigation');
assert.equal(resolveExplorerNavigationIndex({index:0,length:0,key:'PageDown'}),-1,'empty Explorer navigation should remain a no-op sentinel');

const source=fs.readFileSync(new URL('../src/studio/input/studio-explorer-range-selection-controller.mjs',import.meta.url),'utf8');
assert.match(source,/PAGE_STEP=10/,'paged navigation must keep a deterministic ten-row step');
assert.match(source,/PageUp','PageDown/,'Explorer keyboard handler must accept PageUp/PageDown');
assert.match(source,/resolveExplorerNavigationIndex\(\{index,length:rows\.length,key:event\.key\}\)/,'live Explorer navigation must use the tested resolver');
assert.match(source,/if\(event\.shiftKey\)/,'paged navigation must keep the existing Shift range path');
assert.match(source,/kernel\.selection\.set/,'paged navigation must use the canonical local selection store');
assert.doesNotMatch(source,/kernel\.execute/,'paged navigation must not create document commands');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'paged navigation must not write through world authority');
assert.match(source,/stopImmediatePropagation/,'Explorer navigation must stay isolated from world nudge handlers');

console.log(JSON.stringify({ok:true,pageStep:10,pageUp:true,pageDown:true,shiftRangeCompatible:true,commandBusWrites:0,authorityWrites:0},null,2));
