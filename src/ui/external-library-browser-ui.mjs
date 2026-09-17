/* KELO-INDEX
 * area: UI / UNIVERSAL CONTENT LIBRARY / EXTERNAL SOURCES
 * owner: Kelo External Library Browser UI
 * keys: EXTERNAL LIBRARIES PROVIDERS EXPLORE SEARCH PAGINATION MOBILE NO-DOWNLOAD
 * purpose: turn the Sources tab into an in-app library navigator without downloading binaries while browsing
 */
import {getProviderStatuses} from '../creators/assets/external-asset-providers.mjs?v=10';

const root=globalThis,doc=root.document;
const $=id=>doc.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let providers=[];
let mounted=false;
let observer=null;

function flash(text){
  const toast=$('toast');
  if(!toast)return;
  toast.textContent=String(text||'');
  toast.classList.add('on');
  clearTimeout(flash.timer);
  flash.timer=setTimeout(()=>toast.classList.remove('on'),2200);
}

function injectStyles(){
  if($('kelo-external-library-browser-style'))return;
  const style=doc.createElement('style');
  style.id='kelo-external-library-browser-style';
  style.textContent=`
    #sources-view .library-intro{margin:0 2px 10px;padding:12px 13px;border:1px solid rgba(232,201,111,.22);border-radius:15px;background:rgba(232,201,111,.055);color:#c7cbd2;font-size:10px;line-height:1.5}
    #sources-view .source{grid-template-columns:1fr;gap:10px}
    #sources-view .source-actions{display:grid;grid-template-columns:1fr auto;gap:7px}
    #sources-view .source-actions .btn{min-height:40px}
    #sources-view .source-actions .browse-here{border-color:#b79641;background:linear-gradient(180deg,#e6c86f,#af8c37);color:#171207}
    #explore-view .library-focus{display:flex;align-items:center;gap:9px;margin:0 0 9px;padding:10px 11px;border:1px solid #303640;border-radius:14px;background:#101319}
    #explore-view .library-focus[hidden]{display:none}
    #explore-view .library-focus-copy{min-width:0;flex:1}
    #explore-view .library-focus-copy b{display:block;font-size:11px;color:#f3dda1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #explore-view .library-focus-copy span{display:block;margin-top:3px;font-size:9px;color:var(--muted)}
    #explore-view .library-focus .btn{min-height:34px;white-space:nowrap}
  `;
  doc.head.appendChild(style);
}

function ensureIntro(){
  const view=$('sources-view');
  if(!view||$('external-library-intro'))return;
  const intro=doc.createElement('div');
  intro.id='external-library-intro';
  intro.className='library-intro';
  intro.innerHTML='<b>Explora antes de traer.</b> Entra a una librería, navega sus páginas y busca solo dentro de ella. Kelo carga metadata ligera; ningún asset pesado se descarga hasta que pulses Descargar.';
  const title=view.querySelector('.section-title');
  title?.insertAdjacentElement('afterend',intro);
}

function ensureFocusBanner(){
  const explore=$('explore-view');
  const search=$('search');
  if(!explore||!search||$('external-library-focus'))return;
  const banner=doc.createElement('div');
  banner.id='external-library-focus';
  banner.className='library-focus';
  banner.hidden=true;
  banner.innerHTML='<div class="library-focus-copy"><b id="external-library-focus-name">Librería</b><span id="external-library-focus-note">Explorando solo este proveedor</span></div><button class="btn" type="button" data-library-all>Ver todas</button>';
  search.insertAdjacentElement('beforebegin',banner);
}

function providerFor(id){return providers.find(p=>p.id===id)||null;}
function selectedProviderId(){return doc.querySelector('#provider-filters [data-provider].on')?.dataset?.provider||'all';}

function updateFocus(id=selectedProviderId()){
  ensureFocusBanner();
  const banner=$('external-library-focus'),search=$('search');
  if(!banner||!search)return;
  if(!id||id==='all'){
    banner.hidden=true;
    search.placeholder='Buscar en todas las bibliotecas conectadas…';
    return;
  }
  const provider=providerFor(id),name=provider?.name||id;
  banner.hidden=false;
  const nameEl=$('external-library-focus-name'),note=$('external-library-focus-note');
  if(nameEl)nameEl.textContent=name;
  if(note)note.textContent=provider?.requiresQuery?'Busca dentro de esta librería · no se descargan archivos al navegar':'Navegación paginada · no se descargan archivos al navegar';
  search.placeholder=`Buscar dentro de ${name}…`;
}

function decorateSources(){
  const list=$('sources-list');
  if(!list||!providers.length)return;
  const cards=[...list.querySelectorAll('.source')];
  cards.forEach((card,index)=>{
    const provider=providers[index];
    if(!provider||card.dataset.keloLibraryDecorated==='1')return;
    card.dataset.keloLibraryDecorated='1';
    card.dataset.libraryProvider=provider.id;
    const oldButton=card.querySelector('[data-source-open]');
    if(oldButton)oldButton.textContent='Web';
    const actions=doc.createElement('div');
    actions.className='source-actions';
    actions.innerHTML=`<button class="btn browse-here" type="button" data-explore-library="${esc(provider.id)}">Explorar aquí</button>`;
    if(oldButton){oldButton.replaceWith(actions);actions.appendChild(oldButton);}else card.appendChild(actions);
  });
}

function watchSources(){
  const list=$('sources-list');
  if(!list||observer)return;
  observer=new MutationObserver(()=>decorateSources());
  observer.observe(list,{childList:true,subtree:false});
}

async function openLibrary(id){
  const provider=providerFor(id);
  const exploreTab=doc.querySelector('[data-tab="explore"]');
  const filter=doc.querySelector(`#provider-filters [data-provider="${CSS.escape(id)}"]`);
  exploreTab?.click();
  if(filter)filter.click();
  else{flash('Esta librería no está disponible en el explorador interno.');return;}
  updateFocus(id);
  const search=$('search');
  if(provider?.requiresQuery){
    search?.focus({preventScroll:true});
    setTimeout(()=>search?.scrollIntoView({behavior:'smooth',block:'center'}),80);
    flash(`Escribe qué quieres buscar dentro de ${provider.name}.`);
  }else{
    setTimeout(()=>$('explore-view')?.scrollIntoView({behavior:'smooth',block:'start'}),80);
    flash(`Explorando ${provider?.name||id}.`);
  }
}

function bind(){
  doc.addEventListener('click',event=>{
    const library=event.target.closest?.('[data-explore-library]');
    if(library){event.preventDefault();event.stopPropagation();void openLibrary(library.dataset.exploreLibrary);return;}
    const all=event.target.closest?.('[data-library-all]');
    if(all){event.preventDefault();const filter=doc.querySelector('#provider-filters [data-provider="all"]');filter?.click();updateFocus('all');return;}
    const providerButton=event.target.closest?.('#provider-filters [data-provider]');
    if(providerButton)setTimeout(()=>updateFocus(providerButton.dataset.provider),0);
  },true);
}

async function mount(){
  if(mounted)return;
  injectStyles();
  const sourceTab=doc.querySelector('[data-tab="sources"]');
  if(sourceTab)sourceTab.textContent='Librerías';
  ensureIntro();
  ensureFocusBanner();
  bind();
  try{providers=await getProviderStatuses();}catch(error){console.error('[Kelo external libraries]',error);providers=[];}
  watchSources();
  decorateSources();
  updateFocus();
  mounted=true;
}

if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>void mount(),{once:true});else void mount();
root.addEventListener?.('pageshow',()=>{decorateSources();updateFocus();});

export const KeloExternalLibraryBrowserUI=Object.freeze({version:'external-library-browser-ui-v1',openLibrary,get providers(){return providers.slice();}});
