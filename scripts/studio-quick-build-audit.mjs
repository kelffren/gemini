import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createPlacementTool } from '../src/studio/tools/placement-tool.mjs';
import { createQuickBuildTool, resolveQuickBuildPieces } from '../src/studio/tools/quick-build-tool.mjs';

const resolved=resolveQuickBuildPieces({
  prefabs:[
    {id:'decor_lamp',label:'Lamp',category:'decor'},
    {id:'stone_wall_01',label:'Stone Wall',category:'building'},
    {id:'marble_floor_01',label:'Marble Floor',category:'building'}
  ]
});
assert.deepEqual(resolved.map(row=>[row.type,row.prefabId]),[['wall','stone_wall_01'],['floor','marble_floor_01']],'catalog resolver must pick semantic wall/floor prefabs');

const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:quick-build',settings:{tileSize:32,chunkSize:512}})});
kernel.prefabs.register({id:'stone_wall_01',label:'Stone Wall',category:'building',bounds:{w:64,h:16},components:{visual:{source:'fixture'}}});
kernel.prefabs.register({id:'marble_floor_01',label:'Marble Floor',category:'building',bounds:{w:32,h:32},components:{visual:{source:'fixture'}}});
const placement=createPlacementTool(kernel);kernel.tools.register(placement);
const quick=createQuickBuildTool(kernel,{placement,root:{KELO_QUICK_BUILD_CATALOG:{wall:'stone_wall_01',floor:'marble_floor_01'}}});kernel.tools.register(quick);

assert.equal(quick.pieces.length,2,'phase 1 must expose WALL and FLOOR');
assert.equal(quick.activate('wall'),true,'WALL must be selectable');
assert.equal(kernel.input.active().includes('studio-quick-build'),true,'Quick Build must own a temporary input context while active');
let preview=placement.getPreview();
assert.equal(preview.prefabId,'stone_wall_01','selecting WALL must create a placement preview immediately');
assert.deepEqual(preview.components.buildingPiece,{type:'wall',system:'quick-build',version:1},'preview must carry semantic building-piece metadata');

let routed=kernel.input.route('pointermove',{worldX:70,worldY:35,pointerType:'mouse'});
assert.equal(routed.handled,true,'desktop pointer movement must route through Quick Build');
preview=placement.getPreview();
assert.deepEqual([preview.transform.x,preview.transform.y],[64,32],'preview movement must respect the existing tile snap');
routed=kernel.input.route('pointerdown',{worldX:98,worldY:65,pointerType:'touch'});
assert.equal(routed.handled,true,'mobile pointer path must route through the same Quick Build context');

const first=await quick.commitAt(98,65);
assert.equal(kernel.document.entities.length,1,'first placement must persist through the canonical placement command');
assert.equal(first.components.buildingPiece.type,'wall','placed entity must remain semantically identifiable as a wall');
assert.ok(placement.getPreview(),'Quick Build must immediately recreate the next preview after placement');
assert.equal(quick.active.type,'wall','placing must keep the same build piece active');

const second=await quick.commitAt(160,65);
assert.equal(kernel.document.entities.length,2,'second click must place another wall without reopening the catalog');
assert.equal(kernel.history.undoDepth,2,'each single-piece placement must remain independently undoable');
await kernel.undo();
assert.equal(kernel.document.entities.length,1,'Undo must remove the most recent Quick Build placement');
await kernel.redo();
assert.equal(kernel.document.entities.length,2,'Redo must restore the Quick Build placement');

const rotationBefore=placement.getPreview().transform.rotation;
assert.equal(quick.rotate(),true,'manual rotate must remain available while building');
assert.equal(placement.getPreview().transform.rotation,(rotationBefore+90)%360,'manual rotate must rotate the active preview');
assert.equal(quick.activate('floor'),true,'creator must be able to switch directly from WALL to FLOOR');
assert.equal(placement.getPreview().components.buildingPiece.type,'floor','switching piece must update semantic metadata');
assert.equal(quick.deactivate(),true,'Quick Build must be cancellable');
assert.equal(placement.getPreview(),null,'cancel must remove the local preview');
assert.equal(kernel.input.active().includes('studio-quick-build'),false,'cancel must return world input to the normal Studio stack');

const source=fs.readFileSync(new URL('../src/studio/tools/quick-build-tool.mjs',import.meta.url),'utf8');
assert.doesNotMatch(source,/KELO_WORLD_EDIT|kernel\.execute\s*\(/,'Quick Build must never bypass placement/CommandBus authority');
assert.match(source,/placement\.commit\(\)/,'persistent placement must delegate to the existing placement tool');
quick.destroy();
assert.equal(kernel.input.has('studio-quick-build'),false,'destroy must unregister the temporary input context');

console.log(JSON.stringify({ok:true,phase:1,pieces:['wall','floor'],preview:true,semanticMetadata:true,continuousPlacement:true,desktopPointer:true,mobilePointer:true,undoRedo:true,rotate:true,cancel:true,authorityBypass:false},null,2));
