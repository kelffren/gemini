/* KELO-INDEX
 * area: STUDIO / MOBILE COMMAND SEARCH
 * owner: presentation layer only
 * owns: searchable command discovery inside the mobile tools sheet
 * does-not-own: editor commands, tool state, selection, undo stack, paint, camera, assets or world persistence
 * public-api: installStudioMobileCommandSearch()
 */

const KEY='__KELO_STUDIO_MOBILE_COMMAND_SEARCH_V1__';
const STYLE_ID='kelo-studio-mobile-command-search-v1';
const MOBILE_QUERY='(max-width:760px)';
const RESULT_LIMIT=8;
const RECENTS_KEY='kelo.studio.mobileToolbar.recents';
const FAVORITES_KEY='kelo.studio.mobileToolbar.favorites';

const LABELS=Object.freeze({
  'mode:select':'SELECT','mode:move':'MOVE','mode:terrain':'GROUND','mode:path':'ROAD','mode:collision':'COLLISION',
  'act:edit-assets':'EDITAR ASSETS','act:undo':'UNDO','act:redo':'REDO','act:rotate':'ROTAR','act:duplicate':'DUPLICAR',
  'act:delete':'BORRAR','act:scale-down':'ESCALA −','act:scale-reset':'ESCALA 100%','act:scale-up':'ESCALA +',
  'act:erase':'ERASE','act:save':'SAVE','act:play':'PLAY','act:focus':'ENFOCAR'
});
const ALIASES=Object.freeze({
  'mode:select':'select seleccionar seleccion cursor escoger',
  'mode:move':'move mover desplazar arrastrar',
  'mode:terrain':'ground terrain terreno suelo piso pintar terreno',
  'mode:path':'road path camino carretera calle sendero',
  'mode:collision':'collision colision colisión hitbox bloqueo pared',
  'act:edit-assets':'edit editar asset assets biblioteca cambiar recurso',
  'act:undo':'undo deshacer atras atrás revertir',
  'act:redo':'redo rehacer repetir adelante',
  'act:rotate':'rotate rotar girar giro',
  'act:duplicate':'duplicate duplicar copy copiar clonar',
  'act:delete':'delete borrar eliminar remover quitar',
  'act:scale-down':'scale escala reducir pequeño disminuir',
  'act:scale-reset':'scale escala 100 reset normal original',
  'act:scale-up':'scale escala aumentar grande ampliar',
  'act:erase':'erase borrar pincel limpiar terreno',
  'act:save':'save guardar salvar cambios',
  'act:play':'play probar test preview vista previa jugar',
  'act:focus':'focus enfocar centrar localizar ver'
});

const CSS=`
#kelo-studio-live .ks-command-search{display:none}
@media(max-width:760px){
  #kelo-studio-live .ks-tools-sheet[open] .ks-command-search{display:block;padding:7px 10px 2px}
  #kelo-studio-live .ks-command-search-box{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:5px;align-items:center;min-height:48px;padding:3px;border:1px solid rgba(231,197,106,.25);border-radius:14px;background:rgba(7,17,19,.86)}
  #kelo-studio-live .ks-command-search-input{width:100%;min-width:0;min-height:44px!important;padding:0 11px!important;border:0!important;outline:0!important;border-radius:11px!important;background:transparent!important;color:#f3f7f4!important;font-size:12px!important;font-weight:750!important}
  #kelo-studio-live .ks-command-search-input::placeholder{color:#82978f;opacity:1}
  #kelo-studio-live .ks-command-search-input:focus-visible{outline:2px solid var(--ks-gold,#e7c56a)!important;outline-offset:1px!important}
  #kelo-studio-live .ks-command-search-clear{width:44px!important;min-width:44px!important;height:44px!important;min-height:44px!important;padding:0!important;border-radius:11px!important;font-size:16px!important}
  #kelo-studio-live .ks-command-search-clear[hidden]{display:none!important}
  #kelo-studio-live .ks-command-search-meta{min-height:17px;padding:4px 4px 0;color:#819990;font-size:6.5px;font-weight:850;letter-spacing:.06em}
  #kelo-studio-live .ks-command-search-results{display:none;max-height:min(47dvh,390px);overflow:auto;overscroll-behavior:contain;padding:5px 0 8px;scrollbar-width:none}
  #kelo-studio-live .ks-command-search-results::-webkit-scrollbar{display:none}
  #kelo-studio-live .ks-tools-sheet[data-command-search-active="1"] .ks-command-search-results{display:grid;gap:6px}
  #kelo-studio-live .ks-tools-sheet[data-command-search-active="1"] .ks-tools-sheet-tabs,#kelo-studio-live .ks-tools-sheet[data-command-search-active="1"] .ks-tools-sheet-body{display:none!important}
  #kelo-studio-live .ks-command-search-result{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;width:100%;min-height:50px!important;padding:7px 10px!important;text-align:left!important;border-radius:13px!important}
  #kelo-studio-live .ks-command-search-result[data-active="1"]{border-color:var(--ks-gold,#e7c56a)!important;background:linear-gradient(180deg,#294b3e,#18362e)!important}
  #kelo-studio-live .ks-command-search-result[data-danger="1"]{border-color:rgba(255,122,112,.46)!important;color:#ffd4cf!important}
  #kelo-studio-live .ks-command-search-result-main{min-width:0}
  #kelo-studio-live .ks-command-search-result-main strong{display:block;font-size:8px;font-weight:950;line-height:1.15}
  #kelo-studio-live .ks-command-search-result-main small{display:block;margin-top:3px;color:#8fa79d;font-size:6px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #kelo-studio-live .ks-command-search-result-kind{font-size:5.7px;font-weight:900;letter-spacing:.08em;color:#d3ba6a}
  #kelo-studio-live .ks-command-search-empty{padding:18px 10px;text-align:center;color:#8fa79d;font-size:8px;font-weight:750}
}
@media(prefers-reduced-motion:reduce){#kelo-studio-live .ks-command-search *{animation:none!important;transition:none!important}}
`;

function isMobile(root){if(typeof root?.matchMedia==='function')return root.matchMedia(MOBILE_QUERY).matches;return Number(root?.innerWidth||0)<=760;}
function ensureStyle(doc){let style=doc.getElementById(STYLE_ID);if(style)return style;style=doc.createElement('style');style.id=STYLE_ID;style.textContent=CSS;doc.head.append(style);return style;}
function normalize(value=''){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9+% -]/g,' ').replace(/\s+/g,' ').trim();}
function readList(storage,key){try{const value=JSON.parse(storage?.getItem?.(key)||'[]');return Array.isArray(value)?value:[];}catch{return [];}}
function keyFor(control){if(control?.dataset?.mode)return `mode:${control.dataset.mode}`;if(control?.dataset?.act)return `act:${control.dataset.act}`;return null;}
function categoryFor(key){if(key.startsWith('mode:terrain')||key.startsWith('mode:path')||key.startsWith('mode:collision')||key==='act:erase')return 'TERRENO';if(['act:undo','act:redo','act:rotate','act:duplicate','act:delete','act:scale-down','act:scale-reset','act:scale-up'].includes(key))return 'TRANSFORMAR';if(['act:save','act:play','act:focus'].includes(key))return 'VISTA';return 'CONSTRUIR';}
function displayLabel(control,key){const aria=control?.getAttribute?.('aria-label')?.trim();const text=control?.textContent?.replace(/\s+/g,' ')?.trim();return LABELS[key]||aria||text||key.split(':')[1].replace(/-/g,' ').toUpperCase();}
function collectCommands(shell,root){
  const selectors=['.ks-deck button[data-act]','.ks-deck button[data-mode]','.ks-top button[data-act]','.ks-productivity-view-slot button[data-act]'].join(',');
  const byKey=new Map();
  shell.querySelectorAll(selectors).forEach(control=>{const key=keyFor(control);if(!key||byKey.has(key))return;const label=displayLabel(control,key);byKey.set(key,{key,label,category:categoryFor(key),control,search:normalize(`${label} ${key} ${ALIASES[key]||''}`)});});
  const favorites=readList(root?.localStorage,FAVORITES_KEY),recents=readList(root?.sessionStorage,RECENTS_KEY);
  return [...byKey.values()].map(command=>({...command,favoriteIndex:favorites.indexOf(command.key),recentIndex:recents.indexOf(command.key)}));
}
function score(command,query){if(!query){if(command.favoriteIndex>=0)return 300-command.favoriteIndex;if(command.recentIndex>=0)return 200-command.recentIndex;return 0;}const label=normalize(command.label),key=normalize(command.key),haystack=command.search;if(label===query)return 1000;if(label.startsWith(query))return 900-query.length;if(key.includes(query))return 800-query.length;if(haystack.split(' ').some(token=>token.startsWith(query)))return 700-query.length;if(haystack.includes(query))return 600-query.length;const words=query.split(' ').filter(Boolean);if(words.length>1&&words.every(word=>haystack.includes(word)))return 500-words.length;return -1;}
function searchCommands(shell,root,query){const q=normalize(query);return collectCommands(shell,root).map(command=>({...command,rank:score(command,q)})).filter(command=>command.rank>=0&&!command.control.disabled).sort((a,b)=>b.rank-a.rank||a.label.localeCompare(b.label)).slice(0,RESULT_LIMIT);}
function executeCommand(shell,dialog,command){const current=[...shell.querySelectorAll('[data-act],[data-mode]')].find(control=>keyFor(control)===command.key&&!control.closest('.ks-command-search'));if(!current||current.disabled)return false;current.click();try{if(dialog.open)dialog.close();else dialog.removeAttribute('open');}catch{dialog.removeAttribute('open');}return true;}

function attachToDialog(shell,dialog,root){
  if(!dialog||dialog.dataset.commandSearchBound==='1')return dialog;dialog.dataset.commandSearchBound='1';
  const doc=shell.ownerDocument,head=dialog.querySelector('.ks-tools-sheet-head');if(!head)return dialog;
  const wrap=doc.createElement('section');wrap.className='ks-command-search';wrap.setAttribute('aria-label','Buscar herramientas');
  const listId=`ks-command-search-results-${Math.random().toString(36).slice(2,8)}`;
  wrap.innerHTML=`<div class="ks-command-search-box"><input class="ks-command-search-input" type="search" inputmode="search" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Buscar herramienta…" aria-label="Buscar herramienta" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${listId}"><button type="button" class="ks-command-search-clear" aria-label="Limpiar búsqueda" hidden>×</button></div><div class="ks-command-search-meta" role="status" aria-live="polite"></div><div class="ks-command-search-results" id="${listId}" role="listbox" aria-label="Resultados de herramientas"></div>`;
  head.insertAdjacentElement('afterend',wrap);
  const input=wrap.querySelector('.ks-command-search-input'),clear=wrap.querySelector('.ks-command-search-clear'),meta=wrap.querySelector('.ks-command-search-meta'),results=wrap.querySelector('.ks-command-search-results');let commands=[],activeIndex=-1;
  const setActive=index=>{const buttons=[...results.querySelectorAll('.ks-command-search-result')];if(!buttons.length){activeIndex=-1;input.removeAttribute('aria-activedescendant');return;}activeIndex=Math.max(0,Math.min(index,buttons.length-1));buttons.forEach((button,i)=>{button.dataset.active=i===activeIndex?'1':'0';button.setAttribute('aria-selected',i===activeIndex?'true':'false');});const active=buttons[activeIndex];input.setAttribute('aria-activedescendant',active.id);active.scrollIntoView?.({block:'nearest'});};
  const render=()=>{const query=input.value.trim(),active=!!query;dialog.dataset.commandSearchActive=active?'1':'0';input.setAttribute('aria-expanded',active?'true':'false');clear.hidden=!query;results.replaceChildren();activeIndex=-1;if(!active){meta.textContent='Busca por nombre: road, rotar, guardar…';input.removeAttribute('aria-activedescendant');return;}commands=searchCommands(shell,root,query);meta.textContent=commands.length?`${commands.length} herramienta${commands.length===1?'':'s'} encontrada${commands.length===1?'':'s'}`:'Sin coincidencias';if(!commands.length){const empty=doc.createElement('div');empty.className='ks-command-search-empty';empty.textContent='No encontré esa herramienta.';results.append(empty);return;}commands.forEach((command,index)=>{const button=doc.createElement('button');button.type='button';button.className='ks-command-search-result';button.id=`${listId}-option-${index}`;button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.dataset.commandKey=command.key;if(command.key==='act:delete')button.dataset.danger='1';button.innerHTML='<span class="ks-command-search-result-main"><strong></strong><small></small></span><span class="ks-command-search-result-kind"></span>';button.querySelector('strong').textContent=command.label;button.querySelector('small').textContent=command.favoriteIndex>=0?'★ FAVORITO':command.recentIndex>=0?'USADO RECIENTEMENTE':command.key.replace(':',' · ');button.querySelector('.ks-command-search-result-kind').textContent=command.category;button.addEventListener('pointerenter',()=>setActive(index));button.addEventListener('click',()=>executeCommand(shell,dialog,command));results.append(button);});setActive(0);};
  input.addEventListener('input',render);
  input.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();setActive(activeIndex<0?0:activeIndex+1);return;}if(event.key==='ArrowUp'){event.preventDefault();setActive(activeIndex<0?commands.length-1:activeIndex-1);return;}if(event.key==='Enter'&&activeIndex>=0&&commands[activeIndex]){event.preventDefault();executeCommand(shell,dialog,commands[activeIndex]);return;}if(event.key==='Escape'&&input.value){event.preventDefault();event.stopPropagation();input.value='';render();}});
  clear.addEventListener('click',()=>{input.value='';render();input.focus({preventScroll:true});});dialog.addEventListener('close',()=>{input.value='';render();});render();return dialog;
}

function createController(shell,root){const MutationObserverCtor=root.MutationObserver||globalThis.MutationObserver;let observer=null,destroyed=false,queued=false;const refresh=()=>{if(destroyed||!isMobile(root))return null;const dialog=shell.querySelector(':scope > .ks-tools-sheet');return dialog?attachToDialog(shell,dialog,root):null;};const schedule=()=>{if(queued||destroyed)return;queued=true;queueMicrotask(()=>{queued=false;refresh();});};refresh();if(MutationObserverCtor){observer=new MutationObserverCtor(schedule);observer.observe(shell,{childList:true,subtree:true});}return Object.freeze({refresh,destroy(){destroyed=true;observer?.disconnect?.();shell.querySelector('.ks-command-search')?.remove();}});}

export function installStudioMobileCommandSearch({root=globalThis}={}){
  const doc=root?.document;if(!doc)return Object.freeze({version:'studio-mobile-command-search-v1',refresh:()=>null,destroy:()=>{}});const existing=root[KEY];if(existing?.refresh){existing.refresh();return existing;}const style=ensureStyle(doc),MutationObserverCtor=root.MutationObserver||globalThis.MutationObserver;let destroyed=false,bodyObserver=null,controller=null,observedShell=null;
  const refresh=()=>{if(destroyed)return null;const shell=doc.getElementById('kelo-studio-live');if(!shell)return null;if(shell!==observedShell){controller?.destroy?.();observedShell=shell;controller=createController(shell,root);}return controller?.refresh?.()||null;};refresh();if(MutationObserverCtor){bodyObserver=new MutationObserverCtor(()=>refresh());bodyObserver.observe(doc.body||doc.documentElement,{childList:true,subtree:false});}
  const api=Object.freeze({version:'studio-mobile-command-search-v1.0.0',refresh,destroy(){if(destroyed)return;destroyed=true;bodyObserver?.disconnect?.();controller?.destroy?.();controller=null;observedShell=null;style.remove();try{if(root[KEY]===api)delete root[KEY];}catch{}}});try{root[KEY]=api;}catch{}return api;
}
