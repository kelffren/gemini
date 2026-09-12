import fs from 'node:fs';
import assert from 'node:assert/strict';
import { resolveExplorerRange } from '../src/studio/input/studio-explorer-range-selection-controller.mjs';

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
const controller=fs.readFileSync(new URL('../src/studio/input/studio-explorer-range-selection-controller.mjs',import.meta.url),'utf8');

const requireText=(source,text,label)=>assert.ok(source.includes(text),label);

requireText(entry,"import { createStudioExplorerRangeSelectionController } from './input/studio-explorer-range-selection-controller.mjs';",'entry imports explorer range controller');
requireText(entry,'const explorerRangeSelectionController=createStudioExplorerRangeSelectionController({root,kernel});','entry mounts explorer range controller');
requireText(entry,'explorerRangeSelectionController, propertyCommitController','live session exposes explorer range controller');
requireText(entry,'explorerRangeSelectionController.destroy();explorerRevealController.destroy();','session close destroys explorer range controller');
requireText(entry,"version: 'kelo-studio-foundation-v1.30.0-explorer-range-live'",'Studio version records live range integration');
requireText(controller,"document.addEventListener('click',onclick,true);",'range selection captures Explorer clicks before shell single-selection handler');
requireText(controller,'event.stopImmediatePropagation?.();','Shift-range prevents the shell click from overwriting the range');
requireText(controller,'kernel.selection.set(result.selection);','range selection updates selection state only');
assert.ok(!controller.includes('kernel.execute('),'range selection must not write through CommandBus');
assert.ok(!controller.includes('KELO_WORLD_EDIT'),'range selection must not bypass online authority');

const ids=['a','b','c','d','e'];
assert.deepEqual(resolveExplorerRange({ids,anchorId:'b',targetId:'d',current:['b']}),{anchor:'b',target:'d',selection:['b','c','d']},'forward Shift range');
assert.deepEqual(resolveExplorerRange({ids,anchorId:'d',targetId:'b',current:['d']}),{anchor:'d',target:'b',selection:['b','c','d']},'reverse Shift range');
assert.deepEqual(resolveExplorerRange({ids,anchorId:'b',targetId:'d',current:['a','b'],append:true}),{anchor:'b',target:'d',selection:['a','b','c','d']},'Cmd/Ctrl+Shift appends without duplicates');
assert.deepEqual(resolveExplorerRange({ids,anchorId:'missing',targetId:'d',current:['a','c']}),{anchor:'c',target:'d',selection:['c','d']},'missing anchor falls back to latest valid selection');
assert.equal(resolveExplorerRange({ids,anchorId:'a',targetId:'missing',current:['a']}),null,'unknown target is ignored');

console.log('Studio explorer range live audit: PASS');
