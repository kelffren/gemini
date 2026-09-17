/* KELO-INDEX
 * area: UI / UNIVERSAL CONTENT LIBRARY / PAGE LIFECYCLE
 * owner: Kelo External Library Browser UI
 * keys: PAGINATION DIRECT JUMP HIBERNATE DISPOSABLE PAGE MOBILE VAULT MEMORY OBJECT-URL
 * purpose: keep only the active external-library page alive while allowing direct jumps to distant pages without retaining previous previews
 */
import {releaseObjectURL} from '../creators/assets/personal-asset-vault.mjs?v=3';

const root=globalThis,doc=root.document;
const $=id=>doc.getElementById(id);
const state={mounted:false,pendingPage:null,searchCleanupTimer:0,pagerObserver:null};

function flash(text){
  const toast=$('toast');if(!toast)return;
  toast.textContent=String(text||'');toast.classList.add('on');clearTimeout(flash.timer);flash.timer=setTimeout(()=>toast.classList.remove('on'),1800);
}

function currentPage(){
  const text=$('pager')?.querySelector('.page-status b')?.textContent||'';
  const match=text.match(/(?:Página|Page)\s+(\d+)/i);
  return match?Math.max(1,Number(match[1])||1):1;
}
function isCoreLoading(){return /cargando/i.test($('pager')?.querySelector('.page-status b')?.textContent||'');}

function releaseActivePreviewObjectURL(){
  const modal=$('preview-modal'),asset=modal?.__keloAsset;
  if(asset?.id){try{releaseObjectURL(asset.id);}catch(error){console.warn('[Kelo page lifecycle] object URL release failed',error);}}
}
function prepareForCatalogChange(){releaseActivePreviewObjectURL();}

function injectStyles(){
  if($('kelo-page-lifecycle-style'))return;
  const style=doc.createElement('style');style.id='kelo-page-lifecycle-style';style.textContent=`
    .kelo-page-jump{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center;margin:8px 0 15px;padding:9px;border:1px solid #2b313a;border-radius:14px;background:#0f1217}
    .kelo-page-jump-copy{grid-column:1/-1;color:#8f98a4;font-size:8px;line-height:1.4}.kelo-page-jump-copy b{color:#e7cf8a;font-size:9px}
    .kelo-page-jump input{min-width:0;height:38px;border:1px solid #343b46;border-radius:10px;background:#0b0e12;color:#fff;padding:0 11px;font-size:11px;outline:none}.kelo-page-jump input:focus{border-color:#9d8241}
    .kelo-page-jump button{height:38px;border:1px solid #9d8241;border-radius:10px;background:#211d13;color:#f2da98;padding:0 13px;font-size:9px;font-weight:900;white-space:nowrap}
    @media(max-width:420px){.kelo-page-jump{grid-template-columns:minmax(0,1fr) auto}}
  `;doc.head.appendChild(style);
}

function ensureJumpUI(){
  const pager=$('pager');if(!pager)return false;
  let form=$('external-library-page-jump');
  if(!form){
    form=doc.createElement('form');form.id='external-library-page-jump';form.className='kelo-page-jump';form.innerHTML='<div class="kelo-page-jump-copy"><b>Ir directo a cualquier página</b><br>Solo vive la página actual. Si algo te gusta, guárdalo en Mi Baúl.</div><input id="external-library-page-number" type="number" inputmode="numeric" min="1" max="999999" step="1" aria-label="Número de página" placeholder="Ej. 450"><button type="submit">Ir a página</button>';
    pager.insertAdjacentElement('afterend',form);
    form.addEventListener('submit',event=>{event.preventDefault();const input=$('external-library-page-number'),page=Math.floor(Number(input?.value)||0);if(page<1){flash('Escribe una página válida.');return;}requestPage(page);});
  }
  const input=$('external-library-page-number');if(input&&doc.activeElement!==input&&!state.pendingPage)input.value=String(currentPage());
  return true;
}

function dispatchCorePage(page){
  const pager=$('pager');if(!pager)return;
  const current=currentPage();if(page===current){state.pendingPage=null;const input=$('external-library-page-number');if(input)input.value=String(current);return;}
  prepareForCatalogChange();
  const trigger=doc.createElement('button');trigger.type='button';trigger.hidden=true;trigger.dataset.page=String(page);pager.appendChild(trigger);trigger.click();trigger.remove();
}
function requestPage(page){
  page=Math.max(1,Math.min(999999,Math.floor(Number(page)||1)));
  if(isCoreLoading()){
    state.pendingPage=page;
    const input=$('external-library-page-number');if(input)input.value=String(page);
    flash(`Página ${page} en cola · se abrirá al terminar la consulta activa.`);
    return;
  }
  state.pendingPage=null;dispatchCorePage(page);
}
function flushPendingPage(){
  ensureJumpUI();
  if(state.pendingPage&&!isCoreLoading()){
    const page=state.pendingPage;state.pendingPage=null;dispatchCorePage(page);
  }
}

function bindLifecycle(){
  doc.addEventListener('click',event=>{
    if(event.target.closest?.('[data-preview-close]')||event.target===$('preview-modal')){releaseActivePreviewObjectURL();return;}
    if(event.target.closest?.('[data-page]:not([disabled]),#provider-filters [data-provider],[data-explore-kind],[data-library-facet-id],[data-library-all]'))prepareForCatalogChange();
  },true);
  doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('preview-modal')?.hidden)releaseActivePreviewObjectURL();},true);
  const search=$('search');search?.addEventListener('input',()=>{clearTimeout(state.searchCleanupTimer);state.searchCleanupTimer=setTimeout(prepareForCatalogChange,250);});
  root.addEventListener?.('pagehide',releaseActivePreviewObjectURL);
}

function mount(){
  if(state.mounted)return;
  injectStyles();ensureJumpUI();bindLifecycle();
  const pager=$('pager');if(pager){state.pagerObserver=new MutationObserver(flushPendingPage);state.pagerObserver.observe(pager,{childList:true,subtree:true,characterData:true});}
  root.addEventListener?.('pageshow',()=>{ensureJumpUI();flushPendingPage();});
  state.mounted=true;
}

if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();

export const KeloExternalLibraryPageLifecycle=Object.freeze({version:'kelo-external-library-page-lifecycle-v1',requestPage,releaseActivePreviewObjectURL});
