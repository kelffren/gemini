/* KELO-INDEX
 * area: CREATORS / SPRITE FACTORY ONLINE BRIDGE
 * owner: Sprite Factory network adapter + deterministic Sprite Compiler repair pass
 * purpose: connect Kelo server AI generation to native image treatment, compiler QA and optional V3.1 real-skeleton row generation
 * consumes: Kelo Image Treatment Engine, Sprite Compiler, Frame Doctor, Skeleton Lab
 * do-not: NO provider secret in browser, NO second auth system, NO gameplay authority, NO silent real-skeleton downgrade
 */
import {openSpriteFactory} from './sprite-factory-workspace.mjs';
import {mountSpriteSkeletonLab} from './sprite-skeleton-lab.mjs';
import {requestCreatorJson} from '../adapters/creator-http-adapter.mjs';
import {repairSpritesheetImage,analyzeGridCells} from '../sprite-compiler/sprite-compiler-core.mjs';
import {detectSpriteCompilerGrid,selectSpriteCompilerGrid} from '../sprite-compiler/sprite-compiler-grid.mjs';
import {diagnoseSpriteFrames,buildSelectiveRepairTargets} from '../sprite-compiler/sprite-frame-doctor.mjs';
import {planLocalFrameGeometryRepairs,applyFrameGeometryRepairs} from '../sprite-compiler/sprite-frame-geometry-repair.mjs';
import {treatImageFile,treatImageSource} from '../core/image-treatment-engine.mjs';

const DIRECTIONS=['N','NE','E','SE','S','SW','W','NW'];
const SIZE=64;
function endpointFromRuntime(root){
  const raw=root.KELO_ONLINE_RUNTIME_CONFIG?.defaultWsUrl||root.KELO_ONLINE_RUNTIME_CONFIG?.effectiveNet||'wss://kelo-world-server.onrender.com';
  try{const url=new URL(raw,root.location?.href||undefined);if(url.protocol==='wss:')url.protocol='https:';else if(url.protocol==='ws:')url.protocol='http:';url.pathname='/api/sprite-generate';url.search='';url.hash='';return url.toString();}catch{return'https://kelo-world-server.onrender.com/api/sprite-generate';}
}
function imageFromUrl(root,url){return new Promise((resolve,reject)=>{const img=new root.Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('SPRITE_AI_IMAGE_DECODE_FAILED'));img.src=url;});}
function detectImageGrid(root,img){
  const width=img.naturalWidth||img.width,height=img.naturalHeight||img.height,canvas=root.document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);
  return detectSpriteCompilerGrid(ctx.getImageData(0,0,width,height).data,width,height);
}
function qaRetryHint(qa){
  const issues=[];if(!qa)return'QA could not inspect the generated atlas.';const grid=qa.compiler?.grid;
  if(grid?.reviewRequired)issues.push(`atlas grid is uncertain (${grid.reason}); return one clean 4x8 grid with transparent gutters`);else if(grid&&!(grid.columns===4&&grid.rows===8))issues.push(`atlas grid detected as ${grid.columns}x${grid.rows}; regenerate exactly 4 columns x 8 rows`);
  const targets=qa.compiler?.repairTargets||[];if(targets.length){const exact=targets.slice(0,8).map(t=>`${t.label} [${t.reasons.join('+')}]`).join(', ');issues.push(`repair these exact cells only and preserve every healthy cell unchanged: ${exact}`);}
  if(qa.nonEmpty!==qa.frameCount)issues.push(`only ${qa.nonEmpty}/${qa.frameCount} cells contain a readable sprite`);if(qa.clipped>0)issues.push(`${qa.clipped} cells touch or cross their frame edge; add more transparent padding`);if(!qa.passArt)issues.push('character occupancy/readability is inconsistent between cells');if(!qa.passMotion)issues.push('the four walk phases are too similar; increase clear limb/stride variation while preserving identity');if(qa.compiler&&!qa.compiler.pass)issues.push(`compiler repair still reports ${qa.compiler.clippedAfter||0} clipped cells and feet spread ${qa.compiler.feetSpread||0}px`);return issues.join('; ')||'Preserve the exact 4x8 layout and improve consistency.';
}
function rowRetryHint(qa,direction){
  const targets=qa?.compiler?.repairTargets||[],parts=[];
  if(targets.length)parts.push(`direction ${direction}: repair ${targets.map(t=>`${t.label} [${t.reasons.join('+')}]`).join(', ')}`);
  if(qa?.compiler?.clippedAfter>0)parts.push('add transparent padding so no limb touches the cell edge');
  if(!qa?.passMotion)parts.push('make the four pose phases visibly distinct while preserving the exact character identity');
  return parts.join('; ')||`Regenerate direction ${direction} only; preserve identity and follow the supplied skeleton exactly.`;
}
function setBadge(panel,text,ready){const badge=panel?.querySelector('.ksf-pill');if(!badge)return;badge.textContent=text;badge.classList.toggle('warn',!ready);}
async function fetchStatus(root,url,panel){
  try{const {ok,status,data}=await requestCreatorJson(root,url+'/status',{headers:{Accept:'application/json'}});if(!ok)throw new Error(data?.error||`HTTP_${status}`);setBadge(panel,data?.configured?'AI BACKEND · READY':'AI BACKEND · KEY REQUIRED',!!data?.configured);return data||{configured:false};}catch(error){setBadge(panel,'AI BACKEND · DEPLOYING/OFFLINE',false);return{configured:false,error:String(error?.message||error)};}
}
async function credentials(root){const auth=await root.KeloOnlineAuth?.credentials?.();if(!auth?.accessToken)throw new Error('INICIA_SESION_PARA_USAR_SPRITE_AI');if(auth.isAnonymous)throw new Error('SPRITE_AI_REQUIERE_CUENTA');return auth;}
function publishTreatmentState(root,kind,report,extra={}){try{root.__KELO_IMAGE_TREATMENT_LAST__={version:'image-treatment-v1.0.0',kind,report,...extra};}catch{}}

export async function openSpriteFactoryOnline({root=globalThis}={}){
  const factory=await openSpriteFactory({root}),shell=factory.shell,endpointInput=shell.querySelector('.ksf-endpoint input'),aiBtn=shell.querySelector('.ksf-endpoint button'),fileInput=shell.querySelector('.ksf-file'),settingsPanel=shell.querySelector('.ksf-settings')?.closest('.ksf-panel'),sheetPanel=shell.querySelector('.ksf-sheet')?.closest('.ksf-panel'),note=shell.querySelector('.ksf-note');
  if(!endpointInput||!aiBtn)return factory;
  const endpoint=endpointFromRuntime(root);endpointInput.value=endpoint;endpointInput.readOnly=true;if(note)note.textContent='Online mode: Image Treatment limpia alpha/halos; Sprite Compiler corrige geometría; Skeleton Lab puede generar una dirección con pose real sin tocar las otras filas.';
  let sourceImageDataUrl=null,busy=false,lastSourceTreatment=null;
  const status=await fetchStatus(root,endpoint,settingsPanel),skeletonLab=mountSpriteSkeletonLab({root,shell,status});
  skeletonLab.setReferenceReady(false);
  const idleLabel=()=>skeletonLab.isEnabled()?'GENERATE SKELETON ROW':'GENERATE WITH AI';
  root.addEventListener?.('kelo:sprite-skeleton-mode',()=>{if(!busy)aiBtn.textContent=idleLabel();});

  fileInput?.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];
    if(!file){sourceImageDataUrl=null;lastSourceTreatment=null;skeletonLab.setReferenceReady(false);return;}
    try{
      const treated=await treatImageFile(root,file,{profile:'sprite',outputType:'image/png'});sourceImageDataUrl=treated.dataUrl;lastSourceTreatment=treated.report;skeletonLab.setReferenceReady(true);publishTreatmentState(root,'source-reference',treated.report,{sourceBytes:treated.sourceBytes,sourceType:treated.sourceType});
      if(note)note.textContent=`Master/reference limpio · halo ${treated.report.operations.haloPixelsRepaired} · RGB invisible ${treated.report.operations.transparentRgbSanitized}. Skeleton Lab ya puede usarlo como identity lock.`;
    }catch(error){console.warn('[Sprite Factory source treatment]',error);sourceImageDataUrl=null;lastSourceTreatment=null;skeletonLab.setReferenceReady(false);}
  },{passive:true});

  async function installGenerated(data){
    const img=await imageFromUrl(root,data.imageDataUrl),treatment=treatImageSource(root,img,{profile:'sprite'}),treatedImage=treatment.canvas,detection=detectImageGrid(root,treatedImage),grid=selectSpriteCompilerGrid(detection,{fallbackColumns:4,fallbackRows:8});
    publishTreatmentState(root,'generated-atlas',treatment.report,{sourceMode:data.sourceMode||'generated'});const tag=sheetPanel?.querySelector('.ksf-pill');
    if(!grid.reviewRequired&&(grid.columns!==4||grid.rows!==8)){
      const compiler=Object.freeze({pass:false,clippedAfter:0,feetSpread:0,grid:detection,frameDoctor:null,repairTargets:Object.freeze([]),imageTreatment:treatment.report});if(tag)tag.textContent=`AI · GRID ${grid.columns}×${grid.rows} · RETRY`;try{root.__KELO_SPRITE_COMPILER_LAST__={version:'v1.6-skeleton-lab',report:compiler,source:[treatment.width,treatment.height],output:null};}catch{}return Object.freeze({frameCount:32,nonEmpty:0,clipped:0,passTechnical:false,passArt:false,passMotion:false,compiler});
    }
    const repaired=repairSpritesheetImage(root,treatedImage,{columns:grid.columns,rows:grid.rows,targetWidth:64,targetHeight:64,padding:4,removeBackground:true,colorThreshold:34,softEdge:14,imageSmoothing:true});
    const beforeDoctor=diagnoseSpriteFrames(repaired.outputFrames,{columns:grid.columns,directions:DIRECTIONS}),localPlan=planLocalFrameGeometryRepairs(repaired.outputFrames,beforeDoctor,{maxRepairs:8}),localApplied=applyFrameGeometryRepairs(root,repaired.canvas,localPlan.operations,{imageSmoothing:true});
    const repairedCtx=repaired.canvas.getContext('2d',{willReadFrequently:true}),repairedPixels=repairedCtx.getImageData(0,0,repaired.canvas.width,repaired.canvas.height),postFrames=analyzeGridCells(repairedPixels.data,repaired.canvas.width,repaired.canvas.height,{columns:grid.columns,rows:grid.rows});
    const frameDoctor=diagnoseSpriteFrames(postFrames,{columns:grid.columns,directions:DIRECTIONS}),repairTargets=buildSelectiveRepairTargets(frameDoctor,{maxTargets:8}),localGeometryRepair=Object.freeze({attempted:localPlan.operations.length,applied:localApplied.applied,skipped:localPlan.skipped.map(x=>x.index),beforeDefects:beforeDoctor.defectiveCount,afterDefects:frameDoctor.defectiveCount});
    const compiler=Object.freeze({...repaired.report,pass:repaired.report.pass&&!grid.reviewRequired&&frameDoctor.pass,grid:Object.freeze({...detection,selectedSource:grid.source}),frameDoctor,repairTargets,localGeometryRepair,imageTreatment:treatment.report});
    const ctx=factory.sheet.getContext('2d');ctx.clearRect(0,0,factory.sheet.width,factory.sheet.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(repaired.canvas,0,0,factory.sheet.width,factory.sheet.height);
    const baseQA=factory.runQA(),qa=Object.freeze({...baseQA,compiler}),cleaned=treatment.report.operations.haloPixelsRepaired+treatment.report.operations.transparentRgbSanitized;if(tag)tag.textContent=`${data.sourceMode==='reference-edit'?'AI · REFERENCE':'AI · GENERATED'} · ${compiler.pass?'FRAME QA PASS':`${frameDoctor.defectiveCount} FRAME${frameDoctor.defectiveCount===1?'':'S'} TO FIX`} · CLEAN ${cleaned} · LOCAL ${localApplied.applied.length}`;
    try{root.__KELO_SPRITE_COMPILER_LAST__={version:'v1.6-skeleton-lab',report:compiler,source:[repaired.sourceWidth,repaired.sourceHeight],output:[repaired.canvas.width,repaired.canvas.height],repairTargets,imageTreatment:treatment.report,sourceImageTreatment:lastSourceTreatment};}catch{}return qa;
  }

  async function installDirectionRow(data,direction){
    const rowIndex=DIRECTIONS.indexOf(direction);if(rowIndex<0)throw new Error('SPRITE_AI_DIRECTION_INVALID');
    const img=await imageFromUrl(root,data.imageDataUrl),treatment=treatImageSource(root,img,{profile:'sprite'}),repaired=repairSpritesheetImage(root,treatment.canvas,{columns:4,rows:1,targetWidth:64,targetHeight:64,padding:4,removeBackground:true,colorThreshold:34,softEdge:14,imageSmoothing:true});
    const rctx=repaired.canvas.getContext('2d',{willReadFrequently:true}),pixels=rctx.getImageData(0,0,repaired.canvas.width,repaired.canvas.height),postFrames=analyzeGridCells(pixels.data,repaired.canvas.width,repaired.canvas.height,{columns:4,rows:1}),frameDoctor=diagnoseSpriteFrames(postFrames,{columns:4,directions:[direction]}),repairTargets=buildSelectiveRepairTargets(frameDoctor,{maxTargets:4});
    const compiler=Object.freeze({...repaired.report,pass:repaired.report.pass&&frameDoctor.pass,frameDoctor,repairTargets,imageTreatment:treatment.report,direction,realSkeleton:Boolean(data.realSkeleton),poseConditioning:data.poseConditioning||data.metadata?.conditioning||null});
    const ctx=factory.sheet.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,rowIndex*SIZE,factory.sheet.width,SIZE);ctx.drawImage(repaired.canvas,0,0,repaired.canvas.width,repaired.canvas.height,0,rowIndex*SIZE,factory.sheet.width,SIZE);
    const alpha=postFrames.map(f=>f.pixels||0),passMotion=new Set(alpha).size>=2,qa=Object.freeze({frameCount:4,nonEmpty:postFrames.filter(f=>(f.pixels||0)>20).length,clipped:postFrames.filter(f=>f.clipped||(f.edgePixels||0)>0).length,passTechnical:postFrames.length===4&&postFrames.every(f=>(f.pixels||0)>20),passArt:frameDoctor.defectiveCount===0,passMotion,compiler});
    const tag=sheetPanel?.querySelector('.ksf-pill');if(tag)tag.textContent=`${direction} · ${data.realSkeleton?'REAL SKELETON':'POSE'} · ${compiler.pass&&passMotion?'ROW QA PASS':`${frameDoctor.defectiveCount} TO FIX`}`;
    try{root.__KELO_SPRITE_COMPILER_LAST__={version:'v1.6-skeleton-lab',mode:'direction-row',direction,report:compiler,output:[factory.sheet.width,factory.sheet.height],repairTargets,imageTreatment:treatment.report,sourceImageTreatment:lastSourceTreatment};}catch{}return qa;
  }

  async function generateOnce(token,retryHint='',overlay=null){
    if(overlay?.realSkeleton&&!sourceImageDataUrl)throw new Error('SPRITE_AI_POSE_REFERENCE_REQUIRED');
    const payload={kind:'character-spritesheet',action:'walk',directions:DIRECTIONS,framesPerDirection:4,spriteSize:64,styleHint:'Kelo World premium dark-fantasy MMORPG sprite, clean silhouette, restrained gold accents, transparent background',sourceImageDataUrl,retryHint,...(overlay||{})};
    const {ok,status:code,data}=await requestCreatorJson(root,endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});if(!ok)throw new Error(data?.error||data?.detail||`SPRITE_AI_HTTP_${code}`);if(!data?.imageDataUrl)throw new Error('SPRITE_AI_NO_IMAGE_DATA_URL');return data;
  }

  aiBtn.onclick=async()=>{
    if(busy)return;busy=true;aiBtn.disabled=true;aiBtn.textContent='GENERATING…';
    try{
      const auth=await credentials(root),overlay=skeletonLab.getRequestOverlay();
      if(overlay){
        if(!sourceImageDataUrl)throw new Error('ADD_MASTER_REFERENCE_FIRST');
        let data=await generateOnce(auth.accessToken,'',overlay),qa=await installDirectionRow(data,overlay.direction);const firstPass=qa?.passTechnical&&qa?.passArt&&qa?.passMotion&&qa?.compiler?.pass;
        if(!firstPass){aiBtn.textContent='REPAIRING POSE ROW…';data=await generateOnce(auth.accessToken,rowRetryHint(qa,overlay.direction),overlay);qa=await installDirectionRow(data,overlay.direction);}
        const ok=qa?.passTechnical&&qa?.passArt&&qa?.passMotion&&qa?.compiler?.pass;setBadge(settingsPanel,ok?`${overlay.direction} · REAL SKELETON PASS`:`${overlay.direction} · POSE REVIEW`,ok);if(typeof root.showToast==='function')root.showToast(ok?`${overlay.direction}: skeleton row generado y validado`:`${overlay.direction}: Frame Doctor encontró defectos en la fila`);
      }else{
        let data=await generateOnce(auth.accessToken),qa=await installGenerated(data);const passed=qa?.passTechnical&&qa?.passArt&&qa?.passMotion&&qa?.compiler?.pass;
        if(!passed){aiBtn.textContent=qa?.compiler?.repairTargets?.length?'TARGETING BAD FRAMES…':'AUTO-REPAIR…';data=await generateOnce(auth.accessToken,qaRetryHint(qa));qa=await installGenerated(data);}
        const ok=qa?.passTechnical&&qa?.passArt&&qa?.passMotion&&qa?.compiler?.pass;setBadge(settingsPanel,ok?'IMAGE CLEAN + FRAME QA PASS':'SPRITE COMPILER · REVIEW',ok);if(typeof root.showToast==='function')root.showToast(ok?'Image Treatment + Sprite Compiler: atlas limpio y todos los frames aprobaron':'Sprite Compiler: identificó los frames exactos que siguen fallando.');
      }
    }catch(error){console.error('[Kelo Sprite AI]',error);const message=String(error?.message||error);setBadge(settingsPanel,message.includes('NOT_CONFIGURED')||message.includes('POSE_REFERENCE')||message.includes('MASTER_REFERENCE')?'AI BACKEND · SETUP REQUIRED':'AI BACKEND · ERROR',false);if(typeof root.showToast==='function')root.showToast(`Sprite AI: ${message}`);}
    finally{busy=false;aiBtn.disabled=false;aiBtn.textContent=idleLabel();}
  };

  aiBtn.textContent=idleLabel();
  try{root.__KELO_SPRITE_FACTORY_ONLINE__={version:'v1.6-skeleton-lab',endpoint,status,imageTreatment:'image-treatment-v1.0.0',skeletonLab};}catch{}
  return factory;
}
