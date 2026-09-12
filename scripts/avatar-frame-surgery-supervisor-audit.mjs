/* KELO-INDEX
 * area: QA / FRAME SURGERY
 * owner: strict finger-first feature supervisor
 * keys: SURGERY SUPERVISOR 25-OF-25 GESTURE NONDESTRUCTIVE UI CONTRACT
 * purpose: refuse PASS unless every promised Frame Surgery capability is wired and core patch behavior is correct
 * online: N/A
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SURGERY_TOOLS,SURGERY_LAYERS,surgeryFeatureContract,createSurgeryPatch,createSurgeryHistory,
  reduceSurgeryGesture,createStroke,createOverlayPatch,serializeSurgeryPatches,normalizeSurgeryPatch
} from '../src/creators/sprite-compiler/sprite-frame-surgery-model.mjs';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const ui=[read('src/creators/ui/avatar-frame-surgery-workspace.mjs'),read('src/creators/ui/avatar-frame-surgery-editor.mjs'),read('src/creators/ui/avatar-frame-surgery-ui-kit.mjs')].join('\n');
const normalizer=read('src/creators/sprite-compiler/sprite-frame-normalizer.mjs');
const service=read('src/creators/avatar/avatar-quick-import-service.mjs');
const manifest=read('src/creators/workspaces/avatar-workspace.mjs');
const failures=[];
const checks=[];
function check(id,fn){try{fn();checks.push({id,pass:true});}catch(error){checks.push({id,pass:false,error:error.message});failures.push(`${id}: ${error.message}`);}}
const has=(text,needles)=>{for(const needle of[].concat(needles))assert.ok(text.includes(needle),`missing ${needle}`);};

check('01-one-finger-move',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'drag',dx:7,dy:-4});assert.equal(p.x,7);assert.equal(p.y,-4);has(ui,['pointers.size===1','type:\'drag\'']);});
check('02-two-finger-scale',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'pinch',start:[{x:0,y:0},{x:10,y:0}],current:[{x:0,y:0},{x:20,y:0}]});assert.ok(p.scale>1.99&&p.scale<2.01);has(ui,['pointers.size===2','scaleMul']);});
check('03-two-finger-rotate',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'pinch',start:[{x:0,y:0},{x:10,y:0}],current:[{x:0,y:0},{x:0,y:10}]});assert.ok(Math.abs(p.rotation-Math.PI/2)<1e-6);has(ui,'rotationDelta');has(normalizer,'context.rotate(plan.patch.rotation');});
check('04-ghost-reference',()=>has(ui,['tool===\'compare\'','ghostIndex','globalAlpha']));
check('05-align-feet',()=>has(ui,['ALINEAR PIES','autoRepair(\'feet\')','feetOffsetPx']));
check('06-center-body',()=>has(ui,['CENTRAR','autoRepair(\'center\')','centerOffsetPx']));
check('07-match-scale',()=>has(ui,['IGUALAR ESCALA','autoRepair(\'scale\')','verticalScaleDelta']));
check('08-finger-eraser',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'stroke',bucket:'erase',points:[{x:.5,y:.5}],radius:.08});assert.equal(p.erase.length,1);has(normalizer,['destination-out','patch.erase']);});
check('09-finger-restore',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'stroke',bucket:'restore',points:[{x:.5,y:.5}],radius:.08});assert.equal(p.restore.length,1);has(normalizer,['restoreStroke','patch.restore']);});
check('10-magic-selection',()=>has(ui,['SELECCIÓN MÁGICA','magicSelectAt','Uint8Array(w*h)']));
check('11-selection-to-layer',()=>has(ui,['selectionToLayer','cutoutOriginal:true','kind:\'selection\'']));
check('12-import-piece',()=>has(ui,['+ PIEZA PNG','importExternalPiece','dataUrl']));
check('13-copy-piece-from-frame',()=>has(ui,['COPIAR DE FRAME','showFramePicker','sourceFrame:i']));
check('14-clone-brush',()=>{const s=createStroke([{x:.4,y:.4}],{source:{x:.2,y:.2}});assert.deepEqual(s.source,{x:.2,y:.2});has(ui,['CLONAR','cloneSource']);has(normalizer,'cloneStroke');});
check('15-small-gap-fill',()=>{has(ui,['RELLENAR HUECO',"mode='fill'"]);has(normalizer,'smartFillSmallGap');});
check('16-free-frame-crop',()=>{const p=reduceSurgeryGesture(createSurgeryPatch(),{type:'crop',edge:'left',value:-.2});assert.equal(p.crop.left,-.2);has(ui,['RECORTE','nearestCropEdge','changeCrop']);has(normalizer,'cropSourceRect');});
check('17-outside-crop-recovery',()=>{const p=normalizeSurgeryPatch({crop:{left:-.3}});assert.equal(p.crop.left,-.3);has(ui,['drawCropSource','globalAlpha=.34']);});
check('18-simple-layers',()=>{assert.deepEqual([...SURGERY_LAYERS],['original','character','patches','pieces','mask']);has(ui,['CAPAS SIMPLES','layer-visibility']);has(normalizer,'layerVisibility');});
check('19-undo-redo',()=>{const h=createSurgeryHistory(createSurgeryPatch());h.commit({...h.value,x:9});assert.equal(h.undo().x,0);assert.equal(h.redo().x,9);has(ui,['pointers.size===3','doUndo','doRedo']);});
check('20-before-after-hold',()=>has(ui,['HOLD ORIGINAL','onpointerdown','holdOriginal=true','holdOriginal=false']));
check('21-live-animation-preview',()=>has(ui,['ANIMACIÓN REAL','motion.clock','requestAnimationFrame(tick)']));
check('22-frame-doctor-heatmap',()=>has(ui,['FRAME DOCTOR · HEATMAP','paintHeatmap','doctorFinding']));
check('23-auto-fix-first',()=>has(ui,['AUTO-FIX','AUTO-FIX · NORMALIZANDO','autoRepair(\'all\')']));
check('24-nondestructive-patches',()=>{const source={x:1};const patch=createSurgeryPatch({x:3,overlays:[createOverlayPatch({kind:'external',image:source,dataUrl:'data:image/png;base64,AA=='})]});const serial=serializeSurgeryPatches({2:patch});assert.equal(serial[2].x,3);assert.equal(serial[2].overlays[0].image,undefined);assert.equal(source.x,1);has(normalizer,['foreground.cleanedData','source = makeCanvas','patch.overlays']);has(service,'framePatches');});
check('25-recompile-and-test',()=>{has(ui,['RECOMPILAR Y PROBAR','compileUniversalAvatarRuntime','use.disabled=!pass','validation']);});

check('contract-exact-25',()=>{assert.equal(surgeryFeatureContract.required.length,25);assert.equal(new Set(surgeryFeatureContract.required).size,25);assert.deepEqual([...SURGERY_TOOLS],['move','erase','restore','piece','compare']);});
check('finger-first-safety',()=>has(ui,['touch-action:none','setPointerCapture','pointerdown','pointermove','pointerup']));
check('runtime-gate-not-bypassed',()=>{has(service,['compileUniversalAvatarRuntime','compiled.reviewRequired','compiled.validation?.artDefects']);has(ui,['use.disabled=!pass','compiled.reviewRequired']);});
check('workspace-routes-to-surgery',()=>has(manifest,'avatar-frame-surgery-workspace.mjs'));
check('normalizer-backward-compatible',()=>{const p=normalizeSurgeryPatch({scale:1.2,x:3,y:4,copyFrom:2});assert.equal(p.scale,1.2);assert.equal(p.x,3);assert.equal(p.copyFrom,2);has(normalizer,['patch.scale','patch.x','patch.y','patch.copyFrom']);});

const promised=checks.slice(0,25),score=promised.filter(x=>x.pass).length;
const report={ok:failures.length===0,supervisor:'Kelo Frame Surgery Guardian',version:'1.0.0',promisedFeatures:25,score:`${score}/25`,astonished:failures.length===0&&score===25,extraGuards:checks.length-25,checks,failures};
console.log(JSON.stringify(report,null,2));
if(failures.length||score!==25)throw new Error(`FRAME_SURGERY_SUPERVISOR_REJECTED ${score}/25 :: ${failures.join(' | ')}`);
