import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStudioKernel} from '../src/studio/core/studio-kernel.mjs';
import {createWorldDocument} from '../src/studio/document/world-document.mjs';
import {createPlacementTool} from '../src/studio/tools/placement-tool.mjs';
import {createQuickBuildTool} from '../src/studio/tools/quick-build-tool.mjs';
import {createQuickEditTool} from '../src/studio/tools/quick-edit-tool.mjs';
import {createBuildEditGridTool,resolveBuildEditVariants,classifyBuildEditMask,BUILD_EDIT_PATTERNS} from '../src/studio/tools/build-edit-grid-tool.mjs';

const prefabs=[
  {id:'wall',label:'Wall',category:'building wall',bounds:{w:64,h:16}},
  {id:'floor',label:'Floor',category:'building',bounds:{w:32,h:32}},
  {id:'ramp',label:'Ramp',category:'building',bounds:{w:64,h:32}},
  {id:'roof',label:'Roof',category:'building',bounds:{w:32,h:32}},
  {id:'wall-doorway',label:'Wall Doorway',category:'building wall',bounds:{w:64,h:16}},
  {id:'wall-window',label:'Wall Window',category:'building wall',bounds:{w:64,h:16}},
  {id:'wall-half',label:'Half Wall',category:'building wall',bounds:{w:64,h:16}},
  {id:'wall-corner',label:'Corner Wall',category:'building wall',bounds:{w:64,h:16}}
];
const variants=resolveBuildEditVariants({prefabs});
assert.deepEqual(variants.map(row=>row.id),['door','window','half','corner'],'resolver must map architectural variants from real prefab catalog');
assert.equal(classifyBuildEditMask('111101101')?.id,'door');
assert.equal(classifyBuildEditMask('111101111')?.id,'window');
assert.equal(classifyBuildEditMask('000111111')?.id,'half');
assert.equal(classifyBuildEditMask('100100111')?.id,'corner');
assert.equal(classifyBuildEditMask('101010101'),null,'custom unsupported mask must not fake a variant');
assert.equal(BUILD_EDIT_PATTERNS.length,5,'grid must expose full + four architectural patterns');

const root={KELO_QUICK_BUILD_CATALOG:{wall:'wall',floor:'floor',ramp:'ramp',roof:'roof'}};
const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:edit-grid',settings:{tileSize:32,chunkSize:256}})});
for(const prefab of prefabs)kernel.prefabs.register({...prefab,components:{}});
const placement=createPlacementTool(kernel);kernel.tools.register(placement);
const quick=createQuickBuildTool(kernel,{placement,root});kernel.tools.register(quick);
const quickEdit=createQuickEditTool(kernel,{quickBuild:quick,root});kernel.tools.register(quickEdit);
const grid=createBuildEditGridTool(kernel,{quickBuild:quick,root});kernel.tools.register(grid);

assert.equal(quick.activate('wall'),true);
const wall=await quick.commitAt(64,64);quick.deactivate();
kernel.selection.set(wall.id);
assert.equal(grid.canEdit(),true,'selected Quick Build wall must expose Edit Grid');
assert.equal(grid.activate(),true);
assert.equal(quickEdit.openEditGrid(),true,'Quick Edit GRID button must hand off into canonical Edit Grid tool');

grid.usePattern('door');
let preview=grid.getPreview();
assert.equal(preview.pattern,'door');assert.equal(preview.available,true);assert.equal(preview.variantPrefabId,'wall-doorway');
const original={id:wall.id,x:wall.transform.x,y:wall.transform.y,rotation:wall.transform.rotation,bounds:{...wall.bounds}};
await grid.apply();
let row=kernel.document.entities.find(entity=>entity.id===wall.id);
assert.equal(row.id,original.id,'grid edit must preserve stable entity identity');
assert.equal(row.prefabId,'wall-doorway','door pattern must resolve to real doorway prefab');
assert.equal(row.components.buildingPiece.type,'wall','edited wall remains a structural wall slot');
assert.equal(row.components.buildingPiece.variant,'door');
assert.equal(row.components.buildingPiece.editGrid.mask,'111101101');
assert.equal(row.components.buildingPiece.editGrid.basePrefabId,'wall');
assert.deepEqual([row.transform.x,row.transform.y,row.transform.rotation],[original.x,original.y,original.rotation],'grid edit must preserve transform');
assert.deepEqual(row.bounds,original.bounds,'variant must retain canonical wall footprint for snap/collision consistency');
await kernel.undo();
row=kernel.document.entities.find(entity=>entity.id===wall.id);
assert.equal(row.prefabId,'wall','one Undo must restore full wall');
assert.equal(row.components.buildingPiece.editGrid,undefined);
await kernel.redo();
row=kernel.document.entities.find(entity=>entity.id===wall.id);
assert.equal(row.prefabId,'wall-doorway','Redo must restore edit variant');

grid.usePattern('full');await grid.apply();
row=kernel.document.entities.find(entity=>entity.id===wall.id);
assert.equal(row.prefabId,'wall','FULL/RESET must restore original wall prefab');
assert.equal(row.components.buildingPiece.variant,undefined);
assert.equal(row.components.buildingPiece.editGrid,undefined);

grid.setMask('101010101');preview=grid.getPreview();
assert.equal(preview.pattern,'custom');assert.equal(preview.available,false,'unsupported custom mask must be preview-only until a real variant exists');
const depth=kernel.history.undoDepth;
assert.equal(await grid.apply(),null,'unsupported custom pattern must not mutate document');
assert.equal(kernel.history.undoDepth,depth,'unsupported custom pattern must not consume undo history');

row.components.buildingPiece.roomGenerated=true;kernel.selection.set(row.id);grid.deactivate();
assert.equal(grid.canEdit(),false,'ROOM generated pieces must stay owned by dedicated ROOM tools');

const source=fs.readFileSync(new URL('../src/studio/tools/build-edit-grid-tool.mjs',import.meta.url),'utf8');
assert.match(source,/createPatchEntityCommand/,'Edit Grid must persist via reversible document command');
assert.match(source,/kernel\.execute\(command\)/,'Edit Grid must commit through Kernel CommandBus');
assert.doesNotMatch(source,/document\.entities\.push|document\.entities\.splice/,'Edit Grid must not mutate world arrays directly');
const serial=fs.readFileSync(new URL('../src/studio/tools/register-build-tools-serial.mjs',import.meta.url),'utf8');
assert.match(serial,/buildEditGrid.*build-edit-grid-tool\.mjs/s,'mobile serial loader must lazy-load Edit Grid after chrome');

grid.destroy();quickEdit.destroy();quick.destroy();
console.log(JSON.stringify({ok:true,phase:'build-edit-grid-v1',grid:'3x3',patterns:['full','door','window','half','corner'],stableIdentity:true,canonicalFootprint:true,undoRedo:true,roomIsolation:true,customMasksPreviewOnly:true,mobileLazyLoad:true},null,2));
