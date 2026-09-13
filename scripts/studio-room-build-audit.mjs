import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createPlacementTool } from '../src/studio/tools/placement-tool.mjs';
import { createQuickBuildTool } from '../src/studio/tools/quick-build-tool.mjs';
import { createRoomBuildTool } from '../src/studio/tools/room-build-tool.mjs';
import { createSelectTool } from '../src/studio/tools/select-tool.mjs';
import { worldSnapPoints } from '../src/studio/tools/snap-resolver.mjs';

const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:room-build',settings:{tileSize:32,chunkSize:512}})});
kernel.prefabs.register({id:'stone_wall_01',label:'Stone Wall',category:'building',bounds:{w:64,h:16},components:{visual:{source:'fixture'}}});
kernel.prefabs.register({id:'marble_floor_01',label:'Marble Floor',category:'building',bounds:{w:32,h:32},components:{visual:{source:'fixture'}}});
const placement=createPlacementTool(kernel);kernel.tools.register(placement);
const select=createSelectTool(kernel);kernel.tools.register(select);
const quick=createQuickBuildTool(kernel,{placement,root:{KELO_QUICK_BUILD_CATALOG:{wall:'stone_wall_01',floor:'marble_floor_01'}}});kernel.tools.register(quick);
const room=createRoomBuildTool(kernel,{placement,quickBuild:quick,root:{}});kernel.tools.register(room);

assert.equal(room.activate(),true,'ROOM must activate when a WALL prefab is available');
assert.equal(room.active,true,'ROOM must expose active state');
assert.equal(quick.active.type,'wall','ROOM must reuse the Quick Build WALL piece instead of creating a parallel catalog');
assert.equal(kernel.input.active().includes('studio-quick-build-room'),true,'ROOM must own a temporary higher-priority input context');

let previews=room.planRect(0,0,128,96);
assert.equal(previews.length,8,'drag dimensions must quantize to the wall module length and plan an eight-module closed perimeter');
assert.equal(previews.every(row=>row.prefabId==='stone_wall_01'),true,'ROOM must use the same resolved WALL prefab as Quick Build');
assert.equal(previews.every(row=>row.components?.buildingPiece?.type==='wall'),true,'ROOM walls must preserve semantic wall metadata');
assert.equal(previews.every(row=>row.components?.buildingPiece?.roomGenerated===true),true,'ROOM-generated walls must remain identifiable for later semantic editing');
const roomIds=new Set(previews.map(row=>row.components?.buildingPiece?.roomId));
assert.equal(roomIds.size,1,'every wall preview in one ROOM gesture must share one semantic roomId');
assert.ok([...roomIds][0]?.startsWith('room:'),'ROOM semantic identity must use a stable room namespace');
assert.deepEqual([...new Set(previews.map(row=>row.components?.buildingPiece?.roomEdge))].sort(),['bottom','left','right','top'],'ROOM walls must carry explicit edge roles');
assert.equal(previews.filter(row=>row.transform.rotation===0).length,4,'ROOM must produce two horizontal edges with two modules each');
assert.equal(previews.filter(row=>row.transform.rotation===90).length,4,'ROOM must produce two vertical edges with two modules each');
const unique=new Set(previews.map(row=>`${row.transform.x}:${row.transform.y}:${row.transform.rotation}`));
assert.equal(unique.size,previews.length,'ROOM planner must not emit duplicate wall modules');
const points=previews.flatMap(worldSnapPoints);
for(const corner of [[0,0],[128,0],[0,128],[128,128]]){
  const matches=points.filter(point=>Math.hypot(point.x-corner[0],point.y-corner[1])<0.001);
  assert.equal(matches.length,2,`room corner ${corner.join(',')} must join exactly two wall endpoints`);
}

let routed=kernel.input.route('pointerdown',{worldX:0,worldY:0,pointerType:'mouse'});
assert.equal(routed.handled,true,'desktop pointerdown must route through ROOM');
routed=kernel.input.route('pointermove',{worldX:128,worldY:96,pointerType:'mouse'});
assert.equal(routed.handled,true,'desktop pointermove must update ROOM preview');
routed=kernel.input.route('pointercancel',{worldX:128,worldY:96,pointerType:'mouse'});
assert.equal(routed.handled,true,'pointercancel must cleanly terminate ROOM drag');
routed=kernel.input.route('pointerdown',{worldX:0,worldY:0,pointerType:'touch'});
assert.equal(routed.handled,true,'mobile touch pointerdown must route through ROOM');
routed=kernel.input.route('pointermove',{worldX:128,worldY:96,pointerType:'touch'});
assert.equal(routed.handled,true,'mobile touch pointermove must update ROOM preview');
routed=kernel.input.route('pointercancel',{worldX:128,worldY:96,pointerType:'touch'});
assert.equal(routed.handled,true,'mobile pointercancel must cleanly terminate ROOM drag');

previews=room.planRect(0,0,128,96);
const historyBefore=kernel.history.undoDepth;
const committed=await room.commitRoom();
assert.equal(committed.length,8,'ROOM must commit the entire planned perimeter');
assert.equal(kernel.document.entities.length,8,'all room walls must persist through placement batch');
assert.equal(kernel.history.undoDepth,historyBefore+1,'one ROOM gesture must create exactly one history entry');
const persistedRoomId=kernel.document.entities[0].components?.buildingPiece?.roomId;
assert.equal(kernel.document.entities.every(row=>row.components?.buildingPiece?.roomId===persistedRoomId),true,'persisted ROOM walls must retain one shared roomId');
assert.deepEqual(kernel.selection.get().length,8,'fresh room placement must leave the whole room selected');

select.clear();
const target=kernel.document.entities.find(row=>row.components?.buildingPiece?.roomEdge==='top'&&row.components?.buildingPiece?.roomIndex===1);
assert.ok(target,'audit must have a non-corner top wall target');
const px=(Number(target.transform?.x)||0)+32,py=(Number(target.transform?.y)||0)+8;
select.selectPoint(px,py,{preserveExisting:false,cycle:true,radius:0});
assert.equal(kernel.selection.get().length,1,'first click/tap on a room wall must preserve fine-grained single-wall editing');
select.selectPoint(px,py,{preserveExisting:true,cycle:true,radius:0});
assert.equal(kernel.selection.get().length,8,'second click/tap on the same room wall must expand selection to the semantic room');
assert.equal(kernel.selection.get().every(id=>kernel.document.entities.find(row=>row.id===id)?.components?.buildingPiece?.roomId===persistedRoomId),true,'semantic expansion must never select walls from another room');

await kernel.undo();
assert.equal(kernel.document.entities.length,0,'one Undo must remove the entire room');
await kernel.redo();
assert.equal(kernel.document.entities.length,8,'one Redo must restore the entire room');
assert.equal(kernel.document.entities.every(row=>row.components?.buildingPiece?.roomId===persistedRoomId),true,'Undo/Redo must preserve semantic room identity');

const roomSource=fs.readFileSync(new URL('../src/studio/tools/room-build-tool.mjs',import.meta.url),'utf8');
assert.doesNotMatch(roomSource,/KELO_WORLD_EDIT|kernel\.execute\s*\(/,'ROOM must not bypass placement/CommandBus authority');
assert.match(roomSource,/placement\.commitBatch\(/,'ROOM persistent mutation must delegate to placement.commitBatch');
assert.equal(room.deactivate(),true,'ROOM must be cancellable back to normal Quick Build');
assert.equal(kernel.input.active().includes('studio-quick-build-room'),false,'ROOM cancel must release its input context');
room.destroy();quick.destroy();
assert.equal(kernel.input.has('studio-quick-build-room'),false,'ROOM destroy must unregister listeners/context');

console.log(JSON.stringify({ok:true,phase:'5.1',tool:'ROOM',previewModules:8,roomEntities:8,exactCornerConnections:true,semanticRoomId:true,edgeRoles:true,singleWallFirstTap:true,roomSecondTap:true,historyEntries:1,oneUndo:true,oneRedo:true,desktopPointer:true,mobilePointer:true,authorityBypass:false},null,2));
