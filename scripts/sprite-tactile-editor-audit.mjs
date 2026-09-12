import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createFrameProject,replaceFrameSlot,updateFramePatch,frameProjectProgress,normalizeFramePatch,createFrameProjectHistory,applyPinchFromPointers,alphaBoundsMatchProposal} from '../src/creators/avatar/avatar-frame-project.mjs';
import {createAvatarFrameProjectStore} from '../src/creators/avatar/avatar-frame-project-store.mjs';
import {createAlphaEditMask,brushErase,magicEraseContiguous,encodeMaskRuns,decodeMaskRuns,applyEraseMask,classifySourceCrop} from '../src/creators/avatar/avatar-frame-pixels.mjs';

const checks=[];const ok=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
let project=createFrameProject({id:'audit-4x4',now:1});
ok('project owns exactly 16 mapped slots',project.slots.length===16&&project.slots.every((slot,i)=>slot.slotIndex===i&&slot.row===Math.floor(i/4)&&slot.column===i%4));
ok('4D semantics come from runtime contract',project.runtimeContract.directionKeys.join(',')==='s,w,e,n'&&project.slots[4].directionKey==='w');
for(let i=0;i<4;i++)project=replaceFrameSlot(project,i,{sourceKey:`src-${i}`,sourceName:`${i}.png`,sourceWidth:64,sourceHeight:96});
ok('partial progress is preserved',frameProjectProgress(project).present===4&&!frameProjectProgress(project).complete);
const before=JSON.stringify(project.slots.map(slot=>slot.sourceKey));project=replaceFrameSlot(project,2,{sourceKey:'src-2-replaced',sourceName:'new.png',sourceWidth:70,sourceHeight:100});const after=project.slots.map(slot=>slot.sourceKey);
ok('replacing one slot does not mutate neighbors',after[0]==='src-0'&&after[1]==='src-1'&&after[2]==='src-2-replaced'&&after[3]==='src-3'&&before!==JSON.stringify(after));

const legacy=normalizeFramePatch({scale:.8,x:3,y:-2,copyFrom:1});
ok('legacy framePatches remain backward compatible',legacy.scale===.8&&legacy.x===3&&legacy.y===-2&&legacy.copyFrom===1&&legacy.pivot.mode==='feet-center');
const pinched=applyPinchFromPointers({scale:1,x:4,y:9},{a0:{x:0,y:0},b0:{x:100,y:0},a1:{x:-50,y:0},b1:{x:150,y:0}});
ok('pinch doubles uniform scale without moving foot offset',Math.abs(pinched.scale-2)<1e-9&&pinched.x===4&&pinched.y===9&&pinched.pivot.mode==='feet-center');
const proposal=alphaBoundsMatchProposal({x:10,y:20,width:20,height:40},{x:8,y:10,width:40,height:80},{scale:1,x:0,y:0});
ok('auto match uses uniform height ratio and center correction',proposal.scale===2&&proposal.x===8&&proposal.y===0);

const history=createFrameProjectHistory(project);const changed=updateFramePatch(project,0,{scale:.72,x:5});history.commit(changed,'gesture');ok('history commits one gesture',history.current().slots[0].patch.scale===.72);history.undo();ok('undo restores exact prior transform',history.current().slots[0].patch.scale===1);history.redo();ok('redo restores transform',history.current().slots[0].patch.scale===.72);

const width=5,height=5,pixels=new Uint8ClampedArray(width*height*4);for(let p=0;p<width*height;p++){pixels[p*4]=p===12?250:10;pixels[p*4+1]=p===12?20:10;pixels[p*4+2]=p===12?20:10;pixels[p*4+3]=255;}
let mask=createAlphaEditMask(width,height);const brush=brushErase(mask,width,height,2,2,{radius:.6});ok('brush erase edits mask not immutable pixels',brush.changed===1&&pixels[12*4+3]===255&&brush.mask[12]===1);const erased=applyEraseMask(pixels,width,height,brush.mask);ok('mask hides pixel in derived output only',erased[12*4+3]===0&&pixels[12*4+3]===255);const restored=brushErase(brush.mask,width,height,2,2,{radius:.6,restore:true});ok('restore returns erased alpha mask exactly',restored.mask[12]===0);
const flood=magicEraseContiguous(pixels,width,height,0,0,{tolerance:4,mask});ok('magic eraser is contiguous and respects color boundary',flood.changed===24&&flood.mask[12]===0);const encoded=encodeMaskRuns(flood.mask),decoded=decodeMaskRuns(encoded,width,height);ok('erase mask round-trips for persistence',Buffer.from(decoded).equals(Buffer.from(flood.mask)));

const recoverable=classifySourceCrop({sourceWidth:128,sourceHeight:128,sourceRect:{x:32,y:32,w:32,h:32},bounds:{x:32,y:35,w:30,h:28},cell:{x:32,y:32,w:32,h:32},boundaryRatio:.04,touchesCanvasEdge:false});
ok('cell/source crop is recoverable when original continues',recoverable.classification==='RECOVERABLE_SOURCE_CROP'&&recoverable.recoverable);
const missing=classifySourceCrop({sourceWidth:128,sourceHeight:128,sourceRect:{x:0,y:0,w:32,h:32},bounds:{x:0,y:2,w:30,h:29},cell:{x:0,y:0,w:32,h:32},boundaryRatio:.04,touchesCanvasEdge:true});
ok('physical source edge is real missing art',missing.classification==='SOURCE_ART_MISSING'&&missing.missing);

const memoryRoot={};const store=createAvatarFrameProjectStore({root:memoryRoot});await store.saveProject(project);await store.putSource('src-0',new Blob(['immutable']),{name:'0.png'});const loaded=await store.loadProject(project.id),source=await store.getSource('src-0');ok('draft project survives store roundtrip',loaded.slots[2].sourceKey==='src-2-replaced');ok('source bytes live outside project metadata',await source.blob.text()==='immutable'&&!JSON.stringify(loaded).includes('immutable'));

const ui=fs.readFileSync('src/creators/ui/avatar-frame-editor.mjs','utf8'),builder=fs.readFileSync('src/creators/ui/avatar-frame-builder.mjs','utf8'),compositor=fs.readFileSync('src/creators/avatar/avatar-frame-compositor.mjs','utf8'),hook=fs.readFileSync('src/creators/ui/avatar-frame-builder-hook.mjs','utf8');
ok('editor confines touch-action none to editor canvases',ui.includes('.kfe-canvas')&&ui.includes('touch-action:none')&&!ui.includes('.kfe{touch-action:none'));
ok('editor implements Pointer Events and two-pointer pinch',ui.includes('onpointerdown')&&ui.includes('onpointermove')&&ui.includes('applyPinchFromPointers'));
ok('editor exposes ghost magic erase restore patch undo redo auto match', ['GHOST','MAGIC','RESTORE','+ PATCH','UNDO','REDO','AUTO MATCH'].every(label=>ui.includes(label)));
ok('builder uses IndexedDB store and exact compositor for preview/export',builder.includes('createAvatarFrameProjectStore')&&builder.includes('composeFrameCell')&&builder.includes('composeFrameProjectAtlas'));
ok('builder publishes through existing Avatar Quick service only',builder.includes('avatarQuick.importAndUse')&&builder.includes('analyzeUniversalAvatarAsset'));
ok('export compositor has no editor overlay vocabulary',!compositor.includes('GHOST')&&!compositor.includes('guide')&&!compositor.includes('selection'));
ok('Avatar Quick exposes the second CONSTRUIR 4×4 entry',hook.includes('CONSTRUIR 4×4'));

for(const name of checks)console.log(`✓ ${name}`);console.log(`Tactile Sprite Editor audit passed: ${checks.length}/${checks.length}`);
