import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMarqueeSelectTool } from '../src/studio/tools/marquee-select-tool.mjs';

const rows=[
  {id:'inside',rect:{x:20,y:20,w:20,h:20}},
  {id:'edge',rect:{x:90,y:20,w:30,h:20}},
  {id:'outside',rect:{x:130,y:20,w:20,h:20}}
];
const selection={value:[],setCalls:0,addCalls:0,get(){return [...this.value];},set(ids){this.setCalls++;this.value=[...ids];},add(id){this.addCalls++;if(!this.value.includes(id))this.value.push(id);}};
const kernel={spatial:{queryRect(){return rows.filter(row=>row.id!=='outside');}},selection};
const tool=createMarqueeSelectTool(kernel);

tool.begin(0,0);tool.move(100,100);
assert.deepEqual(tool.commit(),['inside'],'left-to-right marquee must require full containment');

tool.begin(100,0);tool.move(0,100);
assert.deepEqual(tool.commit(),['inside','edge'],'right-to-left marquee must include crossing entities');

selection.value=['prior'];
selection.setCalls=0;selection.addCalls=0;
tool.begin(0,0,{append:true});tool.move(100,100);
assert.deepEqual(tool.commit(),['inside'],'append enclosure must preserve directional semantics');
assert.deepEqual(selection.value,['prior','inside'],'append marquee must preserve existing selection');
assert.equal(selection.setCalls,1,'append marquee must publish one atomic selection update');
assert.equal(selection.addCalls,0,'append marquee must not emit one selection update per matched entity');
assert.equal(tool.active,false,'commit must clear transient marquee state');

const largeRows=Array.from({length:1200},(_,i)=>({id:`entity-${i}`,rect:{x:i%30,y:Math.floor(i/30),w:1,h:1}}));
const largeSelection={
  value:Array.from({length:300},(_,i)=>`prior-${i}`),setCalls:0,addCalls:0,
  get(){return [...this.value];},
  set(ids){this.setCalls++;this.value=[...ids];},
  add(){this.addCalls++;}
};
const largeTool=createMarqueeSelectTool({spatial:{queryRect(){return largeRows;}},selection:largeSelection});
largeTool.begin(0,0,{append:true});largeTool.move(100,100);
assert.equal(largeTool.commit().length,1200,'large marquee fixture must select every matched entity');
assert.equal(largeSelection.setCalls,1,'1,200 appended entities must still produce exactly one selection write');
assert.equal(largeSelection.addCalls,0,'large append must avoid per-entity selection.add emissions');
assert.equal(largeSelection.value.length,1500,'atomic append must retain prior selection and all new unique entities');
assert.deepEqual(largeSelection.value.slice(0,3),['prior-0','prior-1','prior-2'],'atomic append must preserve prior selection order');
assert.deepEqual(largeSelection.value.slice(300,303),['entity-0','entity-1','entity-2'],'atomic append must preserve spatial result order for new entities');

const source=fs.readFileSync(new URL('../src/studio/tools/marquee-select-tool.mjs',import.meta.url),'utf8');
assert.match(source,/crossing=state\.x1<state\.x0/,'horizontal drag direction must choose crossing vs enclosure semantics');
assert.match(source,/rows\.filter\(row=>contained\(row,box\)\)/,'enclosure mode must filter to fully-contained entities');
assert.match(source,/kernel\.spatial\.queryRect/,'marquee must keep using the spatial index');
assert.match(source,/kernel\.selection\.get/,'append must read the current ordered selection before merging');
assert.match(source,/kernel\.selection\.set\(merged\)/,'append must publish the merged selection atomically');
assert.doesNotMatch(source,/kernel\.selection\.add/,'marquee append must not create per-entity selection emissions');
assert.doesNotMatch(source,/kernel\.execute/,'selection must remain outside CommandBus history');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'selection must not write authority directly');

console.log(JSON.stringify({ok:true,directionalMarquee:true,leftToRight:'enclosure',rightToLeft:'crossing',append:true,atomicAppend:true,largeFixture:{matched:1200,prior:300,selectionWrites:largeSelection.setCalls},spatialIndex:true,localOnly:true},null,2));
