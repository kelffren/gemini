/* KELO-INDEX
 * area: CREATORS / SPRITE FACTORY ONLINE BRIDGE
 * owner: Sprite Factory network adapter
 * purpose: connect the tested local Sprite Factory UI to authenticated Kelo server AI generation
 * do-not: NO provider secret in browser, NO second auth system, NO gameplay authority
 */
import {openSpriteFactory} from './sprite-factory-workspace.mjs';
const DIRECTIONS=['N','NE','E','SE','S','SW','W','NW'];
function endpointFromRuntime(root){
  const raw=root.KELO_ONLINE_RUNTIME_CONFIG?.defaultWsUrl||root.KELO_ONLINE_RUNTIME_CONFIG?.effectiveNet||'wss://kelo-world-server.onrender.com';
  try{const url=new URL(raw,root.location?.href||undefined);if(url.protocol==='wss:')url.protocol='https:';else if(url.protocol==='ws:')url.protocol='http:';url.pathname='/api/sprite-generate';url.search='';url.hash='';return url.toString();}catch{return'https://kelo-world-server.onrender.com/api/sprite-generate';}
}
function imageFromUrl(root,url){return new Promise((resolve,reject)=>{const img=new root.Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('SPRITE_AI_IMAGE_DECODE_FAILED'));img.src=url;});}
function readDataUrl(root,file){return new Promise((resolve,reject)=>{const reader=new root.FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('SPRITE_AI_SOURCE_READ_FAILED'));reader.readAsDataURL(file);});}
function qaRetryHint(qa){const issues=[];if(!qa)return'QA could not inspect the generated atlas.';if(qa.nonEmpty!==qa.frameCount)issues.push(`only ${qa.nonEmpty}/${qa.frameCount} cells contain a readable sprite`);if(qa.clipped>0)issues.push(`${qa.clipped} cells touch or cross their frame edge; add more transparent padding`);if(!qa.passArt)issues.push('character occupancy/readability is inconsistent between cells');if(!qa.passMotion)issues.push('the four walk phases are too similar; increase clear limb/stride variation while preserving identity');return issues.join('; ')||'Preserve the exact 4x8 layout and improve consistency.';}
function setBadge(panel,text,ready){const badge=panel?.querySelector('.ksf-pill');if(!badge)return;badge.textContent=text;badge.classList.toggle('warn',!ready);}
async function fetchStatus(root,url,panel){
  try{const res=await root.fetch(url+'/status',{headers:{Accept:'application/json'}}),data=await res.json();if(!res.ok)throw new Error(data?.error||`HTTP_${res.status}`);setBadge(panel,data.configured?'AI BACKEND · READY':'AI BACKEND · KEY REQUIRED',!!data.configured);return data;}catch(error){setBadge(panel,'AI BACKEND · DEPLOYING/OFFLINE',false);return{configured:false,error:String(error?.message||error)};}
}
async function credentials(root){const auth=await root.KeloOnlineAuth?.credentials?.();if(!auth?.accessToken)throw new Error('INICIA_SESION_PARA_USAR_SPRITE_AI');if(auth.isAnonymous)throw new Error('SPRITE_AI_REQUIERE_CUENTA');return auth;}
export async function openSpriteFactoryOnline({root=globalThis}={}){
  const factory=await openSpriteFactory({root}),shell=factory.shell,endpointInput=shell.querySelector('.ksf-endpoint input'),aiBtn=shell.querySelector('.ksf-endpoint button'),fileInput=shell.querySelector('.ksf-file'),settingsPanel=shell.querySelector('.ksf-settings')?.closest('.ksf-panel'),sheetPanel=shell.querySelector('.ksf-sheet')?.closest('.ksf-panel'),note=shell.querySelector('.ksf-note');
  if(!endpointInput||!aiBtn)return factory;
  const endpoint=endpointFromRuntime(root);endpointInput.value=endpoint;endpointInput.readOnly=true;if(note)note.textContent='Online mode: Kelo Server verifies your Supabase session, keeps the provider key on Render, generates the 4×8 atlas, then local QA can retry one failed result automatically.';
  let sourceImageDataUrl=null,busy=false;
  fileInput?.addEventListener('change',async()=>{const file=fileInput.files?.[0];if(!file){sourceImageDataUrl=null;return;}try{sourceImageDataUrl=await readDataUrl(root,file);}catch(error){console.warn('[Sprite Factory source]',error);sourceImageDataUrl=null;}},{passive:true});
  async function installGenerated(data){const img=await imageFromUrl(root,data.imageDataUrl),ctx=factory.sheet.getContext('2d');ctx.clearRect(0,0,factory.sheet.width,factory.sheet.height);ctx.imageSmoothingEnabled=true;ctx.drawImage(img,0,0,factory.sheet.width,factory.sheet.height);const qa=factory.runQA();const tag=sheetPanel?.querySelector('.ksf-pill');if(tag)tag.textContent=data.sourceMode==='reference-edit'?'AI · REFERENCE':'AI · GENERATED';return qa;}
  async function generateOnce(token,retryHint=''){
    const res=await root.fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({kind:'character-spritesheet',action:'walk',directions:DIRECTIONS,framesPerDirection:4,spriteSize:64,styleHint:'Kelo World premium dark-fantasy MMORPG sprite, clean silhouette, restrained gold accents, transparent background',sourceImageDataUrl,retryHint})});
    const data=await res.json().catch(()=>null);if(!res.ok)throw new Error(data?.error||data?.detail||`SPRITE_AI_HTTP_${res.status}`);if(!data?.imageDataUrl)throw new Error('SPRITE_AI_NO_IMAGE_DATA_URL');return data;
  }
  aiBtn.onclick=async()=>{
    if(busy)return;busy=true;aiBtn.disabled=true;aiBtn.textContent='GENERATING…';
    try{
      const auth=await credentials(root);let data=await generateOnce(auth.accessToken),qa=await installGenerated(data);const passed=qa?.passTechnical&&qa?.passArt&&qa?.passMotion;
      if(!passed){aiBtn.textContent='AUTO-REPAIR…';data=await generateOnce(auth.accessToken,qaRetryHint(qa));qa=await installGenerated(data);}
      const ok=qa?.passTechnical&&qa?.passArt&&qa?.passMotion;setBadge(settingsPanel,ok?'AI BACKEND · GENERATED + QA PASS':'AI BACKEND · GENERATED · REVIEW',ok);if(typeof root.showToast==='function')root.showToast(ok?'Sprite AI: generado y QA aprobado':'Sprite AI: generado; revisa los checks antes de usarlo.');
    }catch(error){console.error('[Kelo Sprite AI]',error);setBadge(settingsPanel,String(error?.message||error).includes('NOT_CONFIGURED')?'AI BACKEND · KEY REQUIRED':'AI BACKEND · ERROR',false);if(typeof root.showToast==='function')root.showToast(`Sprite AI: ${error.message}`);}
    finally{busy=false;aiBtn.disabled=false;aiBtn.textContent='GENERATE WITH AI';}
  };
  aiBtn.textContent='GENERATE WITH AI';
  const status=await fetchStatus(root,endpoint,settingsPanel);try{root.__KELO_SPRITE_FACTORY_ONLINE__={version:'v1',endpoint,status};}catch{}
  return factory;
}
