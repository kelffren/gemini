/* KELO-INDEX
 * area: UI / PRESENTATION FOUNDATION
 * owner: KELO_LUXE shared presentation contract
 * keys: UI TOKENS OVERLAY STACK TOAST DIALOG BUSY HAPTICS MOTION ACCESSIBILITY TOUCH TARGET DIAGNOSTICS
 * purpose: primitives compartidos de presentación para que las superficies Kelo reaccionen y fallen de forma consistente sin poseer gameplay
 * public-api: KeloUI.toast/confirm/surfaces/busy/haptics/motion/auditTouchTargets/snapshot
 * consumes: KeloInputLocks + DOM/browser capability APIs
 * state-owned: stack efímero de superficies, cola visual de toast/busy, preferencia local de motion
 * extension-points: cualquier UI owner puede registrar superficies y usar feedback sin transferir su autoridad de dominio
 * reuse: Luxe/Creators/Studio/paneles futuros; presentation-only
 * legacy: no reemplaza KELO_LUXE; KeloUI es el contrato support compartido del mismo owner de presentación
 * do-not: NO gameplay writes, NO economía, NO player state, NO polling/setInterval, NO segundo input owner
 * online: N/A; presentación cliente. Operaciones valiosas siguen pidiendo resultado al owner/authority de dominio
 */
(function(root){
'use strict';
if(root.KeloUI)return;
const VERSION='kelo-ui-presentation-v1.0.0';
const doc=root.document;
if(!doc?.documentElement)return;
const locks=root.KeloInputLocks||null;
const surfaces=[];
const busyEntries=new Map();
let sequence=1;
let toastHost=null;
let busyHost=null;
const MOTION_KEY='kelo.ui.motion.v1';

function emit(type,detail){
  const payload=Object.freeze({...detail,version:VERSION});
  try{root.dispatchEvent(new CustomEvent(type,{detail:payload}));}catch(_){}
  return payload;
}
function id(prefix){return prefix+'-'+(sequence++).toString(36);}
function visible(el){if(!(el instanceof HTMLElement)||!el.isConnected)return false;const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';}
function ensureHost(kind){
  if(kind==='toast'){
    if(toastHost?.isConnected)return toastHost;
    toastHost=doc.getElementById('kelo-ui-toast-host')||doc.createElement('div');
    toastHost.id='kelo-ui-toast-host';toastHost.className='kelo-ui-toast-host';toastHost.setAttribute('aria-live','polite');toastHost.setAttribute('aria-relevant','additions text');
    if(!toastHost.isConnected)doc.body.appendChild(toastHost);return toastHost;
  }
  if(busyHost?.isConnected)return busyHost;
  busyHost=doc.getElementById('kelo-ui-busy-host')||doc.createElement('div');
  busyHost.id='kelo-ui-busy-host';busyHost.className='kelo-ui-busy-host';busyHost.setAttribute('role','status');busyHost.setAttribute('aria-live','polite');
  if(!busyHost.isConnected)doc.body.appendChild(busyHost);return busyHost;
}
function closeToast(token,reason){
  const el=doc.querySelector(`[data-kelo-toast-id="${CSS.escape(String(token||''))}"]`);if(!el)return false;
  el.dataset.closing='true';const remove=()=>{el.remove();emit('kelo:ui-toast-close',{id:String(token),reason:reason||'dismiss'});};
  if(motionMode()==='reduced')remove();else setTimeout(remove,130);return true;
}
function toast(message,options){
  const opts=options&&typeof options==='object'?options:{};const text=String(message??'').trim();if(!text)return null;
  const host=ensureHost('toast');const key=String(opts.key||text);const existing=Array.from(host.children).find(node=>node.dataset?.key===key);
  if(existing){existing.querySelector('.kelo-ui-toast-copy').textContent=text;return existing.dataset.keloToastId;}
  const token=id('toast');const el=doc.createElement('div');el.className='kelo-ui-toast';el.dataset.keloToastId=token;el.dataset.key=key;el.dataset.tone=String(opts.tone||'neutral');el.setAttribute('role',opts.tone==='error'?'alert':'status');
  const copy=doc.createElement('span');copy.className='kelo-ui-toast-copy';copy.textContent=text;el.appendChild(copy);
  if(opts.actionLabel&&typeof opts.action==='function'){const action=doc.createElement('button');action.type='button';action.className='kelo-ui-toast-action';action.textContent=String(opts.actionLabel);action.addEventListener('click',()=>{try{opts.action();}finally{closeToast(token,'action');}});el.appendChild(action);}
  const dismiss=doc.createElement('button');dismiss.type='button';dismiss.className='kelo-ui-toast-dismiss';dismiss.setAttribute('aria-label','Cerrar aviso');dismiss.textContent='×';dismiss.addEventListener('click',()=>closeToast(token,'manual'));el.appendChild(dismiss);
  host.appendChild(el);emit('kelo:ui-toast-open',{id:token,tone:el.dataset.tone,key});
  const duration=Number.isFinite(Number(opts.duration))?Math.max(900,Number(opts.duration)):2600;if(opts.persistent!==true)setTimeout(()=>closeToast(token,'timeout'),duration);
  return token;
}
function surfaceOpen(options){
  const opts=options&&typeof options==='object'?options:{};const token=id('surface');const active=doc.activeElement instanceof HTMLElement?doc.activeElement:null;
  const entry={token,id:String(opts.id||token),kind:String(opts.kind||'panel'),node:opts.node instanceof HTMLElement?opts.node:null,onRequestClose:typeof opts.onRequestClose==='function'?opts.onRequestClose:null,restoreFocus:opts.restoreFocus!==false?active:null,openedAt:performance.now()};
  surfaces.push(entry);emit('kelo:ui-surface-open',{token,id:entry.id,kind:entry.kind,depth:surfaces.length});return token;
}
function surfaceClose(token,reason){
  const index=surfaces.findIndex(entry=>entry.token===token||entry.id===token);if(index<0)return false;const [entry]=surfaces.splice(index,1);
  if(entry.restoreFocus?.isConnected){try{entry.restoreFocus.focus({preventScroll:true});}catch(_){}}
  emit('kelo:ui-surface-close',{token:entry.token,id:entry.id,kind:entry.kind,reason:reason||'close',depth:surfaces.length});return true;
}
function topSurface(){const entry=surfaces[surfaces.length-1];return entry?Object.freeze({token:entry.token,id:entry.id,kind:entry.kind,openedAt:entry.openedAt}):null;}
function requestCloseTop(reason){
  const entry=surfaces[surfaces.length-1];if(!entry)return false;
  if(entry.onRequestClose){const result=entry.onRequestClose(reason||'request');if(result===false)return false;}
  return surfaceClose(entry.token,reason||'request');
}
function surfaceSnapshot(){return Object.freeze(surfaces.map(entry=>Object.freeze({token:entry.token,id:entry.id,kind:entry.kind,openedAt:entry.openedAt})));}
function focusables(container){return Array.from(container.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(visible);}
function confirm(options){
  const opts=options&&typeof options==='object'?options:{};const overlay=doc.createElement('div');overlay.className='kelo-ui-dialog-backdrop';overlay.dataset.keloUiDialog='true';
  const card=doc.createElement('section');card.className='kelo-ui-dialog';card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');
  const titleId=id('dialog-title');const title=doc.createElement('h2');title.id=titleId;title.className='kelo-ui-dialog-title';title.textContent=String(opts.title||'Confirmar');card.setAttribute('aria-labelledby',titleId);
  const message=doc.createElement('div');message.className='kelo-ui-dialog-copy';message.textContent=String(opts.message||'');
  const actions=doc.createElement('div');actions.className='kelo-ui-dialog-actions';
  const cancel=doc.createElement('button');cancel.type='button';cancel.className='kelo-ui-button kelo-ui-button-secondary';cancel.textContent=String(opts.cancelLabel||'Cancelar');
  const accept=doc.createElement('button');accept.type='button';accept.className='kelo-ui-button kelo-ui-button-primary';accept.textContent=String(opts.confirmLabel||'Aceptar');
  actions.append(cancel,accept);card.append(title,message,actions);overlay.appendChild(card);doc.body.appendChild(overlay);
  const lockToken=locks?.acquire?.('kelo-ui-dialog',{surface:'dialog',reason:String(opts.reason||'confirm')})||null;let settled=false;let surfaceToken=null;
  return new Promise(resolve=>{
    function settle(value,why){if(settled)return;settled=true;overlay.removeEventListener('keydown',onKey);overlay.remove();if(lockToken)locks?.release?.(lockToken);if(surfaceToken)surfaceClose(surfaceToken,why);resolve(value);}
    function onKey(event){
      if(event.key==='Escape'){event.preventDefault();settle(false,'escape');return;}
      if(event.key!=='Tab')return;const list=focusables(card);if(!list.length)return;const first=list[0],last=list[list.length-1];if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}
    }
    surfaceToken=surfaceOpen({id:String(opts.id||'confirm'),kind:'dialog',node:overlay,onRequestClose:()=>{settle(false,'request');return false;}});
    cancel.addEventListener('click',()=>settle(false,'cancel'));accept.addEventListener('click',()=>settle(true,'confirm'));overlay.addEventListener('keydown',onKey);overlay.addEventListener('pointerdown',event=>{if(event.target===overlay&&opts.dismissOnBackdrop!==false)settle(false,'backdrop');});
    requestAnimationFrame(()=>accept.focus({preventScroll:true}));
  });
}
function renderBusy(){
  const host=ensureHost('busy');host.replaceChildren();for(const entry of busyEntries.values()){const row=doc.createElement('div');row.className='kelo-ui-busy-chip';row.dataset.keloBusyId=entry.token;const dot=doc.createElement('i');dot.setAttribute('aria-hidden','true');const copy=doc.createElement('span');copy.textContent=entry.label;row.append(dot,copy);host.appendChild(row);}host.hidden=busyEntries.size===0;
}
function busyBegin(key,label){const token=id('busy');busyEntries.set(token,{token,key:String(key||token),label:String(label||'Procesando…'),startedAt:performance.now()});renderBusy();emit('kelo:ui-busy-start',{token,key:String(key||token)});return token;}
function busyEnd(token){const entry=busyEntries.get(token);if(!entry)return false;busyEntries.delete(token);renderBusy();emit('kelo:ui-busy-end',{token,key:entry.key,ms:Math.round(performance.now()-entry.startedAt)});return true;}
function haptic(kind){
  const pattern={tap:8,success:[12,36,18],warning:[18,45,18],error:[24,55,24]}[String(kind||'tap')]||8;
  try{if(typeof navigator.vibrate==='function')return navigator.vibrate(pattern)!==false;}catch(_){}return false;
}
function systemReduced(){try{return !!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}}
function motionMode(){const value=doc.documentElement.dataset.keloMotion;if(value==='reduced'||value==='full')return value;return systemReduced()?'reduced':'full';}
function setMotion(value){const next=value==='reduced'||value==='full'?value:'system';if(next==='system')delete doc.documentElement.dataset.keloMotion;else doc.documentElement.dataset.keloMotion=next;try{localStorage.setItem(MOTION_KEY,next);}catch(_){}emit('kelo:ui-motion-change',{mode:next,effective:motionMode()});return next;}
function restoreMotion(){try{const saved=localStorage.getItem(MOTION_KEY);if(saved==='reduced'||saved==='full')doc.documentElement.dataset.keloMotion=saved;}catch(_){}}
function auditTouchTargets(scope){
  const rootNode=scope instanceof HTMLElement?scope:doc.body;const selector='button,a[href],[role="button"],input:not([type="hidden"]),select,textarea';const failures=[];let checked=0;
  rootNode.querySelectorAll(selector).forEach(el=>{if(!visible(el))return;checked++;const r=el.getBoundingClientRect();if(r.width>=44&&r.height>=44)return;failures.push(Object.freeze({tag:el.tagName.toLowerCase(),id:el.id||null,className:String(el.className||'').slice(0,120),width:Math.round(r.width),height:Math.round(r.height)}));});
  return Object.freeze({checked,minimumPx:44,failures:Object.freeze(failures),pass:failures.length===0});
}
function snapshot(){return Object.freeze({version:VERSION,owner:'KELO_LUXE',surfaces:surfaceSnapshot(),busy:Object.freeze(Array.from(busyEntries.values()).map(entry=>Object.freeze({key:entry.key,label:entry.label,ms:Math.round(performance.now()-entry.startedAt)}))),motion:motionMode(),touchMinimumPx:44});}
function installInspector(){
  let enabled=false;try{const q=new URLSearchParams(location.search);enabled=q.get('uiLab')==='1'||q.get('uiInspector')==='1';}catch(_){}if(!enabled)return;
  const panel=doc.createElement('aside');panel.id='kelo-ui-inspector';panel.className='kelo-ui-inspector';const refresh=()=>{const touch=auditTouchTargets();const vv=root.KELO_VIEWPORT?.snapshot?.();panel.textContent=`UI ${VERSION} · stack ${surfaces.length} · touch<44 ${touch.failures.length}/${touch.checked} · ${Math.round(vv?.visualW||innerWidth)}×${Math.round(vv?.visualH||innerHeight)} · focus ${(doc.activeElement?.id||doc.activeElement?.tagName||'none')}`;};doc.body.appendChild(panel);refresh();root.addEventListener('kelo:ui-surface-open',refresh);root.addEventListener('kelo:ui-surface-close',refresh);root.addEventListener('kelo:viewport-css-change',refresh);
}
restoreMotion();
root.addEventListener('keydown',event=>{if(event.key==='Escape'&&surfaces.length){const top=surfaces[surfaces.length-1];if(top.kind!=='dialog'&&requestCloseTop('escape'))event.preventDefault();}},true);
root.KeloUI=Object.freeze({version:VERSION,owner:'KELO_LUXE',toast,closeToast,confirm,surfaces:Object.freeze({open:surfaceOpen,close:surfaceClose,top:topSurface,requestCloseTop,snapshot:surfaceSnapshot}),busy:Object.freeze({begin:busyBegin,end:busyEnd}),haptics:Object.freeze({pulse:haptic}),motion:Object.freeze({get:motionMode,set:setMotion}),auditTouchTargets,snapshot});
root.KELO_UI_AUDIT=Object.freeze({version:VERSION,owner:'KELO_LUXE',presentationOnly:true,gameplayWrites:false,inputLockOwner:'KeloInputLocks',touchMinimumPx:44,focusTrap:true,toastDedupe:true,surfaceStack:true,busyTokens:true,hapticsCapabilityFallback:true,motionPreference:true,polling:false});
installInspector();emit('kelo:ui-ready',{owner:'KELO_LUXE'});
})(typeof globalThis!=='undefined'?globalThis:window);
