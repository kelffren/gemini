/* KELO-INDEX
 * area: CREATORS / UNIVERSAL CONTENT PREVIEW
 * owner: Kelo Universal Content Bridge
 * keys: PREVIEW INSPECTOR ZOOM PIXEL CHECKERBOARD MOBILE ON-DEMAND
 * purpose: Enhance the on-demand asset preview without preloading or retaining asset binaries.
 */

const STYLE_ID='kelo-universal-preview-inspector-style';
const TOOLBAR_ID='kelo-preview-toolbar';
let installed=false;

function injectStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${TOOLBAR_ID}{display:none;grid-template-columns:auto auto auto auto auto auto 1fr;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid #242a33;background:#0f1217;position:sticky;top:61px;z-index:2}
#${TOOLBAR_ID}.on{display:grid}
#${TOOLBAR_ID} button{min-width:38px;height:34px;padding:0 9px;border:1px solid #343944;border-radius:10px;background:#171b21;color:#e7eaf0;font:800 10px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}
#${TOOLBAR_ID} button.on{border-color:#a78a45;background:#241f13;color:#f2d98d}
#${TOOLBAR_ID} .kelo-preview-metrics{justify-self:end;color:#949ca8;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:210px}
#preview-stage.kelo-inspector-stage{overflow:auto;overscroll-behavior:contain;touch-action:pan-x pan-y pinch-zoom;align-content:center;justify-content:center}
#preview-stage.kelo-inspector-stage img{transform-origin:center center;user-select:none;-webkit-user-drag:none}
#preview-stage.kelo-checker{background-color:#11151a;background-image:linear-gradient(45deg,#262b32 25%,transparent 25%),linear-gradient(-45deg,#262b32 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#262b32 75%),linear-gradient(-45deg,transparent 75%,#262b32 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}
#preview-stage.kelo-crisp img{image-rendering:pixelated}
@media(max-width:520px){#${TOOLBAR_ID}{grid-template-columns:repeat(6,1fr);top:61px}#${TOOLBAR_ID} button{padding:0 4px;min-width:0}#${TOOLBAR_ID} .kelo-preview-metrics{grid-column:1/-1;justify-self:stretch;text-align:center;max-width:none}}
`;
  document.head.append(style);
}

function createToolbar(sheet){
  let bar=document.getElementById(TOOLBAR_ID);
  if(bar)return bar;
  bar=document.createElement('div');
  bar.id=TOOLBAR_ID;
  bar.setAttribute('aria-label','Controles de vista previa');
  bar.innerHTML=`
    <button type="button" data-preview-tool="fit" title="Ajustar">Ajustar</button>
    <button type="button" data-preview-tool="minus" title="Alejar">−</button>
    <button type="button" data-preview-tool="actual" title="Tamaño real">100%</button>
    <button type="button" data-preview-tool="plus" title="Acercar">+</button>
    <button type="button" data-preview-tool="checker" title="Fondo de transparencia">▦</button>
    <button type="button" data-preview-tool="pixel" title="Pixel perfecto">PX</button>
    <span class="kelo-preview-metrics" id="kelo-preview-metrics">Vista bajo demanda</span>`;
  const head=sheet.querySelector('.preview-head');
  head?.insertAdjacentElement('afterend',bar);
  return bar;
}

function currentImage(stage){return stage.querySelector(':scope > img')||stage.querySelector('img');}

export function installUniversalPreviewInspector(){
  if(installed||typeof document==='undefined')return;
  const modal=document.getElementById('preview-modal'),stage=document.getElementById('preview-stage');
  if(!modal||!stage)return;
  installed=true;
  injectStyles();
  const sheet=modal.querySelector('.preview-sheet')||modal;
  const bar=createToolbar(sheet),metrics=bar.querySelector('#kelo-preview-metrics');
  const state={fit:true,zoom:1,checker:false,crisp:false,img:null,lastTap:0};

  function setMetrics(img){
    if(!metrics)return;
    if(!img){metrics.textContent='Vista bajo demanda';return;}
    const size=img.naturalWidth&&img.naturalHeight?`${img.naturalWidth}×${img.naturalHeight}`:'imagen';
    metrics.textContent=state.fit?`${size} · ajustado`:`${size} · ${Math.round(state.zoom*100)}%`;
  }

  function syncButtons(){
    bar.querySelector('[data-preview-tool="fit"]')?.classList.toggle('on',state.fit);
    bar.querySelector('[data-preview-tool="actual"]')?.classList.toggle('on',!state.fit&&Math.abs(state.zoom-1)<.01);
    bar.querySelector('[data-preview-tool="checker"]')?.classList.toggle('on',state.checker);
    bar.querySelector('[data-preview-tool="pixel"]')?.classList.toggle('on',state.crisp);
  }

  function applyImageView(){
    const img=state.img;
    stage.classList.add('kelo-inspector-stage');
    stage.classList.toggle('kelo-checker',state.checker);
    stage.classList.toggle('kelo-crisp',state.crisp);
    if(!img){bar.classList.remove('on');setMetrics(null);return;}
    bar.classList.add('on');
    img.style.transform='none';
    if(state.fit){
      img.style.width='auto';img.style.height='auto';img.style.maxWidth='100%';img.style.maxHeight='62vh';
    }else{
      const width=Math.max(1,Math.round((img.naturalWidth||img.width||1)*state.zoom));
      img.style.width=`${width}px`;img.style.height='auto';img.style.maxWidth='none';img.style.maxHeight='none';
    }
    syncButtons();setMetrics(img);
  }

  function attachImage(img){
    state.img=img;state.fit=true;state.zoom=1;state.checker=false;
    state.crisp=stage.classList.contains('pixel')||/sprite|tile|pixel/i.test(document.getElementById('preview-subtitle')?.textContent||'');
    const ready=()=>applyImageView();
    if(img.complete&&img.naturalWidth)ready();else img.addEventListener('load',ready,{once:true});
  }

  function refresh(){
    const img=currentImage(stage);
    if(img!==state.img){state.img=img||null;if(img)attachImage(img);else applyImageView();}
  }

  bar.addEventListener('click',event=>{
    const button=event.target.closest('[data-preview-tool]');if(!button||!state.img)return;
    const tool=button.dataset.previewTool;
    if(tool==='fit'){state.fit=true;state.zoom=1;}
    if(tool==='actual'){state.fit=false;state.zoom=1;}
    if(tool==='minus'){state.fit=false;state.zoom=Math.max(.125,(state.fit?1:state.zoom)/1.35);}
    if(tool==='plus'){state.fit=false;state.zoom=Math.min(8,(state.fit?1:state.zoom)*1.35);}
    if(tool==='checker')state.checker=!state.checker;
    if(tool==='pixel')state.crisp=!state.crisp;
    applyImageView();
  });

  stage.addEventListener('click',event=>{
    if(event.target!==state.img)return;
    const now=Date.now();
    if(now-state.lastTap<320){state.fit=!state.fit;if(!state.fit)state.zoom=1;applyImageView();state.lastTap=0;return;}
    state.lastTap=now;
  });

  const observer=new MutationObserver(refresh);
  observer.observe(stage,{childList:true,subtree:true});
  refresh();
}

export const UNIVERSAL_PREVIEW_INSPECTOR=Object.freeze({install:installUniversalPreviewInspector});
