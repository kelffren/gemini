import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createPlaceEntityCommand } from '../src/studio/document/document-commands.mjs';
import { createRoomOpeningTool, resolveRoomOpeningPieces } from '../src/studio/tools/room-opening-tool.mjs';

const mirrored=[];
const adapter={async mirrorStudioEvent(event){mirrored.push(event);}};
const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:room-opening',settings:{tileSize:32,chunkSize:512}}),adapter});
kernel.prefabs.register({id:'stone_wall_01',label:'Stone Wall',category:'building',bounds:{w:64,h:16},components:{visual:{source:'fixture'}}});
kernel.prefabs.register({id:'arched_door_01',label:'Arched Door',category:'building',bounds:{w:32,h:64},components:{visual:{source:'fixture'}}});
kernel.prefabs.register({id:'arched_window_01',label:'Arched Window',category:'building',bounds:{w:32,h:48},components:{visual:{source:'fixture'}}});

const resolved=resolveRoomOpeningPieces({prefabs:kernel.prefabs.list()});
assert.deepEqual(resolved.map(row=>row.type),['door','window'],'opening catalog must resolve DOOR and WINDOW from plug-and-play prefabs');

const wall={
  id:'room-wall-1',prefabId:'stone_wall_01',transform:{x:64,y:128,rotation:90},bounds:{w:64,h:16},
  components:{buildingPiece:{type:'wall',system:'quick-build',version:3,roomGenerated:true,roomId:'room:audit',roomEdge:'left',roomIndex:1,prefabId:'stone_wall_01',snapPoints:[{id:'start',type:'wall',x:0,y:8,direction:'start'},{id:'end',type:'wall',x:64,y:8,direction:'end'}]}}
};
await kernel.execute(createPlaceEntityCommand(wall));
kernel.history.clear();
kernel.selection.set(wall.id);
const tool=createRoomOpeningTool(kernel,{root:{}});
assert.equal(tool.canReplace(),true,'one selected generated ROOM wall must be replaceable');

const beforeDoor=kernel.history.undoDepth;
await tool.replaceSelected('door');
let entity=kernel.document.entities.find(row=>row.id===wall.id);
assert.equal(entity.prefabId,'arched_door_01','DOOR conversion must replace the visual prefab');
assert.equal(entity.components.buildingPiece.type,'door','DOOR conversion must update semantic type');
assert.equal(entity.components.buildingPiece.roomId,'room:audit','DOOR must preserve roomId');
assert.equal(entity.components.buildingPiece.roomEdge,'left','DOOR must preserve room edge role');
assert.equal(entity.components.buildingPiece.roomIndex,1,'DOOR must preserve room index');
assert.deepEqual(entity.components.buildingPiece.snapPoints,wall.components.buildingPiece.snapPoints,'DOOR must preserve original wall endpoints');
assert.deepEqual(entity.bounds,wall.bounds,'DOOR must preserve the wall module footprint');
assert.deepEqual(entity.transform,wall.transform,'DOOR must preserve exact transform/orientation');
assert.equal(entity.components.buildingPiece.openingGenerated,true,'semantic opening marker must be persisted');
assert.equal(entity.components.buildingPiece.wallPrefabId,'stone_wall_01','opening must retain the replaced wall prefab identity for later reversal/editing');
assert.equal(kernel.history.undoDepth,beforeDoor+1,'WALL -> DOOR must create exactly one history entry');
assert.deepEqual(kernel.selection.get(),[wall.id],'replacement must keep the edited segment selected');
assert.equal(mirrored.at(-1)?.command?.type,'entity.patch','authority mirror must receive canonical entity.patch');

await kernel.undo();
entity=kernel.document.entities.find(row=>row.id===wall.id);
assert.equal(entity.prefabId,'stone_wall_01','one Undo must restore the wall prefab');
assert.equal(entity.components.buildingPiece.type,'wall','one Undo must restore wall semantics');
await kernel.redo();
entity=kernel.document.entities.find(row=>row.id===wall.id);
assert.equal(entity.components.buildingPiece.type,'door','one Redo must restore DOOR semantics');
await kernel.undo();

const beforeWindow=kernel.history.undoDepth;
await tool.replaceSelected('window');
entity=kernel.document.entities.find(row=>row.id===wall.id);
assert.equal(entity.prefabId,'arched_window_01','WINDOW conversion must replace the visual prefab');
assert.equal(entity.components.buildingPiece.type,'window','WINDOW conversion must update semantic type');
assert.equal(entity.components.buildingPiece.roomId,'room:audit','WINDOW must preserve roomId');
assert.deepEqual(entity.components.buildingPiece.snapPoints,wall.components.buildingPiece.snapPoints,'WINDOW must preserve wall connectivity');
assert.equal(kernel.history.undoDepth,beforeWindow+1,'WALL -> WINDOW must create exactly one history entry');
await kernel.undo();
assert.equal(kernel.document.entities.find(row=>row.id===wall.id).components.buildingPiece.type,'wall','one Undo must restore WINDOW back to WALL');

kernel.selection.clear();
assert.equal(tool.canReplace(),false,'empty selection must not expose a replaceable wall');
assert.equal(await tool.replaceSelected('door'),null,'empty selection replacement must be a no-op');
kernel.selection.set(['room-wall-1','other']);
assert.equal(tool.canReplace(),false,'multi-selection must not accidentally replace one room segment');

const source=fs.readFileSync(new URL('../src/studio/tools/room-opening-tool.mjs',import.meta.url),'utf8');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'room openings must never bypass studio authority');
assert.match(source,/createPatchEntityCommand/,'room openings must use the canonical reversible patch command');
assert.match(source,/kernel\.execute\(command\)/,'room openings must enter persistence through Kernel CommandBus');
tool.destroy();

console.log(JSON.stringify({ok:true,phase:'6.0',tool:'ROOM semantic openings',door:true,window:true,preservesRoomId:true,preservesEndpoints:true,preservesFootprint:true,preservesOrientation:true,historyEntriesPerReplacement:1,oneUndo:true,oneRedo:true,authorityCommand:'entity.patch',multiSelectionGuard:true},null,2));
