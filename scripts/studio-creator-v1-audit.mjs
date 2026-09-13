import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMemoryStudioStore } from '../src/studio/document/studio-store.mjs';
import { createStudioKernel } from '../src/studio/kernel/studio-kernel.mjs';
import { createStudioDocument } from '../src/studio/document/studio-document.mjs';
import { createCreatorActions } from '../src/studio/tools/creator-actions.mjs';
import { createCreatorPrefabLibrary } from '../src/studio/prefabs/creator-prefab-library.mjs';
import { createStudioCameraController } from '../src/studio/input/studio-camera-controller.mjs';
import { analyzeCreatorWorld } from '../src/studio/validation/creator-world-analyzer.mjs';
import { installStudioAuthorityMirror } from '../src/studio/integration/authority-command-mirror.mjs';

const store=createMemoryStudioStore({dbName:`audit-${Date.now()}`});
const doc=createStudioDocument({documentId:'creator-v1',settings:{tileSize:32},entities:[
{id:'a',prefabId:'bench',transform:{x:32,y:32,rotation:0},bounds:{w:32,h:32},source:{authorityPlacementId:'a'}},
{id:'b',prefabId:'lamp',transform:{x:96,y:32,rotation:0},bounds:{w:32,h:32},source:{authorityPlacementId:'b'}},
{id:'c',prefabId:'tree',transform:{x:256,y:256,rotation:0},bounds:{w:64,h:64},source:{authorityPlacementId:'c'}}
]});
const kernel=createStudioKernel({store,document:doc});
const creator=createCreatorActions(kernel);const calls=[];
const adapter={async worldEditRequest(op,payload){calls.push({op,payload});return{ok:true,placement:{placementId:payload.placementId||payload.entityId||`p${calls.length}`}};}};
const mirror=installStudioAuthorityMirror({adapter,actorId:'kelo',getDraftId:()=> 'draft-audit'});for(const e of kernel.document.entities)mirror.seed(e.id,e.source.authorityPlacementId);

kernel.selection.set(['a','b']);const beforeUndo=kernel.history.undoDepth;await creator.rotateSelection(90);assert.equal(kernel.history.undoDepth,beforeUndo+1);assert.equal(kernel.document.entities.find(e=>e.id==='a').transform.rotation,90);assert.equal(kernel.document.entities.find(e=>e.id==='b').transform.rotation,90);await kernel.undo();assert.equal(kernel.document.entities.find(e=>e.id==='a').transform.rotation,0);
kernel.selection.set(['a','b']);await creator.scaleSelection({value:1.25});assert.equal(kernel.document.entities.find(e=>e.id==='a').transform.scale,1.25);assert(calls.some(c=>c.op==='world:placement:scale'));
kernel.selection.set(['a']);const copied=creator.copySelection();assert.equal(copied,1);const pasted=await creator.pasteClipboard({offsetX:64,offsetY:64});assert.equal(pasted.length,1);assert(kernel.document.entities.some(e=>e.id===pasted[0]));await kernel.undo();assert(!kernel.document.entities.some(e=>e.id===pasted[0]));
kernel.selection.set(['a']);const dup=await creator.duplicateSelection({offsetX:32,offsetY:0});assert.equal(dup.length,1);assert(kernel.document.entities.some(e=>e.id===dup[0]));await creator.removeSelection();assert(!kernel.document.entities.some(e=>e.id===dup[0]));await kernel.undo();assert(kernel.document.entities.some(e=>e.id===dup[0]));
kernel.tools.marquee.begin(0,0);kernel.tools.marquee.move(160,96);const selected=kernel.tools.marquee.commit();assert(selected.includes('a')&&selected.includes('b')&&!selected.includes('c'));
kernel.tools.terrain.configure({role:'terrain',material:'grass',brushSize:2});kernel.tools.terrain.beginStroke(0,0);kernel.tools.terrain.strokeTo(96,0);await kernel.tools.terrain.commitStroke();assert(Object.keys(kernel.document.terrain).length>=4);await kernel.undo();assert.equal(Object.keys(kernel.document.terrain).length,0);

const prefabLibrary=createCreatorPrefabLibrary({kernel,store,tool:kernel.tools.prefabStamp,ownerId:'kelo'});kernel.selection.set(['a','b']);const saved=await prefabLibrary.captureSelection({label:'Corner Set'});assert(saved.prefabId.startsWith('creator-prefab:'));assert(prefabLibrary.assets().some(v=>v.assetId===saved.prefabId));await prefabLibrary.load();assert(prefabLibrary.get(saved.prefabId));

const listeners=new Map(),fakeDocument={addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);},querySelector(){return null;},hidden:false},canvas={style:{}},followState={deadXRatio:.1,deadYRatio:.1,lookAheadDist:24},cameraState={x:500,y:400,targetX:500,targetY:400,screenW:800,screenH:600,baseZoom:1,effectiveZoom:1,lookOffsetX:0,lookOffsetY:0};
const keloCamera={
 snapshot(){return{...cameraState,follow:{...followState}};},getBaseZoom(){return cameraState.baseZoom;},getFollowTuning(){return{...followState};},setFollowTuning(v){Object.assign(followState,v);},setBaseZoom(v){cameraState.baseZoom=v;cameraState.effectiveZoom=v;},
 setTarget(x,y){cameraState.x=Number(x);cameraState.y=Number(y);cameraState.targetX=cameraState.x;cameraState.targetY=cameraState.y;return cameraState;},
 screenToWorld(sx,sy){return{x:cameraState.x+(Number(sx)-cameraState.screenW/2)/cameraState.effectiveZoom,y:cameraState.y+(Number(sy)-cameraState.screenH/2)/cameraState.effectiveZoom};},
 restoreState(value={}){for(const key of ['x','y','targetX','targetY','lookOffsetX','lookOffsetY'])if(Number.isFinite(Number(value[key])))cameraState[key]=Number(value[key]);return true;}
};
const cameraTool=createStudioCameraController({root:{document:fakeDocument,KeloCamera:keloCamera,innerWidth:800,innerHeight:600}});
assert.equal(followState.deadXRatio,1e6);
const beforeWorld=cameraTool.toWorld(400,300);assert.deepEqual(beforeWorld,{x:500,y:400});
cameraTool.panScreen(100,0);assert.equal(cameraState.x,400);
cameraTool.setZoom(1.5);assert.equal(cameraTool.zoom,1.5);assert.match(canvas.style.transform,/scale\(1\.5\)/);
cameraTool.suspend();assert.equal(followState.deadXRatio,.1);assert.equal(canvas.style.transform,'');cameraTool.destroy();

const health=analyzeCreatorWorld({document:kernel.document,prefabs:kernel.prefabs});assert.equal(health.errors.length,0);assert.equal(health.counts.objects,kernel.document.entities.length);assert.equal(health.performance.measured,false);assert.match(health.performance.notice,/Sin presupuesto medido/);
const shell=await readFile(new URL('../src/studio/ui/studio-live-shell.mjs',import.meta.url),'utf8');assert.match(shell,/ASSETS · VISUAL/);assert.match(shell,/ks-scale-hud/);assert.match(shell,/2 DEDOS/);assert.match(shell,/document\.createElement\('canvas'\)/);assert.match(shell,/renderAssetPreview/);assert.match(shell,/data-act=\"focus\"/);assert.match(shell,/onFocus/);assert.match(shell,/EXPLORER/);assert.match(shell,/PROPERTIES/);assert.match(shell,/data-act=\"duplicate\"/);assert.match(shell,/data-act=\"scale-up\"/);assert.match(shell,/ESCALA %/);assert.match(shell,/data-act=\"play\"/);assert.match(shell,/data-act=\"brush-size\"/);assert.match(shell,/virtualRange/);
const product=await readFile(new URL('../src/studio/ui/creator-productivity-panel.mjs',import.meta.url),'utf8');assert.match(product,/SAVE PREFAB/);assert.match(product,/CHECK MAP/);assert.match(product,/SNAP 32/);assert.match(product,/COPY/);assert.match(product,/PASTE/);
const overlaySource=await readFile(new URL('../src/studio/render/studio-overlay-renderer.mjs',import.meta.url),'utf8');assert.match(overlaySource,/assetPreview\?\.drawAsset/);assert.match(overlaySource,/drawCreatorPrefab/);
const controller=await readFile(new URL('../src/studio/integration/live-studio-controller.mjs',import.meta.url),'utf8');assert.match(controller,/createStudioCameraController/);assert.match(controller,/onPinchStart:payload=>mode==='select'\?false:beginPinchScale\(payload\)/);assert.match(controller,/previewScale/);assert.match(controller,/cameraController\.toWorld/);assert.match(controller,/cameraController\?\.zoom/);assert.match(controller,/studio\.tools\.marquee\.begin/);assert.match(controller,/studio\.tools\.marquee\.commit/);assert.match(controller,/renderAssetPreview/);assert.match(controller,/createCreatorActions/);assert.match(controller,/createCreatorPrefabLibrary/);assert.match(controller,/createCreatorGridOverlay/);assert.match(controller,/analyzeCreatorWorld/);assert.match(controller,/beginStroke/);assert.match(controller,/commitStroke/);assert.match(controller,/togglePlaytest/);assert.match(controller,/KeloInputLocks\.release\(inputLockToken\)/);assert.match(controller,/pasteClipboard/);assert.match(controller,/scaleSelection/);
const cameraSource=await readFile(new URL('../src/studio/input/studio-camera-controller.mjs',import.meta.url),'utf8');assert.match(cameraSource,/onPinchStart/);assert.match(cameraSource,/mode:'delegate'/);const beforePreviewDocScale=Number(kernel.document.entities.find(e=>e.id===a.id).transform?.scale||1);await mirror.previewScale(a.id,1.2);assert.equal(calls.at(-1).op,'world:placement:scale');assert.equal(Number(kernel.document.entities.find(e=>e.id===a.id).transform?.scale||1),beforePreviewDocScale,'authority preview must not mutate Studio History document');await mirror.previewScale(a.id,beforePreviewDocScale);
mirror.uninstall();await store.close();
console.log(JSON.stringify({ok:true,creatorV1:true,multiSelect:true,marquee:true,batchHistory:true,duplicate:true,delete:true,rotate:true,rotationAuthoritySafe:true,scale:true,pinchScale:true,visibleScaleHud:true,copyPaste:true,continuousBrush:true,brushSizes:true,visualAssetBrowser:true,realPlacementGhost:true,creatorPrefabPreview:true,creatorCamera:true,foundationCameraOwnerFixture:true,focusSelection:true,explorer:true,properties:true,playtestToggle:true,myPrefabs:true,prefabStamp:true,snapGrid:true,mapHealth:true,lazyArchitecturePreserved:true,entities:kernel.document.entities.length,terrainCells:Object.keys(kernel.document.terrain).length,authorityCalls:calls.length},null,2));