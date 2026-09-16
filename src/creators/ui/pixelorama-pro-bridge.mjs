/* KELO-INDEX
 * area: CREATORS / PIXELORAMA PRO BRIDGE
 * owner: Kelo Asset Forge UI
 * owns: lazy launch/return flow between Asset Forge and the official Pixelorama Web editor
 * does-not-own: Pixelorama code, upstream availability, Pixelorama persistence, gameplay rendering or marketplace settlement
 * performance: no preload; remote Pixelorama is requested only after explicit user action
 */

export const PIXELORAMA_WEB_URL='https://orama-interactive.github.io/Pixelorama/';
const CONTROL_ID='kelo-pixelorama-pro-control';
const OVERLAY_ID='kelo-pixelorama-pro-overlay';

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

export function installPixeloramaProBridge({root=globalThis,session=null}={}){
  const document=root.document;
  const shell=session?.shell||document?.getElementById('kelo-asset-forge');
  if(!document||!shell)return()=>{};

  shell.querySelector(`#${CONTROL_ID}`)?.remove();
  shell.querySelector(`#${OVERLAY_ID}`)?.remove();

  const toolbar=shell.querySelector('#kelo-asset-drawing-controls')||shell.querySelector('.kaf-toolbar');
  if(!toolbar)return()=>{};

  const control=make(document,'button',{id:CONTROL_ID,type:'button',className:'kaf-btn primary',text:'PIXELORAMA PRO'});
  control.setAttribute('aria-label','Abrir Pixelorama Pro');
  toolbar.append(control);

  let overlay=null;

  function closeOverlay({importBack=false}={}){
    overlay?.remove();overlay=null;
    if(importBack){
      const fileInput=shell.querySelector('input[type="file"]');
      root.setTimeout?.(()=>fileInput?.click?.(),0);
    }
  }

  function openExternal(){
    const opened=root.open?.(PIXELORAMA_WEB_URL,'_blank','noopener,noreferrer');
    if(!opened)root.location.href=PIXELORAMA_WEB_URL;
  }

  function openOverlay(){
    if(overlay)return;
    overlay=make(document,'section',{id:OVERLAY_ID});
    Object.assign(overlay.style,{
      position:'fixed',inset:'0',zIndex:'2147483600',display:'grid',gridTemplateRows:'auto minmax(0,1fr)',
      background:'#07090b',color:'#fff',fontFamily:'Inter,ui-sans-serif,system-ui,-apple-system,sans-serif'
    });

    const head=make(document,'header');
    Object.assign(head.style,{
      display:'flex',alignItems:'center',gap:'7px',padding:'calc(8px + env(safe-area-inset-top)) 8px 8px',
      background:'#0b1012',borderBottom:'1px solid rgba(255,255,255,.1)'
    });
    const title=make(document,'div',{text:'PIXELORAMA PRO'});
    Object.assign(title.style,{fontSize:'11px',fontWeight:'950',letterSpacing:'.08em',marginRight:'auto'});

    const back=make(document,'button',{type:'button',className:'kaf-btn',text:'BACK'});
    const importBack=make(document,'button',{type:'button',className:'kaf-btn primary',text:'IMPORT BACK'});
    const full=make(document,'button',{type:'button',className:'kaf-btn',text:'FULLSCREEN'});
    back.onclick=()=>closeOverlay();
    importBack.onclick=()=>closeOverlay({importBack:true});
    full.onclick=openExternal;
    head.append(title,back,importBack,full);

    const body=make(document,'div');
    Object.assign(body.style,{position:'relative',minHeight:'0',background:'#000'});
    const iframe=make(document,'iframe',{src:PIXELORAMA_WEB_URL,title:'Pixelorama Pro',allow:'clipboard-read; clipboard-write; fullscreen'});
    iframe.setAttribute('allowfullscreen','');
    iframe.setAttribute('referrerpolicy','no-referrer');
    Object.assign(iframe.style,{position:'absolute',inset:'0',width:'100%',height:'100%',border:'0',background:'#000'});

    const note=make(document,'div',{text:'Pixelorama se carga solo ahora. Para volver con tu arte: Export PNG/Spritesheet en Pixelorama → IMPORT BACK → elige el archivo exportado.'});
    Object.assign(note.style,{
      position:'absolute',left:'8px',right:'8px',bottom:'calc(8px + env(safe-area-inset-bottom))',zIndex:'2',
      padding:'7px 9px',borderRadius:'9px',background:'rgba(0,0,0,.72)',fontSize:'9px',lineHeight:'1.35',pointerEvents:'none'
    });
    body.append(iframe,note);overlay.append(head,body);shell.append(overlay);
  }

  control.onclick=openOverlay;

  return()=>{
    control.onclick=null;
    closeOverlay();
    control.remove();
  };
}
