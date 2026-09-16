/* KELO-INDEX
 * area: CREATORS / PIXELORAMA PRO BRIDGE
 * owner: Kelo Asset Forge UI
 * keys: PIXELORAMA IN-GAME LAZY HIBERNATE ARRAYBUFFER PXO IMPORT EXPORT MEMORY SAME-ORIGIN
 * purpose: monta Pixelorama Pro dentro del juego, hiberna gameplay pesado y transfiere arte/proyectos sin navegación externa
 * public-api: installPixeloramaProBridge/PIXELORAMA_RUNTIME_PATH
 * consumes: Asset Forge session, creator-exclusive runtime, Pixelorama project repository, Kelo local runtime shell
 * state-owned: overlay/iframe efímeros; no gameplay, no Pixelorama internals, no marketplace settlement
 * performance: Pixelorama no existe hasta el tap; al cerrar se pide quit/unload y se destruye el iframe
 * online: drafts locales; publicación/ownership futuro usa autoridad separada
 * do-not: NO abrir editor externo, NO mantener WASM residente al cerrar, NO file picker como flujo primario
 */
import {enterCreatorExclusiveMode,leaveCreatorExclusiveMode} from '../core/creator-exclusive-runtime.mjs';
import {createPixeloramaProjectStore,requestCreatorPersistentStorage} from '../repository/pixelorama-project-store.mjs';

export const PIXELORAMA_RUNTIME_PATH='tools/pixelorama/index.html';
const PROTOCOL='kelo.pixelorama.v1';
const CONTROL_ID='kelo-pixelorama-pro-control';
const OVERLAY_ID='kelo-pixelorama-pro-overlay';
const CLOSE_GRACE_MS=700;

function make(document,tag,props={}){
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(props)){
    if(key==='text')node.textContent=value;
    else if(key==='style')Object.assign(node.style,value);
    else if(key.startsWith('aria-'))node.setAttribute(key,value);
    else node[key]=value;
  }
  return node;
}
function runtimeUrl(document){return new URL(PIXELORAMA_RUNTIME_PATH,document.baseURI).href;}
function canvasBlob(canvas){
  return new Promise((resolve,reject)=>{
    if(typeof canvas.toBlob==='function')return canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('ASSET_CANVAS_BLOB_FAILED')),'image/png');
    try{fetch(canvas.toDataURL('image/png')).then(r=>r.blob()).then(resolve,reject);}catch(error){reject(error);}
  });
}
function fileFromBlob(root,blob,name){try{return new root.File([blob],name,{type:blob.type||'application/octet-stream'});}catch{return Object.assign(blob,{name});}}

export function installPixeloramaProBridge({root=globalThis,session=null}={}){
  const document=root.document;
  const shell=session?.shell||document?.getElementById('kelo-asset-forge');
  if(!document||!shell||!session?.canvas)return()=>{};

  shell.querySelector(`#${CONTROL_ID}`)?.remove();
  shell.querySelector(`#${OVERLAY_ID}`)?.remove();
  const toolbar=shell.querySelector('#kelo-asset-drawing-controls')||shell.querySelector('.kaf-toolbar');
  if(!toolbar)return()=>{};

  const projectStore=createPixeloramaProjectStore({root,maxRevisions:5});
  const control=make(document,'button',{id:CONTROL_ID,type:'button',className:'kaf-btn primary',text:'PIXELORAMA PRO'});
  control.setAttribute('aria-label','Abrir Pixelorama Pro dentro de Kelo World');
  toolbar.append(control);

  let overlay=null,iframe=null,exclusiveToken=null,closeTimer=0,messageHandler=null,domObserver=null,resumeBtn=null,statusNode=null;
  let closing=false,lastPxoName=null;

  function setStatus(text,error=false){
    if(statusNode){statusNode.textContent=text;statusNode.style.color=error?'#ffb2a4':'#aab8b2';}
  }
  function assetId(){return String(session.assetId||'kelo-asset');}
  async function storageSummary(){
    const result=await requestCreatorPersistentStorage(root).catch(()=>null);if(!result)return;
    if(result.quota>0){const used=(result.usage/1048576).toFixed(1),quota=(result.quota/1048576).toFixed(0);setStatus(`Creator storage ${result.persisted?'persistent':'best-effort'} · ${used}/${quota} MB used.`);}
  }
  async function sendBuffer({blob,name,mime}){
    if(!iframe?.contentWindow||!blob)return false;
    const buffer=await blob.arrayBuffer();
    iframe.contentWindow.postMessage({protocol:PROTOCOL,type:'asset',payload:{name,mime:mime||blob.type||'application/octet-stream',buffer}},root.location.origin,[buffer]);
    return true;
  }
  async function sendCurrentCanvas(){
    const blob=await canvasBlob(session.canvas);return sendBuffer({blob,name:`${assetId()}.png`,mime:'image/png'});
  }
  async function resumeLatestPxo(){
    const latest=await projectStore.latest(assetId()).catch(()=>null);
    if(!latest?.blob){setStatus('No saved Pixelorama project for this asset yet.',true);return false;}
    await sendBuffer({blob:latest.blob,name:latest.name||`${assetId()}.pxo`,mime:'application/octet-stream'});setStatus(`Sent saved project ${latest.name} to Pixelorama.`);return true;
  }
  async function refreshResumeButton(){
    if(!resumeBtn)return;const latest=await projectStore.latest(assetId()).catch(()=>null);resumeBtn.hidden=!latest?.blob;if(latest?.name)resumeBtn.title=`Resume ${latest.name}`;
  }
  async function importImageBlob(blob,name){
    const file=fileFromBlob(root,blob,name||'pixelorama-export.png');
    const input=shell.querySelector('input[type="file"]');
    try{
      if(input&&typeof root.DataTransfer==='function'){
        const dt=new root.DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new root.Event('change',{bubbles:true}));
        setStatus(`${name} returned directly to Asset Forge.`);return true;
      }
    }catch(error){console.warn('[Pixelorama Pro] DataTransfer import fallback',error);}
    try{
      const url=root.URL.createObjectURL(blob),image=new root.Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
      const canvas=session.canvas,ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);
      const scale=Math.min(canvas.width/image.width,canvas.height/image.height),w=Math.max(1,Math.round(image.width*scale)),h=Math.max(1,Math.round(image.height*scale));
      ctx.drawImage(image,Math.floor((canvas.width-w)/2),Math.floor((canvas.height-h)/2),w,h);root.URL.revokeObjectURL(url);session.selfCheck?.();setStatus(`${name} returned to Asset Forge.`);return true;
    }catch(error){setStatus(`Could not return ${name}: ${String(error?.message||error)}`,true);return false;}
  }
  async function acceptExport(payload){
    const name=String(payload?.name||'pixelorama-export.bin'),mime=String(payload?.mime||'application/octet-stream'),buffer=payload?.buffer;
    if(!(buffer instanceof ArrayBuffer)){setStatus('Pixelorama export arrived without binary data.',true);return;}
    const blob=new Blob([buffer],{type:mime});
    if(name.toLowerCase().endsWith('.pxo')){
      await projectStore.save({assetId:assetId(),name,blob,metadata:{source:'pixelorama-pro'}});lastPxoName=name;setStatus(`${name} saved inside Kelo · 5 revisions max.`);await refreshResumeButton();return;
    }
    if(mime.startsWith('image/')||/\.(png|webp|jpe?g)$/i.test(name)){await importImageBlob(blob,name);return;}
    setStatus(`${name} captured inside Kelo (${Math.round(blob.size/1024)} KB).`);
  }

  function finalizeClose(){
    if(closeTimer){root.clearTimeout(closeTimer);closeTimer=0;}
    if(messageHandler){root.removeEventListener('message',messageHandler);messageHandler=null;}
    try{iframe?.setAttribute('src','about:blank');}catch{}
    overlay?.remove();overlay=null;iframe=null;closing=false;
    if(exclusiveToken){leaveCreatorExclusiveMode(exclusiveToken,{root});exclusiveToken=null;}
    void storageSummary();
  }
  function requestClose(){
    if(!overlay||closing)return;closing=true;setStatus('Closing Pixelorama and releasing WASM memory…');
    try{iframe?.contentWindow?.postMessage({protocol:PROTOCOL,type:'quit',payload:{}},root.location.origin);}catch{}
    closeTimer=root.setTimeout(finalizeClose,CLOSE_GRACE_MS);
  }

  async function openOverlay(){
    if(overlay)return;
    closing=false;exclusiveToken=enterCreatorExclusiveMode({root,owner:'pixelorama-pro',meta:{surface:'asset-forge'}});
    overlay=make(document,'section',{id:OVERLAY_ID});
    Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'2147483600',display:'grid',gridTemplateRows:'auto minmax(0,1fr)',background:'#07090b',color:'#fff',fontFamily:'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'});
    const head=make(document,'header');Object.assign(head.style,{display:'flex',alignItems:'center',gap:'6px',padding:'calc(7px + env(safe-area-inset-top)) 7px 7px',background:'#0b1012',borderBottom:'1px solid rgba(255,255,255,.1)',flexWrap:'wrap'});
    const title=make(document,'div',{text:'PIXELORAMA PRO'});Object.assign(title.style,{fontSize:'10px',fontWeight:'950',letterSpacing:'.08em',marginRight:'auto'});
    const back=make(document,'button',{type:'button',className:'kaf-btn',text:'BACK TO KELO'});back.onclick=requestClose;
    const send=make(document,'button',{type:'button',className:'kaf-btn primary',text:'SEND CURRENT'});send.onclick=()=>void sendCurrentCanvas().then(()=>setStatus('Current Asset Forge canvas sent to Pixelorama.')).catch(e=>setStatus(e.message,true));
    resumeBtn=make(document,'button',{type:'button',className:'kaf-btn',text:'RESUME PXO'});resumeBtn.hidden=true;resumeBtn.onclick=()=>void resumeLatestPxo();
    statusNode=make(document,'span',{text:'Starting isolated creator runtime…'});Object.assign(statusNode.style,{flexBasis:'100%',fontSize:'8px',color:'#aab8b2'});
    head.append(title,resumeBtn,send,back,statusNode);
    const body=make(document,'div');Object.assign(body.style,{position:'relative',minHeight:'0',background:'#000'});
    iframe=make(document,'iframe',{src:runtimeUrl(document),title:'Pixelorama Pro inside Kelo World',allow:'clipboard-read; clipboard-write'});
    iframe.setAttribute('referrerpolicy','same-origin');Object.assign(iframe.style,{position:'absolute',inset:'0',width:'100%',height:'100%',border:'0',background:'#000'});body.append(iframe);overlay.append(head,body);shell.append(overlay);

    messageHandler=event=>{
      if(event.origin!==root.location.origin||event.source!==iframe?.contentWindow)return;
      const message=event.data||{};if(message.protocol!==PROTOCOL)return;
      if(message.type==='ready'){
        setStatus('Pixelorama ready · game hibernated · exporting PNG/PXO returns to Kelo automatically.');void sendCurrentCanvas().catch(error=>setStatus(`Pixelorama ready; send failed: ${error.message}`,true));void refreshResumeButton();
      }else if(message.type==='export')void acceptExport(message.payload).catch(error=>setStatus(error.message,true));
      else if(message.type==='quit-ack')finalizeClose();
      else if(message.type==='error')setStatus(`Pixelorama: ${message.payload?.message||message.payload?.code||'error'}`,true);
    };
    root.addEventListener('message',messageHandler);
    void storageSummary();void refreshResumeButton();
  }

  control.onclick=()=>void openOverlay().catch(error=>{setStatus(String(error?.message||error),true);if(exclusiveToken){leaveCreatorExclusiveMode(exclusiveToken,{root});exclusiveToken=null;}});

  // Escape can destroy Asset Forge without invoking this enhancer's disposer. Observe only while the workspace exists.
  domObserver=new root.MutationObserver(()=>{if(!shell.isConnected){requestClose();if(!overlay)cleanup();}});domObserver.observe(document.body,{childList:true,subtree:true});
  function cleanup(){
    control.onclick=null;domObserver?.disconnect();domObserver=null;
    if(overlay)requestClose();else if(exclusiveToken){leaveCreatorExclusiveMode(exclusiveToken,{root});exclusiveToken=null;}
    projectStore.close();control.remove();
  }
  return cleanup;
}
