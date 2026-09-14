/* KELO-INDEX
 * area: UI / SOCIAL CHAT
 * owner: KeloChatUI presentation enhancer; Kelo Luxe sigue siendo owner del chat/transporte
 * keys: CHAT MOBILE DRAWER KEYBOARD RETRACTABLE DRAG IOS EXISTING HANDLERS
 * purpose: convierte #lx-chat-drawer existente en bottom-sheet retráctil y añade teclado KELO sin duplicar mensajes ni red
 * public-api: KeloChatUI.open/close/toggle/showKeyboard/hideKeyboard/snapshot
 * consumes: #lx-chat-drawer #lx-in #lx-form + KELO_LUXE.open path/closeChat + handler submit existente
 * state-owned: solo capa visual, gesto de drag y layout del teclado
 * do-not: NO segundo chat, NO segundo transporte, NO duplicar submit/keloSay, NO polling/MutationObserver
 */
(function(root){
'use strict';
if(typeof document==='undefined'||root.KeloChatUI)return;

const VERSION='kelo-chat-ui-v2.0.0-existing-owner';
const PEEK=48;
let drawer,tab,input,form,keyboard,keyboardToggle;
let dragging=false,moved=false,startY=0,startOffset=0,suppressClick=false,shift=false,layer='letters';

function qs(sel){return document.querySelector(sel);}
function isOpen(){return !!drawer?.classList.contains('open');}
function drawerHeight(){return drawer?.getBoundingClientRect().height||Math.min(innerHeight*.5,480);}
function closedOffset(){return Math.max(0,drawerHeight()-PEEK);}
function setTransform(px){if(drawer)drawer.style.transform=`translate3d(0,${Math.max(0,Math.min(closedOffset(),px))}px,0)`;}
function clearTransform(){if(drawer)drawer.style.removeProperty('transform');}
function syncA11y(){
  const open=isOpen();
  tab?.setAttribute('aria-expanded',String(open));
  tab?.setAttribute('aria-label',open?'Cerrar chat':'Abrir chat');
  drawer?.setAttribute('aria-hidden',String(!open));
  if(!open)hideKeyboard();
}
function routeExistingOpen(){
  if(isOpen())return true;
  try{
    root.KELO_LUXE?.renderMenu?.();
    const chatRoute=qs('#lx-menu-grid [data-tool="chat"], [data-tool="chat"]');
    if(chatRoute){chatRoute.click();requestAnimationFrame(syncA11y);return true;}
  }catch(_){}
  return false;
}
function close(){root.KELO_LUXE?.closeChat?.();requestAnimationFrame(syncA11y);return false;}
function open(){routeExistingOpen();return true;}
function toggle(){return isOpen()?close():open();}

function updateInput(next){
  if(!input)return;
  const max=Number(input.maxLength)>0?input.maxLength:80;
  input.value=String(next||'').slice(0,max);
  input.dispatchEvent(new Event('input',{bubbles:true}));
}
function insertText(text){
  if(!input)return;
  const start=Number.isInteger(input.selectionStart)?input.selectionStart:input.value.length;
  const end=Number.isInteger(input.selectionEnd)?input.selectionEnd:start;
  const value=input.value.slice(0,start)+text+input.value.slice(end);
  updateInput(value);
  const pos=Math.min(start+text.length,input.value.length);
  try{input.setSelectionRange(pos,pos);}catch(_){}
}
function backspace(){
  if(!input)return;
  let start=Number.isInteger(input.selectionStart)?input.selectionStart:input.value.length;
  let end=Number.isInteger(input.selectionEnd)?input.selectionEnd:start;
  if(start===end&&start>0)start--;
  const next=input.value.slice(0,start)+input.value.slice(end);
  updateInput(next);try{input.setSelectionRange(start,start);}catch(_){}
}
function submitExisting(){
  if(!form||!input?.value.trim())return;
  if(typeof form.requestSubmit==='function')form.requestSubmit();
  else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
}
function key(label,action,value,cls){
  const b=document.createElement('button');b.type='button';b.className='kc-key'+(cls?' '+cls:'');b.dataset.action=action;if(value!=null)b.dataset.value=value;b.textContent=label;return b;
}
function renderKeyboard(){
  if(!keyboard)return;
  keyboard.replaceChildren();
  const rows=[];
  if(layer==='letters'){
    rows.push('qwertyuiop'.split('').map(k=>key(shift?k.toUpperCase():k,'char',k)));
    rows.push('asdfghjkl'.split('').map(k=>key(shift?k.toUpperCase():k,'char',k)));
    rows.push([key('⇧','shift',null,'kc-wide'),...'zxcvbnm'.split('').map(k=>key(shift?k.toUpperCase():k,'char',k)),key('⌫','backspace',null,'kc-wide')]);
    rows.push([key('123','numbers',null,'kc-mode'),key('☺','emoji',null,'kc-mode'),key('espacio','space',' ','kc-space'),key('➤','send',null,'kc-send')]);
  }else if(layer==='numbers'){
    rows.push('1234567890'.split('').map(k=>key(k,'char',k)));
    rows.push(['-','/',';',':','(',')','$','&','@','"'].map(k=>key(k,'char',k)));
    rows.push(['.','?', '!', "'",'#','%','+','=','_'].map(k=>key(k,'char',k)).concat(key('⌫','backspace')));
    rows.push([key('ABC','letters',null,'kc-mode'),key('☺','emoji',null,'kc-mode'),key('espacio','space',' ','kc-space'),key('➤','send',null,'kc-send')]);
  }else{
    rows.push(['😀','😂','😍','😎','😭','😡','🥳','🤝'].map(k=>key(k,'char',k)));
    rows.push(['❤️','🔥','✨','⚔️','🛡️','👑','👍','💪'].map(k=>key(k,'char',k)));
    rows.push(['👋','✅','❌','🎉','💎','🏠','🗺️'].map(k=>key(k,'char',k)).concat(key('⌫','backspace')));
    rows.push([key('ABC','letters',null,'kc-mode'),key('123','numbers',null,'kc-mode'),key('espacio','space',' ','kc-space'),key('➤','send',null,'kc-send')]);
  }
  rows.forEach(keys=>{const row=document.createElement('div');row.className='kc-row';keys.forEach(b=>row.appendChild(b));keyboard.appendChild(row);});
}
function showKeyboard(){if(!isOpen())open();drawer?.classList.add('kc-keyboard-open');keyboard?.setAttribute('aria-hidden','false');keyboardToggle?.setAttribute('aria-expanded','true');return true;}
function hideKeyboard(){drawer?.classList.remove('kc-keyboard-open');keyboard?.setAttribute('aria-hidden','true');keyboardToggle?.setAttribute('aria-expanded','false');return false;}
function handleKey(e){
  const b=e.target.closest('.kc-key');if(!b)return;
  e.preventDefault();e.stopPropagation();
  const a=b.dataset.action,v=b.dataset.value||'';
  if(a==='char'){insertText(shift?v.toUpperCase():v);if(shift){shift=false;renderKeyboard();}}
  else if(a==='space')insertText(' ');
  else if(a==='backspace')backspace();
  else if(a==='shift'){shift=!shift;renderKeyboard();}
  else if(a==='letters'||a==='numbers'||a==='emoji'){layer=a;shift=false;renderKeyboard();}
  else if(a==='send')submitExisting();
}
function beginDrag(e){
  if(e.button!=null&&e.button!==0)return;
  dragging=true;moved=false;startY=e.clientY;startOffset=isOpen()?0:closedOffset();drawer.classList.add('kc-dragging');
  try{tab.setPointerCapture(e.pointerId);}catch(_){}
  e.preventDefault();e.stopPropagation();
}
function moveDrag(e){
  if(!dragging)return;
  const delta=e.clientY-startY;if(Math.abs(delta)>5)moved=true;
  setTransform(startOffset+delta);e.preventDefault();e.stopPropagation();
}
function endDrag(e){
  if(!dragging)return;
  const delta=e.clientY-startY;const finalOffset=Math.max(0,Math.min(closedOffset(),startOffset+delta));
  dragging=false;drawer.classList.remove('kc-dragging');clearTransform();
  suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
  const shouldOpen=moved?finalOffset<closedOffset()*.58:!isOpen();
  shouldOpen?open():close();
  try{tab.releasePointerCapture(e.pointerId);}catch(_){}
  e.preventDefault();e.stopPropagation();
}
function mount(){
  drawer=qs('#lx-chat-drawer');input=qs('#lx-in');form=qs('#lx-form');
  if(!drawer||!input||!form)return false;
  if(drawer.dataset.keloRetractable==='1')return true;
  drawer.dataset.keloRetractable='1';drawer.classList.add('kc-enhanced');
  input.setAttribute('inputmode','none');input.setAttribute('enterkeyhint','send');input.setAttribute('virtualkeyboardpolicy','manual');

  const style=document.createElement('style');style.id='kelo-chat-ui-v2-style';style.textContent=`
#kelo-luxe .lx-chat-drawer.kc-enhanced{--kc-peek:${PEEK}px;display:grid!important;grid-template-rows:var(--kc-peek) auto minmax(0,1fr) auto auto;position:absolute!important;left:max(8px,env(safe-area-inset-left))!important;right:max(8px,env(safe-area-inset-right))!important;bottom:max(0px,env(safe-area-inset-bottom))!important;width:auto!important;height:min(50dvh,480px)!important;max-height:50dvh!important;min-height:0!important;padding:0 10px max(7px,env(safe-area-inset-bottom))!important;border:1px solid rgba(231,197,106,.68)!important;border-bottom:0!important;border-radius:24px 24px 0 0!important;background:linear-gradient(180deg,rgba(20,31,27,.985),rgba(4,12,14,.99))!important;box-shadow:0 -14px 34px rgba(0,0,0,.38),inset 0 0 0 1px rgba(255,255,255,.025)!important;overflow:hidden!important;transform:translate3d(0,calc(100% - var(--kc-peek)),0);transition:transform .22s cubic-bezier(.2,.8,.2,1);pointer-events:none!important;will-change:transform;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
#kelo-luxe .lx-chat-drawer.kc-enhanced.open{transform:translate3d(0,0,0);pointer-events:auto!important}#kelo-luxe .lx-chat-drawer.kc-enhanced.kc-dragging{transition:none!important}.kc-chat-tab{height:var(--kc-peek);margin:0 -10px;padding:0 12px;border:0;background:linear-gradient(180deg,rgba(31,46,39,.98),rgba(13,25,24,.98));color:#f0d27d;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;pointer-events:auto!important;touch-action:none;cursor:grab}.kc-chat-tab:active{cursor:grabbing}.kc-tab-label{justify-self:start;font:800 14px Georgia,serif}.kc-tab-handle{width:54px;height:5px;border-radius:99px;background:rgba(244,226,169,.58);box-shadow:0 0 9px rgba(231,197,106,.16)}.kc-tab-state{justify-self:end;font:750 10px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#aebdb7}.kc-enhanced:not(.open)>:not(.kc-chat-tab){visibility:hidden!important;opacity:0!important;pointer-events:none!important}.kc-enhanced.open> :not(.kc-chat-tab){visibility:visible;opacity:1}.kc-enhanced .lx-chat-head{min-height:38px;padding:3px 2px 5px!important;border-bottom:1px solid rgba(231,197,106,.2)}.kc-enhanced .lx-chat-head span{font-size:15px;letter-spacing:.08em}.kc-enhanced .lx-chat-close{width:36px;height:32px}.kc-enhanced .lx-log{height:auto!important;min-height:0;overflow-y:auto!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:8px 4px!important;font-size:12px!important;line-height:1.35!important}.kc-enhanced .lx-log>div{margin:0 0 6px;padding:7px 9px;border-radius:12px;background:rgba(40,52,57,.72);border:1px solid rgba(255,255,255,.055)}.kc-enhanced .lx-chat-form{display:grid!important;grid-template-columns:minmax(0,1fr) 48px;gap:7px;padding:6px 0}.kc-enhanced .lx-chat-form input{height:42px!important;border-radius:16px!important;border-color:rgba(231,197,106,.48)!important;background:rgba(8,18,21,.9)!important;padding:0 12px!important;font-size:13px!important}.kc-enhanced .lx-chat-form button{height:42px!important;min-width:48px!important;border-radius:50%!important;background:linear-gradient(145deg,#edc14b,#a87617)!important;color:#111!important;font-size:0!important}.kc-enhanced .lx-chat-form button:after{content:'➤';font-size:19px}.kc-keyboard{display:none;grid-template-rows:repeat(4,minmax(0,1fr));gap:5px;height:min(190px,23dvh);min-height:0;margin:0 -4px;padding:5px 0 2px;border-top:1px solid rgba(231,197,106,.22);pointer-events:auto}.kc-keyboard-open .kc-keyboard{display:grid}.kc-row{display:flex;gap:4px;min-height:0}.kc-key{flex:1 1 0;min-width:0;border:1px solid rgba(231,197,106,.27)!important;border-radius:8px!important;background:linear-gradient(180deg,rgba(38,49,47,.98),rgba(20,29,29,.98))!important;color:#f8edd0!important;font:700 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;touch-action:manipulation}.kc-key:active{transform:scale(.94)}.kc-wide{flex:1.35}.kc-mode{flex:1.35;color:#e8c86f!important}.kc-space{flex:4}.kc-send{flex:1.35;background:linear-gradient(145deg,#edc14b,#9f7013)!important;color:#111!important;border-color:#f4d77d!important;font-size:18px!important}.kc-keyboard-open .lx-log{padding-top:5px!important;padding-bottom:5px!important}.kc-enhanced:not(.open){pointer-events:none!important}.kc-enhanced:not(.open) .kc-chat-tab{pointer-events:auto!important}
@media(max-height:620px){#kelo-luxe .lx-chat-drawer.kc-enhanced{height:50dvh!important}.kc-keyboard{height:min(145px,25dvh)}.kc-enhanced .lx-chat-head{min-height:32px}.kc-enhanced .lx-chat-form{padding:4px 0}.kc-enhanced .lx-chat-form input,.kc-enhanced .lx-chat-form button{height:36px!important}}
@media(orientation:landscape){#kelo-luxe .lx-chat-drawer.kc-enhanced{left:max(10px,calc(env(safe-area-inset-left) + 6px))!important;right:max(10px,calc(env(safe-area-inset-right) + 6px))!important;height:50dvh!important;--kc-peek:44px}.kc-keyboard{height:min(124px,27dvh)}.kc-chat-tab{height:44px}.kc-enhanced .lx-chat-head{min-height:28px}.kc-enhanced .lx-log{font-size:11px!important}.kc-enhanced .lx-chat-form input,.kc-enhanced .lx-chat-form button{height:34px!important}}
@media(prefers-reduced-motion:reduce){#kelo-luxe .lx-chat-drawer.kc-enhanced{transition:none!important}}
`;
  document.head.appendChild(style);

  tab=document.createElement('button');tab.type='button';tab.id='lx-chat-tab';tab.className='kc-chat-tab';tab.setAttribute('aria-controls','lx-chat-drawer');tab.setAttribute('aria-expanded','false');tab.innerHTML='<span class="kc-tab-label">Chat</span><span class="kc-tab-handle" aria-hidden="true"></span><span class="kc-tab-state">desliza ↑</span>';drawer.prepend(tab);
  keyboard=document.createElement('div');keyboard.id='kelo-chat-keyboard';keyboard.className='kc-keyboard';keyboard.setAttribute('aria-label','Teclado KELO');keyboard.setAttribute('aria-hidden','true');drawer.appendChild(keyboard);
  keyboardToggle=input;input.setAttribute('aria-controls','kelo-chat-keyboard');input.setAttribute('aria-expanded','false');renderKeyboard();

  tab.addEventListener('pointerdown',beginDrag);tab.addEventListener('pointermove',moveDrag);tab.addEventListener('pointerup',endDrag);tab.addEventListener('pointercancel',endDrag);tab.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();}});
  input.addEventListener('pointerdown',e=>{if(matchMedia('(pointer:coarse)').matches){e.preventDefault();e.stopPropagation();showKeyboard();try{input.focus({preventScroll:true});}catch(_){input.focus();}}});
  input.addEventListener('click',()=>showKeyboard());
  keyboard.addEventListener('click',handleKey);
  keyboard.addEventListener('pointerdown',e=>e.stopPropagation());
  drawer.addEventListener('click',e=>{if(e.target.closest('#lx-chat-close'))requestAnimationFrame(syncA11y);});
  document.addEventListener('click',e=>{if(e.target.closest('[data-tool="chat"]'))requestAnimationFrame(syncA11y);if(e.target.closest('#lx-side-pvp'))requestAnimationFrame(syncA11y);},true);
  root.addEventListener('keydown',e=>{if(e.key==='Escape')requestAnimationFrame(syncA11y);});
  root.addEventListener('resize',()=>{if(!dragging)clearTransform();},{passive:true});
  root.addEventListener('orientationchange',()=>requestAnimationFrame(clearTransform),{passive:true});
  form.addEventListener('submit',()=>requestAnimationFrame(()=>{if(isOpen()&&drawer.classList.contains('kc-keyboard-open'))showKeyboard();}),true);
  syncA11y();
  return true;
}

function boot(){if(mount())return;document.addEventListener('kelo:luxe-ready',mount,{once:true});requestAnimationFrame(mount);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
root.KeloChatUI=Object.freeze({version:VERSION,open,close,toggle,showKeyboard,hideKeyboard,snapshot:()=>Object.freeze({mounted:!!drawer,open:isOpen(),keyboard:!!drawer?.classList.contains('kc-keyboard-open'),maxViewportFraction:.5,reusesExistingDrawer:true,reusesExistingInput:true,reusesExistingSubmit:true,nativeKeyboardDefault:false})});
root.KELO_CHAT_UI_AUDIT=Object.freeze({version:VERSION,retractable:true,drag:true,maxHalfViewport:true,customKeyboard:true,reusesExistingChat:true,reusesExistingSubmit:true,secondTransport:false,noPolling:true});
})(typeof globalThis!=='undefined'?globalThis:window);
