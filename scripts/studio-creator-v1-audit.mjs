import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createKeloRuntimeAdapter } from '../src/studio/adapters/kelo-runtime-adapter.mjs';
import { installStudioAuthorityMirror } from '../src/studio/integration/authority-command-mirror.mjs';
import { seedCatalogPrefabs } from '../src/studio/adapters/catalog-prefab-seeder.mjs';
import { registerBasicTools } from '../src/studio/tools/register-basic-tools.mjs';
import { createCreatorActions } from '../src/studio/tools/creator-actions.mjs';
import { createPlaceEntityCommand } from '../src/studio/document/document-commands.mjs';

const catalogRows=[{id:'prefab:house',label:'House',category:'architecture',width:64,height:64,parts:[],collision:{x:0,y:0,w:64,h:64}}];
const catalog={list:()=>catalogRows,get:id=>catalogRows.find(x=>x.id===id)||null,categories:()=>['architecture']};
let placementSeq=0;const calls=[];
const root={KELO_PROPERTY_CATALOG:catalog,KELO_WORLD_EDIT:{request:async(op,payload)=>{calls.push({op,payload});if(op==='world:placement:create')return{placement:{placementId:`p:${++placementSeq}`}};return{ok:true};}}};
const adapter=createKeloRuntimeAdapter(root),kernel=createStudioKernel({document:createWorldDocument({worldId:'world:creator-v1',settings:{tileSize:32,chunkSize:512}}),adapter,historyBudgetBytes:2*1024*1024});
seedCatalogPrefabs({prefabRegistry:kernel.prefabs,assetCatalog:catalog});const tools=registerBasicTools(kernel),creator=createCreatorActions(kernel),mirror=installStudioAuthorityMirror({adapter,actorId:'creator',getDraftId:()=> 'draft:creator-v1'});

const a={id:'entity:a',prefabId:'prefab:house',transform:{x:32,y:32,rotation:0},bounds:{w:64,h:64}},b={id:'entity:b',prefabId:'prefab:house',transform:{x:128,y:32,rotation:0},bounds:{w:64,h:64}};
await kernel.execute(createPlaceEntityCommand(a));mirror.seed(a.id,'p:seed:a');await kernel.execute(createPlaceEntityCommand(b));mirror.seed(b.id,'p:seed:b');
kernel.selection.set([a.id,b.id]);const depthBeforeDuplicate=kernel.history.undoDepth;const clones=await creator.duplicateSelection();assert.equal(clones.length,2);assert.equal(kernel.document.entities.length,4);assert.equal(kernel.history.undoDepth,depthBeforeDuplicate+1,'duplicate group must be one History action');assert.deepEqual(kernel.selection.get(),clones.map(x=>x.id));assert.equal(calls.filter(x=>x.op==='world:placement:create').length>=4,true);
await kernel.undo();assert.equal(kernel.document.entities.length,2);assert.equal(calls.slice(-2).every(x=>x.op==='world:placement:remove'),true,'batch undo must mirror child removals');await kernel.redo();assert.equal(kernel.document.entities.length,4);assert.equal(kernel.selection.get().length,2);
const depthBeforeRotate=kernel.history.undoDepth;await creator.rotateSelection(90);assert.equal(kernel.history.undoDepth,depthBeforeRotate+1);for(const id of kernel.selection.get())assert.equal(kernel.document.entities.find(e=>e.id===id).transform.rotation,90);
await creator.removeSelection();assert.equal(kernel.document.entities.length,2);await kernel.undo();assert.equal(kernel.document.entities.length,4);

const terrainBefore=Object.keys(kernel.document.terrain).length,historyBeforeStroke=kernel.history.undoDepth,callsBeforeStroke=calls.length;tools.terrain.configure({material:'grass',role:'terrain',brushSize:2,erase:false});tools.terrain.beginStroke(32,160);tools.terrain.strokeTo(160,160);assert.equal(Object.keys(kernel.document.terrain).length,terrainBefore,'stroke preview must remain local');const strokePreview=tools.terrain.getStrokePreview();assert.ok(strokePreview.count>=8);await tools.terrain.commitStroke();const terrainAfter=Object.keys(kernel.document.terrain).length;assert.ok(terrainAfter>terrainBefore+4);assert.equal(kernel.history.undoDepth,historyBeforeStroke+1,'stroke must be one History action');assert.ok(calls.slice(callsBeforeStroke).filter(x=>x.op==='world:tile:paint').length>=strokePreview.count);await kernel.undo();assert.equal(Object.keys(kernel.document.terrain).length,terrainBefore,'stroke undo must restore terrain');

const shell=await readFile(new URL('../src/studio/ui/studio-live-shell.mjs',import.meta.url),'utf8');assert.match(shell,/EXPLORER/);assert.match(shell,/PROPERTIES/);assert.match(shell,/data-act=\"duplicate\"/);assert.match(shell,/data-act=\"play\"/);assert.match(shell,/data-act=\"brush-size\"/);assert.match(shell,/virtualRange/);
const controller=await readFile(new URL('../src/studio/integration/live-studio-controller.mjs',import.meta.url),'utf8');assert.match(controller,/createCreatorActions/);assert.match(controller,/beginStroke/);assert.match(controller,/commitStroke/);assert.match(controller,/togglePlaytest/);assert.match(controller,/KeloInputLocks\.release\(inputLockToken\)/);assert.match(controller,/onPropertyChange/);
mirror.uninstall();
console.log(JSON.stringify({ok:true,creatorV1:true,multiSelect:true,batchHistory:true,duplicate:true,delete:true,rotate:true,continuousBrush:true,brushSizes:true,explorer:true,properties:true,playtestToggle:true,lazyArchitecturePreserved:true,entities:kernel.document.entities.length,terrainCells:Object.keys(kernel.document.terrain).length,authorityCalls:calls.length},null,2));
