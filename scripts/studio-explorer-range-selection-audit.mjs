import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveExplorerRange, createStudioExplorerRangeSelectionController } from '../src/studio/input/studio-explorer-range-selection-controller.mjs';

const ids=['a','b','c','d','e'];
assert.deepEqual(resolveExplorerRange({ids,anchorId:'b',targetId:'d',current:['b'],append:false})?.selection,['b','c','d'],'Shift range should select the contiguous forward range');
assert.deepEqual(resolveExplorerRange({ids,anchorId:'d',targetId:'b',current:['d'],append:false})?.selection,['b','c','d'],'Shift range should work backwards');
assert.deepEqual(resolveExplorerRange({ids,anchorId:'b',targetId:'d',current:['a','e'],append:true})?.selection,['a','e','b','c','d'],'Ctrl/Cmd+Shift should append the contiguous range without duplicates');
assert.deepEqual(resolveExplorerRange({ids,anchorId:'missing',targetId:'d',current:['a','c'],append:false})?.selection,['c','d'],'missing anchors should fall back to the latest valid selection');
assert.equal(resolveExplorerRange({ids,anchorId:'a',targetId:'missing',current:[]}),null,'missing targets must not mutate selection');

let clickHandler=null,removed=false;
const document={
  addEventListener(type,fn,capture){if(type==='click'&&capture===true)clickHandler=fn;},
  removeEventListener(type,fn,capture){if(type==='click'&&fn===clickHandler&&capture===true)removed=true;}
};
let selection=['b'];
const sets=[];
const kernel={
  document:{entities:ids.map(id=>({id}))},
  selection:{get:()=>selection.slice(),set(next){selection=next.map(String);sets.push(selection.slice());}}
};
const root={document};
const controller=createStudioExplorerRangeSelectionController({root,kernel});
const target=id=>({closest(selector){return selector==='#kelo-studio-live [data-entity]'?{dataset:{entity:id}}:null;}});
const event=(id,extra={})=>({target:target(id),defaultPrevented:false,shiftKey:false,ctrlKey:false,metaKey:false,prevented:0,stopped:0,preventDefault(){this.prevented++;},stopImmediatePropagation(){this.stopped++;},...extra});

clickHandler(event('b'));
const shift=event('e',{shiftKey:true});
clickHandler(shift);
assert.deepEqual(sets.at(-1),['b','c','d','e'],'captured Shift+click should set one contiguous Explorer range');
assert.equal(shift.prevented,1,'range selection should suppress the shell single-row click');
assert.equal(shift.stopped,1,'range selection should stop the shell click from overwriting the range');

selection=['a'];
const append=event('c',{shiftKey:true,ctrlKey:true});
clickHandler(append);
assert.deepEqual(sets.at(-1),['a','b','c'],'Ctrl+Shift should append range to existing selection');

controller.destroy();
assert.equal(removed,true,'destroy must remove the capture click listener');

const source=fs.readFileSync(new URL('../src/studio/input/studio-explorer-range-selection-controller.mjs',import.meta.url),'utf8');
assert.ok(!source.includes('KELO_WORLD_EDIT'),'range selection must not access world authority');
assert.ok(!source.includes('kernel.execute'),'selection-only ergonomics must not create document commands');
assert.ok(source.includes('kernel.selection.set'),'range selection must use the canonical local selection store');

console.log('PASS studio explorer range selection audit: forward/reverse ranges, additive range, anchor fallback, shell-click suppression, teardown and authority isolation verified.');
