/* KELO-INDEX
 * area: CREATORS / ABILITY TOUCH TUNER
 * owner: Ability Creator touch-first tuning surface
 * owns: direct arena handles for reach/size + timing sliders
 * does-not-own: ability schema, combat authority, persistence, runtime delivery or FX rendering
 * reuse: Ability Studio kernel/history + autosave + existing safe preview arena
 */
import { createPatchAbilityDefinitionCommand } from './ability-commands.mjs';
import { abilityTimelineDuration } from './ability-document.mjs';

const STYLE_ID='kelo-ability-touch-tuner-v2-style';
const installed=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const round=(v,step=1)=>Math.round((Number(v)||0)/step)*step;
const fmt=(value,step)=>step<1?Number(value).toFixed(step<=.01?2:1):String(Math.round(Number(value)||0));
const lerp=(a,b,t)=>a+(b-a)*clamp(t,0,1);
const inv=(value,min,max)=>max<=min?0:clamp((value-min)/(max-min),0,1);

function ensureStyle(doc){
  if(doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=`
  .katune{position:absolute;z-index:80;left:10px;right:10px;bottom:10px;pointer-events:auto;font-family:Inter,ui-sans-serif,system-ui;color:#eef2ed;filter:drop-shadow(0 12px 28px rgba(0,0,0,.42))}
  .katune *{box-sizing:border-box}.katune-bar{height:38px;display:flex;align-items:center;gap:8px;padding:6px 7px 6px 10px;border:1px solid rgba(231,197,106,.28);border-radius:13px;background:rgba(7,12,14,.94);backdrop-filter:blur(12px)}
  .katune-title{font-size:8px;font-weight:950;letter-spacing:.11em;color:#efd98f;white-space:nowrap}.katune-sub{font-size:7px;color:#7f9389;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.katune-toggle{margin-left:auto;min-width:32px;height:26px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#121820;color:#e9e5dc;font:900 11px system-ui;cursor:pointer}
  .katune-panel{display:none;margin-top:6px;padding:7px;border:1px solid rgba(231,197,106,.2);border-radius:14px;background:rgba(7,12,14,.95);backdrop-filter:blur(14px)}.katune.open .katune-panel{display:block}
  .katune-strip{display:flex;gap:7px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;padding:1px 1px 4px;scrollbar-width:none}.katune-strip::-webkit-scrollbar{display:none}
  .katune-card{flex:0 0 152px;scroll-snap-align:start;padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(255,255,255,.035)}
  .katune-card-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px}.katune-card b{font-size:7px;letter-spacing:.08em;color:#aebdb5}.katune-value{min-width:42px;text-align:right;font-size:9px;font-weight:950;color:#f4dda0}
  .katune input[type=range]{width:100%;height:28px;margin:0;accent-color:#e7c56a;touch-action:none;cursor:ew-resize}.katune-card small{display:block;margin-top:2px;color:#60746a;font-size:6px;line-height:1.25}
  .katune-live{display:flex;justify-content:space-between;gap:8px;padding:5px 3px 0;color:#6f8279;font-size:6px}.katune-live strong{color:#9ecab0}
  .katune-geo{position:absolute;inset:0;z-index:72;pointer-events:none;font-family:Inter,ui-sans-serif,system-ui}.katune-geo-line,.katune-geo-size{position:absolute;pointer-events:none;color:#e7c56a}.katune-geo-line{height:2px;background:linear-gradient(90deg,rgba(231,197,106,.12),rgba(231,197,106,.88));box-shadow:0 0 12px rgba(231,197,106,.38);transform-origin:0 50%}.katune-geo-size.radius{border:2px dashed rgba(127,215,255,.72);border-radius:50%;background:rgba(127,215,255,.045);box-shadow:0 0 18px rgba(127,215,255,.12)}.katune-geo-size.width{height:3px;background:rgba(127,215,255,.7);box-shadow:0 0 12px rgba(127,215,255,.25)}
  .katune-handle{position:absolute;z-index:74;width:42px;height:42px;margin:-21px 0 0 -21px;border:2px solid #f2d47f;border-radius:50%;background:radial-gradient(circle,#f6e3a9 0 18%,rgba(16,20,22,.96) 20% 100%);box-shadow:0 0 0 5px rgba(231,197,106,.1),0 5px 18px rgba(0,0,0,.45);pointer-events:auto;touch-action:none;cursor:ew-resize;display:grid;place-items:center;color:#fff;font:950 7px/1 system-ui;user-select:none;-webkit-user-select:none}.katune-handle.size{border-color:#7fd7ff;box-shadow:0 0 0 5px rgba(127,215,255,.1),0 5px 18px rgba(0,0,0,.45)}.katune-handle:active{transform:scale(1.08)}.katune-bubble{position:absolute;z-index:75;transform:translate(-50%,-100%);margin-top:-25px;padding:5px 7px;border-radius:999px;background:rgba(7,12,14,.96);border:1px solid rgba(255,255,255,.12);color:#f3dfa6;font:950 8px/1 system-ui;white-space:nowrap;pointer-events:none}.katune-bubble.size{color:#a8e7ff}
  @media(max-width:760px){.katune{left:7px;right:7px;bottom:max(7px,env(safe-area-inset-bottom))}.katune-bar{height:42px;border-radius:14px}.katune-title{font-size:9px}.katune-sub{font-size:7px}.katune-panel{padding:7px 6px}.katune-card{flex-basis:148px;padding:9px 8px}.katune input[type=range]{height:36px}.katune-card b{font-size:8px}.katune-value{font-size:10px}.katune-handle{width:48px;height:48px;margin:-24px 0 0 -24px;font-size:8px}.katune-bubble{font-size:9px;margin-top:-28px}}
  `;doc.head.append(style);
}

function actionTracks(document){
  const d=document.definition,a=d.action,w=a.windup,activeStart=w,recoveryStart=w+a.active,total=abilityTimelineDuration(document);
  return [{id:'phases',label:'ACTION',items:[{id:'windup',label:'WINDUP',start:0,end:w},{id:'active',label:'ACTIVE',start:activeStart,end:recoveryStart},{id:'recovery',label:'RECOVERY',start:recoveryStart,end:total}]},{id:'effects',label:'EFFECTS',items:(d.effects||[]).map((effect,index)=>({id:effect._id,label:`${index+1} · ${effect.type}`,start:activeStart,end:Math.max(activeStart+.01,recoveryStart)}))}];
}
function reachBinding(d){
  const type=d.delivery.type;
  if(type==='dash'||type==='blink')return{label:'REACH',detail:'movement distance',value:d.delivery.distance,min:20,max:700,step:5,patch:v=>({delivery:{distance:v},telegraph:{range:v}})};
  if(d.targeting.type!=='self')return{label:'REACH',detail:type==='projectile'?'target + projectile distance':'targeting range',value:d.targeting.range,min:40,max:1200,step:10,patch:v=>type==='projectile'?({targeting:{range:v},telegraph:{range:v},delivery:{maxDistance:v}}):({targeting:{range:v},telegraph:{range:v}})};
  return{label:'REACH',detail:'telegraph reach',value:d.telegraph.range,min:20,max:900,step:10,patch:v=>({telegraph:{range:v}})};
}
function sizeBinding(d){
  const type=d.delivery.type,shape=d.telegraph.shape;
  if(type==='trap')return{label:'RADIUS',detail:'trap trigger',value:d.delivery.activationRadius,min:8,max:260,step:2,patch:v=>({delivery:{activationRadius:v},telegraph:{radius:v}})};
  if(['self_aoe','persistent_area','aura'].includes(type))return{label:'RADIUS',detail:'effect area',value:d.delivery.radius,min:8,max:320,step:2,patch:v=>({delivery:{radius:v},telegraph:{radius:v}})};
  if(type==='projectile')return{label:'RADIUS',detail:'projectile hit size',value:d.delivery.radius,min:2,max:96,step:1,patch:v=>({delivery:{radius:v}})};
  if(type==='wall')return{label:'WIDTH',detail:'wall size',value:d.delivery.width,min:30,max:360,step:5,patch:v=>({delivery:{width:v},telegraph:{width:v}})};
  if(shape==='line'||shape==='dash'||shape==='wall')return{label:'WIDTH',detail:'telegraph width',value:d.telegraph.width,min:4,max:120,step:2,patch:v=>({telegraph:{width:v}})};
  return{label:'RADIUS',detail:'telegraph area',value:d.telegraph.radius,min:8,max:320,step:2,patch:v=>({telegraph:{radius:v}})};
}
function timingBindings(d){return[
  {label:'WINDUP',detail:'response before cast',value:d.action.windup,min:0,max:1.2,step:.01,patch:v=>({action:{windup:v}})},
  {label:'ACTIVE',detail:'active window',value:d.action.active,min:.01,max:1.2,step:.01,patch:v=>({action:{active:v}})},
  {label:'RECOVERY',detail:'lockout after cast',value:d.action.recovery,min:0,max:1.8,step:.01,patch:v=>({action:{recovery:v}})}
];}
function syncKnownInspectorFields(shell,document){
  const d=document.definition,map=new Map([['Target Range',d.targeting.range],['Telegraph Range',d.telegraph.range],['Telegraph Radius',d.telegraph.radius],['Telegraph Width',d.telegraph.width],['Windup',d.action.windup],['Active',d.action.active],['Recovery',d.action.recovery],['Max Distance',d.delivery.maxDistance],['Distance',d.delivery.distance],['Projectile Radius',d.delivery.radius],['AOE Radius',d.delivery.radius],['Area Radius',d.delivery.radius],['Trigger Radius',d.delivery.activationRadius],['Wall Width',d.delivery.width]]);
  for(const row of shell.left?.querySelectorAll?.('.ksw-field')||[]){const label=row.querySelector('label')?.textContent,input=row.querySelector('input');if(input&&map.has(label))input.value=String(map.get(label));}
}

export function installAbilityTouchTuner(session,{root=globalThis}={}){
  if(!session?.kernel?.execute||!session?.shell?.viewport||!session?.autosave)return null;if(installed.has(session))return installed.get(session);
  const host=session.shell.viewport,doc=host.ownerDocument;ensureStyle(doc);
  const node=doc.createElement('section');node.className='katune';node.setAttribute('aria-label','Ability touch tune');node.innerHTML='<div class="katune-bar"><div class="katune-title">✦ TOUCH TUNE</div><div class="katune-sub">drag arena handles</div><button class="katune-toggle" type="button" aria-label="Toggle timing controls">⌃</button></div><div class="katune-panel"><div class="katune-strip"></div><div class="katune-live"><span>WINDUP · ACTIVE · RECOVERY</span><strong>geometry lives on arena</strong></div></div>';
  const geo=doc.createElement('div');geo.className='katune-geo';geo.innerHTML='<div class="katune-geo-line"></div><div class="katune-geo-size"></div><div class="katune-bubble reach"></div><div class="katune-bubble size"></div><button class="katune-handle reach" type="button">↔</button><button class="katune-handle size" type="button">↔</button>';
  host.append(geo,node);const strip=node.querySelector('.katune-strip'),toggle=node.querySelector('.katune-toggle'),reachLine=geo.querySelector('.katune-geo-line'),sizeShape=geo.querySelector('.katune-geo-size'),reachHandle=geo.querySelector('.katune-handle.reach'),sizeHandle=geo.querySelector('.katune-handle.size'),reachBubble=geo.querySelector('.katune-bubble.reach'),sizeBubble=geo.querySelector('.katune-bubble.size');
  const mobile=root.matchMedia?.('(max-width:760px)')?.matches===true;let expanded=mobile,commitQueue=Promise.resolve(),destroyed=false,drag=null;
  const setOpen=value=>{expanded=!!value;node.classList.toggle('open',expanded);toggle.textContent=expanded?'⌄':'⌃';toggle.setAttribute('aria-expanded',String(expanded));};setOpen(expanded);toggle.onclick=e=>{e.stopPropagation();setOpen(!expanded);};

  function arenaPoints(){
    const hb=host.getBoundingClientRect(),player=host.querySelector('.kat-player')?.getBoundingClientRect(),dummy=host.querySelector('.kat-dummy')?.getBoundingClientRect(),fallbackY=hb.height*(mobile?.61:.64);
    const point=(rect,x)=>rect?{x:rect.left-hb.left+rect.width/2,y:rect.top-hb.top+rect.height}:{x:hb.width*x,y:fallbackY};
    return{player:point(player,mobile?.22:.27),dummy:point(dummy,mobile?.78:.73),width:hb.width,height:hb.height};
  }
  function sizeCenter(d,p){return(d.targeting.type==='self'||d.delivery.type==='self_aoe'||d.delivery.type==='aura')?p.player:p.dummy;}
  function visualReach(binding,p){const maxPx=Math.max(70,p.width-p.player.x-28),minPx=Math.min(52,maxPx*.34);return lerp(minPx,maxPx,inv(binding.value,binding.min,binding.max));}
  function visualSize(binding,p){const maxPx=Math.max(48,Math.min(150,p.width*.31,p.height*.27)),minPx=Math.min(22,maxPx*.4);return lerp(minPx,maxPx,inv(binding.value,binding.min,binding.max));}
  function drawGeometry(reachValue=null,sizeValue=null){
    if(destroyed)return;const d=session.kernel.document.definition,p=arenaPoints(),rb=reachBinding(d),sb=sizeBinding(d);if(reachValue!=null)rb.value=reachValue;if(sizeValue!=null)sb.value=sizeValue;
    const reachPx=visualReach(rb,p),reachX=clamp(p.player.x+reachPx,24,p.width-24),reachY=p.player.y-24;Object.assign(reachLine.style,{left:`${p.player.x}px`,top:`${reachY}px`,width:`${Math.max(1,reachX-p.player.x)}px`});Object.assign(reachHandle.style,{left:`${reachX}px`,top:`${reachY}px`});Object.assign(reachBubble.style,{left:`${reachX}px`,top:`${reachY}px`});reachBubble.textContent=`REACH ${fmt(rb.value,rb.step)}`;
    const center=sizeCenter(d,p),sizePx=visualSize(sb,p),sizeX=clamp(center.x+sizePx,24,p.width-24),sizeY=center.y-24;sizeShape.className=`katune-geo-size ${sb.label==='WIDTH'?'width':'radius'}`;if(sb.label==='WIDTH'){Object.assign(sizeShape.style,{left:`${center.x-sizePx}px`,top:`${sizeY}px`,width:`${sizePx*2}px`,height:'3px'});}else{Object.assign(sizeShape.style,{left:`${center.x-sizePx}px`,top:`${sizeY-sizePx}px`,width:`${sizePx*2}px`,height:`${sizePx*2}px`});}Object.assign(sizeHandle.style,{left:`${sizeX}px`,top:`${sizeY}px`});Object.assign(sizeBubble.style,{left:`${sizeX}px`,top:`${sizeY}px`});sizeBubble.textContent=`${sb.label} ${fmt(sb.value,sb.step)}`;
  }
  function refresh(){
    if(destroyed||!strip)return;strip.replaceChildren();for(const binding of timingBindings(session.kernel.document.definition)){const card=doc.createElement('label');card.className='katune-card';const head=doc.createElement('div');head.className='katune-card-head';const name=doc.createElement('b');name.textContent=binding.label;const value=doc.createElement('span');value.className='katune-value';value.textContent=fmt(binding.value,binding.step);head.append(name,value);const slider=doc.createElement('input');slider.type='range';slider.min=String(binding.min);slider.max=String(binding.max);slider.step=String(binding.step);slider.value=String(clamp(binding.value,binding.min,binding.max));slider.setAttribute('aria-label',binding.label);slider.onpointerdown=e=>e.stopPropagation();slider.oninput=()=>{value.textContent=fmt(slider.value,binding.step);};slider.onchange=()=>commit(binding,slider.value);const detail=doc.createElement('small');detail.textContent=binding.detail;card.append(head,slider,detail);strip.append(card);}drawGeometry();
  }
  async function commit(binding,raw){
    const value=round(clamp(raw,binding.min,binding.max),binding.step);commitQueue=commitQueue.catch(()=>{}).then(async()=>{await session.kernel.execute(createPatchAbilityDefinitionCommand(binding.patch(value)));session.autosave.markDirty();syncKnownInspectorFields(session.shell,session.kernel.document);const duration=abilityTimelineDuration(session.kernel.document);session.timeline?.set?.({duration,tracks:actionTracks(session.kernel.document),playhead:Math.min(session.timeline.playhead||0,duration),snapStep:1/60});try{await session.preview?.play?.(session.kernel.document);}catch(error){console.warn('[Ability Touch Tune] preview replay unavailable',error);}refresh();});try{await commitQueue;}catch(error){console.warn('[Ability Touch Tune] commit failed',error);}
  }
  function beginDrag(kind,event){
    event.preventDefault();event.stopPropagation();const binding=kind==='reach'?reachBinding(session.kernel.document.definition):sizeBinding(session.kernel.document.definition),p=arenaPoints(),center=kind==='reach'?p.player:sizeCenter(session.kernel.document.definition,p),maxPx=kind==='reach'?Math.max(70,p.width-p.player.x-28):Math.max(48,Math.min(150,p.width*.31,p.height*.27)),minPx=kind==='reach'?Math.min(52,maxPx*.34):Math.min(22,maxPx*.4);drag={kind,binding,center,minPx,maxPx,value:binding.value,pointerId:event.pointerId};event.currentTarget.setPointerCapture?.(event.pointerId);
    const move=e=>{if(!drag||e.pointerId!==drag.pointerId)return;e.preventDefault();const hb=host.getBoundingClientRect(),distance=clamp(e.clientX-hb.left-drag.center.x,drag.minPx,drag.maxPx),t=(distance-drag.minPx)/Math.max(1,drag.maxPx-drag.minPx),raw=lerp(drag.binding.min,drag.binding.max,t);drag.value=round(raw,drag.binding.step);drawGeometry(drag.kind==='reach'?drag.value:null,drag.kind==='size'?drag.value:null);};
    const end=e=>{if(!drag||e.pointerId!==drag.pointerId)return;e.preventDefault();const done=drag;drag=null;root.removeEventListener?.('pointermove',move,true);root.removeEventListener?.('pointerup',end,true);root.removeEventListener?.('pointercancel',end,true);void commit(done.binding,done.value);};root.addEventListener?.('pointermove',move,{capture:true,passive:false});root.addEventListener?.('pointerup',end,{capture:true,passive:false});root.addEventListener?.('pointercancel',end,{capture:true,passive:false});
  }
  reachHandle.onpointerdown=e=>beginDrag('reach',e);sizeHandle.onpointerdown=e=>beginDrag('size',e);
  const onChange=event=>{if(node.contains(event?.target)||geo.contains(event?.target))return;root.setTimeout?.(()=>refresh(),80);};session.shell.root?.addEventListener?.('change',onChange,true);session.shell.root?.addEventListener?.('click',onChange,true);
  const resizeObserver=root.ResizeObserver?new root.ResizeObserver(()=>drawGeometry()):null;resizeObserver?.observe(host);const observer=root.MutationObserver?new root.MutationObserver(()=>{if(!session.shell.root?.isConnected)destroy();}):null;observer?.observe(doc.body,{childList:true,subtree:true});
  function destroy(){if(destroyed)return;destroyed=true;resizeObserver?.disconnect();observer?.disconnect();session.shell.root?.removeEventListener?.('change',onChange,true);session.shell.root?.removeEventListener?.('click',onChange,true);geo.remove();node.remove();installed.delete(session);}
  const api=Object.freeze({version:'ability-touch-tuner-v2.0.0-direct-handles',node,geometry:geo,refresh,destroy,get expanded(){return expanded;}});installed.set(session,api);refresh();return api;
}
