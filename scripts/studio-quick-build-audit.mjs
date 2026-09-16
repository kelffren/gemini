import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createPlacementTool } from '../src/studio/tools/placement-tool.mjs';
import { createQuickBuildTool, resolveQuickBuildPieces } from '../src/studio/tools/quick-build-tool.mjs';
import { createSnapResolver, defaultSnapPointsForPiece, worldSnapPoints } from '../src/studio/tools/snap-resolver.mjs';

const resolved=resolveQuickBuildPieces({
  prefabs:[
    {id:'decor_lamp',label:'Lamp',category:'decor'},
    {id:'stone_wall_01',label:'Stone Wall',category:'building'},
    {id:'marble_floor_01',label:'Marble Floor',category:'building'},
    {id:'wood_ramp_01',label:'Wood Ramp',category:'building'},
    {id:'metal_roof_01',label:'Metal Roof Cone',category:'building'}
  ]
});
assert.deepEqual(resolved.map(row=>[row.slot,row.type,row.prefabId]),[[1,'wall','stone_wall_01'],[2,'floor','marble_floor_01'],[3,'ramp','wood_ramp_01'],[4,'roof','metal_roof_01']],'catalog resolver must expose the four fast-build slots when matching assets exist');
assert.deepEqual(defaultSnapPointsForPiece('wall',{w:64,h:16}).map(point=>point.id),['start','end'],'wall contract must expose reusable start/end points');
assert.deepEqual(defaultSnapPointsForPiece('floor',{w:32,h:32}).map(point=>point.id),['north','south','west','east'],'floor contract must expose four reusable edges');
assert.deepEqual(defaultSnapPointsForPiece('ramp',{w:64,h:32}).map(point=>point.id),['north','south','west','east'],'ramp contract must expose four reusable edges');
assert.deepEqual(defaultSnapPointsForPiece('roof',{w:32,h:32}).map(point=>point.id),['north','south','west','east'],'roof contract must expose four reusable edges');

const rotateKernel=createStudioKernel({document:createWorldDocument({worldId:'audit:auto-rotate',settings:{tileSize:32,chunkSize:256}})});
const targetWall={id:'target:wall',prefabId:'stone_wall_01',transform:{x:0,y:0,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',snapPoints:defaultSnapPointsForPiece('wall',{w:64,h:16})}}};
rotateKernel.spatial.upsert({id:targetWall.id,category:'entity',rect:{x:0,y:0,w:64,h:16},data:targetWall,order:0});
const rotateResolver=createSnapResolver({spatial:rotateKernel.spatial,radius:48});
const cornerPreview={id:'preview:corner',prefabId:'stone_wall_01',transform:{x:32,y:32,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',snapPoints:defaultSnapPointsForPiece('wall',{w:64,h:16})}}};
const autoTurn=rotateResolver.resolve(cornerPreview);
assert.equal(autoTurn.state,'snapped');
assert.equal(autoTurn.rotation,90);
assert.equal(autoTurn.autoRotated,true);
assert.equal(autoTurn.rotationChecks,4);
assert.ok(autoTurn.connection.distance<0.001);
const manualOnly=rotateResolver.resolve(cornerPreview,{rotations:[0]});
assert.notEqual(manualOnly.rotation,90);
assert.equal(manualOnly.rotationChecks,1);

const kernel=createStudioKernel({document:createWorldDocument({worldId:'audit:quick-build',settings:{tileSize:32,chunkSize:512}})});
for(const prefab of [
  {id:'stone_wall_01',label:'Stone Wall',bounds:{w:64,h:16}},
  {id:'marble_floor_01',label:'Marble Floor',bounds:{w:32,h:32}},
  {id:'wood_ramp_01',label:'Wood Ramp',bounds:{w:64,h:32}},
  {id:'metal_roof_01',label:'Metal Roof Cone',bounds:{w:32,h:32}}
])kernel.prefabs.register({...prefab,category:'building',components:{visual:{source:'fixture'}}});
const placement=createPlacementTool(kernel);kernel.tools.register(placement);
const quick=createQuickBuildTool(kernel,{placement,root:{KELO_QUICK_BUILD_CATALOG:{wall:'stone_wall_01',floor:'marble_floor_01',ramp:'wood_ramp_01',roof:'metal_roof_01'}}});kernel.tools.register(quick);

assert.equal(quick.pieces.length,4);
assert.deepEqual(quick.pieces.map(row=>row.slot),[1,2,3,4]);
assert.equal(quick.activate('wall'),true);
assert.equal(kernel.input.active().includes('studio-quick-build'),true);
let preview=placement.getPreview();
assert.equal(preview.prefabId,'stone_wall_01');
assert.equal(preview.components.buildingPiece.type,'wall');
assert.equal(preview.components.buildingPiece.version,4);
assert.equal(preview.components.buildingPiece.slot,1);
assert.equal(preview.components.buildingPiece.snapPoints.length,2);

let routed=kernel.input.route('pointermove',{worldX:70,worldY:35,pointerType:'mouse'});
assert.equal(routed.handled,true);
preview=placement.getPreview();
assert.deepEqual([preview.transform.x,preview.transform.y],[64,32]);
assert.equal(quick.getSnapState().placementState,'valid');
routed=kernel.input.route('pointerdown',{worldX:98,worldY:65,pointerType:'touch'});
assert.equal(routed.handled,true);

const first=await quick.commitAt(98,65);
assert.equal(kernel.document.entities.length,1);
assert.equal(first.components.buildingPiece.type,'wall');
assert.equal(first.components.buildingPiece.snapPoints.length,2);
assert.ok(placement.getPreview());
assert.equal(quick.active.type,'wall');
preview=placement.getPreview();
assert.deepEqual([preview.transform.x,preview.transform.y],[160,64]);
const snapState=quick.getSnapState();
assert.equal(snapState.state,'snapped');
assert.equal(snapState.connection.targetEntityId,first.id);
assert.ok(snapState.connection.distance<0.001);
const placedPoints=worldSnapPoints(first),previewPoints=worldSnapPoints(preview);
assert.ok(placedPoints.some(a=>previewPoints.some(b=>Math.hypot(a.x-b.x,a.y-b.y)<0.001)));

const second=await quick.commitAt(preview.transform.x,preview.transform.y);
assert.equal(kernel.document.entities.length,2);
assert.deepEqual(kernel.document.entities.map(entity=>[entity.transform.x,entity.transform.y]),[[96,64],[160,64]]);
assert.equal(kernel.history.undoDepth,2);
await kernel.undo();assert.equal(kernel.document.entities.length,1);
await kernel.redo();assert.equal(kernel.document.entities.length,2);

kernel.spatial.upsert({id:targetWall.id,category:'entity',rect:{x:0,y:0,w:64,h:16},data:targetWall,order:99});
quick.resolveMove(32,32);
preview=placement.getPreview();
assert.equal(preview.transform.rotation,90);
assert.equal(quick.getSnapState().autoRotated,true);
assert.equal(quick.rotate(),true);
const manualRotation=placement.getPreview().transform.rotation;
quick.resolveMove(32,32);
assert.equal(placement.getPreview().transform.rotation,manualRotation);
assert.equal(quick.getSnapState().manualRotationOverride,true);
assert.equal(quick.getSnapState().rotationChecks,1);

assert.equal(quick.selectSlot(2),true);assert.equal(placement.getPreview().components.buildingPiece.type,'floor');
assert.equal(quick.selectSlot(3),true);assert.equal(quick.active.type,'ramp');
assert.equal(quick.selectSlot(4),true);assert.equal(quick.active.type,'roof');
assert.equal(quick.cycle(-1),true);assert.equal(quick.active.type,'ramp');
assert.equal(quick.cycle(1),true);assert.equal(quick.active.type,'roof');
assert.equal(quick.deactivate(),true);
assert.equal(placement.getPreview(),null);
assert.equal(kernel.input.active().includes('studio-quick-build'),false);

const perfKernel=createStudioKernel({document:createWorldDocument({worldId:'audit:snap-perf',settings:{tileSize:32,chunkSize:256}})});
for(let i=0;i<5000;i++){
  const x=(i%100)*1024,y=Math.floor(i/100)*1024;
  const entity={id:`perf:${i}`,prefabId:'wall',transform:{x,y,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',snapPoints:defaultSnapPointsForPiece('wall',{w:64,h:16})}}};
  perfKernel.spatial.upsert({id:entity.id,category:'entity',rect:{x,y,w:64,h:16},data:entity,order:i});
}
for(let i=0;i<5;i++){
  const entity={id:`near:${i}`,prefabId:'wall',transform:{x:96+i*70,y:96,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',snapPoints:defaultSnapPointsForPiece('wall',{w:64,h:16})}}};
  perfKernel.spatial.upsert({id:entity.id,category:'entity',rect:{x:entity.transform.x,y:entity.transform.y,w:64,h:16},data:entity,order:5000+i});
}
const perfResolver=createSnapResolver({spatial:perfKernel.spatial,radius:48});
const perfPreview={id:'preview',prefabId:'wall',transform:{x:160,y:96,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',snapPoints:defaultSnapPointsForPiece('wall',{w:64,h:16})}}};
const perfResult=perfResolver.resolve(perfPreview);
const perfStats=perfKernel.spatial.stats();
assert.equal(perfStats.entries,5005);
assert.ok(perfStats.lastQuery.uniqueCandidates<30);
assert.ok(perfResult.candidateCount<30);
assert.equal(perfResult.rotationChecks,4);

const source=fs.readFileSync(new URL('../src/studio/tools/quick-build-tool.mjs',import.meta.url),'utf8');
assert.doesNotMatch(source,/KELO_WORLD_EDIT|kernel\.execute\s*\(/);
assert.match(source,/placement\.commit\(\)/);
assert.doesNotMatch(source,/observe\(document\.documentElement,\{childList:true,subtree:true\}\)/);
const buildRegistry=fs.readFileSync(new URL('../src/studio/tools/register-build-tools.mjs',import.meta.url),'utf8');
const mobileRegistry=fs.readFileSync(new URL('../src/studio/tools/register-build-tools-serial.mjs',import.meta.url),'utf8');
assert.match(buildRegistry,/quickEdit/,'desktop/full build tool registry must include Quick Edit');
assert.match(mobileRegistry,/quick-edit-tool\.mjs/,'mobile serial loader must lazy-load Quick Edit');
quick.destroy();
assert.equal(kernel.input.has('studio-quick-build'),false);
console.log(JSON.stringify({ok:true,phase:'four-piece-turbo',pieces:['wall','floor','ramp','roof'],fastSlots:[1,2,3,4],pieceCycle:true,overlapGuard:true,quickEditRegistered:true,preview:true,semanticMetadata:true,localSnap:true,authorityBypass:false,performance:{entries:perfStats.entries,uniqueCandidates:perfStats.lastQuery.uniqueCandidates,rotationChecks:perfResult.rotationChecks}},null,2));
