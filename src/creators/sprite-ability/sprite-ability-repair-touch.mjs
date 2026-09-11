/* KELO-INDEX
 * area: CREATORS / SPRITE ABILITY / REPAIR TOUCH
 * owner: mobile pointer gestures layered over Sprite Repair Studio
 * keys: TOUCH PINCH SCALE PAN ERASER MOBILE POINTER
 * purpose: keep Repair Studio canonical while making its existing move/scale/erase controls directly operable with fingers
 * does-not-own: frame pixels, repair persistence, spritesheet generation or combat data
 */
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const dist=(a,b)=>Math.hypot((b?.x||0)-(a?.x||0),(b?.y||0)-(a?.y||0));
const mid=(a,b)=>({x:((a?.x||0)+(b?.x||0))/2,y:((a?.y||0)+(b?.y||0))/2});

export function pinchScale(startScale,startDistance,currentDistance,{min=.25,max=2.5}={}){
  const base=clamp(startScale,min,max),from=Number(startDistance),to=Number(currentDistance);
  if(!(from>0)||!(to>0))return base;
  return clamp(base*(to/from),min,max);
}
export function pinchMidpoint(a,b){return mid(a,b);}

function activeTool(overlay){return overlay?.querySelector('.sr-mode button.on')?.textContent?.trim()||'';}
function scaleInputFor(overlay){
  for(const row of overlay?.querySelectorAll?.('.sr-range')||[])if(row.querySelector('span')?.textContent?.trim()==='ESCALA')return row.querySelector('input[type="range"]');
  return null;
}
function addHint(stage){
  const overlay=stage.closest('.sab-repair');if(!overlay||overlay.querySelector('.sr-touch-help'))return;
  const card=overlay.querySelector('.sr-side .sr-card');if(!card)return;
  const p=overlay.ownerDocument.createElement('p');p.className='sr-help sr-touch-help';p.textContent='☝️ 1 dedo: mover · 🤏 2 dedos: escalar · BORRAR: pinta con el dedo';card.append(p);
}

function attachStage(stage,root){
  if(stage.dataset.srTouchGestures==='1')return()=>{};
  stage.dataset.srTouchGestures='1';addHint(stage);
  const pointers=new Map(),blocked=new Set();let pinch=null;
  const point=e=>({x:e.clientX,y:e.clientY});
  const stop=e=>{e.preventDefault?.();e.stopImmediatePropagation?.();};
  const clearPinch=()=>{if(!pinch)return;try{stage.onpointerup?.({pointerId:pinch.primaryId,preventDefault(){}});}catch{}pinch=null;delete stage.dataset.srGesture;};
  const down=e=>{
    if(e.pointerType!=='touch')return;
    pointers.set(e.pointerId,point(e));
    if(pointers.size<2)return;
    if(!activeTool(stage.closest('.sab-repair')).includes('MOVER')){blocked.add(e.pointerId);stop(e);return;}
    if(pinch){stop(e);return;}
    const entries=[...pointers.entries()].slice(0,2),scaleInput=scaleInputFor(stage.closest('.sab-repair'));
    if(!scaleInput){blocked.add(e.pointerId);stop(e);return;}
    const [first,second]=entries,startDistance=dist(first[1],second[1]);
    if(!(startDistance>0)){blocked.add(e.pointerId);stop(e);return;}
    pinch={ids:[first[0],second[0]],primaryId:first[0],primaryStart:{...first[1]},startDistance,startMid:mid(first[1],second[1]),startScale:Number(scaleInput.value)||1,scaleInput};
    stage.dataset.srGesture='pinch';stop(e);
  };
  const move=e=>{
    if(e.pointerType!=='touch')return;
    if(blocked.has(e.pointerId)){stop(e);return;}
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,point(e));
    if(!pinch||!pinch.ids.includes(e.pointerId))return;
    const a=pointers.get(pinch.ids[0]),b=pointers.get(pinch.ids[1]);if(!a||!b)return;
    stop(e);
    const nextScale=pinchScale(pinch.startScale,pinch.startDistance,dist(a,b),{min:Number(pinch.scaleInput.min)||.25,max:Number(pinch.scaleInput.max)||2.5});
    if(Math.abs((Number(pinch.scaleInput.value)||0)-nextScale)>.0005){pinch.scaleInput.value=String(nextScale);pinch.scaleInput.dispatchEvent(new root.Event('input',{bubbles:true}));}
    const currentMid=mid(a,b),dx=currentMid.x-pinch.startMid.x,dy=currentMid.y-pinch.startMid.y;
    try{stage.onpointermove?.({pointerId:pinch.primaryId,clientX:pinch.primaryStart.x+dx,clientY:pinch.primaryStart.y+dy,preventDefault(){}});}catch{}
  };
  const up=e=>{
    if(e.pointerType!=='touch')return;
    const wasBlocked=blocked.delete(e.pointerId);
    const wasPinch=Boolean(pinch?.ids.includes(e.pointerId));
    if(wasBlocked)stop(e);
    if(wasPinch){stop(e);clearPinch();}
    pointers.delete(e.pointerId);
  };
  stage.addEventListener('pointerdown',down,true);stage.addEventListener('pointermove',move,true);stage.addEventListener('pointerup',up,true);stage.addEventListener('pointercancel',up,true);
  return()=>{stage.removeEventListener('pointerdown',down,true);stage.removeEventListener('pointermove',move,true);stage.removeEventListener('pointerup',up,true);stage.removeEventListener('pointercancel',up,true);pointers.clear();blocked.clear();clearPinch();delete stage.dataset.srTouchGestures;};
}

export function installSpriteAbilityRepairTouch({root=globalThis}={}){
  if(!root?.document)return()=>{};
  const attached=new Map();let disposed=false;
  const scan=()=>{
    if(disposed)return;
    for(const stage of root.document.querySelectorAll('.sab-repair .sr-stage'))if(!attached.has(stage))attached.set(stage,attachStage(stage,root));
    for(const [stage,dispose] of [...attached])if(!stage.isConnected){try{dispose();}catch{}attached.delete(stage);}
  };
  const observer=new root.MutationObserver(scan);observer.observe(root.document.documentElement,{subtree:true,childList:true});scan();
  return()=>{disposed=true;observer.disconnect();for(const dispose of attached.values())try{dispose();}catch{}attached.clear();};
}
