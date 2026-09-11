/* KELO-INDEX
 * area: STUDIO / INPUT / QUICK ACTIONS
 * owner: Kelo Studio Quick Actions
 * keys: SELECTION NAVIGATION MOBILE SHORTCUTS GRID WORKSPACE PLAYTEST SAVE
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
  let destroyed=false,observer=null,bar=null,style=null;

  const ids=()=>kernel.document?.entities?.map?.(e=>String(e.id))||[];
  const selected=()=>kernel.selection.get().map(String);
  const setSelection=list=>kernel.selection.set(Array.from(new Set(list.map(String))));

  function selectAll(){const all=ids();setSelection(all);return all.length;}
  function invertSelection(){const current=new Set(selected());const next=ids().filter(id=>!current.has(id));setSelection(next);return next.length;}
  function clearSelection(){if(!selected().length)return false;kernel.selection.clear();return true;}
  function cycleSelection(direction=1){
    const all=ids();if(!all.length)return false;
    const current=selected();const anchor=current[current.length-1];let index=all.indexOf(anchor);
    if(index<0)index=direction>0?-1:0;
    index=(index+direction+all.length)%all.length;
    kernel.selection.set(all[index]);return all[index];
  }
  function focusAssetSearch(){
    try{assetPalette?.open?.();}catch{}
    const shell=rootNode(root);
    if(!shell)return false;
    const mobile=(root.innerWidth||9999)<=760;
    if(mobile){
      shell.dataset.sheetOpen='1';
      shell.querySelectorAll?.('[data-tab]')?.forEach?.(el=>el.classList.toggle('on',el.dataset.tab==='assets'));
      shell.querySelectorAll?.('.ks-mobile-pane')?.forEach?.(el=>el.classList.toggle('on',el.dataset.pane==='assets'));
    }
    const input=shell.querySelector(mobile?'.ks-asset-search-mobile':'.ks-asset-search')||shell.querySelector('.ks-asset-search');
    if(!input)return false;input.focus();input.select?.();return true;
  }
  const toggleGrid=()=>click(root,'[data-ext="grid"]');
  const toggleWorkspace=()=>click(root,'[data-studio-minimize="1"]');
  const togglePlaytest=()=>click(root,'[data-act="play"]');
  const save=()=>click(root,'[data-act="save"]');
  function numericMode(n){
    const modes={1:'select',2:'move',3:'terrain',4:'path',5:'collision',6:'camera'};
    const mode=modes[n];if(!mode)return false;
    return mode==='camera'?click(root,'[data-ext="camera"]'):click(root,`[data-mode="${mode}"]`);
  }

  function onKey(e){
    if(destroyed||e.defaultPrevented||e.repeat||e.target?.closest?.(EDITABLE))return;
    const k=String(e.key||'').toLowerCase(),mod=!!(e.metaKey||e.ctrlKey);
    if(mod&&k==='a'){handled(e);e.shiftKey?invertSelection():selectAll();return;}
    if(k==='escape'&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&selected().length){handled(e);clearSelection();return;}
    if(k==='tab'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){handled(e);cycleSelection(e.shiftKey?-1:1);return;}
    if(k==='/'&&!mod&&!e.altKey){handled(e);focusAssetSearch();return;}
    if(k==='g'&&e.shiftKey&&!mod&&!e.altKey){handled(e);toggleGrid();return;}
    if(k==='m'&&!mod&&!e.altKey){handled(e);toggleWorkspace();return;}
    if(k==='enter'&&mod){handled(e);save();return;}
    if(k==='p'&&e.shiftKey&&!mod&&!e.altKey){handled(e);togglePlaytest();return;}
    if(/^[1-6]$/.test(k)&&!mod&&!e.altKey&&!e.shiftKey){handled(e);numericMode(Number(k));}
  }

  function mount(){
    if(destroyed||bar?.isConnected)return;
    const shell=rootNode(root),slot=shell?.querySelector?.('.ks-productivity-edit-slot');if(!shell||!slot)return;
    if(!style){style=document.createElement('style');style.dataset.keloStudioQuickActions='1';style.textContent=`
      #kelo-studio-live .ks-quick-select{display:inline-flex;gap:4px;align-items:center}
      #kelo-studio-live .ks-quick-select button{min-width:44px;min-height:36px;border:1px solid rgba(231,197,106,.22);border-radius:10px;background:#101b1e;color:#dce6e0;font-size:6.5px;font-weight:900;padding:0 7px}
      @media(max-width:760px){#kelo-studio-live .ks-quick-select button{min-width:44px;min-height:44px;padding:0 6px}}
    `;document.head.appendChild(style);}
    bar=document.createElement('div');bar.className='ks-quick-select';bar.dataset.quickActions='1';bar.innerHTML='<button type="button" data-quick="all" aria-label="Seleccionar todos">ALL</button><button type="button" data-quick="invert" aria-label="Invertir selección">INV</button><button type="button" data-quick="clear" aria-label="Limpiar selección">CLR</button>';
    bar.addEventListener('click',e=>{const act=e.target?.closest?.('[data-quick]')?.dataset.quick;if(act==='all')selectAll();else if(act==='invert')invertSelection();else if(act==='clear')clearSelection();});
    slot.appendChild(bar);
  }
  observer=new MutationObserver(mount);observer.observe(document.documentElement||document.body,{childList:true,subtree:true});mount();
  document.addEventListener('keydown',onKey,true);

  return Object.freeze({
    version:'studio-quick-actions-v1.0.0',selectAll,invertSelection,clearSelection,cycleSelection,focusAssetSearch,toggleGrid,toggleWorkspace,togglePlaytest,save,numericMode,
    destroy(){if(destroyed)return;destroyed=true;document.removeEventListener('keydown',onKey,true);observer?.disconnect();bar?.remove();style?.remove();bar=null;style=null;}
  });
}
