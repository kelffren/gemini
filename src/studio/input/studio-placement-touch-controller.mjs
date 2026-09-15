/* KELO-INDEX
 * area: STUDIO / INPUT / PLACEMENT TOUCH
 * owns: mobile precision controls + lightweight on-map ghost for an active placement preview
 * does-not-own: document mutation, pointer listeners, authority transport or placement math
 * public-api: createStudioPlacementTouchController()
 * online: preview movement/rendering is local; PLACE delegates to placement.commit() -> Kernel CommandBus
 */

const MOBILE_MAX=760;
const HOLD_DELAY_MS=320;
const HOLD_REPEAT_MS=90;

export function createStudioPlacementTouchController({root=globalThis,placement}={}){
  const document=root?.document;
  if(!document||!placement?.onPreview||!placement?.move||!placement?.commit)return Object.freeze({destroy(){}});
  let destroyed=false,style=null,pad=null,ghost=null,preview=null,mode='snap',busy=false;
  let holdTimeout=null,holdInterval=null,holdDir='',suppressDirectionClick=false;
  let lastPreviewId='',ghostAssetId='',ghostRenderToken=0,centering=false;
  const imageCache=new Map(),ownedImageKeys=new Set();

  const shell=()=>document.getElementById('kelo-studio-live');
  const isMobile=()=>Number(root.innerWidth||9999)<=MOBILE_MAX;
  const snapStep=()=>{
    const live=Number(shell()?.querySelector?.('[data-ext="snap"]')?.value);
    return Number.isFinite(live)&&live>0?live:32;
  };
  const step=()=>mode==='fine'?1:mode==='coarse'?snapStep()*4:snapStep();
  const pulse=()=>{try{root.navigator?.vibrate?.(8);}catch{}};
  const later=(fn,ms)=>root.setTimeout?.(fn,ms)??setTimeout(fn,ms);
  const every=(fn,ms)=>root.setInterval?.(fn,ms)??setInterval(fn,ms);
  const clearLater=id=>{if(id==null)return;(root.clearTimeout||clearTimeout)(id);};
  const clearEvery=id=>{if(id==null)return;(root.clearInterval||clearInterval)(id);};

  function cameraState(){
    try{
      const s=root.KeloCamera?.snapshot?.();
      if(s)return{x:Number(s.x)||0,y:Number(s.y)||0,w:Number(s.screenW)||root.innerWidth||1,h:Number(s.screenH)||root.innerHeight||1,z:Math.max(.05,Number(s.effectiveZoom)||1)};
    }catch{}
    const c=root.camera||{x:0,y:0};
    return{x:Number(c.x)||0,y:Number(c.y)||0,w:Number(root.screenW)||root.innerWidth||1,h:Number(root.screenH)||root.innerHeight||1,z:Math.max(.05,Number(root.CONFIG?.zoom)||1)};
  }

  function ensure(){
    if(destroyed||!isMobile())return null;
    const host=shell();if(!host)return null;
    if(!style){
      style=document.createElement('style');style.dataset.keloPlacementTouch='1';style.textContent=`
      #kelo-studio-live .ks-placement-touch{display:none}
      #kelo-studio-live .ks-placement-ghost{display:none;position:absolute;z-index:9;pointer-events:none;transform-origin:center center;opacity:.82;border:1.5px dashed rgba(150,244,184,.95);border-radius:5px;box-shadow:0 0 0 1px rgba(5,14,16,.35),0 0 18px rgba(126,235,169,.28);image-rendering:pixelated;will-change:left,top,width,height,transform}
      #kelo-studio-live .ks-placement-ghost.on{display:block}
      @media(max-width:760px){
        #kelo-studio-live .ks-placement-touch{position:absolute;right:8px;bottom:calc(max(8px,env(safe-area-inset-bottom)) + 126px);z-index:11;pointer-events:auto;display:grid;grid-template-columns:46px 46px 46px;grid-template-rows:46px 46px 46px auto;gap:4px;padding:7px;border:1px solid rgba(231,197,106,.46);border-radius:16px;background:rgba(5,14,16,.965);box-shadow:0 14px 38px rgba(0,0,0,.52);backdrop-filter:blur(14px)}
        #kelo-studio-live .ks-placement-touch[hidden]{display:none}
        #kelo-studio-live .ks-placement-touch button{min-width:46px;min-height:46px;border:1px solid rgba(231,197,106,.26);border-radius:12px;background:#102022;color:#fff0b2;font-size:18px;font-weight:900;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
        #kelo-studio-live .ks-placement-touch button:active{transform:scale(.96);border-color:#e7c56a}
        #kelo-studio-live .ks-placement-touch .place{grid-column:1/4;min-height:48px;font-size:8px;letter-spacing:.08em;background:linear-gradient(180deg,#3e6b53,#2a4f40);border-color:#e7c56a}
        #kelo-studio-live .ks-placement-touch .cancel{color:#ffd4cf;border-color:rgba(255,122,112,.45)}
        #kelo-studio-live .ks-placement-touch .step{font-size:7px;line-height:1.2}
      }`;
      document.head.appendChild(style);
    }
    if(!ghost?.isConnected){
      ghost=document.createElement('canvas');ghost.className='ks-placement-ghost';ghost.setAttribute('aria-hidden','true');host.appendChild(ghost);
    }
    if(!pad?.isConnected){
      pad=document.createElement('div');pad.className='ks-placement-touch';pad.hidden=true;pad.setAttribute('aria-label','Ajuste preciso de colocación');
      pad.innerHTML='<span></span><button data-place-dir="up" aria-label="Mover arriba">↑</button><button data-place-action="rotate" aria-label="Rotar preview">⟳</button><button data-place-dir="left" aria-label="Mover izquierda">←</button><button class="step" data-place-action="step" aria-label="Cambiar precisión">SNAP</button><button data-place-dir="right" aria-label="Mover derecha">→</button><button class="cancel" data-place-action="cancel" aria-label="Cancelar colocación">×</button><button data-place-dir="down" aria-label="Mover abajo">↓</button><span></span><button class="place" data-place-action="commit">COLOCAR AQUÍ</button>';
      pad.addEventListener('click',onClick);
      pad.addEventListener('pointerdown',onPointerDown);
      pad.addEventListener('pointerup',stopHold);
      pad.addEventListener('pointercancel',stopHold);
      pad.addEventListener('lostpointercapture',stopHold);
      host.appendChild(pad);
    }
    return pad;
  }

  function drawGhostFallback(asset){
    if(!ghost)return;
    const w=Math.max(24,Math.round(Number(asset?.width||asset?.bounds?.w||preview?.bounds?.w)||48));
    const h=Math.max(24,Math.round(Number(asset?.height||asset?.bounds?.h||preview?.bounds?.h)||48));
    ghost.width=w;ghost.height=h;
    const ctx=ghost.getContext('2d');if(!ctx)return;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(27,62,49,.68)';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='rgba(231,197,106,.72)';ctx.strokeRect(.5,.5,w-1,h-1);
    const label=String(asset?.label||asset?.id||preview?.prefabId||'PREVIEW');
    const glyph=/tree|arbol|oak|pine|willow|birch|flor/i.test(label)?'🌳':(label.slice(0,2).toUpperCase()||'•');
    ctx.fillStyle='#eff8d1';ctx.font=`bold ${Math.max(10,Math.min(24,Math.floor(Math.min(w,h)*.34)))}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(glyph,w/2,h/2);
  }

  async function getImage(key){
    key=String(key||'');if(!key||!root.KELO_ATLAS_CONTRACT?.acquire)return null;
    if(imageCache.has(key))return imageCache.get(key);
    const p=Promise.resolve().then(()=>root.KELO_ATLAS_CONTRACT.acquire(key)).then(img=>{if(img)ownedImageKeys.add(key);return img;}).catch(()=>null);
    imageCache.set(key,p);return p;
  }

  async function renderGhostAsset(assetId){
    if(!ghost||!assetId)return;
    const token=++ghostRenderToken;
    const asset=root.KELO_PROPERTY_CATALOG?.get?.(assetId)||null;
    drawGhostFallback(asset||{id:assetId,width:preview?.bounds?.w,height:preview?.bounds?.h});
    const parts=Array.isArray(asset?.parts)?asset.parts:[];
    if(!parts.length)return;
    const keys=[...new Set(parts.map(p=>p?.assetKey).filter(Boolean))];
    const imgs=new Map();
    for(const key of keys){
      if(destroyed||token!==ghostRenderToken)return;
      const img=await getImage(key);if(img)imgs.set(String(key),img);
      await new Promise(resolve=>later(resolve,0));
    }
    if(destroyed||token!==ghostRenderToken||!ghost)return;
    const w=Math.max(1,Math.round(Number(asset.width||asset.bounds?.w)||preview?.bounds?.w||32));
    const h=Math.max(1,Math.round(Number(asset.height||asset.bounds?.h)||preview?.bounds?.h||32));
    ghost.width=w;ghost.height=h;
    const ctx=ghost.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;
    let drew=false;
    for(const part of parts){
      const img=imgs.get(String(part?.assetKey||''));if(!img)continue;
      const s=part.source||{},o=part.offset||{},z=part.size||{};
      const sw=Math.max(1,Number(s.w)||w),sh=Math.max(1,Number(s.h)||h),dw=Math.max(1,Number(z.w)||sw),dh=Math.max(1,Number(z.h)||sh);
      ctx.save();ctx.globalAlpha=Number.isFinite(Number(part.opacity))?Math.max(0,Math.min(1,Number(part.opacity))):1;
      try{ctx.drawImage(img,Number(s.x)||0,Number(s.y)||0,sw,sh,Number(o.x)||0,Number(o.y)||0,dw,dh);drew=true;}catch{}
      ctx.restore();
    }
    if(!drew)drawGhostFallback(asset);
  }

  function syncGhost(){
    if(!isMobile()){ghost?.classList.remove('on');return;}
    ensure();if(!ghost)return;
    if(!preview){ghost.classList.remove('on');ghostAssetId='';ghostRenderToken++;return;}
    const c=cameraState(),w=Math.max(1,Number(preview.bounds?.w)||32),h=Math.max(1,Number(preview.bounds?.h)||32),x=Number(preview.transform?.x)||0,y=Number(preview.transform?.y)||0;
    ghost.style.left=`${c.w/2+(x-c.x)*c.z}px`;ghost.style.top=`${c.h/2+(y-c.y)*c.z}px`;
    ghost.style.width=`${Math.max(8,w*c.z)}px`;ghost.style.height=`${Math.max(8,h*c.z)}px`;
    ghost.style.transform=`rotate(${Number(preview.transform?.rotation)||0}deg)`;ghost.classList.add('on');
    const id=String(preview.prefabId||'');
    if(id&&id!==ghostAssetId){ghostAssetId=id;void renderGhostAsset(id);}
  }

  function maybeCenterNewPreview(next){
    if(!next||!isMobile()||busy||centering)return;
    const id=String(next.id||'');if(!id||id===lastPreviewId)return;lastPreviewId=id;
    const x=Number(next.transform?.x)||0,y=Number(next.transform?.y)||0;if(x||y)return;
    const c=cameraState(),w=Math.max(1,Number(next.bounds?.w)||32),h=Math.max(1,Number(next.bounds?.h)||32);
    centering=true;try{placement.move(c.x-w/2,c.y-h/2,{snap:snapStep()});}finally{centering=false;}
  }

  function sync(){
    const el=ensure();if(!el){ghost?.classList.remove('on');return;}
    el.hidden=!preview;
    const label=el.querySelector('[data-place-action="step"]');if(label)label.textContent=mode==='fine'?'1 PX':mode==='coarse'?'4×':'SNAP';
    syncGhost();
  }

  function move(dx,dy){
    if(!preview)return false;
    const s=step(),x=(Number(preview.transform?.x)||0)+(Number(dx)||0)*s,y=(Number(preview.transform?.y)||0)+(Number(dy)||0)*s;
    placement.move(x,y,{snap:1});pulse();return true;
  }

  function moveDirection(dir){
    const map={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
    return map[dir]?move(...map[dir]):false;
  }

  function stopHold(){
    clearLater(holdTimeout);clearEvery(holdInterval);
    holdTimeout=holdInterval=null;holdDir='';
  }

  function onPointerDown(event){
    const button=event.target?.closest?.('[data-place-dir]');
    const dir=button?.dataset.placeDir;
    if(!dir||!preview||event.button>0)return;
    stopHold();
    holdDir=dir;suppressDirectionClick=true;
    event.preventDefault?.();
    try{button.setPointerCapture?.(event.pointerId);}catch{}
    moveDirection(dir);
    holdTimeout=later(()=>{
      holdTimeout=null;
      if(!holdDir||destroyed||!preview)return;
      holdInterval=every(()=>{if(holdDir&&preview)moveDirection(holdDir);},HOLD_REPEAT_MS);
    },HOLD_DELAY_MS);
  }

  async function commit(){
    if(!preview||busy)return false;busy=true;
    const current={
      prefabId:String(preview.prefabId||''),
      x:Number(preview.transform?.x)||0,
      y:Number(preview.transform?.y)||0,
      rotation:Number(preview.transform?.rotation)||0,
      components:{...(preview.components||{})}
    };
    try{
      await placement.commit();
      if(!destroyed&&current.prefabId&&placement.start){
        placement.start(current.prefabId,{rotation:current.rotation,overrides:{components:current.components}});
        placement.move(current.x,current.y,{snap:1});
      }
      pulse();return true;
    }finally{busy=false;}
  }
  function cycleStep(){mode=mode==='snap'?'fine':mode==='fine'?'coarse':'snap';sync();pulse();return mode;}
  function rotate(){if(!preview)return false;placement.rotate?.(90);pulse();return true;}
  function cancel(){if(!preview)return false;stopHold();placement.cancel?.();pulse();return true;}

  function onClick(event){
    const dir=event.target?.closest?.('[data-place-dir]')?.dataset.placeDir;
    if(dir){
      if(suppressDirectionClick){suppressDirectionClick=false;return;}
      moveDirection(dir);return;
    }
    const action=event.target?.closest?.('[data-place-action]')?.dataset.placeAction;
    if(action==='step')cycleStep();else if(action==='rotate')rotate();else if(action==='cancel')cancel();else if(action==='commit')void commit().catch(error=>console.warn('[Kelo Studio] placement touch commit failed',error));
  }

  const unsubscribe=placement.onPreview(next=>{preview=next;if(!next){stopHold();lastPreviewId='';}else maybeCenterNewPreview(next);sync();});
  const onResize=()=>{if(!isMobile())stopHold();sync();};root.addEventListener?.('resize',onResize,{passive:true});
  preview=placement.getPreview?.()||null;if(preview)maybeCenterNewPreview(preview);sync();

  return Object.freeze({
    version:'studio-placement-touch-v1.3.0-asset-ghost',move,commit,cancel,rotate,cycleStep,
    get mode(){return mode;},get active(){return !!preview;},get holding(){return holdDir||'';},
    destroy(){if(destroyed)return;destroyed=true;ghostRenderToken++;stopHold();unsubscribe?.();root.removeEventListener?.('resize',onResize);pad?.removeEventListener?.('click',onClick);pad?.removeEventListener?.('pointerdown',onPointerDown);pad?.removeEventListener?.('pointerup',stopHold);pad?.removeEventListener?.('pointercancel',stopHold);pad?.removeEventListener?.('lostpointercapture',stopHold);pad?.remove();ghost?.remove();style?.remove();for(const key of ownedImageKeys)try{root.KELO_ATLAS_CONTRACT?.release?.(key);}catch{}ownedImageKeys.clear();imageCache.clear();pad=ghost=style=null;}
  });
}
