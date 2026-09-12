import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveExplorerRange, createStudioExplorerRangeSelectionController } from '../src/studio/input/studio-explorer-range-selection-controller.mjs';

const ids=['a','b','c','d','e'];
assert.deepEqual(resolveExplorerRange({ids,anchorId:'b',targetId:'d',current:['b'],append:false})?.selection,['b','c','d'],'Shift range should select the contiguous forward range');
assert.deepEqual(resolveExplorerRange({ids,anchorId:'d',targetId:'b',current:['d'],append:false})?.selection,['b','c','d'],'Shift range should work backwards');
assert.deepEqual(resolveExplorerRange({ids,anchorId:'b',targetId:'d',current:['a','e'],append:true})?.selection,['a','e','b','c','d'],'Ctrl/Cmd+Shift should append the contiguous range without duplicates');
assert.deepEqual(resolveExplorerRange({ids,anchorId:'missing',targetId:'d',current:['a','c'],append:false})?.selection,['c','d'],'missing anchors should fall back to the latest valid selection');
assert.equal(resolveExplorerRange({ids,anchorId:'a',targetId:'missing',current:[]}),null,'missing targets must not mutate selection');

let clickHandler=null,keyHandler=null,clickRemoved=false,keyRemoved=false;
const rows=ids.map(id=>({
  dataset:{entity:id},tabindex:null,focusCount:0,scrollCount:0,
  closest(selector){return selector==='#kelo-studio-live [data-entity]'?this:null;},
  getAttribute(name){return name==='tabindex'?this.tabindex:null;},
  setAttribute(name,value){if(name==='tabindex')this.tabindex=String(value);},
  focus(options){this.focusCount++;this.focusOptions=options;},
  scrollIntoView(options){this.scrollCount++;this.scrollOptions=options;}
}));
const document={
  addEventListener(type,fn,capture){if(type==='click'&&capture===true)clickHandler=fn;if(type==='keydown'&&capture===true)keyHandler=fn;},
  removeEventListener(type,fn,capture){if(type==='click'&&fn===clickHandler&&capture===true)clickRemoved=true;if(type==='keydown'&&fn===keyHandler&&capture===true)keyRemoved=true;},
  querySelectorAll(selector){return selector==='#kelo-studio-live [data-entity]'?rows:[];}
};
let selection=['b'];
const sets=[];
const kernel={
  document:{entities:ids.map(id=>({id}))},
  selection:{get:()=>selection.slice(),set(next){selection=next.map(String);sets.push(selection.slice());}}
};
const root={document};
const controller=createStudioExplorerRangeSelectionController({root,kernel});
const rowFor=id=>rows.find(row=>row.dataset.entity===id);
const pointerEvent=(id,extra={})=>({target:rowFor(id),defaultPrevented:false,shiftKey:false,ctrlKey:false,metaKey:false,prevented:0,stopped:0,preventDefault(){this.prevented++;},stopImmediatePropagation(){this.stopped++;},...extra});
const keyEvent=(id,key,extra={})=>({target:rowFor(id),key,defaultPrevented:false,shiftKey:false,ctrlKey:false,metaKey:false,altKey:false,prevented:0,stopped:0,preventDefault(){this.prevented++;},stopImmediatePropagation(){this.stopped++;},...extra});

clickHandler(pointerEvent('b'));
assert.equal(rowFor('b').focusCount,1,'normal Explorer click should focus the row so arrow navigation stays scoped to Explorer');
assert.equal(rowFor('b').tabindex,'-1','Explorer rows should become programmatically focusable without entering the tab order');
assert.deepEqual(rowFor('b').focusOptions,{preventScroll:true},'click focus must not jump the Explorer scroll position');

const shift=pointerEvent('e',{shiftKey:true});
clickHandler(shift);
assert.deepEqual(sets.at(-1),['b','c','d','e'],'captured Shift+click should set one contiguous Explorer range');
assert.equal(shift.prevented,1,'range selection should suppress the shell single-row click');
assert.equal(shift.stopped,1,'range selection should stop the shell click from overwriting the range');

selection=['a'];
clickHandler(pointerEvent('b'));
const append=pointerEvent('c',{shiftKey:true,ctrlKey:true});
clickHandler(append);
assert.deepEqual(sets.at(-1),['a','b','c'],'Ctrl+Shift should append range to existing selection');

selection=['b'];
clickHandler(pointerEvent('b'));
const down=keyEvent('b','ArrowDown');
keyHandler(down);
assert.deepEqual(sets.at(-1),['c'],'ArrowDown on a focused Explorer row should select the next visible row');
assert.equal(down.prevented,1,'Explorer arrow navigation must suppress browser/default movement');
assert.equal(down.stopped,1,'Explorer arrow navigation must stop the world nudge listener chain');
assert.equal(rowFor('c').focusCount>0,true,'ArrowDown should transfer focus to the newly selected row');
assert.equal(rowFor('c').scrollCount,1,'keyboard navigation should keep the next row visible');
assert.deepEqual(rowFor('c').scrollOptions,{block:'nearest',inline:'nearest'},'keyboard navigation should use nearest scrolling only');

const up=keyEvent('c','ArrowUp');
keyHandler(up);
assert.deepEqual(sets.at(-1),['b'],'ArrowUp should select the previous visible row');

selection=['e'];
const beforeBoundarySets=sets.length;
const boundary=keyEvent('e','ArrowDown');
keyHandler(boundary);
assert.equal(sets.length,beforeBoundarySets,'ArrowDown at the last Explorer row should clamp without changing selection');
assert.equal(boundary.prevented,1,'boundary arrows should still be consumed inside Explorer');
assert.equal(boundary.stopped,1,'boundary arrows must not leak into world nudge');

const modified=keyEvent('b','ArrowDown',{shiftKey:true});
const beforeModifiedSets=sets.length;
keyHandler(modified);
assert.equal(sets.length,beforeModifiedSets,'modified arrows are reserved for other Explorer gestures and should not change single selection');
assert.equal(modified.prevented,0,'modified arrows should remain available to dedicated handlers');

controller.destroy();
assert.equal(clickRemoved,true,'destroy must remove the capture click listener');
assert.equal(keyRemoved,true,'destroy must remove the Explorer keyboard listener');

const source=fs.readFileSync(new URL('../src/studio/input/studio-explorer-range-selection-controller.mjs',import.meta.url),'utf8');
const nudgeSource=fs.readFileSync(new URL('../src/studio/input/studio-nudge-controller.mjs',import.meta.url),'utf8');
assert.ok(!source.includes('KELO_WORLD_EDIT'),'Explorer selection ergonomics must not access world authority');
assert.ok(!source.includes('kernel.execute'),'Explorer selection ergonomics must not create document commands');
assert.ok(source.includes('kernel.selection.set'),'Explorer navigation must use the canonical local selection store');
assert.ok(nudgeSource.includes("EXPLORER_ENTITY_SELECTOR='#kelo-studio-live [data-entity]'"),'nudge must explicitly recognize focused Explorer entity rows');
assert.ok(nudgeSource.includes('explorerTarget(event.target)'),'world nudge must yield when arrow keys originate inside Explorer');

console.log('PASS studio explorer selection audit: ranges, focused ArrowUp/ArrowDown navigation, boundary isolation, teardown and CommandBus/authority separation verified.');
