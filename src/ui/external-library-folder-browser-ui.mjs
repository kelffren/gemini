/* KELO-INDEX
 * area: UI / UNIVERSAL CONTENT LIBRARY / FOLDER BROWSER
 * owner: Kelo External Library Browser UI
 * keys: PACKS FOLDERS CATEGORIES BREADCRUMBS SUBSEARCH MOBILE METADATA ONLY
 * purpose: browse real provider-backed categories and packs inside Kelo before downloading assets
 */
import {getExternalLibraryFacets,clearExternalLibraryFacetCache} from '../creators/assets/external-library-facets.mjs?v=2';
import {getProviderStatuses} from '../creators/assets/external-asset-providers.mjs?v=10';

const root=globalThis,doc=root.document;
const $=id=>doc.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={provider:'all',providers:[],facets:null,loading:false,error:null,active:null,folderFilter:'',providerQuery:'',requestToken:0,mounted:false};

function flash(text){const toast=$('toast');if(!toast)return;toast.textContent=String(text||'');toast.classList.add('on');clearTimeout(flash.timer);flash.timer=setTimeout(()=>toast.classList.remove('on'),1900);}
function providerInfo(id){return state.providers.find(p=>p.id===id)||null;}
function mainSearch(){return $('search');}
function dispatchCoreSearch(){const input=mainSearch();if(input)input.dispatchEvent(new Event('input',{bubbles:true}));}

function injectStyles(){
  if($('kelo-library-folder-style'))return;
  const style=doc.createElement('style');style.id='kelo-library-folder-style';style.textContent=`
    #external-library-folders{margin:0 0 10px;border:1px solid #2b313a;border-radius:16px;background:linear-gradient(150deg,#11151b,#0c0f13);overflow:hidden}
    #external-library-folders[hidden]{display:none}
    .library-folder-head{display:flex;align-items:center;gap:9px;padding:11px 12px;border-bottom:1px solid #242a32}
    .library-folder-head-copy{min-width:0;flex:1}.library-folder-head-copy b{display:block;font-size:11px;color:#f0d996}.library-folder-head-copy span{display:block;margin-top:3px;color:var(--muted);font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .library-folder-mini{min-height:31px;border:1px solid #323945;border-radius:10px;background:#151920;color:#dce0e6;padding:0 9px;font-size:9px;font-weight:850}
    .library-folder-body{padding:10px 11px 12px}.library-folder-label{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 1px 7px}.library-folder-label b{font-size:10px}.library-folder-label span{font-size:8px;color:var(--muted)}
    .library-category-row{display:flex;gap:6px;overflow:auto;padding:0 0 9px;scrollbar-width:none}.library-category{flex:0 0 auto;border:1px solid #343b46;border-radius:11px;background:#151920;color:#d8dce2;padding:8px 10px;font-size:9px;font-weight:850}.library-category small{color:#8e97a4;margin-left:5px}.library-category.on{border-color:#a38843;background:#211d13;color:#f3d993}
    .library-folder-filter{width:100%;height:38px;border:1px solid #303742;border-radius:11px;background:#0d1015;color:#fff;padding:0 11px;font-size:10px;outline:none;margin:0 0 8px}.library-folder-filter:focus{border-color:#806a34}
    .library-pack-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.library-pack{min-width:0;text-align:left;border:1px solid #2e3540;border-radius:12px;background:#13171d;color:#e6e8ec;padding:9px 10px}.library-pack:active{transform:scale(.985)}.library-pack b{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.library-pack span{display:block;margin-top:4px;color:#89929e;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.library-pack.on{border-color:#a38843;background:#211d13}.library-pack.on b{color:#f3d993}
    .library-pack-more{margin-top:8px;color:#7f8793;font-size:8px;text-align:center}.library-folder-empty{padding:16px 8px;text-align:center;color:#8e97a4;font-size:9px;line-height:1.5}
    .library-subsearch{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;margin:0 0 9px;padding:8px;border:1px solid #3b3422;border-radius:14px;background:#17140d}.library-subsearch[hidden]{display:none}.library-crumb{max-width:34vw;color:#e9cd7d;font-size:9px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.library-subsearch input{min-width:0;height:36px;border:1px solid #3b414b;border-radius:10px;background:#0f1217;color:#fff;padding:0 10px;font-size:10px;outline:none}.library-subsearch input:focus{border-color:#987d3c}.library-subsearch button{height:36px;border:1px solid #3b414b;border-radius:10px;background:#171b21;color:#fff;padding:0 10px;font-size:9px;font-weight:900}
    .library-declared{display:flex;gap:6px;flex-wrap:wrap}.library-declared span{border:1px solid #303742;border-radius:999px;background:#13171d;padding:6px 8px;color:#bfc5ce;font-size:8px;font-weight:800}
    @media(min-width:700px){.library-pack-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.library-crumb{max-width:220px}}
  `;doc.head.appendChild(style);
}

function ensureUI(){
  const explore=$('explore-view'),search=mainSearch();if(!explore||!search)return false;
  if(!$('external-library-subsearch')){
    const sub=doc.createElement('div');sub.id='external-library-subsearch';sub.className='library-subsearch';sub.hidden=true;sub.innerHTML='<div class="library-crumb" id="external-library-crumb">Carpeta</div><input id="external-library-asset-search" type="search" autocomplete="off" placeholder="Buscar dentro…"><button type="button" data-library-folder-clear>Salir</button>';
    search.insertAdjacentElement('afterend',sub);
  }
  if(!$('external-library-folders')){
    const panel=doc.createElement('section');panel.id='external-library-folders';panel.hidden=true;panel.innerHTML='<header class="library-folder-head"><div class="library-folder-head-copy"><b id="external-library-folder-title">Carpetas</b><span id="external-library-folder-meta">Metadata bajo demanda</span></div><button class="library-folder-mini" type="button" data-library-folder-refresh>Actualizar índice</button></header><div class="library-folder-body" id="external-library-folder-body"><div class="library-folder-empty">Elige una librería para ver sus carpetas.</div></div>';
    const kinds=$('kind-filters');if(kinds)kinds.insertAdjacentElement('beforebegin',panel);else $('external-library-subsearch').insertAdjacentElement('afterend',panel);
  }
  return true;
}

function resetActive({restoreQuery=true,dispatch=true}={}){
  const search=mainSearch(),sub=$('external-library-subsearch'),subInput=$('external-library-asset-search');
  state.active=null;if(sub)sub.hidden=true;if(subInput)subInput.value='';
  if(search){search.hidden=false;if(restoreQuery)search.value=state.providerQuery||'';if(dispatch)dispatchCoreSearch();}
  render();
}

function applyFacet(facet){
  if(!facet?.query)return;
  const search=mainSearch(),sub=$('external-library-subsearch'),subInput=$('external-library-asset-search');if(!search||!sub||!subInput)return;
  if(!state.active)state.providerQuery=search.value||'';
  state.active={...facet};search.hidden=true;sub.hidden=false;subInput.value='';
  const crumb=$('external-library-crumb');if(crumb)crumb.textContent=`${providerInfo(state.provider)?.name||state.provider} › ${facet.label}`;
  search.value=facet.query;dispatchCoreSearch();render();
  setTimeout(()=>$('explore-grid')?.scrollIntoView({behavior:'smooth',block:'start'}),90);
  flash(`Abriendo ${facet.label}.`);
}

function runSubsearch(){
  if(!state.active)return;
  const input=$('external-library-asset-search'),search=mainSearch();if(!input||!search)return;
  const term=String(input.value||'').trim();search.value=[state.active.query,term].filter(Boolean).join(' ');dispatchCoreSearch();
}

function visiblePacks(){
  const packs=state.facets?.packs||[],q=String(state.folderFilter||'').trim().toLowerCase();
  return q?packs.filter(x=>`${x.label} ${x.group||''} ${x.id}`.toLowerCase().includes(q)):packs;
}

function render(){
  if(!ensureUI())return;
  const panel=$('external-library-folders'),body=$('external-library-folder-body'),title=$('external-library-folder-title'),meta=$('external-library-folder-meta');
  if(state.provider==='all'){panel.hidden=true;return;}panel.hidden=false;
  const provider=providerInfo(state.provider),name=provider?.name||state.provider;if(title)title.textContent=`Explorar ${name}`;
  if(state.loading){if(meta)meta.textContent='Leyendo solo metadata…';body.innerHTML='<div class="library-folder-empty">Indexando carpetas y categorías sin descargar assets…</div>';return;}
  if(state.error){if(meta)meta.textContent='No se pudo leer el árbol';body.innerHTML=`<div class="library-folder-empty">${esc(state.error)}<br>Puedes seguir usando la búsqueda normal.</div>`;return;}
  const data=state.facets;if(!data){if(meta)meta.textContent='Metadata bajo demanda';body.innerHTML='<div class="library-folder-empty">Preparando explorador…</div>';return;}
  const assets=data.summary?.assets,complete=data.summary?.complete;if(meta)meta.textContent=assets==null?(provider?.requiresQuery?'API de búsqueda · sin catálogo completo':'Metadata remota'):`${Number(assets).toLocaleString()} assets indexados${complete?'':' · ventana segura'}`;
  const categories=data.categories||[],packs=visiblePacks(),allPackCount=(data.packs||[]).length,shown=packs.slice(0,120),declared=data.declaredTypes||[];
  let html='';
  if(categories.length){html+=`<div class="library-folder-label"><b>Categorías reales</b><span>${categories.length}</span></div><div class="library-category-row">${categories.map(x=>`<button class="library-category ${state.active?.id===x.id?'on':''}" type="button" data-library-facet-id="${esc(x.id)}" data-library-facet-kind="category">${esc(x.label)}<small>${Number(x.count||0).toLocaleString()}</small></button>`).join('')}</div>`;}
  if((data.packs||[]).length){html+=`<div class="library-folder-label"><b>Packs / carpetas</b><span>${allPackCount}</span></div><input class="library-folder-filter" id="external-library-folder-filter" type="search" autocomplete="off" placeholder="Filtrar carpetas de ${esc(name)}…" value="${esc(state.folderFilter)}"><div class="library-pack-grid">${shown.map(x=>`<button class="library-pack ${state.active?.id===x.id?'on':''}" type="button" data-library-facet-id="${esc(x.id)}" data-library-facet-kind="pack"><b>📁 ${esc(x.label)}</b><span>${esc(x.group||'Pack')} · ${Number(x.count||0).toLocaleString()} assets</span></button>`).join('')}</div>${packs.length>shown.length?`<div class="library-pack-more">Mostrando 120 de ${packs.length}. Usa el filtro para encontrar otra carpeta.</div>`:''}`;}
  if(declared.length){html+=`<div class="library-folder-label"><b>Tipos declarados por la fuente</b><span>buscador remoto</span></div><div class="library-declared">${declared.map(x=>`<span>${esc(x.label)}</span>`).join('')}</div><div class="library-folder-empty">Esta API no expone un árbol completo de carpetas. Busca arriba y Kelo consultará la fuente directamente.</div>`;}
  if(!categories.length&&!(data.packs||[]).length&&!declared.length)html='<div class="library-folder-empty">Esta fuente no publica carpetas navegables. Puedes buscar directamente dentro de ella.</div>';
  body.innerHTML=html;
}

function findFacet(id,kind){const list=kind==='pack'?(state.facets?.packs||[]):(state.facets?.categories||[]);return list.find(x=>x.id===id)||null;}

async function loadProvider(id,{refresh=false}={}){
  id=String(id||'all');const token=++state.requestToken;
  if(state.active)resetActive({restoreQuery:false,dispatch:false});
  state.provider=id;state.folderFilter='';state.facets=null;state.error=null;
  if(id==='all'){state.loading=false;const search=mainSearch();if(search){search.hidden=false;state.providerQuery=search.value||'';}render();return;}
  state.providerQuery=mainSearch()?.value||'';state.loading=true;render();
  try{if(refresh)clearExternalLibraryFacetCache(id);const facets=await getExternalLibraryFacets(id,{refresh});if(token!==state.requestToken)return;state.facets=facets;}
  catch(error){if(token!==state.requestToken)return;console.error('[Kelo library folders]',error);state.error=String(error?.message||error).replaceAll('_',' ');}
  finally{if(token===state.requestToken){state.loading=false;render();}}
}

function prepareSwitch(id){
  const search=mainSearch();if(state.active)resetActive({restoreQuery:false,dispatch:false});
  state.providerQuery='';if(search){search.hidden=false;search.value='';dispatchCoreSearch();}
  setTimeout(()=>void loadProvider(id),0);
}

function bind(){
  doc.addEventListener('click',event=>{
    const facetButton=event.target.closest?.('[data-library-facet-id]');if(facetButton){event.preventDefault();const facet=findFacet(facetButton.dataset.libraryFacetId,facetButton.dataset.libraryFacetKind);applyFacet(facet);return;}
    if(event.target.closest?.('[data-library-folder-clear]')){event.preventDefault();resetActive();return;}
    if(event.target.closest?.('[data-library-folder-refresh]')){event.preventDefault();void loadProvider(state.provider,{refresh:true});return;}
    const providerButton=event.target.closest?.('#provider-filters [data-provider]');if(providerButton){prepareSwitch(providerButton.dataset.provider);return;}
    const sourceButton=event.target.closest?.('[data-explore-library]');if(sourceButton){prepareSwitch(sourceButton.dataset.exploreLibrary);return;}
    if(event.target.closest?.('[data-library-all]')){prepareSwitch('all');return;}
  },true);
  doc.addEventListener('input',event=>{
    if(event.target===mainSearch()&&!state.active){state.providerQuery=event.target.value||'';return;}
    if(event.target?.id==='external-library-asset-search'){runSubsearch();return;}
    if(event.target?.id==='external-library-folder-filter'){state.folderFilter=event.target.value||'';render();const input=$('external-library-folder-filter');if(input){input.focus({preventScroll:true});try{input.setSelectionRange(input.value.length,input.value.length);}catch{}}}
  },true);
}

async function mount(){
  if(state.mounted)return;injectStyles();if(!ensureUI()){setTimeout(()=>void mount(),80);return;}
  try{state.providers=await getProviderStatuses();}catch(error){console.error('[Kelo library folder providers]',error);state.providers=[];}
  bind();state.mounted=true;
  const selected=doc.querySelector('#provider-filters [data-provider].on')?.dataset?.provider||'all';void loadProvider(selected);
}

if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>void mount(),{once:true});else void mount();
root.addEventListener?.('pageshow',()=>{ensureUI();render();});

export const KeloExternalLibraryFolderBrowser=Object.freeze({version:'external-library-folder-browser-v1',openProvider:loadProvider,get state(){return Object.freeze({provider:state.provider,loading:state.loading,active:state.active?{...state.active}:null,folders:state.facets?.packs?.length||0,categories:state.facets?.categories?.length||0});}});
