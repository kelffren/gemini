/* KELO-INDEX
 * area: CREATORS / UNIVERSAL CONTENT PREVIEW
 * owner: Kelo Universal Content Bridge
 * keys: AVATAR TRYON MANNEQUIN EQUIPMENT AURA WEAPON CLOTHING HELMET LAYERED PREVIEW MOBILE ON-DEMAND
 * purpose: Preview remote visual assets on a real Kelo World base body before download, without retaining the asset binary.
 */

const STYLE_ID='kelo-universal-avatar-tryon-style';
const BAR_ID='kelo-avatar-tryon-bar';
const BASE_URL=new URL('../../../assets/kelo-hero-body-base-8dir.png',import.meta.url).href;
let installed=false,basePromise=null;

const SLOT_PRESETS=Object.freeze({
  aura:{label:'✨ Aura',x:.50,y:.53,scale:1.28,layer:'back',rotation:0,alpha:.96},
  wings:{label:'🪽 Alas',x:.50,y:.46,scale:1.02,layer:'back',rotation:0,alpha:1},
  head:{label:'👑 Cabeza',x:.50,y:.22,scale:.34,layer:'front',rotation:0,alpha:1},
  weapon:{label:'⚔️ Arma',x:.73,y:.57,scale:.58,layer:'front',rotation:0,alpha:1},
  shield:{label:'🛡️ Escudo',x:.28,y:.58,scale:.44,layer:'front',rotation:0,alpha:1},
  torso:{label:'🧥 Torso',x:.50,y:.48,scale:.62,layer:'front',rotation:0,alpha:1},
  legs:{label:'👖 Piernas',x:.50,y:.70,scale:.55,layer:'front',rotation:0,alpha:1},
  feet:{label:'🥾 Pies',x:.50,y:.88,scale:.28,layer:'front',rotation:0,alpha:1},
  body:{label:'🧍 Cuerpo',x:.50,y:.56,scale:.78,layer:'front',rotation:0,alpha:1},
  generic:{label:'◇ Accesorio',x:.50,y:.52,scale:.52,layer:'front',rotation:0,alpha:1}
});

function injectStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
#${BAR_ID}{display:none;gap:6px;align-items:center;overflow-x:auto;padding:8px 10px;border-bottom:1px solid #242a33;background:#0b0f14;scrollbar-width:none;position:sticky;top:145px;z-index:4}
#${BAR_ID}.on{display:flex}
#${BAR_ID} button{flex:0 0 auto;height:34px;padding:0 10px;border:1px solid #343944;border-radius:10px;background:#171b21;color:#e7eaf0;font:800 9px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}
#${BAR_ID} button.on{border-color:#a78a45;background:#241f13;color:#f2d98d}
#${BAR_ID} .kelo-tryon-slot{border-color:rgba(232,201,111,.28);color:#f2d98d;background:#1b1811}
#preview-stage.kelo-tryon-active{overflow:hidden!important;touch-action:none;background:radial-gradient(ellipse at 50% 76%,rgba(232,201,111,.12) 0 12%,rgba(255,255,255,.025) 13% 24%,transparent 46%),linear-gradient(180deg,#12171e,#080b0f)!important}
#preview-stage.kelo-tryon-active>img,#preview-stage.kelo-tryon-active>.kelo-sprite-canvas,#preview-stage.kelo-tryon-active>.kelo-sprite-game-label{display:none!important}
#preview-stage .kelo-tryon-canvas{display:none;width:min(88vw,520px);height:auto;max-height:58vh;image-rendering:pixelated;touch-action:none;user-select:none;-webkit-user-select:none}
#preview-stage.kelo-tryon-active .kelo-tryon-canvas{display:block}
#preview-stage .kelo-tryon-note{display:none;position:absolute;left:50%;bottom:10px;transform:translateX(-50%);max-width:92%;padding:6px 9px;border-radius:999px;border:1px solid rgba(232,201,111,.22);background:rgba(6,9,12,.82);color:#d8c58f;font-size:8px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#preview-stage.kelo-tryon-active .kelo-tryon-note{display:block}
@media(max-width:520px){#${BAR_ID}{top:219px}#preview-stage .kelo-tryon-canvas{width:92vw;max-height:54vh}}
`;document.head.append(style);
}

function assetFromModal(){return document.getElementById('preview-modal')?.__keloAsset||null;}
function textFor(asset){return `${asset?.name||''} ${asset?.category||''} ${asset?.contentKind||''} ${(asset?.tags||[]).join?.(' ')||''} ${asset?.description||''}`.toLowerCase();}
function classifySlot(asset){
  const t=textFor(asset);
  if(/aura|halo|glow|energy|flame|fire.?ring|magic.?circle/.test(t))return'aura';
  if(/wing|wings|ala|alas/.test(t))return'wings';
  if(/helmet|helm|hat|hood|crown|hair|mask|headgear|casco|sombrero|corona|cabello/.test(t))return'head';
  if(/shield|buckler|escudo/.test(t))return'shield';
  if(/sword|axe|bow|staff|spear|gun|dagger|weapon|blade|mace|wand|katana|espada|hacha|arco|lanza|arma/.test(t))return'weapon';
  if(/pants|trouser|legging|skirt|shorts|pantalon|pierna/.test(t))return'legs';
  if(/boot|shoe|feet|foot|zapato|bota/.test(t))return'feet';
  if(/armor|armour|shirt|jacket|robe|coat|hoodie|chest|torso|camisa|chaqueta|armadura|abrigo/.test(t))return'torso';
  if(/character|avatar|body|personaje|cuerpo/.test(t)&&['sprite','animation'].includes(asset?.contentKind))return'body';
  return'generic';
}
function profileFor(asset){
  const slot=String(asset?.renderProfile?.slot||asset?.slot||classifySlot(asset));
  const base={...(SLOT_PRESETS[slot]||SLOT_PRESETS.generic)};
  const rp=asset?.renderProfile&&typeof asset.renderProfile==='object'?asset.renderProfile:{};
  const num=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
  return{slot,label:base.label,x:num(rp.x??rp.anchorX,base.x),y:num(rp.y??rp.anchorY,base.y),scale:num(rp.scale,base.scale),rotation:num(rp.rotation,base.rotation),alpha:num(rp.alpha,base.alpha),layer:rp.layer==='back'?'back':rp.layer==='front'?'front':base.layer};
}

function createBar(sheet){
  let bar=document.getElementById(BAR_ID);if(bar)return bar;
  bar=document.createElement('div');bar.id=BAR_ID;bar.setAttribute('aria-label','Prueba del asset sobre personaje');
  bar.innerHTML=`<button type="button" data-tryon="toggle">👤 Probar</button><button type="button" class="kelo-tryon-slot" data-tryon="slot">◇ Accesorio</button><button type="button" data-tryon="smaller">−</button><button type="button" data-tryon="bigger">+</button><button type="button" data-tryon="rotate">↻</button><button type="button" data-tryon="layer">Frente</button><button type="button" data-tryon="reset">Reset</button>`;
  const rows=document.getElementById('kelo-sprite-row-strip'),spriteBar=document.getElementById('kelo-sprite-preview-bar'),previewBar=document.getElementById('kelo-preview-toolbar');
  if(rows)rows.insertAdjacentElement('afterend',bar);else if(spriteBar)spriteBar.insertAdjacentElement('afterend',bar);else if(previewBar)previewBar.insertAdjacentElement('afterend',bar);else sheet.querySelector('.preview-head')?.insertAdjacentElement('afterend',bar);
  return bar;
}

async function loadBase(){
  if(basePromise)return basePromise;
  basePromise=new Promise((resolve,reject)=>{const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=()=>{basePromise=null;reject(new Error('KELO_TRYON_BASE_UNAVAILABLE'));};img.src=BASE_URL;});
  return basePromise;
}
function baseRect(img){
  const h=img.naturalHeight,w=img.naturalWidth;
  if(!w||!h)return{x:0,y:0,w:1,h:1};
  const frameH=h/8,ratio=w/frameH,candidates=[1,2,3,4,5,6,8,10,12,16];
  let cols=candidates.reduce((best,n)=>Math.abs(n-ratio)<Math.abs(best-ratio)?n:best,1);
  if(!Number.isFinite(frameH)||frameH<12||cols<1)return{x:0,y:0,w,h};
  const frameW=w/cols,row=4;
  return{x:0,y:Math.min(h-frameH,row*frameH),w:frameW,h:frameH};
}
function assetRect(img,asset){
  const w=img?.naturalWidth||1,h=img?.naturalHeight||1;
  const rt=asset?.avatarRuntime||asset?.payload?.avatarRuntime||null;
  let cols=Number(asset?.columns||rt?.columns)||1,rows=Number(asset?.rows||rt?.rows)||1,row=0;
  if(cols>1||rows>1){if(rows===8)row=4;return{x:0,y:Math.min(h-h/rows,row*h/rows),w:w/cols,h:h/rows};}
  const t=textFor(asset),kind=asset?.contentKind;
  if((/sprite.?sheet|animation|\banim\b/.test(t)||['sprite','animation'].includes(kind))&&w>h*1.6){
    const common=[32,48,64,96,128,192,256];let best=null;
    for(const fw of common){if(w%fw)continue;for(const fh of common){if(h%fh)continue;const c=w/fw,r=h/fh;if(c<2||c>24||r<1||r>8)continue;const score=(c<=12?10:0)+(r===4||r===8?8:0)-Math.abs(fw/fh-1)*3;if(!best||score>best.score)best={x:0,y:r===8?4*fh:0,w:fw,h:fh,score};}}
    if(best)return best;
  }
  return{x:0,y:0,w,h};
}
function imageInStage(stage){return stage.querySelector(':scope > img')||stage.querySelector('img');}
function canvasFor(stage){let c=stage.querySelector(':scope > .kelo-tryon-canvas');if(c)return c;c=document.createElement('canvas');c.className='kelo-tryon-canvas';c.setAttribute('aria-label','Prueba del asset sobre personaje de Kelo World');stage.append(c);return c;}
function noteFor(stage){let n=stage.querySelector(':scope > .kelo-tryon-note');if(n)return n;n=document.createElement('div');n.className='kelo-tryon-note';stage.append(n);return n;}

export function installUniversalAvatarTryOn(){
  if(installed||typeof document==='undefined')return;
  const modal=document.getElementById('preview-modal'),stage=document.getElementById('preview-stage');if(!modal||!stage)return;
  installed=true;injectStyles();
  const sheet=modal.querySelector('.preview-sheet')||modal,bar=createBar(sheet);
  const state={asset:null,profile:null,active:false,base:null,overlay:null,drag:false,lastX:0,lastY:0,token:0};

  function eligible(asset){return !!asset&&!!asset.previewUrl&&!['sfx','music','ambience','ability','scene','prefab'].includes(asset.contentKind)&&asset.previewKind!=='video';}
  function publishProfile(){
    if(!state.asset||!state.profile){modal.__keloTryonProfile=null;return;}
    modal.__keloTryonProfile={assetId:String(state.asset.id||''),profile:{...state.profile}};
    modal.dispatchEvent(new CustomEvent('kelo:tryon-profile',{detail:modal.__keloTryonProfile}));
  }
  function syncBar(){
    bar.classList.toggle('on',eligible(state.asset));
    bar.querySelector('[data-tryon="toggle"]')?.classList.toggle('on',state.active);
    const slot=bar.querySelector('[data-tryon="slot"]');if(slot)slot.textContent=state.profile?.label||'◇ Accesorio';
    const layer=bar.querySelector('[data-tryon="layer"]');if(layer)layer.textContent=state.profile?.layer==='back'?'Detrás':'Frente';
  }
  function removeCanvas(){stage.classList.remove('kelo-tryon-active');stage.querySelector(':scope > .kelo-tryon-canvas')?.remove();stage.querySelector(':scope > .kelo-tryon-note')?.remove();}
  function resetState(){state.token++;state.active=false;state.base=null;state.overlay=null;state.drag=false;modal.__keloTryonProfile=null;removeCanvas();syncBar();}
  function drawLayer(ctx,img,rect,x,y,w,h,profile){
    ctx.save();ctx.globalAlpha=Math.max(.08,Math.min(1,profile.alpha||1));ctx.translate(x,y);ctx.rotate((profile.rotation||0)*Math.PI/180);ctx.imageSmoothingEnabled=false;ctx.drawImage(img,rect.x,rect.y,rect.w,rect.h,-w/2,-h/2,w,h);ctx.restore();
  }
  function render(){
    publishProfile();
    if(!state.active||!state.base||!state.overlay||!state.profile)return;
    const canvas=canvasFor(stage),cssW=360,cssH=420,dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);canvas.style.aspectRatio=`${cssW}/${cssH}`;
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cssW,cssH);
    const br=baseRect(state.base),baseH=245,baseW=baseH*(br.w/br.h),baseX=cssW/2,baseY=255;
    const p=state.profile,or=assetRect(state.overlay,state.asset),overlayH=baseH*p.scale,overlayW=overlayH*(or.w/or.h),ox=baseX+(p.x-.5)*baseH*1.35,oy=baseY-baseH/2+(p.y-.5)*baseH*1.35;
    ctx.save();ctx.globalAlpha=.15;ctx.fillStyle='#e8c96f';ctx.beginPath();ctx.ellipse(baseX,baseY+baseH*.49,baseW*.55,11,0,0,Math.PI*2);ctx.fill();ctx.restore();
    if(p.layer==='back')drawLayer(ctx,state.overlay,or,ox,oy,overlayW,overlayH,p);
    drawLayer(ctx,state.base,br,baseX,baseY,baseW,baseH,{alpha:1,rotation:0});
    if(p.layer!=='back')drawLayer(ctx,state.overlay,or,ox,oy,overlayW,overlayH,p);
    const note=noteFor(stage);note.textContent=`${p.label} · arrastra para ajustar · ${Math.round(p.scale*100)}% · ${p.layer==='back'?'detrás':'frente'}`;
  }
  async function activate(){
    if(!eligible(state.asset))return;
    if(state.active){state.active=false;removeCanvas();syncBar();return;}
    const source=imageInStage(stage);if(!source?.naturalWidth)return;
    state.active=true;state.overlay=source;state.profile=profileFor(state.asset);render();syncBar();
    const spriteToggle=document.querySelector('#kelo-sprite-preview-bar [data-sprite-tool="toggle"].on');spriteToggle?.click();
    stage.classList.add('kelo-tryon-active');const token=++state.token;
    try{state.base=await loadBase();if(token!==state.token||!state.active)return;render();}catch{state.active=false;removeCanvas();syncBar();}
  }
  function nudgeScale(mult){if(!state.profile)return;state.profile.scale=Math.max(.08,Math.min(2.4,state.profile.scale*mult));render();}
  function resetProfile(){if(!state.asset)return;state.profile=profileFor(state.asset);render();syncBar();}

  bar.addEventListener('click',event=>{
    const btn=event.target.closest('[data-tryon]');if(!btn)return;const act=btn.dataset.tryon;
    if(act==='toggle'){void activate();return;}if(!state.profile)return;
    if(act==='smaller')nudgeScale(.88);if(act==='bigger')nudgeScale(1.14);if(act==='rotate'){state.profile.rotation=(state.profile.rotation+15)%360;render();}
    if(act==='layer'){state.profile.layer=state.profile.layer==='back'?'front':'back';render();syncBar();}
    if(act==='reset')resetProfile();
    if(act==='slot'){
      const keys=Object.keys(SLOT_PRESETS),i=Math.max(0,keys.indexOf(state.profile.slot)),next=keys[(i+1)%keys.length],preset=SLOT_PRESETS[next];
      state.profile={slot:next,...preset};render();syncBar();
    }
  });

  stage.addEventListener('pointerdown',event=>{if(!state.active||event.target!==stage.querySelector('.kelo-tryon-canvas'))return;state.drag=true;state.lastX=event.clientX;state.lastY=event.clientY;event.target.setPointerCapture?.(event.pointerId);event.preventDefault();});
  stage.addEventListener('pointermove',event=>{if(!state.drag||!state.active||!state.profile)return;const dx=event.clientX-state.lastX,dy=event.clientY-state.lastY;state.lastX=event.clientX;state.lastY=event.clientY;state.profile.x=Math.max(-.2,Math.min(1.2,state.profile.x+dx/330));state.profile.y=Math.max(-.2,Math.min(1.2,state.profile.y+dy/330));render();event.preventDefault();});
  const stopDrag=()=>{state.drag=false;};stage.addEventListener('pointerup',stopDrag);stage.addEventListener('pointercancel',stopDrag);

  modal.addEventListener('kelo:preview-asset',event=>{resetState();state.asset=event.detail?.asset||null;state.profile=state.asset?profileFor(state.asset):null;publishProfile();syncBar();});
  new MutationObserver(()=>{if(modal.hidden){state.asset=null;state.profile=null;resetState();bar.classList.remove('on');}}).observe(modal,{attributes:true,attributeFilter:['hidden']});
  new MutationObserver(()=>{if(!state.active)return;const img=imageInStage(stage);if(img&&img!==state.overlay){state.overlay=img;render();}}).observe(stage,{childList:true,subtree:true});
  syncBar();
}

export const UNIVERSAL_AVATAR_TRYON=Object.freeze({install:installUniversalAvatarTryOn});