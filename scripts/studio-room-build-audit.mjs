import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createPlacementTool } from '../src/studio/tools/placement-tool.mjs';
import { createQuickBuildTool } from '../src/studio/tools/quick-build-tool.mjs';
import { createRoomBuildTool } from '../src/studio/tools/room-build-tool.mjs';

const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:room-build',settings:{tileSize:32,chunkSize:512}})});
kernel.prefabs.register({id:'stone_wall_01',label:'Stone Wall',category:'building',bounds:{w:64,h:16},components:{visual:{source:'fixture'}}});
kernel.prefabs.register({id:'marble_floor_01',label:'Marble Floor',category:'building',bounds:{w:32,h:32},components:{visual:{source:'fixture'}}});
const placement=createPlacementTool(kernel);kernel.tools.register(placement);
const quick=createQuickBuildTool(kernel,{placement,root:{KELO_QUICK_BUILD_CATALOG:{wall:'stone_wall_01',floor:'marble_floor_01'}}});kernel.tools.register(quick);
const room=createRoomBuildTool(kernel,{placement,quickBuild:quick,root:{}});kernel.tools.register(room);

assert.equal(room.activate(),true,'ROOM must activate when a WALL prefab is available');
assert.equal(room.active,true,'ROOM must expose active state');
assert.equal(quick.active.type,'wall','ROOM must reuse the Quick Build WALL piece instead of creating a parallel catalog');
assert.equal(kernel.input.active().includes('studio-quick-build-room'),true,'ROOM must own a temporary higher-priority input context');

let previews=room.planRect(0,0,128,96);
assert.equal(previews.length,10,'128x96 fixture must plan a ten-module perimeter with the current wall footprint');
assert.equal(previews.every(row=>row.prefabId==='stone_wall_01'),true,'ROOM must use the same resolved WALL prefab as Quick Build');
assert.equal(previews.every(row=>row.components?.buildingPiece?.type==='wall'),true,'ROOM walls must preserve semantic wall metadata');
assert.equal(previews.every(row=>row.components?.buildingPiece?.roomGenerated===true),true,'ROOM-generated walls must remain identifiable for later semantic editing');
assert.ok(previews.some(row=>row.transform.rotation===0),'ROOM must include horizontal walls');
assert.ok(previews.some(row=>row.transform.rotation===90),'ROOM must include vertical walls');
const unique=new Set(previews.map(row=>`${row.transform.x}:${row.transform.y}:${row.transform.rotation}`));
assert.equal(unique.size,previews.length,'ROOM planner must not emit duplicate wall modules');

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
assert.equal(committed.length,10,'ROOM must commit the entire planned perimeter');
assert.equal(kernel.document.entities.length,10,'all room walls must persist through placement batch');
assert.equal(kernel.history.undoDepth,historyBefore+1,'one ROOM gesture must create exactly one history entry');
assert.equal(kernel.document.entities.every(row=>row.components?.buildingPiece?.roomGenerated===true),true,'persisted ROOM walls must retain semantic room metadata');
await kernel.undo();
assert.equal(kernel.document.entities.length,0,'one Undo must remove the entire room');
await kernel.redo();
assert.equal(kernel.document.entities.length,10,'one Redo must restore the entire room');

const roomSource=fs.readFileSync(new URL('../src/studio/tools/room-build-tool.mjs',import.meta.url),'utf8');
assert.doesNotMatch(roomSource,/KELO_WORLD_EDIT|kernel\.execute\s*\(/,'ROOM must not bypass placement/CommandBus authority');
assert.match(roomSource,/placement\.commitBatch\(/,'ROOM persistent mutation must delegate to placement.commitBatch');
assert.equal(room.deactivate(),true,'ROOM must be cancellable back to normal Quick Build');
assert.equal(kernel.input.active().includes('studio-quick-build-room'),false,'ROOM cancel must release its input context');
room.destroy();quick.destroy();
assert.equal(kernel.input.has('studio-quick-build-room'),false,'ROOM destroy must unregister listeners/context');

console.log(JSON.stringify({ok:true,phase:5,tool:'ROOM',previewModules:10,roomEntities:10,historyEntries:1,oneUndo:true,oneRedo:true,desktopPointer:true,mobilePointer:true,semanticMetadata:true,authorityBypass:false},null,2));
