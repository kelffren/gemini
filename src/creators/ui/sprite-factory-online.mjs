/* KELO-INDEX
 * area: CREATORS / SPRITE FACTORY ONLINE BRIDGE
 * owner: Sprite Factory network adapter + deterministic Sprite Compiler repair pass
 * purpose: connect Kelo server AI generation to safe grid detection, background cleanup, frame normalization, feet anchoring and QA
 * do-not: NO provider secret in browser, NO second auth system, NO gameplay authority
 */
import {openSpriteFactory} from './sprite-factory-workspace.mjs';
import {repairSpritesheetImage} from '../sprite-compiler/sprite-compiler-core.mjs';
import {detectSpriteCompilerGrid,selectSpriteCompilerGrid} from '../sprite-compiler/sprite-compiler-grid.mjs';
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
function qaRetryHint(qa){const issues=[];if(!qa)return'QA could not inspect the generated atlas.';const grid=qa.compiler?.grid;if(grid?.reviewRequired)issues.push(`atlas grid is uncertain (${grid.reason}); return one clean 4x8 grid with transparent gutters`);else if(grid&&!(grid.columns===4&&grid.rows===8))issues.push(`atlas grid detected as ${grid.columns}x${grid.rows}; regenerate exactly 4 columns x 8 rows`);if(qa.nonEmpty!==qa.frameCount)issues.push(`only ${qa.nonEmpty}/${qa.frameCount} cells contain a readable sprite`);if(qa.clipped>0)issues.push(`${qa.clipped} cells touch or cross their frame edge; add more transparent padding`);if(!qa.passArt)issues.push('character occupancy/readability is inconsistent between cells');if(!qa.passMotion)issues.push('the four walk phases are too similar; increase clear limb/stride variation while preserving identity');if(qa.compiler&&!qa.compiler.pass)issues.push(`compiler repair still reports ${qa.compiler.clippedAfter||0} clipped cells and feet spread ${qa.compiler.feetSpread||0}px`);return issues.join('; ')||'Preserve the exact 4x8 layout and improve consistency.';}
function setBadge(panel,text,ready){const badge=panel?.querySelector('.ksf-pill');if(!badge)return;badge.textContent=text;badge.classList.toggle('warn',!ready);}
async function fetchStatus(root,url,panel){
  try{const res=await root.fetch(url+'/status',{headers:{Accept:'application/json'}}),data=await res.json();if(!res.ok)throw new Error(data?.error||`HTTP_${res.status}`);setBadge(panel,data.configured?'AI BACKEND · READY':'AI BACKEND · KEY REQUIRED',!!data.configured);return data;}catch(error){setBadge(panel,'AI BACKEND · DEPLOYING/OFFLINE',false);return{configured:false,error:String(error?.message||error)};}
}
async function credentials(root){const auth=await root.KeloOnlineAuth?.credentials?.();if(!auth?.accessToken)throw new Error('INICIA_SESION_PARA_USAR_SPRITE_AI');if(auth.isAnonymous)throw new Error('SPRITE_AI_REQUIERE_CUENTA');return auth;}
export async function openSpriteFactoryOnline({root=globalThis}={}){
  const factory=await openSpriteFactory({root}),shell=factory.shell,endpointInput=shell.querySelector('.ksf-endpoint input'),aiBtn=shell.querySelector('.ksf-endpoint button'),fileInput=shell.querySelector('.ksf-file'),settingsPanel=shell.querySelector('.ksf-settings')?.closest('.ksf-panel'),sheetPanel=shell.querySelector('.ksf-sheet')?.closest('.ksf-panel'),note=shell.querySelector('.ksf-note');
  if(!endpointInput||!aiBtn)return factory;
  const endpoint=endpointFromRuntime(root);endpointInput.value=endpoint;endpointInput.readOnly=true;if(note)note.textContent='Online mode: Sprite Compiler now detects the raw atlas grid first. Confident non-4×8 layouts or uncertain grids are rejected for review/retry instead of being silently stretched into the game format.';
  let sourceImageDataUrl=null,busy=false;
  fileInput?.addEventListener('change',async()=>{const file=fileInput.files?.[0];if(!file){sourceImageDataUrl=null;return;}try{sourceImageDataUrl=await readDataUrl(root,file);}catch(error){console.warn('[Sprite Factory source]',error);sourceImageDataUrl=null;}},{passive:true});
  async function installGenerated(data){
    const img=await imageFromUrl(root,data.imageDataUrl),detection=detectImageGrid(root,img),grid=selectSpriteCompilerGrid(detection,{fallbackColumns:4,fallbackRows:8});
    const tag=sheetPanel?.querySelector('.ksf-pill');
    if(!grid.reviewRequired&&(grid.columns!==4||grid.rows!==8)){
      const compiler=Object.freeze({pass:false,clippedAfter:0,feetSpread:0,grid:detection});
      if(tag)tag.textContent=`AI · GRID ${grid.columns}×${grid.rows} · RETRY`;
      try{root.__KELO_SPRITE_COMPILER_LAST__={version:'v1.2-auto-grid',report:compiler,source:[img.naturalWidth||img.width,img.naturalHeight||img.height],output:null};}catch{}
      return Object.freeze({frameCount:32,nonEmpty:0,clipped:0,passTechnical:false,passArt:false,passMotion:false,compiler});
    }
    const repaired=repairSpritesheetImage(root,img,{columns:grid.columns,rows:grid.rows,targetWidth:64,targetHeight:64,padding:4,removeBackground:true,colorThreshold:34,softEdge:14,imageSmoothing:true});
    const compiler=Object.freeze({...repaired.report,pass:repaired.report.pass&&!grid.reviewRequired,grid:Object.freeze({...detection,selectedSource:grid.source})});
    const ctx=factory.sheet.getContext('2d');ctx.clearRect(0,0,factory.sheet.width,factory.sheet.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(repaired.canvas,0,0,factory.sheet.width,factory.sheet.height);
    const baseQA=factory.runQA(),qa=Object.freeze({...baseQA,compiler});if(tag)tag.textContent=`${data.sourceMode==='reference-edit'?'AI · REFERENCE':'AI · GENERATED'} · ${compiler.pass?'AUTO GRID + COMPILED':'GRID CHECK'}`;
    try{root.__KELO_SPRITE_COMPILER_LAST__={version:'v1.2-auto-grid',report:compiler,source:[repaired.sourceWidth,repaired.sourceHeight],output:[repaired.canvas.width,repaired.canvas.height]};}catch{}
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
      if(!passed){aiBtn.textContent='AUTO-REPAIR…';data=await generateOnce(auth.accessToken,qaRetryHint(qa));qa=await installGenerated(data);}
      const ok=qa?.passTechnical&&qa?.passArt&&qa?.passMotion&&qa?.compiler?.pass;setBadge(settingsPanel,ok?'SPRITE COMPILER · AUTO GRID + QA PASS':'SPRITE COMPILER · REVIEW',ok);if(typeof root.showToast==='function')root.showToast(ok?'Sprite Compiler: grid detectado, reparado y QA aprobado':'Sprite Compiler: el grid o los frames necesitan revisión.');
    }catch(error){console.error('[Kelo Sprite AI]',error);setBadge(settingsPanel,String(error?.message||error).includes('NOT_CONFIGURED')?'AI BACKEND · KEY REQUIRED':'AI BACKEND · ERROR',false);if(typeof root.showToast==='function')root.showToast(`Sprite AI: ${error.message}`);}
    finally{busy=false;aiBtn.disabled=false;aiBtn.textContent='GENERATE WITH AI';}
  };
  aiBtn.textContent='GENERATE WITH AI';
  const status=await fetchStatus(root,endpoint,settingsPanel);try{root.__KELO_SPRITE_FACTORY_ONLINE__={version:'v1.2-auto-grid',endpoint,status};}catch{}
  return factory;
}
