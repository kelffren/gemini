/* KELO-INDEX
 * area: CREATORS / SPRITE FACTORY ONLINE BRIDGE
 * owner: Sprite Factory network adapter + deterministic Sprite Compiler repair pass
 * purpose: connect Kelo server AI generation to safe grid detection, background cleanup, frame normalization, feet anchoring and per-frame QA
 * do-not: NO provider secret in browser, NO second auth system, NO gameplay authority
 */
import {openSpriteFactory} from './sprite-factory-workspace.mjs';
import {repairSpritesheetImage,analyzeGridCells} from '../sprite-compiler/sprite-compiler-core.mjs';
import {detectSpriteCompilerGrid,selectSpriteCompilerGrid} from '../sprite-compiler/sprite-compiler-grid.mjs';
import {diagnoseSpriteFrames,buildSelectiveRepairTargets} from '../sprite-compiler/sprite-frame-doctor.mjs';
import {planLocalFrameGeometryRepairs,applyFrameGeometryRepairs} from '../sprite-compiler/sprite-frame-geometry-repair.mjs';
const DIRECTIONS=['N','NE','E','SE','S','SW','W','NW'];
function endpointFromRuntime(root){
  const raw=root.KELO_ONLINE_RUNTIME_CONFIG?.defaultWsUrl||root.KELO_ONLINE_RUNTIME_CONFIG?.effectiveNet||'wss://kelo-world-server.onrender.com';
  try{const url=new URL(raw,root.location?.href||undefined);if(url.protocol==='wss:')url.protocol='https:';else if(url.protocol==='ws:')url.protocol='http:';url.pathname='/api/sprite-generate';url.search='';url.hash='';return url.toString();}catch{return'https://kelo-world-server.onrender.com/api/sprite-generate';}
}
function imageFromUrl(root,url){return new Promise((resolve,reject)=>{const img=new root.Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('SPRITE_AI_IMAGE_DECODE_FAILED'));img.src=url;});}
function readDataUrl(root,file){return new Promise((resolve,reject)=>{const reader=new root.FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('SPRITE_AI_SOURCE_READ_FAILED'));reader.readAsDataURL(file);});}
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
function setBadge(panel,text,ready){const badge=panel?.querySelector('.ksf-pill');if(!badge)return;badge.textContent=text;badge.classList.toggle('warn',!ready);}
async function fetchStatus(root,url,panel){
  try{const res=await root.fetch(url+'/status',{headers:{Accept:'application/json'}}),data=await res.json();if(!res.ok)throw new Error(data?.error||`HTTP_${res.status}`);setBadge(panel,data.configured?'AI BACKEND · READY':'AI BACKEND · KEY REQUIRED',!!data.configured);return data;}catch(error){setBadge(panel,'AI BACKEND · DEPLOYING/OFFLINE',false);return{configured:false,error:String(error?.message||error)};}
}
async function credentials(root){const auth=await root.KeloOnlineAuth?.credentials?.();if(!auth?.accessToken)throw new Error('INICIA_SESION_PARA_USAR_SPRITE_AI');if(auth.isAnonymous)throw new Error('SPRITE_AI_REQUIERE_CUENTA');return auth;}
export async function openSpriteFactoryOnline({root=globalThis}={}){
  const factory=await openSpriteFactory({root}),shell=factory.shell,endpointInput=shell.querySelector('.ksf-endpoint input'),aiBtn=shell.querySelector('.ksf-endpoint button'),fileInput=shell.querySelector('.ksf-file'),settingsPanel=shell.querySelector('.ksf-settings')?.closest('.ksf-panel'),sheetPanel=shell.querySelector('.ksf-sheet')?.closest('.ksf-panel'),note=shell.querySelector('.ksf-note');
  if(!endpointInput||!aiBtn)return factory;
  const endpoint=endpointFromRuntime(root);endpointInput.value=endpoint;endpointInput.readOnly=true;if(note)note.textContent='Online mode: Sprite Compiler detects the atlas grid, repairs geometry, then Frame Doctor auto-fixes safe scale/center defects locally for free and identifies the exact remaining direction/frame without touching healthy cells.';
  let sourceImageDataUrl=null,busy=false;
  fileInput?.addEventListener('change',async()=>{const file=fileInput.files?.[0];if(!file){sourceImageDataUrl=null;return;}try{sourceImageDataUrl=await readDataUrl(root,file);}catch(error){console.warn('[Sprite Factory source]',error);sourceImageDataUrl=null;}},{passive:true});
  async function installGenerated(data){
    const img=await imageFromUrl(root,data.imageDataUrl),detection=detectImageGrid(root,img),grid=selectSpriteCompilerGrid(detection,{fallbackColumns:4,fallbackRows:8});
    const tag=sheetPanel?.querySelector('.ksf-pill');
    if(!grid.reviewRequired&&(grid.columns!==4||grid.rows!==8)){
      const compiler=Object.freeze({pass:false,clippedAfter:0,feetSpread:0,grid:detection,frameDoctor:null,repairTargets:Object.freeze([])});
      if(tag)tag.textContent=`AI · GRID ${grid.columns}×${grid.rows} · RETRY`;
      try{root.__KELO_SPRITE_COMPILER_LAST__={version:'v1.4-local-frame-repair',report:compiler,source:[img.naturalWidth||img.width,img.naturalHeight||img.height],output:null};}catch{}
      return Object.freeze({frameCount:32,nonEmpty:0,clipped:0,passTechnical:false,passArt:false,passMotion:false,compiler});
    }
    const repaired=repairSpritesheetImage(root,img,{columns:grid.columns,rows:grid.rows,targetWidth:64,targetHeight:64,padding:4,removeBackground:true,colorThreshold:34,softEdge:14,imageSmoothing:true});
    const beforeDoctor=diagnoseSpriteFrames(repaired.outputFrames,{columns:grid.columns,directions:DIRECTIONS}),localPlan=planLocalFrameGeometryRepairs(repaired.outputFrames,beforeDoctor,{maxRepairs:8}),localApplied=applyFrameGeometryRepairs(root,repaired.canvas,localPlan.operations,{imageSmoothing:true});
    const repairedCtx=repaired.canvas.getContext('2d',{willReadFrequently:true}),repairedPixels=repairedCtx.getImageData(0,0,repaired.canvas.width,repaired.canvas.height),postFrames=analyzeGridCells(repairedPixels.data,repaired.canvas.width,repaired.canvas.height,{columns:grid.columns,rows:grid.rows});
    const frameDoctor=diagnoseSpriteFrames(postFrames,{columns:grid.columns,directions:DIRECTIONS}),repairTargets=buildSelectiveRepairTargets(frameDoctor,{maxTargets:8}),localGeometryRepair=Object.freeze({attempted:localPlan.operations.length,applied:localApplied.applied,skipped:localPlan.skipped.map(x=>x.index),beforeDefects:beforeDoctor.defectiveCount,afterDefects:frameDoctor.defectiveCount});
    const compiler=Object.freeze({...repaired.report,pass:repaired.report.pass&&!grid.reviewRequired&&frameDoctor.pass,grid:Object.freeze({...detection,selectedSource:grid.source}),frameDoctor,repairTargets,localGeometryRepair});
    const ctx=factory.sheet.getContext('2d');ctx.clearRect(0,0,factory.sheet.width,factory.sheet.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(repaired.canvas,0,0,factory.sheet.width,factory.sheet.height);
    const baseQA=factory.runQA(),qa=Object.freeze({...baseQA,compiler});if(tag)tag.textContent=`${data.sourceMode==='reference-edit'?'AI · REFERENCE':'AI · GENERATED'} · ${compiler.pass?'FRAME QA PASS':`${frameDoctor.defectiveCount} FRAME${frameDoctor.defectiveCount===1?'':'S'} TO FIX`} · LOCAL ${localApplied.applied.length}`;
    try{root.__KELO_SPRITE_COMPILER_LAST__={version:'v1.4-local-frame-repair',report:compiler,source:[repaired.sourceWidth,repaired.sourceHeight],output:[repaired.canvas.width,repaired.canvas.height],repairTargets};}catch{}
    return qa;
  }
  async function generateOnce(token,retryHint=''){
    const res=await root.fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({kind:'character-spritesheet',action:'walk',directions:DIRECTIONS,framesPerDirection:4,spriteSize:64,styleHint:'Kelo World premium dark-fantasy MMORPG sprite, clean silhouette, restrained gold accents, transparent background',sourceImageDataUrl,retryHint})});
    const data=await res.json().catch(()=>null);if(!res.ok)throw new Error(data?.error||data?.detail||`SPRITE_AI_HTTP_${res.status}`);if(!data?.imageDataUrl)throw new Error('SPRITE_AI_NO_IMAGE_DATA_URL');return data;
  }
  aiBtn.onclick=async()=>{
    if(busy)return;busy=true;aiBtn.disabled=true;aiBtn.textContent='GENERATING…';
    try{
      const auth=await credentials(root);let data=await generateOnce(auth.accessToken),qa=await installGenerated(data);const passed=qa?.passTechnical&&qa?.passArt&&qa?.passMotion&&qa?.compiler?.pass;
      if(!passed){aiBtn.textContent=qa?.compiler?.repairTargets?.length?'TARGETING BAD FRAMES…':'AUTO-REPAIR…';data=await generateOnce(auth.accessToken,qaRetryHint(qa));qa=await installGenerated(data);}
      const ok=qa?.passTechnical&&qa?.passArt&&qa?.passMotion&&qa?.compiler?.pass;setBadge(settingsPanel,ok?'SPRITE COMPILER · FRAME QA PASS':'SPRITE COMPILER · REVIEW',ok);if(typeof root.showToast==='function')root.showToast(ok?'Sprite Compiler: atlas reparado y todos los frames aprobaron':'Sprite Compiler: identificó los frames exactos que siguen fallando.');
    }catch(error){console.error('[Kelo Sprite AI]',error);setBadge(settingsPanel,String(error?.message||error).includes('NOT_CONFIGURED')?'AI BACKEND · KEY REQUIRED':'AI BACKEND · ERROR',false);if(typeof root.showToast==='function')root.showToast(`Sprite AI: ${error.message}`);}
    finally{busy=false;aiBtn.disabled=false;aiBtn.textContent='GENERATE WITH AI';}
  };
  aiBtn.textContent='GENERATE WITH AI';
  const status=await fetchStatus(root,endpoint,settingsPanel);try{root.__KELO_SPRITE_FACTORY_ONLINE__={version:'v1.4-local-frame-repair',endpoint,status};}catch{}
  return factory;
}
