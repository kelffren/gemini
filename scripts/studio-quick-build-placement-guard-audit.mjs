import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createPlaceEntityCommand } from '../src/studio/document/document-commands.mjs';
import { createPlacementTool } from '../src/studio/tools/placement-tool.mjs';
import { createQuickBuildTool } from '../src/studio/tools/quick-build-tool.mjs';
import { defaultSnapPointsForPiece } from '../src/studio/tools/snap-resolver.mjs';

const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:quick-build-overlap',settings:{tileSize:32,chunkSize:256}})});
kernel.prefabs.register({id:'wall',label:'Wall',category:'building',bounds:{w:64,h:16},components:{}});
const occupied={
  id:'occupied-wall',prefabId:'wall',transform:{x:256,y:64,rotation:0},bounds:{w:64,h:16},
  components:{buildingPiece:{type:'wall',system:'quick-build',version:4,slot:1,snapPoints:defaultSnapPointsForPiece('wall',{w:64,h:16})}}
};
await kernel.execute(createPlaceEntityCommand(occupied));
const placement=createPlacementTool(kernel);kernel.tools.register(placement);
const root={KELO_QUICK_BUILD_CATALOG:{wall:'wall'},KeloCamera:{snapshot:()=>({effectiveZoom:1})}};
const quick=createQuickBuildTool(kernel,{placement,root});kernel.tools.register(quick);

assert.equal(quick.collideCopies,true,'duplicate blocking must default to on');
assert.equal(quick.validatePlacement(occupied).state,'occupied','an exact semantic duplicate must be rejected');
assert.equal(quick.validatePlacement(occupied).targetEntityId,'occupied-wall','guard must identify the occupying entity');
assert.equal(quick.setCollideCopies(false),false,'creator must be able to disable duplicate blocking');
assert.equal(quick.validatePlacement(occupied).state,'valid','duplicate must become placeable when copy collision is disabled');
assert.equal(quick.setCollideCopies(true),true,'creator must be able to restore duplicate blocking');

assert.equal(quick.activate('wall'),true,'wall quick-build must activate');
let routed=kernel.input.route('pointerdown',{worldX:64,worldY:64,pointerType:'mouse'});
assert.equal(routed.handled,true,'pointerdown must enter a build gesture');
routed=kernel.input.route('pointermove',{worldX:320,worldY:64,pointerType:'mouse'});
assert.equal(routed.handled,true,'pointermove must plan turbo build');
const state=quick.getDragState();
assert.deepEqual(state,{planned:5,valid:4,blocked:1},'turbo planning must skip exactly the occupied module');
const previews=quick.getDragPreviews();
assert.equal(previews.some(row=>row.transform.x===256&&row.transform.y===64),false,'occupied transform must not enter the commit preview list');
assert.deepEqual(previews.map(row=>row.transform.x),[64,128,192,320],'valid modules on both sides of the occupied slot must remain');

const historyBefore=kernel.history.undoDepth;
const committed=await quick.commitDrag();
assert.equal(committed.length,4,'turbo commit must persist only valid modules');
assert.equal(kernel.document.entities.length,5,'existing occupant plus four new modules must remain in the document');
assert.equal(kernel.history.undoDepth,historyBefore+1,'filtered turbo gesture must remain one history action');
assert.equal(kernel.document.entities.filter(row=>row.transform?.x===256&&row.transform?.y===64&&row.components?.buildingPiece?.type==='wall').length,1,'overlap guard must preserve exactly one wall at the occupied transform');
await kernel.undo();
assert.equal(kernel.document.entities.length,1,'one Undo must remove the whole filtered turbo gesture and preserve the original occupant');

quick.setCollideCopies(false);
kernel.input.route('pointerdown',{worldX:64,worldY:64,pointerType:'mouse'});
kernel.input.route('pointermove',{worldX:320,worldY:64,pointerType:'mouse'});
assert.deepEqual(quick.getDragState(),{planned:5,valid:5,blocked:0},'turning BLOCK OVERLAP off must restore full free-placement planning');
quick.deactivate();

const source=fs.readFileSync(new URL('../src/studio/tools/quick-build-tool.mjs',import.meta.url),'utf8');
assert.match(source,/kernel\.spatial\.queryRect\(/,'overlap guard must use the local spatial index');
assert.doesNotMatch(source,/kernel\.document\.entities\.find\(|kernel\.document\.entities\.filter\(/,'hot-path duplicate validation must not scan the full document');
assert.match(source,/placement\.commitBatch\(/,'filtered turbo persistence must still go through placement/CommandBus');
assert.doesNotMatch(source,/kernel\.execute\s*\(/,'Quick Build must not bypass placement authority');
quick.destroy();

console.log(JSON.stringify({ok:true,phase:'placement-guard',blockOverlapDefault:true,toggle:true,planned:5,valid:4,blocked:1,batchHistoryEntries:1,oneUndo:true,localSpatialValidation:true,authorityBypass:false},null,2));
