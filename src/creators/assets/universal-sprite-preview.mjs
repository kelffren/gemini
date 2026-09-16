/* KELO-INDEX
 * area: CREATORS / UNIVERSAL CONTENT PREVIEW
 * owner: Kelo Universal Content Bridge
 * keys: SPRITE SHEET AUTO DETECT ANIMATION PREVIEW SEMANTIC ROWS DIRECTIONS ACTIONS CANVAS RAF MOBILE ON-DEMAND
 * purpose: Detect likely sprite-sheet grids, infer safe row semantics and preview one action/direction at a time without retaining extra game assets.
 */

const STYLE_ID='kelo-universal-sprite-preview-style';
const BAR_ID='kelo-sprite-preview-bar';
const ROWS_ID='kelo-sprite-row-strip';
const COMMON=[16,24,32,40,48,56,64,72,80,96,112,128,144,160,192,224,256];
const FOUR_DIR=['↓ Abajo','← Izquierda','→ Derecha','↑ Arriba'];
const EIGHT_DIR=['↓ Sur','↙ Suroeste','← Oeste','↖ Noroeste','↑ Norte','↗ Noreste','→ Este','↘ Sureste'];
let installed=false;

function injectStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${BAR_ID}{display:none;grid-template-columns:auto auto auto auto auto 1fr;gap:6px;align-items:center;padding:8px 10px;border-bottom:1px solid #242a33;background:#0d1116;position:sticky;top:103px;z-index:3}
#${BAR_ID}.on{display:grid}
#${BAR_ID} button{height:34px;min-width:38px;padding:0 9px;border:1px solid #343944;border-radius:10px;background:#171b21;color:#e7eaf0;font:800 10px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}
#${BAR_ID} button.on{border-color:#a78a45;background:#241f13;color:#f2d98d}
#${BAR_ID} .kelo-sprite-meta{justify-self:end;color:#949ca8;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px}
#${ROWS_ID}{display:none;gap:6px;overflow-x:auto;padding:7px 10px;border-bottom:1px solid #242a33;background:#0b0e12;scrollbar-width:none;position:sticky;top:145px;z-index:3}
#${ROWS_ID}.on{display:flex}
#${ROWS_ID} button{flex:0 0 auto;min-height:32px;padding:0 10px;border:1px solid #303640;border-radius:999px;background:#141820;color:#b9c0ca;font-size:9px;font-weight:850;white-space:nowrap}
#${ROWS_ID} button.on{border-color:#a78a45;background:#241f13;color:#f2d98d}
#preview-stage.kelo-sprite-stage{position:relative;overflow:hidden}
#preview-stage .kelo-sprite-canvas{display:none;width:min(46vw,256px);height:auto;max-width:72%;max-height:52vh;image-rendering:pixelated;background:transparent;z-index:2;filter:drop-shadow(0 16px 18px rgba(0,0,0,.35))}
#preview-stage .kelo-sprite-game-label{display:none;position:absolute;left:50%;bottom:13px;transform:translateX(-50%);z-index:3;max-width:88%;padding:6px 10px;border:1px solid rgba(232,201,111,.24);border-radius:999px;background:rgba(8,10,13,.82);color:#f0d992;font-size:9px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#preview-stage.kelo-sprite-playing{background:radial-gradient(ellipse at 50% 74%,rgba(232,201,111,.12) 0 12%,rgba(255,255,255,.03) 13% 20%,transparent 38%),linear-gradient(180deg,#11161d,#090c10)}
#preview-stage.kelo-sprite-playing .kelo-sprite-canvas,#preview-stage.kelo-sprite-playing .kelo-sprite-game-label{display:block}
#preview-stage.kelo-sprite-playing>img{display:none!important}
@media(max-width:520px){#${BAR_ID}{grid-template-columns:repeat(5,1fr);top:145px}#${BAR_ID} button{min-width:0;padding:0 4px}#${BAR_ID} .kelo-sprite-meta{grid-column:1/-1;max-width:none;justify-self:stretch;text-align:center}#${ROWS_ID}{top:219px}#preview-stage .kelo-sprite-canvas{width:min(58vw,240px);max-width:82%}}
`;
  document.head.append(style);
}

function createControls(sheet){
  let bar=document.getElementById(BAR_ID),rows=document.getElementById(ROWS_ID);
  if(!bar){
    bar=document.createElement('div');bar.id=BAR_ID;bar.setAttribute('aria-label','Controles de animación del sprite');
    bar.innerHTML=`<button type="button" data-sprite-tool="toggle" title="Animar o ver hoja">▶</button><button type="button" data-sprite-tool="prev-row" title="Fila anterior">↑</button><button type="button" data-sprite-tool="next-row" title="Fila siguiente">↓</button><button type="button" data-sprite-tool="slower" title="Más lento">− FPS</button><button type="button" data-sprite-tool="faster" title="Más rápido">+ FPS</button><span class="kelo-sprite-meta" id="kelo-sprite-meta">Detectando spritesheet…</span>`;
    const previewToolbar=document.getElementById('kelo-preview-toolbar');
    if(previewToolbar)previewToolbar.insertAdjacentElement('afterend',bar);else sheet.querySelector('.preview-head')?.insertAdjacentElement('afterend',bar);
  }
  if(!rows){rows=document.createElement('div');rows.id=ROWS_ID;rows.setAttribute('aria-label','Acción o dirección del sprite');bar.insertAdjacentElement('afterend',rows);}
  return{bar,rows};
}

function subtitleKind(){return String(document.getElementById('preview-subtitle')?.textContent||'').toLowerCase();}
function previewTitle(){return String(document.getElementById('preview-name')?.textContent||'').toLowerCase();}
function modalAsset(){return document.getElementById('preview-modal')?.__keloAsset||null;}
function assetText(){const a=modalAsset()||{};return `${a.name||''} ${a.category||''} ${(a.tags||[]).join?.(' ')||''} ${a.description||''} ${previewTitle()} ${subtitleKind()}`.toLowerCase();}
function eligible(){return /animation|sprite|vfx|character/.test(subtitleKind())&&!/tileset|tile\b/.test(subtitleKind());}
function strongAnimationHint(img){const text=assetText(),ratio=(img?.naturalWidth||1)/(img?.naturalHeight||1);return /animation|vfx|sprite.?sheet|\banim\b|walk|run|idle|attack|slash|shoot|cast|spell|jump|thrust|hurt|death/.test(text)||ratio>1.45||ratio<.69;}
function currentImage(stage){return stage.querySelector(':scope > img')||stage.querySelector('img');}
function gcd(a,b){while(b){const t=a%b;a=b;b=t;}return Math.abs(a);}
function isPow2(n){return n>0&&(n&(n-1))===0;}

function candidateGrids(width,height){
  const widths=new Set(COMMON.filter(v=>width%v===0)),heights=new Set(COMMON.filter(v=>height%v===0)),commonGcd=gcd(width,height);
  for(const v of COMMON)if(commonGcd%v===0){widths.add(v);heights.add(v);}
  const out=[];
  for(const cw of widths)for(const ch of heights){
    const cols=width/cw,rowCount=height/ch,total=cols*rowCount;
    if(cols<2||cols>24||rowCount<1||rowCount>16||total<2||total>192)continue;
    const aspect=cw/ch;if(aspect<.4||aspect>2.5)continue;
    let score=0;score+=cols>=3&&cols<=16?18:4;score+=rowCount>=2&&rowCount<=8?14:5;score+=total>=4&&total<=64?12:2;score+=isPow2(cw)?8:0;score+=isPow2(ch)?8:0;score+=Math.max(0,10-Math.abs(cols-rowCount)*1.4);score+=Math.max(0,8-Math.abs(Math.log2(aspect))*5);if([4,8,12,16,20,24,32,48,64].includes(total))score+=6;if(cw===64&&ch===64)score+=8;
    out.push({cw,ch,cols,rows:rowCount,total,score,boundary:null});
  }
  return out.sort((a,b)=>b.score-a.score||b.cw*b.ch-a.cw*a.ch);
}

async function loadCorsProbe(source,width,height){if(!source||!/^https?:/i.test(source))return null;const img=new Image();img.crossOrigin='anonymous';img.decoding='async';await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=source;});if(img.naturalWidth!==width||img.naturalHeight!==height)return null;return img;}
function boundaryScore(img,candidate){try{const {cw,ch,cols,rows}=candidate,w=img.naturalWidth,h=img.naturalHeight;if(w*h>12_000_000)return null;const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,w,h).data,alphaAt=(x,y)=>data[(y*w+x)*4+3];let samples=0,occupied=0;const stepY=Math.max(1,Math.floor(h/160)),stepX=Math.max(1,Math.floor(w/160));for(let c=1;c<cols;c++){const x=Math.min(w-1,c*cw);for(let y=0;y<h;y+=stepY){samples++;if(alphaAt(x,y)>24)occupied++;}}for(let r=1;r<rows;r++){const y=Math.min(h-1,r*ch);for(let x=0;x<w;x+=stepX){samples++;if(alphaAt(x,y)>24)occupied++;}}if(!samples)return null;const emptyRatio=1-occupied/samples;return Math.max(-20,Math.min(28,(emptyRatio-.45)*50));}catch{return null;}}
async function detectGrid(img){const width=img.naturalWidth,height=img.naturalHeight;if(!width||!height)return null;const candidates=candidateGrids(width,height).slice(0,18);if(!candidates.length)return null;let probe=img;try{probe=await loadCorsProbe(img.currentSrc||img.src,width,height)||img;}catch{}let hasPixelEvidence=false;for(const candidate of candidates){const boundary=boundaryScore(probe,candidate);candidate.boundary=boundary;if(boundary!==null){candidate.score+=boundary;hasPixelEvidence=true;}}candidates.sort((a,b)=>b.score-a.score);const best=candidates[0];if(!best||best.score<24)return null;if(!strongAnimationHint(img)&&(!hasPixelEvidence||best.boundary===null||best.boundary<4))return null;return best;}

function inferAction(){
  const text=assetText();
  const patterns=[['death',/death|dead|die|dying|muerte/],['hurt',/hurt|hit|damage|damaged|herido/],['attack',/attack|slash|thrust|melee|sword|ataque/],['shoot',/shoot|shot|bow|gun|arrow|disparo/],['cast',/cast|spell|magic|mage|hechizo/],['run',/\brun\b|running|correr/],['walk',/\bwalk\b|walking|caminar/],['idle',/\bidle\b|stand|standing|reposo/],['jump',/jump|salto/]];
  for(const [id,re] of patterns)if(re.test(text))return id;
  if(/vfx|effect|fx\b/.test(text))return'vfx';
  return'animation';
}
function actionLabel(action){return({idle:'Idle',walk:'Walk',run:'Run',attack:'Attack',shoot:'Shoot',cast:'Cast',jump:'Jump',hurt:'Hurt',death:'Death',vfx:'VFX',animation:'Animación'})[action]||'Animación';}
function explicitRowLabels(asset,rowCount){
  if(!asset)return null;
  for(const key of ['rowLabels','directions','animationRows']){
    const rows=asset[key];if(Array.isArray(rows)&&rows.length===rowCount&&rows.every(v=>typeof v==='string'||typeof v==='number'))return rows.map(v=>String(v));
  }
  if(asset.animations&&typeof asset.animations==='object'){
    const labels=Array(rowCount).fill(null);let hits=0;
    for(const [name,value] of Object.entries(asset.animations)){const row=Number(value?.row);if(Number.isInteger(row)&&row>=0&&row<rowCount&&!labels[row]){labels[row]=name;hits++;}}
    if(hits===rowCount)return labels;
  }
  return null;
}
function inferRows(grid){
  const action=inferAction(),asset=modalAsset(),explicit=explicitRowLabels(asset,grid.rows);
  if(explicit)return{action,confidence:'metadata',labels:explicit.map(v=>`${actionLabel(action)} · ${v}`)};
  const text=assetText();
  if(grid.rows===4)return{action,confidence:'probable 4-dir',labels:FOUR_DIR.map(v=>`${actionLabel(action)} · ${v}`)};
  if(grid.rows===8&&/(8\s*dir|8-way|8way|eight.?direction|8.?direction)/.test(text))return{action,confidence:'probable 8-dir',labels:EIGHT_DIR.map(v=>`${actionLabel(action)} · ${v}`)};
  if(grid.rows===1)return{action,confidence:'acción única',labels:[actionLabel(action)]};
  return{action,confidence:'sin orden confirmado',labels:Array.from({length:grid.rows},(_,i)=>`${actionLabel(action)} · Fila ${i+1}`)};
}

function canvasFor(stage){let canvas=stage.querySelector(':scope > .kelo-sprite-canvas');if(canvas)return canvas;canvas=document.createElement('canvas');canvas.className='kelo-sprite-canvas';canvas.setAttribute('aria-label','Animación detectada del spritesheet');stage.append(canvas);return canvas;}
function labelFor(stage){let label=stage.querySelector(':scope > .kelo-sprite-game-label');if(label)return label;label=document.createElement('div');label.className='kelo-sprite-game-label';stage.append(label);return label;}

export function installUniversalSpritePreview(){
  if(installed||typeof document==='undefined')return;
  const modal=document.getElementById('preview-modal'),stage=document.getElementById('preview-stage');if(!modal||!stage)return;
  installed=true;injectStyles();stage.classList.add('kelo-sprite-stage');
  const sheet=modal.querySelector('.preview-sheet')||modal,{bar,rows}=createControls(sheet),meta=bar.querySelector('#kelo-sprite-meta');
  const state={img:null,grid:null,semantics:null,row:0,frame:0,fps:8,playing:false,raf:0,last:0,token:0};
  function stopLoop(){if(state.raf)cancelAnimationFrame(state.raf);state.raf=0;state.last=0;}
  function reset(){stopLoop();state.img=null;state.grid=null;state.semantics=null;state.row=0;state.frame=0;state.playing=false;state.token++;stage.classList.remove('kelo-sprite-playing');stage.querySelector(':scope > .kelo-sprite-canvas')?.remove();stage.querySelector(':scope > .kelo-sprite-game-label')?.remove();bar.classList.remove('on');rows.classList.remove('on');rows.replaceChildren();bar.querySelector('[data-sprite-tool="toggle"]')?.classList.remove('on');if(meta)meta.textContent='Detectando spritesheet…';}
  function currentRowLabel(){return state.semantics?.labels?.[state.row]||`Fila ${state.row+1}`;}
  function updateRowUi(){rows.querySelectorAll('[data-sprite-row]').forEach(btn=>btn.classList.toggle('on',Number(btn.dataset.spriteRow)===state.row));const label=labelFor(stage);label.textContent=`${currentRowLabel()} · ${state.fps} FPS`;
    if(meta&&state.grid)meta.textContent=`Auto ${state.grid.cw}×${state.grid.ch} · ${state.grid.cols}×${state.grid.rows} · ${state.semantics?.confidence||'detectado'}`;
  }
  function renderRows(){rows.innerHTML=(state.semantics?.labels||[]).map((label,i)=>`<button type="button" data-sprite-row="${i}" title="Previsualizar fila ${i+1}">${label}</button>`).join('');rows.classList.toggle('on',!!state.grid);updateRowUi();}
  function draw(){if(!state.img||!state.grid)return;const g=state.grid,canvas=canvasFor(stage),ctx=canvas.getContext('2d');if(canvas.width!==g.cw||canvas.height!==g.ch){canvas.width=g.cw;canvas.height=g.ch;}ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,g.cw,g.ch);ctx.drawImage(state.img,state.frame*g.cw,state.row*g.ch,g.cw,g.ch,0,0,g.cw,g.ch);updateRowUi();}
  function loop(ts){state.raf=0;if(!state.playing||!state.grid)return;const frameMs=1000/state.fps;if(!state.last||ts-state.last>=frameMs){state.last=ts;state.frame=(state.frame+1)%state.grid.cols;draw();}state.raf=requestAnimationFrame(loop);}
  function setPlaying(next){if(!state.grid)return;state.playing=!!next;stage.classList.toggle('kelo-sprite-playing',state.playing);const toggle=bar.querySelector('[data-sprite-tool="toggle"]');if(toggle){toggle.textContent=state.playing?'❚❚':'▶';toggle.classList.toggle('on',state.playing);}if(state.playing){draw();if(!state.raf)state.raf=requestAnimationFrame(loop);}else stopLoop();}
  function selectRow(row,{play=state.playing}={}){if(!state.grid)return;state.row=(row+state.grid.rows)%state.grid.rows;state.frame=0;draw();if(play&&!state.playing)setPlaying(true);}
  async function attach(img){reset();if(!img||!eligible())return;state.img=img;const token=state.token;if(meta)meta.textContent='Detectando cuadrícula…';if(!(img.complete&&img.naturalWidth))await new Promise(resolve=>img.addEventListener('load',resolve,{once:true}));if(token!==state.token||state.img!==img)return;const grid=await detectGrid(img);if(token!==state.token||state.img!==img)return;if(!grid){if(meta)meta.textContent='Hoja sin cuadrícula segura';return;}state.grid=grid;state.semantics=inferRows(grid);state.row=0;state.frame=0;bar.classList.add('on');renderRows();draw();}

  bar.addEventListener('click',event=>{const button=event.target.closest('[data-sprite-tool]');if(!button||!state.grid)return;const tool=button.dataset.spriteTool;if(tool==='toggle')setPlaying(!state.playing);if(tool==='prev-row')selectRow(state.row-1);if(tool==='next-row')selectRow(state.row+1);if(tool==='slower'){state.fps=Math.max(1,state.fps-1);updateRowUi();}if(tool==='faster'){state.fps=Math.min(24,state.fps+1);updateRowUi();}});
  rows.addEventListener('click',event=>{const button=event.target.closest('[data-sprite-row]');if(!button||!state.grid)return;selectRow(Number(button.dataset.spriteRow),{play:true});});
  let touchX=0,touchY=0;stage.addEventListener('touchstart',event=>{const t=event.touches?.[0];if(!t||!state.grid)return;touchX=t.clientX;touchY=t.clientY;},{passive:true});stage.addEventListener('touchend',event=>{const t=event.changedTouches?.[0];if(!t||!state.grid||!state.playing)return;const dx=t.clientX-touchX,dy=t.clientY-touchY;if(Math.abs(dx)<42||Math.abs(dx)<Math.abs(dy))return;selectRow(state.row+(dx<0?1:-1));},{passive:true});
  modal.addEventListener('kelo:preview-asset',event=>{modal.__keloAsset=event.detail?.asset||null;const img=currentImage(stage);if(img&&eligible())void attach(img);});
  const refresh=()=>{const img=currentImage(stage);if(img!==state.img){if(img)void attach(img);else reset();}if(modal.hidden&&state.playing)setPlaying(false);};
  new MutationObserver(refresh).observe(stage,{childList:true,subtree:true});new MutationObserver(()=>{if(modal.hidden){modal.__keloAsset=null;reset();}}).observe(modal,{attributes:true,attributeFilter:['hidden']});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.playing)setPlaying(false);},{passive:true});
  refresh();
}

export const UNIVERSAL_SPRITE_PREVIEW=Object.freeze({install:installUniversalSpritePreview});
