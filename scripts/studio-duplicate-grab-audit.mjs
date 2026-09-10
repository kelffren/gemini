import assert from 'node:assert/strict';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { registerBasicTools } from '../src/studio/tools/register-basic-tools.mjs';
import { createCreatorActions } from '../src/studio/tools/creator-actions.mjs';
import { createPlaceEntityCommand } from '../src/studio/document/document-commands.mjs';

const kernel=createStudioKernel({document:createWorldDocument({worldId:'world:duplicate-grab',settings:{tileSize:32,chunkSize:512}})});
const tools=registerBasicTools(kernel);
const creator=createCreatorActions(kernel);
const entity=(id,x,y)=>({id,prefabId:'audit',transform:{x,y,rotation:0},bounds:{w:32,h:32}});

await kernel.execute(createPlaceEntityCommand(entity('entity:a',32,32)));
kernel.selection.set('entity:a');
const clones=await creator.duplicateSelection();
assert.equal(clones.length,1);
assert.equal(kernel.selection.get()[0],clones[0].id,'duplicate must select the clone');
const armedHit=tools.select.selectPoint(9999,9999);
assert.equal(armedHit.id,clones[0].id,'first canvas contact after duplicate must grab the clone even on empty space');
assert.equal(kernel.selection.get()[0],clones[0].id,'armed grab must preserve clone selection');
const afterConsume=tools.select.selectPoint(9999,9999);
assert.equal(afterConsume,null,'armed grab must be one-shot');
assert.equal(kernel.selection.get().length,0,'normal empty-space selection must resume after armed grab is consumed');

await kernel.execute(createPlaceEntityCommand(entity('entity:b',128,32)));
kernel.selection.set(['entity:a','entity:b']);
const group=await creator.duplicateSelection();
assert.equal(group.length,2);
const groupIds=group.map(row=>row.id);
assert.deepEqual(kernel.selection.get(),groupIds,'duplicate group must remain selected');
const groupHit=tools.select.selectPoint(-5000,-5000);
assert.equal(groupIds.includes(groupHit.id),true,'armed group grab must return one member of the duplicated selection');
assert.deepEqual(kernel.selection.get(),groupIds,'armed group grab must preserve the whole group for transform.begin');

console.log(JSON.stringify({ok:true,duplicateGrab:true,oneShot:true,groupGrab:true},null,2));
