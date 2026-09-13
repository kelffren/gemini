import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStudioKernel} from '../src/studio/core/studio-kernel.mjs';
import {createWorldDocument} from '../src/studio/document/world-document.mjs';
import {createCreatorActions} from '../src/studio/tools/creator-actions.mjs';

const original=[
  {id:'a',prefabId:'wall',transform:{x:0,y:0,rotation:0},bounds:{w:64,h:16},components:{}},
  {id:'b',prefabId:'wall',transform:{x:64,y:0,rotation:0},bounds:{w:64,h:16},components:{}},
  {id:'c',prefabId:'wall',transform:{x:64,y:32,rotation:0},bounds:{w:64,h:16},components:{}}
];
const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:group-rotate',settings:{tileSize:32,chunkSize:256},entities:original})});
const actions=createCreatorActions(kernel);kernel.tools.register?.({...actions,id:'creatorActions'});
kernel.selection.set(['a','b','c']);
let executed=null;const off=kernel.commands.on(event=>{if(event.type==='execute')executed=event.command;});

const rotated=await actions.rotateSelection(90);
assert.equal(rotated.length,3,'all selected entities must remain selected after rotation');
assert.deepEqual(rotated.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.rotation]),[
  ['a',48,-16,90],['b',48,48,90],['c',16,48,90]
],'90° group rotation must rotate positions around the selection center and orientations together');
assert.equal(kernel.history.undoDepth,1,'group rotation must be one history entry');
assert.equal(executed?.type,'entity.batch.rotate','group rotation must serialize as one composite command');
assert.equal(executed?.commands?.length,3,'composite rotation must retain one patch per selected entity');

await kernel.undo();
assert.deepEqual(kernel.document.entities.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.rotation]),original.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.rotation]),'one Undo must restore the complete original composition');
await kernel.redo();
assert.deepEqual(kernel.document.entities.map(row=>[row.id,row.transform.x,row.transform.y,row.transform.rotation]),[
  ['a',48,-16,90],['b',48,48,90],['c',16,48,90]
],'one Redo must restore the complete rotated composition');
assert.equal(kernel.history.undoDepth,1,'Redo must restore one history entry');

await kernel.undo();kernel.selection.set(['a']);
await actions.rotateSelection(90);
const single=kernel.document.entities.find(row=>row.id==='a');
assert.deepEqual([single.transform.x,single.transform.y,single.transform.rotation],[0,0,90],'single-object rotation must preserve its position');

const source=fs.readFileSync(new URL('../src/studio/tools/creator-actions.mjs',import.meta.url),'utf8');
assert.match(source,/createCompositeCommand\(commands/,'rotation persistence must remain one composite CommandBus operation');
assert.doesNotMatch(source,/document\.entities\s*=|document\.entities\.splice|KELO_WORLD_EDIT/,'creator actions must not bypass CommandBus/authority with direct document mutation');
off();
console.log(JSON.stringify({ok:true,groupRotation:true,selectionCount:3,pivot:'selection-bounds-center',oneUndo:true,oneRedo:true,singlePositionStable:true,authorityBypass:false},null,2));