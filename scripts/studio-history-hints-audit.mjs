import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/studio/ui/studio-history-hints.mjs',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');

assert.match(source,/history\?\.inspect\?\.\(\)/,'history hints must read canonical history metadata');
assert.match(source,/state\.undo\[state\.undo\.length-1\]/,'undo hint must expose the next undo action');
assert.match(source,/state\.redo\[state\.redo\.length-1\]/,'redo hint must expose the next redo action');
assert.match(source,/\[data-act="undo"\]/,'history hints must target existing undo controls');
assert.match(source,/\[data-act="redo"\]/,'history hints must target existing redo controls');
assert.match(source,/button\.title=text/,'desktop hover must expose the contextual action');
assert.match(source,/setAttribute\('aria-label',text\)/,'accessible/mobile semantics must expose the contextual action');
assert.match(source,/kernel\.commands\?\.on/,'hints must refresh after command bus events');
assert.match(source,/MutationObserver/,'hints must attach when the live shell mounts after Studio boot');
assert.match(source,/observer\?\.disconnect/,'history hint observer must be cleaned up');
assert.doesNotMatch(source,/kernel\.execute/,'history hints must not mutate the world');
assert.doesNotMatch(source,/history\.undo\(/,'history hints must not invoke undo');
assert.doesNotMatch(source,/history\.redo\(/,'history hints must not invoke redo');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'history hints must not write authority');

assert.match(entry,/createStudioHistoryHints/,'Studio entry must install history hints');
assert.match(entry,/historyHints=createStudioHistoryHints\(\{root,kernel\}\)/,'history hints must use the existing kernel');
assert.match(entry,/historyHints\.destroy\(\)/,'Studio close must release history hints');
assert.match(entry,/kelo-studio-foundation-v1\.21\.0-history-hints/,'foundation version must expose history hint integration');

console.log(JSON.stringify({ok:true,contextualUndoRedo:true,desktopTitle:true,ariaLabel:true,commandBusReadOnly:true,authorityUntouched:true,cleanup:true},null,2));
