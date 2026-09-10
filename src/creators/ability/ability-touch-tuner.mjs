/* KELO-INDEX
 * area: CREATORS / ABILITY TOUCH TUNER
 * owner: Ability Creator touch-first tuning surface
 * owns: mobile/desktop range sliders for reach, radius/width and action timing
 * does-not-own: ability schema, combat authority, persistence, runtime delivery or FX rendering
 * reuse: Ability Studio kernel/history + autosave + existing safe preview arena
 */
import { createPatchAbilityDefinitionCommand } from './ability-commands.mjs';
import { abilityTimelineDuration } from './ability-document.mjs';

const STYLE_ID='kelo-ability-touch-tuner-v1-style';
const installed=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const round=(v,step=1)=>Math.round((Number(v)||0)/step)*step;
const fmt=(value,step)=>step<1?Number(value).toFixed(step<=.01?2:1):String(Math.round(Number(value)||0));

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
  @media(max-width:760px){.katune{left:7px;right:7px;bottom:max(7px,env(safe-area-inset-bottom))}.katune-bar{height:42px;border-radius:14px}.katune-title{font-size:9px}.katune-sub{font-size:7px}.katune-panel{padding:7px 6px}.katune-card{flex-basis:148px;padding:9px 8px}.katune input[type=range]{height:36px}.katune-card b{font-size:8px}.katune-value{font-size:10px}}
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
function bindings(document){const d=document.definition;return[reachBinding(d),sizeBinding(d),...timingBindings(d)];}

function syncKnownInspectorFields(shell,document){
  const d=document.definition,map=new Map([['Target Range',d.targeting.range],['Telegraph Range',d.telegraph.range],['Telegraph Radius',d.telegraph.radius],['Telegraph Width',d.telegraph.width],['Windup',d.action.windup],['Active',d.action.active],['Recovery',d.action.recovery],['Max Distance',d.delivery.maxDistance],['Distance',d.delivery.distance],['Projectile Radius',d.delivery.radius],['AOE Radius',d.delivery.radius],['Area Radius',d.delivery.radius],['Trigger Radius',d.delivery.activationRadius],['Wall Width',d.delivery.width]]);
  for(const row of shell.left?.querySelectorAll?.('.ksw-field')||[]){const label=row.querySelector('label')?.textContent,input=row.querySelector('input');if(input&&map.has(label))input.value=String(map.get(label));}
}

export function installAbilityTouchTuner(session,{root=globalThis}={}){
  if(!session?.kernel?.execute||!session?.shell?.viewport||!session?.autosave)return null;
  if(installed.has(session))return installed.get(session);
  const doc=session.shell.viewport.ownerDocument;ensureStyle(doc);
  const host=session.shell.viewport,node=doc.createElement('section');node.className='katune';node.setAttribute('aria-label','Ability touch tune');
  const mobile=root.matchMedia?.('(max-width:760px)')?.matches===true;let expanded=mobile,commitQueue=Promise.resolve(),destroyed=false;
  node.innerHTML='<div class="katune-bar"><div class="katune-title">✦ TOUCH TUNE</div><div class="katune-sub">drag → auto replay</div><button class="katune-toggle" type="button" aria-label="Toggle touch tune">⌃</button></div><div class="katune-panel"><div class="katune-strip"></div><div class="katune-live"><span>REACH · SIZE · TIMING</span><strong>release to commit</strong></div></div>';
  host.append(node);const strip=node.querySelector('.katune-strip'),toggle=node.querySelector('.katune-toggle');
  const setOpen=value=>{expanded=!!value;node.classList.toggle('open',expanded);toggle.textContent=expanded?'⌄':'⌃';toggle.setAttribute('aria-expanded',String(expanded));};setOpen(expanded);toggle.onclick=e=>{e.stopPropagation();setOpen(!expanded);};

  function refresh(){
    if(destroyed||!strip)return;strip.replaceChildren();
    for(const binding of bindings(session.kernel.document)){
      const card=doc.createElement('label');card.className='katune-card';const head=doc.createElement('div');head.className='katune-card-head';const name=doc.createElement('b');name.textContent=binding.label;const value=doc.createElement('span');value.className='katune-value';value.textContent=fmt(binding.value,binding.step);head.append(name,value);
      const slider=doc.createElement('input');slider.type='range';slider.min=String(binding.min);slider.max=String(binding.max);slider.step=String(binding.step);slider.value=String(clamp(binding.value,binding.min,binding.max));slider.setAttribute('aria-label',binding.label);slider.onpointerdown=e=>e.stopPropagation();slider.oninput=()=>{value.textContent=fmt(slider.value,binding.step);};slider.onchange=()=>commit(binding,slider.value);
      const detail=doc.createElement('small');detail.textContent=binding.detail;card.append(head,slider,detail);strip.append(card);
    }
  }
  async function commit(binding,raw){
    const value=round(clamp(raw,binding.min,binding.max),binding.step);commitQueue=commitQueue.then(async()=>{await session.kernel.execute(createPatchAbilityDefinitionCommand(binding.patch(value)));session.autosave.markDirty();syncKnownInspectorFields(session.shell,session.kernel.document);const duration=abilityTimelineDuration(session.kernel.document);session.timeline?.set?.({duration,tracks:actionTracks(session.kernel.document),playhead:Math.min(session.timeline.playhead||0,duration),snapStep:1/60});try{await session.preview?.play?.(session.kernel.document);}catch(error){console.warn('[Ability Touch Tune] preview replay unavailable',error);}refresh();});try{await commitQueue;}catch(error){console.warn('[Ability Touch Tune] commit failed',error);}
  }
  const onChange=()=>root.setTimeout?.(()=>refresh(),80);session.shell.root?.addEventListener?.('change',onChange,true);session.shell.root?.addEventListener?.('click',onChange,true);
  const observer=root.MutationObserver?new root.MutationObserver(()=>{if(!session.shell.root?.isConnected)destroy();}):null;observer?.observe(doc.body,{childList:true,subtree:true});
  function destroy(){if(destroyed)return;destroyed=true;observer?.disconnect();session.shell.root?.removeEventListener?.('change',onChange,true);session.shell.root?.removeEventListener?.('click',onChange,true);node.remove();installed.delete(session);}
  const api=Object.freeze({version:'ability-touch-tuner-v1.0.0',node,refresh,destroy,get expanded(){return expanded;}});installed.set(session,api);refresh();return api;
}
