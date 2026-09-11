/* KELO-INDEX
 * area: STUDIO / INPUT / QUICK ACTIONS
 * owner: Kelo Studio Quick Actions
 * keys: SELECTION NAVIGATION MOBILE SHORTCUTS GRID WORKSPACE PLAYTEST SAVE TOUCH DOCK
 * owns: local selection accelerators and delegation to existing Studio UI actions
 * does-not-own: document mutation, CommandBus, authority, camera math or tool internals
 * online: no direct writes; persistent actions click the existing Studio controls so their CommandBus/authority path remains canonical
 */

const EDITABLE='input,textarea,select,[contenteditable="true"]';
const handled=e=>{e.preventDefault?.();e.stopImmediatePropagation?.();};
const rootNode=root=>root.document?.querySelector?.('#kelo-studio-live')||null;
const button=(root,selector)=>rootNode(root)?.querySelector?.(selector)||null;
const click=(root,selector)=>{const el=button(root,selector);if(!el||el.disabled)return false;el.click();return true;};

export function createStudioQuickActionsController({root=globalThis,kernel,assetPalette}={}){
  if(!root?.document||!kernel?.selection) return Object.freeze({destroy(){}});
  const document=root.document;
  let destroyed=false,observer=null,bar=null,style=null,mobileDock=null,mobileMore=null;

  const ids=()=>kernel.document?.entities?.map?.(e=>String(e.id))||[];
  const selected=()=>kernel.selection.get().map(String);
  const setSelection=list=>kernel.selection.set(Array.from(new Set(list.map(String))));

  function selectAll(){const all=ids();setSelection(all);return all.length;}
  function invertSelection(){const current=new Set(selected());const next=ids().filter(id=>!current.has(id));setSelection(next);return next.length;}
  function clearSelection(){if(!selected().length)return false;kernel.selection.clear();return true;}
  function cycleSelection(direction=1){const all=ids();if(!all.length)return false;const current=selected(),anchor=current[current.length-1];let index=all.indexOf(anchor);if(index<0)index=direction>0?-1:0;index=(index+direction+all.length)%all.length;kernel.selection.set(all[index]);return all[index];}
  function focusAssetSearch(){try{assetPalette?.open?.();}catch{}const shell=rootNode(root);if(!shell)return false;const mobile=(root.innerWidth||9999)<=760;if(mobile){shell.dataset.sheetOpen='1';shell.querySelectorAll?.('[data-tab]')?.forEach?.(el=>el.classList.toggle('on',el.dataset.tab==='assets'));shell.querySelectorAll?.('.ks-mobile-pane')?.forEach?.(el=>el.classList.toggle('on',el.dataset.pane==='assets'));}const input=shell.querySelector(mobile?'.ks-asset-search-mobile':'.ks-asset-search')||shell.querySelector('.ks-asset-search');if(!input)return false;input.focus();input.select?.();return true;}
  const toggleGrid=()=>click(root,'[data-ext="grid"]');
  const toggleWorkspace=()=>click(root,'[data-studio-minimize="1"]');
  const togglePlaytest=()=>click(root,'[data-act="play"]');
  const save=()=>click(root,'[data-act="save"]');
  const undo=()=>click(root,'[data-act="undo"]');
  const redo=()=>click(root,'[data-act="redo"]');
  const duplicate=()=>click(root,'[data-act="duplicate"]');
  const remove=()=>click(root,'[data-act="delete"]');
  const rotate=()=>click(root,'[data-act="rotate"]');
  const scaleDown=()=>click(root,'[data-act="scale-down"]');
  const scaleReset=()=>click(root,'[data-act="scale-reset"]');
  const scaleUp=()=>click(root,'[data-act="scale-up"]');
  const focusSelection=()=>click(root,'[data-act="focus"]');
  const toggleErase=()=>click(root,'[data-act="erase"]');
  const openAssets=()=>click(root,'[data-act="edit-assets"]');
  function numericMode(n){const modes={1:'select',2:'move',3:'terrain',4:'path',5:'collision',6:'camera'},mode=modes[n];if(!mode)return false;return mode==='camera'?click(root,'[data-ext="camera"]'):click(root,`[data-mode="${mode}"]`);}
  function openMobilePane(name){const shell=rootNode(root);if(!shell)return false;shell.dataset.sheetOpen='1';shell.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('on',el.dataset.tab===name));shell.querySelectorAll('[data-pane]').forEach(el=>el.classList.toggle('on',el.dataset.pane===name));return true;}
  function closeMobileSheet(){const shell=rootNode(root);if(!shell)return false;shell.dataset.sheetOpen='0';document.activeElement?.blur?.();return true;}
  function toggleMore(){if(!mobileMore)return false;const open=mobileMore.dataset.open!=='1';mobileMore.dataset.open=open?'1':'0';mobileMore.hidden=!open;return open;}

  function onKey(e){if(destroyed||e.defaultPrevented||e.repeat||e.target?.closest?.(EDITABLE))return;const k=String(e.key||'').toLowerCase(),mod=!!(e.metaKey||e.ctrlKey);if(mod&&k==='a'){handled(e);e.shiftKey?invertSelection():selectAll();return;}if(k==='escape'&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&selected().length){handled(e);clearSelection();return;}if(k==='tab'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){handled(e);cycleSelection(e.shiftKey?-1:1);return;}if(k==='/'&&!mod&&!e.altKey){handled(e);focusAssetSearch();return;}if(k==='g'&&e.shiftKey&&!mod&&!e.altKey){handled(e);toggleGrid();return;}if(k==='m'&&!mod&&!e.altKey){handled(e);toggleWorkspace();return;}if(k==='enter'&&mod){handled(e);save();return;}if(k==='p'&&e.shiftKey&&!mod&&!e.altKey){handled(e);togglePlaytest();return;}if(/^[1-6]$/.test(k)&&!mod&&!e.altKey&&!e.shiftKey){handled(e);numericMode(Number(k));}}

  const mobileActions={undo,redo,duplicate,delete:remove,rotate,down:scaleDown,reset:scaleReset,up:scaleUp,focus:focusSelection,assets:openAssets,explorer:()=>openMobilePane('explorer'),properties:()=>openMobilePane('properties'),select:()=>numericMode(1),move:()=>numericMode(2),terrain:()=>numericMode(3),path:()=>numericMode(4),collision:()=>numericMode(5),erase:toggleErase,clear:clearSelection,close:closeMobileSheet,more:toggleMore};
  function onMobileAction(e){const act=e.target?.closest?.('[data-mobile-quick]')?.dataset.mobileQuick;if(act&&mobileActions[act])mobileActions[act]();}

  function mountMobile(shell){if(mobileDock?.isConnected)return;mobileDock=document.createElement('nav');mobileDock.className='ks-mobile-quick-dock';mobileDock.setAttribute('aria-label','Acciones rápidas móviles');mobileDock.innerHTML='<button data-mobile-quick="undo" aria-label="Deshacer">↶<small>UNDO</small></button><button data-mobile-quick="redo" aria-label="Rehacer">↷<small>REDO</small></button><button data-mobile-quick="duplicate" aria-label="Duplicar">⧉<small>DUP</small></button><button data-mobile-quick="focus" aria-label="Enfocar selección">◎<small>FOCUS</small></button><button data-mobile-quick="more" aria-label="Más herramientas">•••<small>MÁS</small></button>';mobileDock.addEventListener('click',onMobileAction);shell.appendChild(mobileDock);mobileMore=document.createElement('section');mobileMore.className='ks-mobile-quick-more';mobileMore.dataset.open='0';mobileMore.hidden=true;mobileMore.innerHTML='<div class="ks-mobile-quick-head"><strong>ACCIONES RÁPIDAS</strong><button data-mobile-quick="close">×</button></div><div class="ks-mobile-quick-grid"><button data-mobile-quick="assets">▦<small>ASSETS</small></button><button data-mobile-quick="explorer">☷<small>EXPLORER</small></button><button data-mobile-quick="properties">⚙<small>PROPS</small></button><button data-mobile-quick="rotate">⟳<small>ROTAR</small></button><button data-mobile-quick="down">−<small>ESCALA</small></button><button data-mobile-quick="reset">100<small>RESET</small></button><button data-mobile-quick="up">＋<small>ESCALA</small></button><button data-mobile-quick="select">↖<small>SELECT</small></button><button data-mobile-quick="move">✥<small>MOVE</small></button><button data-mobile-quick="terrain">▦<small>GROUND</small></button><button data-mobile-quick="path">⌁<small>ROAD</small></button><button data-mobile-quick="collision">◇<small>COLLISION</small></button><button data-mobile-quick="erase">⌫<small>ERASE</small></button><button data-mobile-quick="clear">○<small>CLEAR</small></button><button class="danger" data-mobile-quick="delete">⌫<small>BORRAR</small></button></div>';mobileMore.addEventListener('click',onMobileAction);shell.appendChild(mobileMore);}

  function mount(){if(destroyed)return;const shell=rootNode(root),slot=shell?.querySelector?.('.ks-productivity-edit-slot');if(!shell)return;if(!style){style=document.createElement('style');style.dataset.keloStudioQuickActions='1';style.textContent=`#kelo-studio-live .ks-quick-select{display:inline-flex;gap:4px;align-items:center}#kelo-studio-live .ks-quick-select button{min-width:44px;min-height:36px;border:1px solid rgba(231,197,106,.22);border-radius:10px;background:#101b1e;color:#dce6e0;font-size:6.5px;font-weight:900;padding:0 7px}.ks-mobile-quick-dock,.ks-mobile-quick-more{display:none}@media(max-width:760px){#kelo-studio-live .ks-quick-select button{min-width:44px;min-height:44px;padding:0 6px}#kelo-studio-live .ks-mobile-quick-dock{display:grid;position:absolute;left:8px;right:8px;bottom:calc(max(6px,env(safe-area-inset-bottom)) + 60px);grid-template-columns:repeat(5,1fr);gap:5px;padding:6px;border:1px solid rgba(231,197,106,.36);border-radius:16px;background:rgba(5,14,16,.96);pointer-events:auto;z-index:8;box-shadow:0 12px 34px rgba(0,0,0,.48);backdrop-filter:blur(14px)}#kelo-studio-live .ks-mobile-quick-dock button,#kelo-studio-live .ks-mobile-quick-more button{min-height:48px;border:1px solid rgba(231,197,106,.24);border-radius:12px;background:#102022;color:#fff0b2;font-size:18px;font-weight:900;-webkit-tap-highlight-color:transparent}#kelo-studio-live .ks-mobile-quick-dock small,#kelo-studio-live .ks-mobile-quick-more small{display:block;font-size:5.5px;letter-spacing:.06em;margin-top:2px;color:#9db4aa}#kelo-studio-live .ks-mobile-quick-more{display:block;position:absolute;left:8px;right:8px;bottom:calc(max(6px,env(safe-area-inset-bottom)) + 122px);max-height:54vh;overflow:auto;padding:8px;border:1px solid rgba(231,197,106,.5);border-radius:17px;background:rgba(5,14,16,.985);pointer-events:auto;z-index:9;box-shadow:0 18px 50px rgba(0,0,0,.6)}#kelo-studio-live .ks-mobile-quick-more[hidden]{display:none}.ks-mobile-quick-head{display:flex;align-items:center;justify-content:space-between;color:#f1d77e;font-size:8px;letter-spacing:.12em;margin-bottom:7px}.ks-mobile-quick-head button{min-width:44px!important;width:44px;min-height:44px!important}.ks-mobile-quick-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.ks-mobile-quick-grid .danger{border-color:rgba(255,122,112,.55)!important;color:#ffd4cf!important;background:rgba(65,24,24,.5)!important}#kelo-studio-live[data-compact="asset"] .ks-mobile-quick-dock{bottom:calc(max(6px,env(safe-area-inset-bottom)) + 58px)}}`;document.head.appendChild(style);}if(slot&&!bar?.isConnected){bar=document.createElement('div');bar.className='ks-quick-select';bar.dataset.quickActions='1';bar.innerHTML='<button type="button" data-quick="all">ALL</button><button type="button" data-quick="invert">INV</button><button type="button" data-quick="clear">CLR</button>';bar.addEventListener('click',e=>{const act=e.target?.closest?.('[data-quick]')?.dataset.quick;if(act==='all')selectAll();else if(act==='invert')invertSelection();else if(act==='clear')clearSelection();});slot.appendChild(bar);}mountMobile(shell);}
  observer=new MutationObserver(mount);observer.observe(document.documentElement||document.body,{childList:true,subtree:true});mount();document.addEventListener('keydown',onKey,true);

  return Object.freeze({version:'studio-quick-actions-v2.0.0-mobile',selectAll,invertSelection,clearSelection,cycleSelection,focusAssetSearch,toggleGrid,toggleWorkspace,togglePlaytest,save,numericMode,undo,redo,duplicate,remove,rotate,scaleDown,scaleReset,scaleUp,focusSelection,openAssets,openMobilePane,closeMobileSheet,toggleErase,destroy(){if(destroyed)return;destroyed=true;document.removeEventListener('keydown',onKey,true);observer?.disconnect();bar?.remove();mobileDock?.remove();mobileMore?.remove();style?.remove();bar=mobileDock=mobileMore=style=null;}}
}
