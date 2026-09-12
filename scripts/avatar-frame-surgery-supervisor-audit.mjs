/* KELO-INDEX
 * area: QA / FRAME SURGERY
 * owner: strict research-hardened finger-first feature supervisor
 * keys: SURGERY SUPERVISOR 35-OF-35 GESTURE MASK ONION PIXEL-PERFECT NONDESTRUCTIVE UI CONTRACT
 * purpose: refuse PASS unless every promised Frame Surgery capability is wired and core behavior is demonstrably correct
 * online: N/A
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SURGERY_TOOLS,SURGERY_LAYERS,SURGERY_SELECTION_OPS,surgeryFeatureContract,createSurgeryPatch,createSurgeryHistory,
  reduceSurgeryGesture,createStroke,createOverlayPatch,serializeSurgeryPatches,normalizeSurgeryPatch,
  selectionFromMask,maskToRuns,runsToMask,combineSelectionRuns,invertSelectionRuns,snapSurgeryPatch
} from '../src/creators/sprite-compiler/sprite-frame-surgery-model.mjs';
import {planSpriteFrameNormalization,__spriteFrameNormalizerInternals as normalizerInternals} from '../src/creators/sprite-compiler/sprite-frame-normalizer.mjs';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const ui=[read('src/creators/ui/avatar-frame-surgery-workspace.mjs'),read('src/creators/ui/avatar-frame-surgery-editor.mjs'),read('src/creators/ui/avatar-frame-surgery-ui-kit.mjs')].join('\n');
const normalizer=read('src/creators/sprite-compiler/sprite-frame-normalizer.mjs');
const service=read('src/creators/avatar/avatar-quick-import-service.mjs');
const manifest=read('src/creators/workspaces/avatar-workspace.mjs');
const failures=[],checks=[];
function check(id,fn){try{fn();checks.push({id,pass:true});}catch(error){checks.push({id,pass:false,error:error.message});failures.push(`${id}: ${error.message}`)}}
const has=(text,needles)=>{for(const needle of[].concat(needles))assert.ok(text.includes(needle),`missing ${needle}`)};

check('01-one-finger-move',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'drag',dx:7,dy:-4});assert.equal(p.x,7);assert.equal(p.y,-4);has(ui,['pointers.size===1',"type:'drag'"])});
check('02-two-finger-scale',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'pinch',start:[{x:0,y:0},{x:10,y:0}],current:[{x:0,y:0},{x:20,y:0}]});assert.ok(p.scale>1.99&&p.scale<2.01);has(ui,['pointers.size===2','scaleMul'])});
check('03-two-finger-rotate',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'pinch',start:[{x:0,y:0},{x:10,y:0}],current:[{x:0,y:0},{x:0,y:10}]});assert.ok(Math.abs(p.rotation-Math.PI/2)<1e-6);has(ui,'rotationDelta');has(normalizer,'context.rotate(plan.patch.rotation')});
check('04-ghost-reference',()=>has(ui,["S.tool==='compare'",'ghostIndex','globalAlpha']));
check('05-align-feet',()=>has(ui,['ALINEAR PIES',"autoRepair('feet')",'feetOffsetPx']));
check('06-center-body',()=>has(ui,['CENTRAR',"autoRepair('center')",'centerOffsetPx']));
check('07-match-scale',()=>has(ui,['IGUALAR ESCALA',"autoRepair('scale')",'verticalScaleDelta']));
check('08-finger-eraser',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'stroke',bucket:'erase',points:[{x:.5,y:.5}],radius:.08});assert.equal(p.erase.length,1);has(normalizer,['destination-out','patch.erase'])});
check('09-finger-restore',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'stroke',bucket:'restore',points:[{x:.5,y:.5}],radius:.08});assert.equal(p.restore.length,1);has(normalizer,['restoreStroke','patch.restore'])});
check('10-magic-selection',()=>has(ui,['SELECCIÓN MÁGICA','magicSelectAt','Uint8Array(w*h)']));
check('11-selection-to-layer',()=>has(ui,['selectionToLayer','cutoutOriginal:true',"kind:'selection'"]));
check('12-import-piece',()=>has(ui,['+ PIEZA PNG','importExternalPiece','dataUrl']));
check('13-copy-piece-from-frame',()=>has(ui,['COPIAR DE FRAME','showFramePicker','sourceFrame:i']));
check('14-clone-brush',()=>{const s=createStroke([{x:.4,y:.4}],{source:{x:.2,y:.2}});assert.deepEqual(s.source,{x:.2,y:.2});has(ui,['CLONAR','cloneSource']);has(normalizer,'cloneStroke')});
check('15-small-gap-fill',()=>{has(ui,['RELLENAR HUECO',"S.mode='fill'"]);has(normalizer,'smartFillSmallGap')});
check('16-free-frame-crop',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'crop',edge:'left',value:-.2});assert.equal(p.crop.left,-.2);has(ui,['RECORTE','nearestCropEdge','changeCrop']);has(normalizer,'cropSourceRect')});
check('17-outside-crop-recovery',()=>{const p=normalizeSurgeryPatch({crop:{left:-.3}});assert.equal(p.crop.left,-.3);has(ui,['drawCropSource','globalAlpha=.34'])});
check('18-simple-layers',()=>{assert.deepEqual([...SURGERY_LAYERS],['original','character','patches','pieces','mask']);has(ui,['CAPAS',"type:'layer-visibility'"]);has(normalizer,'layerVisibility')});
check('19-undo-redo',()=>{const h=createSurgeryHistory(createSurgeryPatch());h.commit({...h.value,x:9});assert.equal(h.undo().x,0);assert.equal(h.redo().x,9);has(ui,['pointers.size===3','doUndo','doRedo'])});
check('20-before-after-hold',()=>has(ui,['HOLD ORIGINAL','onpointerdown','holdOriginal=true','holdOriginal=false']));
check('21-live-animation-preview',()=>has(ui,['ANIMACIÓN REAL','motion.clock','requestAnimationFrame(tick)']));
check('22-frame-doctor-heatmap',()=>has(ui,['FRAME DOCTOR · HEATMAP','paintHeatmap','doctorFinding']));
check('23-auto-fix-first',()=>has(ui,['AUTO-FIX','AUTO-FIX · NORMALIZANDO',"autoRepair('all')"]));
check('24-nondestructive-patches',()=>{const source={x:1};const patch=createSurgeryPatch({x:3,overlays:[createOverlayPatch({kind:'external',image:source,dataUrl:'data:image/png;base64,AA=='})]});const serial=serializeSurgeryPatches({2:patch});assert.equal(serial[2].x,3);assert.equal(serial[2].overlays[0].image,undefined);assert.equal(source.x,1);has(normalizer,['foreground.cleanedData','source=makeCanvas','patch.overlays']);has(service,'framePatches')});
check('25-recompile-and-test',()=>has(ui,['RECOMPILAR Y PROBAR','compileUniversalAvatarRuntime','use.disabled=!pass','validation']));

check('26-exact-selection-mask',()=>{const mask=Uint8Array.from([1,1,0,0,1,0]);const s=selectionFromMask(mask,3,2);assert.deepEqual(Array.from(runsToMask(s.runs,6)),Array.from(mask));assert.ok(s.runs.length>0);has(ui,['maskWidth','runsToMask','MASK EXACTA'])});
check('27-selection-boolean-ops',()=>{assert.deepEqual([...SURGERY_SELECTION_OPS],['replace','add','subtract','intersect']);const a=maskToRuns(Uint8Array.from([1,1,0,0])),b=maskToRuns(Uint8Array.from([0,1,1,0]));assert.deepEqual(Array.from(runsToMask(combineSelectionRuns(a,b,'add',4),4)),[1,1,1,0]);assert.deepEqual(Array.from(runsToMask(combineSelectionRuns(a,b,'subtract',4),4)),[1,0,0,0]);assert.deepEqual(Array.from(runsToMask(combineSelectionRuns(a,b,'intersect',4),4)),[0,1,0,0]);assert.deepEqual(Array.from(runsToMask(invertSelectionRuns(a,4),4)),[0,0,1,1]);has(ui,['SEL +','SEL −','SEL ∩','SEL INV'])});
check('28-multi-frame-onion-skin',()=>has(ui,['drawOnion','onionSpan','ONION ±2','col-distance','col+distance']));
check('29-pixel-perfect-strokes',()=>{const pts=normalizerInternals.rasterizeStrokePoints({points:[{x:0,y:0},{x:1,y:1}]},4,4);assert.deepEqual(pts.map(p=>[p.x,p.y]),[[0,0],[1,1],[2,2],[3,3]]);const s=createStroke([{x:.1,y:.1}],{});assert.equal(s.pixelPerfect,true);has(normalizer,['getImageData','putImageData','brushOffsets'])});
check('30-relative-clone-path',()=>{has(normalizer,['anchor.x+(p.x-first.x)','anchor.y+(p.y-first.y)','cloneStroke']);has(ui,'la muestra seguirá el desplazamiento')});
check('31-enclosed-gap-fill',()=>{const enclosed=new Uint8ClampedArray(5*5*4);for(let i=0;i<enclosed.length;i+=4)enclosed[i+3]=255;enclosed[(2*5+2)*4+3]=0;assert.deepEqual(normalizerInternals.findEnclosedTransparentComponent(enclosed,5,5,2,2,8),[12]);const edge=new Uint8ClampedArray(5*5*4);for(let i=0;i<edge.length;i+=4)edge[i+3]=255;edge[3]=0;assert.deepEqual(normalizerInternals.findEnclosedTransparentComponent(edge,5,5,0,0,8),[]);has(ui,'solo huecos transparentes cerrados y pequeños')});
check('32-pixel-snap-transforms',()=>{const p=snapSurgeryPatch(createSurgeryPatch({x:2.7,y:-3.3,rotation:.3,scale:1.021}));assert.equal(p.x,3);assert.equal(p.y,-3);assert.ok(Math.abs(p.rotation-Math.PI/12)<1e-9);has(ui,['PIXEL SNAP ✓','snapSurgeryPatch'])});
check('33-piece-visibility-lock-order',()=>{let p=createSurgeryPatch({overlays:[createOverlayPatch({id:'x',x:1,z:0})]});p=reduceSurgeryGesture(p,{type:'overlay-property',id:'x',changes:{locked:true,visible:false}});const locked=p.overlays[0];assert.equal(locked.locked,true);assert.equal(locked.visible,false);const moved=reduceSurgeryGesture(p,{type:'overlay-transform',id:'x',transform:{x:9}});assert.equal(moved.overlays[0].x,1);const raised=reduceSurgeryGesture(p,{type:'overlay-reorder',id:'x',delta:1});assert.equal(raised.overlays[0].z,1);has(ui,['VISIBILIDAD / BLOQUEO / ORDEN',"type:'overlay-remove'",'🔒'])});
check('34-pointer-cancel-rollback',()=>has(ui,['onpointercancel','history.replace(original)','GESTO CANCELADO','releasePointerCapture']));
check('35-selective-patch-backward-compatibility',()=>{const frame=i=>({bounds:{x:i*12,y:0,w:8,h:10},sourceRect:{x:i*12,y:0,w:8,h:10},cell:{x:i*12,y:0,w:10,h:12},area:80,boundaryRatio:0,touchesCanvasEdge:false});const rig={groups:[[frame(0),frame(1)]],directionKeys:['s'],rowMap:{s:0}};const plan=planSpriteFrameNormalization(rig,{sourceWidth:40,sourceHeight:20,framePatches:{0:{scale:1.2,x:3,y:4,copyFrom:1}}});assert.equal(plan.plans[0].patch.scale,1.2);assert.equal(plan.plans[0].patch.copyFrom,1);assert.ok(plan.plans[0].destination.x!==plan.plans[1].destination.x);has(normalizer,['framePatches','copyFrom','patchScale'])});

check('contract-exact-35',()=>{assert.equal(surgeryFeatureContract.required.length,35);assert.equal(new Set(surgeryFeatureContract.required).size,35);assert.deepEqual([...SURGERY_TOOLS],['move','erase','restore','piece','compare'])});
check('finger-first-safety',()=>has(ui,['touch-action:none','setPointerCapture','pointerdown','pointermove','pointerup','pointercancel']));
check('runtime-gate-not-bypassed',()=>{has(service,['compileUniversalAvatarRuntime','compiled.reviewRequired','compiled.validation?.artDefects']);has(ui,['use.disabled=!pass','compiled.reviewRequired'])});
check('workspace-routes-to-surgery',()=>has(manifest,'avatar-frame-surgery-workspace.mjs'));
check('original-remains-immutable',()=>{const p=createSurgeryPatch({erase:[createStroke([{x:.5,y:.5}])]});const serial=serializeSurgeryPatches({0:p});assert.equal(serial[0].erase.length,1);has(normalizer,['foreground.cleanedData','putPixels'])});
check('explicit-ambiguous-review',()=>has(ui,['CONFIRMAR INTERPRETACIÓN','reviewConfirmed','userConfirmedInterpretation:reviewConfirmed']));

const promised=checks.slice(0,35),score=promised.filter(x=>x.pass).length;
const report={ok:failures.length===0,supervisor:'Kelo Frame Surgery Guardian',version:'2.0.0-research-hardened',promisedFeatures:35,score:`${score}/35`,astonished:failures.length===0&&score===35,extraGuards:checks.length-35,checks,failures};
console.log(JSON.stringify(report,null,2));
if(failures.length||score!==35)throw new Error(`FRAME_SURGERY_SUPERVISOR_REJECTED ${score}/35 :: ${failures.join(' | ')}`);