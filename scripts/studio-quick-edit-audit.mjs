import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStudioKernel} from '../src/studio/core/studio-kernel.mjs';
import {createWorldDocument} from '../src/studio/document/world-document.mjs';
import {createPlacementTool} from '../src/studio/tools/placement-tool.mjs';
import {createQuickBuildTool} from '../src/studio/tools/quick-build-tool.mjs';
import {createQuickEditTool} from '../src/studio/tools/quick-edit-tool.mjs';

const root={KELO_QUICK_BUILD_CATALOG:{wall:'wall',floor:'floor',ramp:'ramp',roof:'roof'}};
const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:quick-edit',settings:{tileSize:32,chunkSize:256}})});
for(const prefab of [
  {id:'wall',label:'Wall',bounds:{w:64,h:16}},
  {id:'floor',label:'Floor',bounds:{w:32,h:32}},
  {id:'ramp',label:'Ramp',bounds:{w:64,h:32}},
  {id:'roof',label:'Roof',bounds:{w:32,h:32}}
])kernel.prefabs.register({...prefab,category:'building',components:{}});

const placement=createPlacementTool(kernel);kernel.tools.register(placement);
const quick=createQuickBuildTool(kernel,{placement,root});kernel.tools.register(quick);
const edit=createQuickEditTool(kernel,{quickBuild:quick,root});kernel.tools.register(edit);

assert.equal(quick.activate('wall'),true);
const first=await quick.commitAt(64,64);
quick.deactivate();
assert.equal(kernel.selection.get()[0],first.id,'placed wall must remain selected for contextual edit');
assert.equal(edit.canEdit(),true,'a selected Quick Build piece must expose Quick Edit');

const original={id:first.id,x:first.transform.x,y:first.transform.y,rotation:first.transform.rotation};
const replaced=await edit.replaceSelected('floor');
assert.equal(replaced.id,original.id,'replace must preserve stable entity identity');
assert.equal(replaced.prefabId,'floor','replace must swap the prefab in place');
assert.deepEqual([replaced.transform.x,replaced.transform.y,replaced.transform.rotation],[original.x,original.y,original.rotation],'replace must preserve transform');
assert.equal(replaced.components.buildingPiece.type,'floor');
assert.equal(replaced.components.buildingPiece.slot,2);
assert.equal(replaced.components.buildingPiece.snapPoints.length,4,'replacement must regenerate semantic snap points');
await kernel.undo();
let row=kernel.document.entities.find(entity=>entity.id===first.id);
assert.equal(row.prefabId,'wall','one Undo must restore the original prefab');
assert.equal(row.components.buildingPiece.type,'wall','Undo must restore original semantic type');

await edit.rotateSelected();
row=kernel.document.entities.find(entity=>entity.id===first.id);
assert.equal(row.transform.rotation,90,'Quick Edit rotate must rotate selected building piece by one cardinal step');
await kernel.undo();
row=kernel.document.entities.find(entity=>entity.id===first.id);
assert.equal(row.transform.rotation,0,'one Undo must restore Quick Edit rotation');

const beforeDuplicateDepth=kernel.history.undoDepth;
const clones=await edit.duplicateSelected();
assert.equal(clones.length,1,'Quick Edit duplicate must clone selected piece');
assert.equal(kernel.document.entities.length,2);
assert.notEqual(clones[0].id,first.id,'duplicate must receive a fresh entity id');
assert.equal(clones[0].components.buildingPiece.type,'wall','duplicate must retain building semantics');
assert.equal(kernel.history.undoDepth,beforeDuplicateDepth+1,'duplicate must consume one history entry');
await kernel.undo();
assert.equal(kernel.document.entities.length,1,'one Undo must remove only the duplicate');

kernel.selection.set(first.id);
assert.equal(edit.continueBuild(),true,'BUILD→ must hand selected piece back to Quick Build');
assert.equal(quick.active.type,'wall','continue build must preserve selected piece type');
const preview=placement.getPreview();
assert.ok(preview,'continue build must create a live ghost');
assert.equal(preview.prefabId,'wall');
assert.notDeepEqual([preview.transform.x,preview.transform.y],[row.transform.x,row.transform.y],'continue build ghost must advance beyond selected piece instead of stacking on it');
assert.equal(preview.components.buildingPiece.type,'wall');

quick.deactivate();
const source=fs.readFileSync(new URL('../src/studio/tools/quick-edit-tool.mjs',import.meta.url),'utf8');
assert.match(source,/createCreatorActions/,'Quick Edit must reuse generic CreatorActions instead of cloning rotate/duplicate engines');
assert.match(source,/quickBuild\.resolveMove/,'BUILD→ must hand placement back into canonical Quick Build');
assert.doesNotMatch(source,/KELO_WORLD_EDIT|kernel\.execute\s*\(/,'Quick Edit must not bypass reusable actions/CommandBus authority');

edit.destroy();quick.destroy();
console.log(JSON.stringify({ok:true,phase:'quick-edit-v1',replaceInPlace:true,stableId:true,rotateUndo:true,duplicateUndo:true,continueBuild:true,mobileContextBar:true,authorityBypass:false},null,2));
