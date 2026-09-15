/* KELO-INDEX
 * area: TEST / WORLD EDITOR / A10 MOBILE HYDRATION
 * owner: BUG-0003 A10 regression contract
 * purpose: prove stable ESM identity, one large normalization boundary, cooperative spatial rebuild and one genuinely serialized mobile optional-work queue
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT=process.cwd(),read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8'),BUILD='world-bridge-20260915-21';
const workspace=read('src/creators/workspaces/world-workspace.mjs');
const bridge=read('src/studio/integration/world-studio-bridge.mjs');
const coordinator=read('src/studio/integration/live-studio-controller-a10.mjs');
const controller=read('src/studio/integration/live-studio-controller.mjs');
const entry=read('src/studio/studio-entry.mjs');
const legacyEntry=read('src/studio/studio-entry-legacy.mjs');
const importer=read('src/studio/adapters/current-world-importer.mjs');
const kernel=read('src/studio/core/studio-kernel.mjs');
const overlay=read('src/studio/render/studio-overlay-canvas.mjs');
const index=read('index.html');
const launcher=read('src/ui/studio-launcher.js');
const creatorEntry=read('src/creators/creator-entry.mjs');

test('A10 uses stable production module identities and build 21',()=>{
  assert.match(workspace,new RegExp(`WORLD_BUILD='${BUILD}'`));
  assert.match(bridge,new RegExp(`WORLD_STUDIO_BRIDGE_BUILD='${BUILD}'`));
  assert.match(bridge,/live-studio-controller-a10\.mjs/);
  for(const source of [workspace,bridge,coordinator]){
    assert.doesNotMatch(source,/world-ios-/);
    assert.doesNotMatch(source,/import\([^\n]*(Date\.now|Math\.random)/);
  }
  assert.doesNotMatch(workspace,/PHONE_RUNTIME_ROOTS/);
  assert.match(index,new RegExp(`studio-launcher\\.js\\?v=${BUILD}`));
  assert.match(launcher,new RegExp(`CREATOR_BUILD='${BUILD}'`));
  assert.match(creatorEntry,new RegExp(`world-workspace\\.mjs\\?v=${BUILD}`));
  assert.match(controller,/const BUILD=controllerUrl\.searchParams\.get\('v'\)/);
});

test('A10 phone boot still excludes overlay renderer and worker',()=>{
  const guard=legacyEntry.indexOf('if(!phoneBoot){');
  assert.ok(guard>=0);
  assert.ok(legacyEntry.indexOf("import('./render/studio-overlay-renderer.mjs')")>guard);
  assert.ok(legacyEntry.indexOf("import('./compiler/worker-client.mjs')")>guard);
  assert.match(controller,/if\(phone\)[\s\S]*createStudioOverlayCanvas:\(\)=>\(\{canvas:null/);
  assert.match(workspace,/preloadPhoneStudioRuntime[\s\S]*enabled:false/);
});

test('A10 captures the old 8s/15s timers and waits for each real ESM graph to settle',()=>{
  for(const token of ['hydrateAfterChrome','creator-productivity-panel.mjs','loadBasicTools','loadAssetPalette','installStudioProductivityExtras'])assert.match(coordinator,new RegExp(token));
  assert.match(coordinator,/capture\.take\('hydrate'\)/);
  assert.match(coordinator,/capture\.take\('basic-tools'\)/);
  assert.match(coordinator,/capture\.take\('productivity'\)/);
  assert.match(coordinator,/capture\.take\('extras'\)/);
  assert.match(coordinator,/capture\.take\('asset-palette'\)/);
  assert.match(coordinator,/waitForStudioModuleSettled/);
  assert.match(coordinator,/MODULE_BY_KIND/);
  assert.match(coordinator,/stableTurns>=3/);
  assert.match(coordinator,/const startGate=new Promise/);
  assert.match(coordinator,/let phaseChain=startGate/);
  assert.match(coordinator,/queuePhase\('basic-tools','basic-tools'/);
  assert.match(coordinator,/queuePhase\('productivity','productivity'/);
  assert.match(coordinator,/queuePhase\('extras','extras'/);
  assert.match(coordinator,/A10_ASSETS_REQUESTED/);
  assert.match(coordinator,/queuePhase\('asset-palette','asset-palette'/);
});

test('A10 importer borrows the large snapshot until the kernel boundary',async()=>{
  assert.doesNotMatch(importer,/structuredClone/);assert.doesNotMatch(importer,/createWorldDocument/);
  const cells={},collisions={},placements=[];
  for(let i=0;i<250;i++){cells[`cell-${i}`]={material:'grass',x:i,y:i};collisions[`collision-${i}`]={collisionId:`collision-${i}`,x:i,y:i,w:32,h:32};placements.push({placementId:`p-${i}`,assetId:'tree',x:i*2,y:i*3,rotation:i%4,scale:1});}
  const snapshot={worldId:'world:a10-fixture',placements,cells,collisions},template={width:32,height:48,parts:[{sprite:'tree.png',x:0,y:0}],collision:{x:0,y:32,w:32,h:16}};
  const adapter={assetCatalog:{get:id=>id==='tree'?template:null},tileRegistry:{worldTileSize:32},worldRenderer:{chunkSize:512},worldEditRequest:async op=>op==='world:preview:enter'?{viewSnapshot:snapshot,viewMeta:{draftId:'draft-a10'}}:null};
  const mod=await import(pathToFileURL(path.join(ROOT,'src/studio/adapters/current-world-importer.mjs')).href+'?a10-contract=1');
  const raw=await mod.importCurrentKeloWorld({adapter,mode:'world',actorId:'tester',view:'draft',draftId:'draft-a10'});
  assert.equal(raw.terrain,cells);assert.equal(raw.navigation.collisions,collisions);assert.equal(raw.entities[0].components.visual.parts,template.parts);assert.equal(raw.entities[0].components.collider.rect,template.collision);
});

test('A10 kernel normalizes once and rebuilds 250 entities in cooperative batches',async()=>{
  assert.match(kernel,/setDocumentAsync/);assert.match(kernel,/yieldControl/);assert.match(entry,/setDocumentAsync/);
  const mod=await import(pathToFileURL(path.join(ROOT,'src/studio/core/studio-kernel.mjs')).href+'?a10-contract=1');
  const entities=Array.from({length:250},(_,i)=>({id:`e-${i}`,transform:{x:i,y:i,scale:1},bounds:{w:32,h:32},components:{}})),terrain={a:{material:'grass'}},collisions={c:{collisionId:'c',x:0,y:0,w:32,h:32}},raw={worldId:'world:a10',metadata:{name:'A10'},settings:{tileSize:32,chunkSize:512},terrain,entities,navigation:{collisions}};
  const k=mod.createStudioKernel({document:{worldId:'empty',metadata:{name:'empty'},settings:{tileSize:32,chunkSize:512}}});let yields=0;const batches=[];
  await k.setDocumentAsync(raw,{batchSize:100,yieldControl:async()=>{yields++;await Promise.resolve();},onBatch:row=>batches.push(row)});
  assert.equal(k.document.entities.length,250);assert.notEqual(k.document.entities,entities);assert.notEqual(k.document.terrain,terrain);assert.notEqual(k.document.navigation.collisions,collisions);assert.equal(batches.length,3);assert.equal(yields,2);assert.deepEqual(batches.map(row=>row.end),[100,200,250]);
});

test('A10 exposes every requested BUG-0003 phase and canvas teardown',()=>{
  const joined=entry+'\n'+coordinator+'\n'+bridge;
  for(const milestone of ['A10_CHROME_READY','A10_CORE_READY','A10_IMPORT_START','A10_IMPORT_SNAPSHOT_READY','A10_DOCUMENT_SET_START','A10_DOCUMENT_SET_DONE','A10_SPATIAL_BATCH','A10_MAP_READY','A10_BASIC_TOOLS_START','A10_BASIC_TOOLS_READY','A10_PRODUCTIVITY_START','A10_PRODUCTIVITY_READY','A10_ASSETS_REQUESTED'])assert.match(joined,new RegExp(milestone));
  assert.match(overlay,/canvas\.width=0;canvas\.height=0/);assert.match(workspace,/canvas\.width=0;canvas\.height=0/);assert.match(bridge,/1000,5000,10000,15000/);
});
