import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMarqueeSelectTool } from '../src/studio/tools/marquee-select-tool.mjs';

const rows=[
  {id:'inside',rect:{x:20,y:20,w:20,h:20}},
  {id:'edge',rect:{x:90,y:20,w:30,h:20}},
  {id:'outside',rect:{x:130,y:20,w:20,h:20}}
];
const selection={value:[],set(ids){this.value=[...ids];},add(id){if(!this.value.includes(id))this.value.push(id);}};
const kernel={spatial:{queryRect(){return rows.filter(row=>row.id!=='outside');}},selection};
const tool=createMarqueeSelectTool(kernel);

tool.begin(0,0);tool.move(100,100);
assert.deepEqual(tool.commit(),['inside'],'left-to-right marquee must require full containment');

tool.begin(100,0);tool.move(0,100);
assert.deepEqual(tool.commit(),['inside','edge'],'right-to-left marquee must include crossing entities');

selection.value=['prior'];
tool.begin(0,0,{append:true});tool.move(100,100);
assert.deepEqual(tool.commit(),['inside'],'append enclosure must preserve directional semantics');
assert.deepEqual(selection.value,['prior','inside'],'append marquee must preserve existing selection');
assert.equal(tool.active,false,'commit must clear transient marquee state');

const source=fs.readFileSync(new URL('../src/studio/tools/marquee-select-tool.mjs',import.meta.url),'utf8');
assert.match(source,/crossing=state\.x1<state\.x0/,'horizontal drag direction must choose crossing vs enclosure semantics');
assert.match(source,/rows\.filter\(row=>contained\(row,box\)\)/,'enclosure mode must filter to fully-contained entities');
assert.match(source,/kernel\.spatial\.queryRect/,'marquee must keep using the spatial index');
assert.doesNotMatch(source,/kernel\.execute/,'selection must remain outside CommandBus history');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'selection must not write authority directly');

console.log(JSON.stringify({ok:true,directionalMarquee:true,leftToRight:'enclosure',rightToLeft:'crossing',append:true,spatialIndex:true,localOnly:true},null,2));
