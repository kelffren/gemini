import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeAlignedPositions } from '../src/studio/ui/studio-multi-align.mjs';

const rows=[
  {id:'a',transform:{x:10,y:20,scale:1},bounds:{w:20,h:30}},
  {id:'b',transform:{x:80,y:70,scale:2},bounds:{w:10,h:10}},
  {id:'c',transform:{x:45,y:40,scale:1},bounds:{w:15,h:25}}
];

assert.deepEqual(computeAlignedPositions(rows,'left').map(r=>r.x),[10,10,10],'left aligns all origins to selection minX');
assert.deepEqual(computeAlignedPositions(rows,'top').map(r=>r.y),[20,20,20],'top aligns all origins to selection minY');
assert.deepEqual(computeAlignedPositions(rows,'right').map(r=>r.x),[80,80,85],'right alignment must respect each scaled width');
assert.deepEqual(computeAlignedPositions(rows,'bottom').map(r=>r.y),[60,70,65],'bottom alignment must respect each height');
assert.deepEqual(computeAlignedPositions(rows,'hcenter').map(r=>r.x),[45,45,47.5],'horizontal center preserves object widths around group center');
assert.deepEqual(computeAlignedPositions(rows,'vcenter').map(r=>r.y),[40,45,42.5],'vertical center preserves object heights around group center');
assert.deepEqual(computeAlignedPositions([rows[0]],'left'),[],'single selection must not create an alignment mutation');

const source=fs.readFileSync(new URL('../src/studio/ui/studio-multi-align.mjs',import.meta.url),'utf8');
assert.match(source,/createMoveEntityCommand/,'alignment must use reversible move commands');
assert.match(source,/createCompositeCommand/,'group alignment must enter history as one composite action');
assert.match(source,/kernel\.execute\(createCompositeCommand/,'persistent mutation must pass through Studio CommandBus');
assert.match(source,/type:'selection\.align'/,'authority serialization must have a deterministic group command type');
assert.match(source,/kernel\.selection\.onChange/,'toolbar must react immediately to multi-selection changes');
assert.match(source,/count>1/,'toolbar must stay hidden for single selection');
assert.match(source,/@media\(max-width:760px\)/,'touch layout must have an explicit mobile treatment');
assert.doesNotMatch(source,/KELO_WORLD_EDIT\s*\./,'UI must not bypass authority with direct world writes');

const entry=fs.readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(entry,/createStudioMultiAlign/,'Studio boot must install multi align');
assert.match(entry,/multiAlign\.destroy\(\)/,'Studio close must cleanup multi align');
assert.match(entry,/kelo-studio-foundation-v1\.16\.0-multi-align/,'Studio version must expose the multi-align release');

console.log(JSON.stringify({ok:true,left:true,rightScaled:true,centers:true,top:true,bottom:true,commandBus:true,compositeUndo:true,mobile:true,cleanup:true},null,2));
