/* KELO-INDEX
 * area: CREATORS / UNIVERSAL CONTENT PREVIEW
 * owner: Kelo Universal Content Bridge
 * keys: SPRITE SHEET AUTO DETECT ANIMATION PREVIEW CANVAS RAF MOBILE ON-DEMAND
 * purpose: Detect likely sprite-sheet grids and animate one row at a time without downloading or retaining extra game assets.
 */

const STYLE_ID='kelo-universal-sprite-preview-style';
const BAR_ID='kelo-sprite-preview-bar';
const COMMON=[16,24,32,40,48,56,64,72,80,96,112,128,144,160,192,224,256];
let installed=false;

function injectStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${BAR_ID}{display:none;grid-template-columns:auto auto auto auto auto 1fr;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid #242a33;background:#0d1116;position:sticky;top:103px;z-index:2}
#${BAR_ID}.on{display:grid}
#${BAR_ID} button{height:34px;min-width:38px;padding:0 9px;border:1px solid #343944;border-radius:10px;background:#171b21;color:#e7eaf0;font:800 10px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}
#${BAR_ID} button.on{border-color:#a78a45;background:#241f13;color:#f2d98d}
#${BAR_ID} .kelo-sprite-meta{justify-self:end;color:#949ca8;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px}
#preview-stage .kelo-sprite-canvas{display:none;max-width:100%;max-height:58vh;width:auto;height:auto;image-rendering:pixelated;background:transparent}
#preview-stage.kelo-sprite-playing .kelo-sprite-canvas{display:block}
#preview-stage.kelo-sprite-playing>img{display:none!important}
@media(max-width:520px){#${BAR_ID}{grid-template-columns:repeat(5,1fr);top:145px}#${BAR_ID} button{min-width:0;padding:0 4px}#${BAR_ID} .kelo-sprite-meta{grid-column:1/-1;max-width:none;justify-self:stretch;text-align:center}}
`;
  document.head.append(style);
}

function createBar(sheet){
  let bar=document.getElementById(BAR_ID);
  if(bar)return bar;
  bar=document.createElement('div');
  bar.id=BAR_ID;
  bar.setAttribute('aria-label','Controles de animación del sprite');
  bar.innerHTML=`
    <button type="button" data-sprite-tool="toggle" title="Animar o ver hoja">▶</button>
    <button type="button" data-sprite-tool="prev-row" title="Fila anterior">↑</button>
    <button type="button" data-sprite-tool="next-row" title="Fila siguiente">↓</button>
    <button type="button" data-sprite-tool="slower" title="Más lento">− FPS</button>
    <button type="button" data-sprite-tool="faster" title="Más rápido">+ FPS</button>
    <span class="kelo-sprite-meta" id="kelo-sprite-meta">Detectando spritesheet…</span>`;
  const previewToolbar=document.getElementById('kelo-preview-toolbar');
  if(previewToolbar)previewToolbar.insertAdjacentElement('afterend',bar);
  else sheet.querySelector('.preview-head')?.insertAdjacentElement('afterend',bar);
  return bar;
}

function subtitleKind(){return String(document.getElementById('preview-subtitle')?.textContent||'').toLowerCase();}
function eligible(){return /animation|sprite|vfx|character/.test(subtitleKind())&&!/tileset|tile\b/.test(subtitleKind());}
function currentImage(stage){return stage.querySelector(':scope > img')||stage.querySelector('img');}
function gcd(a,b){while(b){const t=a%b;a=b;b=t;}return Math.abs(a);}
function isPow2(n){return n>0&&(n&(n-1))===0;}

function candidateGrids(width,height){
  const widths=new Set(COMMON.filter(v=>width%v===0));
  const heights=new Set(COMMON.filter(v=>height%v===0));
  const commonGcd=gcd(width,height);
  for(const v of COMMON)if(commonGcd%v===0){widths.add(v);heights.add(v);}
  const rows=[];
  for(const cw of widths)for(const ch of heights){
    const cols=width/cw,rowCount=height/ch,total=cols*rowCount;
    if(cols<2||cols>24||rowCount<1||rowCount>16||total<2||total>192)continue;
    const aspect=cw/ch;if(aspect<.4||aspect>2.5)continue;
    let score=0;
    score+=cols>=3&&cols<=16?18:4;
    score+=rowCount>=2&&rowCount<=8?14:5;
    score+=total>=4&&total<=64?12:2;
    score+=isPow2(cw)?8:0;score+=isPow2(ch)?8:0;
    score+=Math.max(0,10-Math.abs(cols-rowCount)*1.4);
    score+=Math.max(0,8-Math.abs(Math.log2(aspect))*5);
    if([4,8,12,16,20,24,32,48,64].includes(total))score+=6;
    if(cw===64&&ch===64)score+=8;
    rows.push({cw,ch,cols,rows:rowCount,total,score});
  }
  return rows.sort((a,b)=>b.score-a.score||b.cw*b.ch-a.cw*a.ch);
}

async function loadCorsProbe(source,width,height){
  if(!source||!/^https?:/i.test(source))return null;
  const img=new Image();img.crossOrigin='anonymous';img.decoding='async';
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=source;});
  if(img.naturalWidth!==width||img.naturalHeight!==height)return null;
  return img;
}

function boundaryScore(img,candidate){
  try{
    const {cw,ch,cols,rows}=candidate,w=img.naturalWidth,h=img.naturalHeight;
    if(w*h>12_000_000)return 0;
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
    const data=ctx.getImageData(0,0,w,h).data;
    const alphaAt=(x,y)=>data[(y*w+x)*4+3];
    let samples=0,occupied=0;
    const stepY=Math.max(1,Math.floor(h/160)),stepX=Math.max(1,Math.floor(w/160));
    for(let c=1;c<cols;c++){
      const x=Math.min(w-1,c*cw);
      for(let y=0;y<h;y+=stepY){samples++;if(alphaAt(x,y)>24)occupied++;}
    }
    for(let r=1;r<rows;r++){
      const y=Math.min(h-1,r*ch);
      for(let x=0;x<w;x+=stepX){samples++;if(alphaAt(x,y)>24)occupied++;}
    }
    if(!samples)return 0;
    const emptyRatio=1-occupied/samples;
    return Math.max(-20,Math.min(28,(emptyRatio-.45)*50));
  }catch{return 0;}
}

async function detectGrid(img){
  const width=img.naturalWidth,height=img.naturalHeight;
  if(!width||!height)return null;
  const candidates=candidateGrids(width,height).slice(0,18);
  if(!candidates.length)return null;
  let probe=img;
  try{probe=await loadCorsProbe(img.currentSrc||img.src,width,height)||img;}catch{}
  for(const candidate of candidates)candidate.score+=boundaryScore(probe,candidate);
  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0];
  if(!best||best.score<24)return null;
  return best;
}

function canvasFor(stage){
  let canvas=stage.querySelector(':scope > .kelo-sprite-canvas');
  if(canvas)return canvas;
  canvas=document.createElement('canvas');canvas.className='kelo-sprite-canvas';canvas.setAttribute('aria-label','Animación detectada del spritesheet');stage.append(canvas);return canvas;
}

export function installUniversalSpritePreview(){
  if(installed||typeof document==='undefined')return;
  const modal=document.getElementById('preview-modal'),stage=document.getElementById('preview-stage');
  if(!modal||!stage)return;
  installed=true;injectStyles();
  const sheet=modal.querySelector('.preview-sheet')||modal,bar=createBar(sheet),meta=bar.querySelector('#kelo-sprite-meta');
  const state={img:null,grid:null,row:0,frame:0,fps:8,playing:false,raf:0,last:0,token:0};

  function stopLoop(){if(state.raf)cancelAnimationFrame(state.raf);state.raf=0;state.last=0;}
  function reset(){
    stopLoop();state.img=null;state.grid=null;state.row=0;state.frame=0;state.playing=false;state.token++;
    stage.classList.remove('kelo-sprite-playing');stage.querySelector(':scope > .kelo-sprite-canvas')?.remove();
    bar.classList.remove('on');bar.querySelector('[data-sprite-tool="toggle"]')?.classList.remove('on');
    if(meta)meta.textContent='Detectando spritesheet…';
  }
  function updateMeta(){
    if(!meta||!state.grid)return;
    const g=state.grid;meta.textContent=`Auto ${g.cw}×${g.ch} · ${g.cols}×${g.rows} · fila ${state.row+1}/${g.rows} · ${state.fps} FPS`;
  }
  function draw(){
    if(!state.img||!state.grid)return;
    const g=state.grid,canvas=canvasFor(stage),ctx=canvas.getContext('2d');
    if(canvas.width!==g.cw||canvas.height!==g.ch){canvas.width=g.cw;canvas.height=g.ch;}
    ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,g.cw,g.ch);
    ctx.drawImage(state.img,state.frame*g.cw,state.row*g.ch,g.cw,g.ch,0,0,g.cw,g.ch);
  }
  function loop(ts){
    state.raf=0;if(!state.playing||!state.grid)return;
    const frameMs=1000/state.fps;
    if(!state.last||ts-state.last>=frameMs){state.last=ts;state.frame=(state.frame+1)%state.grid.cols;draw();}
    state.raf=requestAnimationFrame(loop);
  }
  function setPlaying(next){
    if(!state.grid)return;state.playing=!!next;stage.classList.toggle('kelo-sprite-playing',state.playing);
    const toggle=bar.querySelector('[data-sprite-tool="toggle"]');if(toggle){toggle.textContent=state.playing?'❚❚':'▶';toggle.classList.toggle('on',state.playing);}
    if(state.playing){draw();if(!state.raf)state.raf=requestAnimationFrame(loop);}else stopLoop();
  }

  async function attach(img){
    reset();if(!img||!eligible())return;state.img=img;const token=state.token;
    if(meta)meta.textContent='Detectando cuadrícula…';
    if(!(img.complete&&img.naturalWidth))await new Promise(resolve=>img.addEventListener('load',resolve,{once:true}));
    if(token!==state.token||state.img!==img)return;
    const grid=await detectGrid(img);if(token!==state.token||state.img!==img)return;
    if(!grid){if(meta)meta.textContent='Hoja sin cuadrícula segura';return;}
    state.grid=grid;state.row=0;state.frame=0;bar.classList.add('on');updateMeta();draw();
  }

  bar.addEventListener('click',event=>{
    const button=event.target.closest('[data-sprite-tool]');if(!button||!state.grid)return;
    const tool=button.dataset.spriteTool;
    if(tool==='toggle')setPlaying(!state.playing);
    if(tool==='prev-row'){state.row=(state.row-1+state.grid.rows)%state.grid.rows;state.frame=0;draw();updateMeta();}
    if(tool==='next-row'){state.row=(state.row+1)%state.grid.rows;state.frame=0;draw();updateMeta();}
    if(tool==='slower'){state.fps=Math.max(1,state.fps-1);updateMeta();}
    if(tool==='faster'){state.fps=Math.min(24,state.fps+1);updateMeta();}
  });

  const refresh=()=>{
    const img=currentImage(stage);
    if(img!==state.img){if(img)void attach(img);else reset();}
    if(modal.hidden&&state.playing)setPlaying(false);
  };
  const observer=new MutationObserver(refresh);observer.observe(stage,{childList:true,subtree:true});
  new MutationObserver(()=>{if(modal.hidden)reset();}).observe(modal,{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.playing)setPlaying(false);},{passive:true});
  refresh();
}

export const UNIVERSAL_SPRITE_PREVIEW=Object.freeze({install:installUniversalSpritePreview});
