/* KELO-INDEX
 * area: UI / SOCIAL CHAT
 * owner: KeloChat presentation
 * keys: CHAT MOBILE DRAWER KEYBOARD RETRACTABLE DRAG IOS
 * purpose: chat retráctil mobile-first con teclado propio; no captura el mundo cuando está cerrado
 * public-api: KeloChat.open/close/toggle/sendMessage/receiveMessage/snapshot
 * consumes: localPlayer, keloNet, optional external chat transport via kelo-chat-send / kelo-chat-message
 * state-owned: draft, drawer/keyboard UI state, session-local recent messages
 * do-not: NO gameplay authority, NO native keyboard por defecto, NO second network transport, NO polling
 */
(function(root){
'use strict';
if(typeof document==='undefined'||root.KeloChat||document.getElementById('kelo-chat-drawer'))return;

const VERSION='kelo-chat-drawer-v1.0.0';
const MAX_MESSAGE=220;
const MAX_HISTORY=60;
const PEEK_PX=48;
const STORE='kelo.chat.session.v1';
const state={open:false,keyboard:false,dragging:false,draft:'',shift:false,layer:'letters',messages:[]};
let rootEl,bodyEl,feedEl,composerEl,draftEl,countEl,keyboardEl,toggleEl,dragStartY=0,dragStartOffset=0,dragMoved=false;

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const cleanText=value=>String(value==null?'':value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').slice(0,MAX_MESSAGE);
const cleanName=value=>String(value||'Jugador').replace(/[\u0000-\u001F\u007F]/g,'').trim().slice(0,28)||'Jugador';
const nowLabel=ts=>{try{return new Intl.DateTimeFormat('es',{hour:'2-digit',minute:'2-digit'}).format(new Date(ts||Date.now()));}catch(_){return'';}};
function identityName(){
  try{
    const actor=typeof localPlayer!=='undefined'&&localPlayer?localPlayer:null;
    return cleanName(actor?.name||actor?.displayName||root.keloNet?.name||'Jugador');
  }catch(_){return'Jugador';}
}
function sessionLoad(){
  try{
    const rows=JSON.parse(sessionStorage.getItem(STORE)||'[]');
    if(Array.isArray(rows))state.messages=rows.slice(-MAX_HISTORY).map(normalizeMessage).filter(Boolean);
  }catch(_){state.messages=[];}
}
function sessionSave(){
  try{sessionStorage.setItem(STORE,JSON.stringify(state.messages.slice(-MAX_HISTORY)));}catch(_){}
}
function normalizeMessage(raw){
  if(!raw||typeof raw!=='object')return null;
  const text=cleanText(raw.text||raw.message||'').trim();
  if(!text)return null;
  return{
    id:String(raw.id||('chat-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8))).slice(0,90),
    name:cleanName(raw.name||raw.playerName||raw.author||'Jugador'),
    text,
    ts:Number(raw.ts||raw.time||Date.now())||Date.now(),
    mine:!!raw.mine
  };
}
function renderEmpty(){
  if(!feedEl)return;
  if(state.messages.length)return;
  const empty=document.createElement('div');
  empty.className='kc-empty';
  empty.textContent='Todavía no hay mensajes. Escribe el primero.';
  feedEl.replaceChildren(empty);
}
function renderMessage(message,append=true){
  if(!feedEl)return;
  feedEl.querySelector('.kc-empty')?.remove();
  const row=document.createElement('article');
  row.className='kc-message'+(message.mine?' is-mine':'');
  row.dataset.messageId=message.id;
  const head=document.createElement('div');head.className='kc-message-head';
  const name=document.createElement('strong');name.textContent=message.name;
  const time=document.createElement('time');time.dateTime=new Date(message.ts).toISOString();time.textContent=nowLabel(message.ts);
  const bubble=document.createElement('div');bubble.className='kc-bubble';bubble.textContent=message.text;
  head.append(name,time);row.append(head,bubble);
  if(append)feedEl.appendChild(row);else feedEl.prepend(row);
}
function renderAll(){
  if(!feedEl)return;
  feedEl.replaceChildren();
  state.messages.forEach(m=>renderMessage(m));
  renderEmpty();
  requestAnimationFrame(()=>{feedEl.scrollTop=feedEl.scrollHeight;});
}
function receiveMessage(raw){
  const message=normalizeMessage(raw);
  if(!message)return false;
  if(state.messages.some(item=>item.id===message.id))return false;
  state.messages.push(message);
  if(state.messages.length>MAX_HISTORY)state.messages.splice(0,state.messages.length-MAX_HISTORY);
  sessionSave();renderMessage(message);requestAnimationFrame(()=>{feedEl.scrollTop=feedEl.scrollHeight;});
  return true;
}
function updateDraft(){
  if(!draftEl)return;
  draftEl.textContent=state.draft||'Escribe un mensaje…';
  draftEl.classList.toggle('is-placeholder',!state.draft);
  if(countEl)countEl.textContent=state.draft?`${state.draft.length}/${MAX_MESSAGE}`:'';
}
function sendMessage(input){
  const text=cleanText(input==null?state.draft:input).trim();
  if(!text)return false;
  const message={id:'local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),name:identityName(),text,ts:Date.now(),mine:true};
  receiveMessage(message);
  state.draft='';updateDraft();
  try{root.dispatchEvent(new CustomEvent('kelo-chat-send',{detail:Object.freeze({...message})}));}catch(_){}
  return message;
}
function setKeyboard(force){
  state.keyboard=typeof force==='boolean'?force:!state.keyboard;
  rootEl?.classList.toggle('is-keyboard',state.keyboard);
  keyboardEl?.setAttribute('aria-hidden',String(!state.keyboard));
  composerEl?.setAttribute('aria-expanded',String(state.keyboard));
  if(state.keyboard&&!state.open)setOpen(true);
  return state.keyboard;
}
function closedOffset(){
  if(!rootEl)return 0;
  return Math.max(0,rootEl.getBoundingClientRect().height-PEEK_PX);
}
function applyOffset(offset,animate){
  if(!rootEl)return;
  rootEl.style.transition=animate?'':'none';
  rootEl.style.transform=`translate3d(0,${Math.round(offset)}px,0)`;
  if(!animate)requestAnimationFrame(()=>{if(rootEl)rootEl.style.transition='';});
}
function setOpen(force){
  state.open=typeof force==='boolean'?force:!state.open;
  if(!state.open){state.keyboard=false;rootEl?.classList.remove('is-keyboard');keyboardEl?.setAttribute('aria-hidden','true');composerEl?.setAttribute('aria-expanded','false');}
  rootEl?.classList.toggle('is-open',state.open);
  rootEl?.setAttribute('data-state',state.open?'open':'closed');
  toggleEl?.setAttribute('aria-expanded',String(state.open));
  toggleEl?.setAttribute('aria-label',state.open?'Cerrar chat':'Abrir chat');
  if(toggleEl)toggleEl.querySelector('.kc-tab-label').textContent=state.open?'Chat':'Chat';
  applyOffset(state.open?0:closedOffset(),true);
  return state.open;
}
function appendChar(char){
  if(state.draft.length>=MAX_MESSAGE)return;
  const value=state.shift?String(char).toUpperCase():String(char);
  state.draft=(state.draft+value).slice(0,MAX_MESSAGE);
  if(state.shift){state.shift=false;renderKeyboard();}
  updateDraft();
}
function backspace(){state.draft=state.draft.slice(0,-1);updateDraft();}
function keyButton(label,action,value,wide){
  const button=document.createElement('button');button.type='button';button.className='kc-key'+(wide?' '+wide:'');button.dataset.action=action;if(value!=null)button.dataset.value=value;button.textContent=label;button.setAttribute('aria-label',label==='⌫'?'Borrar':label==='⇧'?'Mayúsculas':label);return button;
}
function renderKeyboard(){
  if(!keyboardEl)return;
  keyboardEl.replaceChildren();
  const rows=[];
  if(state.layer==='letters'){
    rows.push('qwertyuiop'.split('').map(k=>keyButton(state.shift?k.toUpperCase():k,'char',k)));
    rows.push('asdfghjkl'.split('').map(k=>keyButton(state.shift?k.toUpperCase():k,'char',k)));
    rows.push([keyButton('⇧','shift',null,'kc-key-wide'),...'zxcvbnm'.split('').map(k=>keyButton(state.shift?k.toUpperCase():k,'char',k)),keyButton('⌫','backspace',null,'kc-key-wide')]);
    rows.push([keyButton('123','numbers',null,'kc-key-mode'),keyButton('☺','emoji',null,'kc-key-mode'),keyButton('espacio','space',' ','kc-key-space'),keyButton('➤','send',null,'kc-key-send')]);
  }else if(state.layer==='numbers'){
    rows.push('1234567890'.split('').map(k=>keyButton(k,'char',k)));
    rows.push(['-','/',';',':','(',')','$','&','@','"'].map(k=>keyButton(k,'char',k)));
    rows.push(['.','?', '!', "'",'#','%','+','=','_','⌫'].map((k,i)=>keyButton(k,i===9?'backspace':'char',i===9?null:k)));
    rows.push([keyButton('ABC','letters',null,'kc-key-mode'),keyButton('☺','emoji',null,'kc-key-mode'),keyButton('espacio','space',' ','kc-key-space'),keyButton('➤','send',null,'kc-key-send')]);
  }else{
    rows.push(['😀','😂','😍','😎','😭','😡','🥳','🤝'].map(k=>keyButton(k,'char',k)));
    rows.push(['❤️','🔥','✨','⚔️','🛡️','👑','👍','💪'].map(k=>keyButton(k,'char',k)));
    rows.push(['👋','✅','❌','🎉','💎','🏠','🗺️','⌫'].map((k,i)=>keyButton(k,i===7?'backspace':'char',i===7?null:k)));
    rows.push([keyButton('ABC','letters',null,'kc-key-mode'),keyButton('123','numbers',null,'kc-key-mode'),keyButton('espacio','space',' ','kc-key-space'),keyButton('➤','send',null,'kc-key-send')]);
  }
  rows.forEach(keys=>{const row=document.createElement('div');row.className='kc-key-row';keys.forEach(k=>row.appendChild(k));keyboardEl.appendChild(row);});
}
function onKeyboardClick(event){
  const key=event.target.closest('.kc-key');if(!key)return;
  const action=key.dataset.action,value=key.dataset.value;
  if(action==='char')appendChar(value||'');
  else if(action==='space')appendChar(' ');
  else if(action==='backspace')backspace();
  else if(action==='shift'){state.shift=!state.shift;renderKeyboard();}
  else if(action==='letters'||action==='numbers'||action==='emoji'){state.layer=action;state.shift=false;renderKeyboard();}
  else if(action==='send')sendMessage();
}
function mount(){
  if(document.getElementById('kelo-chat-drawer'))return;
  const style=document.createElement('style');style.id='kelo-chat-drawer-style';style.textContent=`
#kelo-chat-drawer{--kc-peek:${PEEK_PX}px;position:fixed;z-index:84;left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));bottom:max(0px,env(safe-area-inset-bottom));height:min(50dvh,480px);max-height:50dvh;min-height:280px;border:1px solid rgba(231,197,106,.72);border-bottom:0;border-radius:26px 26px 0 0;background:linear-gradient(180deg,rgba(20,31,27,.985),rgba(4,12,14,.99));box-shadow:0 -14px 34px rgba(0,0,0,.38),inset 0 0 0 1px rgba(255,255,255,.025);color:#f8edd0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden;transform:translate3d(0,calc(100% - var(--kc-peek)),0);transition:transform .22s cubic-bezier(.2,.8,.2,1);pointer-events:none;will-change:transform;-webkit-tap-highlight-color:transparent}
#kelo-chat-drawer.is-dragging{transition:none!important}.kc-tab{height:var(--kc-peek);display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 12px;pointer-events:auto;touch-action:none;cursor:grab;background:linear-gradient(180deg,rgba(31,46,39,.98),rgba(13,25,24,.98));border:0;color:inherit;width:100%}.kc-tab:active{cursor:grabbing}.kc-tab-label{justify-self:start;font:800 14px Georgia,serif;color:#f0d27d;letter-spacing:.02em}.kc-handle{width:52px;height:5px;border-radius:99px;background:rgba(244,226,169,.54);box-shadow:0 0 8px rgba(231,197,106,.12)}.kc-online{justify-self:end;font:700 10px/1 sans-serif;color:#b8c8c1;white-space:nowrap}
.kc-body{height:calc(100% - var(--kc-peek));display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;pointer-events:none;visibility:hidden;opacity:0;transition:opacity .16s ease,visibility 0s linear .22s}.is-open .kc-body,.is-dragging .kc-body{pointer-events:auto;visibility:visible;opacity:1;transition-delay:0s}.kc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 12px 6px;border-bottom:1px solid rgba(231,197,106,.24)}.kc-title{display:flex;align-items:center;gap:7px;font:800 18px Georgia,serif;color:#f0d27d}.kc-title:before{content:'●';font-size:9px;color:#e7c56a}.kc-close-keyboard{min-width:40px;min-height:36px;border:1px solid rgba(231,197,106,.35);border-radius:12px;background:rgba(0,0,0,.18);color:#e7c56a;font-size:18px;display:none}.is-keyboard .kc-close-keyboard{display:block}
.kc-feed{min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:8px 10px;scrollbar-width:none}.kc-feed::-webkit-scrollbar{display:none}.kc-empty{height:100%;display:grid;place-items:center;text-align:center;color:#8fa19a;font-size:12px;padding:18px}.kc-message{margin:0 0 8px;max-width:88%}.kc-message.is-mine{margin-left:auto}.kc-message-head{display:flex;gap:8px;align-items:baseline;padding:0 5px 3px}.kc-message-head strong{color:#e8c86f;font-size:12px}.kc-message-head time{color:#82928c;font-size:10px}.kc-bubble{padding:8px 10px;border:1px solid rgba(214,226,224,.09);border-radius:14px;background:rgba(40,52,57,.82);color:#f1f4f3;font-size:13px;line-height:1.25;overflow-wrap:anywhere;white-space:pre-wrap}.kc-message.is-mine .kc-bubble{background:linear-gradient(145deg,rgba(93,72,25,.68),rgba(39,44,39,.9));border-color:rgba(231,197,106,.25)}
.kc-compose{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:7px;align-items:center;padding:7px 10px;border-top:1px solid rgba(231,197,106,.22)}.kc-composer{position:relative;min-height:44px;display:flex;align-items:center;padding:8px 54px 8px 12px;border:1px solid rgba(231,197,106,.55);border-radius:18px;background:rgba(8,18,21,.88);color:#edf1ef;font-size:13px;line-height:1.15;outline:none;pointer-events:auto}.kc-draft.is-placeholder{color:#7e8d88}.kc-count{position:absolute;right:9px;bottom:5px;color:#72817c;font-size:8px}.kc-send{width:44px;height:44px;border:1px solid rgba(255,221,115,.82);border-radius:50%;background:linear-gradient(145deg,#edc14b,#b98217);color:#111;font-size:21px;font-weight:900;pointer-events:auto;touch-action:manipulation}.kc-send:active,.kc-key:active,.kc-close-keyboard:active{transform:scale(.94)}
.kc-keyboard{display:none;grid-template-rows:repeat(4,minmax(0,1fr));gap:5px;padding:6px 6px max(6px,env(safe-area-inset-bottom));height:min(196px,23dvh);min-height:154px;border-top:1px solid rgba(231,197,106,.24);background:rgba(3,8,10,.95);pointer-events:auto}.is-keyboard .kc-keyboard{display:grid}.kc-key-row{display:flex;gap:4px;min-height:0;justify-content:center}.kc-key{flex:1 1 0;min-width:0;border:1px solid rgba(231,197,106,.28);border-radius:8px;background:linear-gradient(180deg,rgba(38,49,47,.98),rgba(20,29,29,.98));color:#f8edd0;font:700 13px/1 sans-serif;touch-action:manipulation;box-shadow:0 1px 0 rgba(255,255,255,.035) inset}.kc-key-wide{flex:1.35}.kc-key-mode{flex:1.35;color:#e8c86f}.kc-key-space{flex:4}.kc-key-send{flex:1.35;background:linear-gradient(145deg,#edc14b,#9f7013);color:#111;border-color:#f4d77d;font-size:18px}
#kelo-chat-drawer:not(.is-open) .kc-body{pointer-events:none!important}#kelo-chat-drawer:not(.is-open):not(.is-dragging) .kc-body *{pointer-events:none!important}
@media(max-height:620px){#kelo-chat-drawer{height:min(50dvh,360px);min-height:240px}.kc-keyboard{height:min(154px,25dvh);min-height:132px}.kc-head{padding-top:4px;padding-bottom:4px}.kc-feed{padding-top:5px;padding-bottom:5px}.kc-compose{padding-top:5px;padding-bottom:5px}}
@media(orientation:landscape){#kelo-chat-drawer{left:max(10px,calc(env(safe-area-inset-left) + 6px));right:max(10px,calc(env(safe-area-inset-right) + 6px));height:50dvh;min-height:210px}.kc-keyboard{height:min(142px,28dvh);min-height:116px}.kc-tab{height:44px}#kelo-chat-drawer{--kc-peek:44px}.kc-title{font-size:15px}.kc-message{margin-bottom:5px}.kc-bubble{padding:6px 8px;font-size:12px}.kc-composer,.kc-send{min-height:38px;height:38px}.kc-send{width:38px}.kc-compose{grid-template-columns:minmax(0,1fr) 38px}}
@media(prefers-reduced-motion:reduce){#kelo-chat-drawer,.kc-body{transition:none!important}}
`;
  document.head.appendChild(style);
  rootEl=document.createElement('section');rootEl.id='kelo-chat-drawer';rootEl.setAttribute('aria-label','Chat de KELO WORLD');rootEl.setAttribute('data-state','closed');
  rootEl.innerHTML=`<button class="kc-tab" id="kelo-chat-toggle" type="button" aria-expanded="false" aria-controls="kelo-chat-body" aria-label="Abrir chat"><span class="kc-tab-label">Chat</span><span class="kc-handle" aria-hidden="true"></span><span class="kc-online" aria-live="polite">Local</span></button><div class="kc-body" id="kelo-chat-body"><header class="kc-head"><div class="kc-title">Chat</div><button class="kc-close-keyboard" type="button" aria-label="Ocultar teclado">⌄</button></header><div class="kc-feed" role="log" aria-live="polite" aria-relevant="additions text"></div><div class="kc-compose"><div class="kc-composer" role="textbox" aria-label="Mensaje" aria-readonly="true" aria-expanded="false" tabindex="0"><span class="kc-draft is-placeholder">Escribe un mensaje…</span><small class="kc-count"></small></div><button class="kc-send" type="button" aria-label="Enviar mensaje">➤</button></div><div class="kc-keyboard" aria-label="Teclado KELO" aria-hidden="true"></div></div>`;
  document.body.appendChild(rootEl);
  bodyEl=rootEl.querySelector('.kc-body');feedEl=rootEl.querySelector('.kc-feed');composerEl=rootEl.querySelector('.kc-composer');draftEl=rootEl.querySelector('.kc-draft');countEl=rootEl.querySelector('.kc-count');keyboardEl=rootEl.querySelector('.kc-keyboard');toggleEl=rootEl.querySelector('.kc-tab');
  const onlineEl=rootEl.querySelector('.kc-online');
  const paintOnline=()=>{if(!onlineEl)return;const n=root.keloNet?.on?1+Object.keys(root.keloNet?.peers||{}).length:0;onlineEl.textContent=n?`${n} en línea`:'Local';};paintOnline();
  renderAll();renderKeyboard();updateDraft();
  applyOffset(closedOffset(),false);
  rootEl.addEventListener('pointerdown',event=>{if(event.target.closest('.kc-body'))event.stopPropagation();},true);
  rootEl.addEventListener('click',event=>event.stopPropagation());
  toggleEl.addEventListener('pointerdown',event=>{
    if(event.button!=null&&event.button!==0)return;
    state.dragging=true;dragMoved=false;dragStartY=event.clientY;dragStartOffset=state.open?0:closedOffset();rootEl.classList.add('is-dragging');toggleEl.setPointerCapture?.(event.pointerId);event.preventDefault();event.stopPropagation();
  });
  toggleEl.addEventListener('pointermove',event=>{
    if(!state.dragging)return;const delta=event.clientY-dragStartY;if(Math.abs(delta)>5)dragMoved=true;const offset=clamp(dragStartOffset+delta,0,closedOffset());applyOffset(offset,false);event.preventDefault();
  });
  const endDrag=event=>{
    if(!state.dragging)return;state.dragging=false;rootEl.classList.remove('is-dragging');const delta=event.clientY-dragStartY,current=clamp(dragStartOffset+delta,0,closedOffset()),shouldOpen=dragMoved?current<closedOffset()*.58:!state.open;setOpen(shouldOpen);try{toggleEl.releasePointerCapture?.(event.pointerId);}catch(_){}event.preventDefault();event.stopPropagation();
  };
  toggleEl.addEventListener('pointerup',endDrag);toggleEl.addEventListener('pointercancel',endDrag);
  composerEl.addEventListener('click',()=>setKeyboard(true));
  composerEl.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setKeyboard(true);}});
  rootEl.querySelector('.kc-send').addEventListener('click',()=>sendMessage());
  rootEl.querySelector('.kc-close-keyboard').addEventListener('click',()=>setKeyboard(false));
  keyboardEl.addEventListener('click',onKeyboardClick);
  root.addEventListener('resize',()=>applyOffset(state.open?0:closedOffset(),false),{passive:true});
  root.addEventListener('orientationchange',()=>requestAnimationFrame(()=>applyOffset(state.open?0:closedOffset(),false)),{passive:true});
  root.addEventListener('kelo-chat-message',event=>receiveMessage(event.detail||{}));
  root.addEventListener('kelo-net-event',event=>{
    const detail=event.detail||{},payload=detail.payload||detail.data||detail.message||null;
    if((detail.type==='chat'||detail.t==='chat'||detail.event==='chat'||payload?.type==='chat'||payload?.kind==='chat')&&payload)receiveMessage(payload);
    paintOnline();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.open){if(state.keyboard)setKeyboard(false);else setOpen(false);}});
}

sessionLoad();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
root.KeloChat=Object.freeze({
  version:VERSION,
  open:()=>setOpen(true),close:()=>setOpen(false),toggle:()=>setOpen(),
  showKeyboard:()=>setKeyboard(true),hideKeyboard:()=>setKeyboard(false),
  sendMessage,receiveMessage,
  snapshot:()=>Object.freeze({open:state.open,keyboard:state.keyboard,layer:state.layer,draftLength:state.draft.length,messageCount:state.messages.length,maxMessage:MAX_MESSAGE,maxViewportFraction:.5,networkTransport:'adapter-only'})
});
root.KELO_CHAT_AUDIT=Object.freeze({version:VERSION,retractable:true,drag:true,maxHalfViewport:true,customKeyboard:true,nativeKeyboardDefault:false,collapsedWorldTouchPassThrough:true,networkTransport:'adapter-only'});
})(typeof globalThis!=='undefined'?globalThis:window);
