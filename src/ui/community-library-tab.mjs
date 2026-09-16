/* KELO-INDEX
 * area: UI / UNIVERSAL CONTENT LIBRARY / COMMUNITY
 * owner: Kelo Community Library UI
 * keys: COMMUNITY CATALOG EQUIP UNEQUIP SLOT PREVIEW MOBILE LAZY
 * purpose: extend asset-vault.html with a community catalog while preserving its external-provider and personal-vault flows
 */
import {
  listCommunityAssets,
  listEquippedCommunityAssets,
  equipCommunityAsset,
  unequipCommunityAsset,
  activeCharacterId,
  refreshGameAvatar,
  renderProfileFor,
} from '../creators/assets/community-asset-library-client.mjs?v=1';

const root=globalThis,doc=root.document;
const state={assets:[],equipped:[],loading:false,error:null,loaded:false};
const $=id=>doc.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function flash(text){
  const toast=$('toast');if(!toast)return;
  toast.textContent=String(text||'');toast.classList.add('on');clearTimeout(flash.timer);flash.timer=setTimeout(()=>toast.classList.remove('on'),2200);
}
function injectStyles(){
  if($('kelo-community-library-style'))return;
  const style=doc.createElement('style');style.id='kelo-community-library-style';style.textContent=`
    #community-view .community-summary{margin:0 2px 9px;color:var(--muted);font-size:10px;line-height:1.45}
    #community-view .community-card .preview{overflow:hidden}
    #community-view .community-card .community-slot{width:100%;height:36px;margin-top:8px;border:1px solid #333944;border-radius:10px;background:#11151b;color:#f5f5f4;padding:0 9px;font:800 10px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    #community-view .community-card .actions{grid-template-columns:1fr auto}
    #community-view .community-card[data-equipped="1"]{border-color:rgba(120,214,162,.45);box-shadow:inset 0 0 0 1px rgba(120,214,162,.08)}
    #community-view .community-card .equipped-note{color:var(--ok)}
    #community-view .community-refresh{min-width:84px}
  `;doc.head.appendChild(style);
}
function mount(){
  injectStyles();
  const tabs=doc.querySelector('.tabs');if(!tabs)return false;
  if(!$('community-tab')){
    const button=doc.createElement('button');button.id='community-tab';button.className='tab';button.dataset.tab='community';button.textContent='Comunidad';tabs.appendChild(button);
  }
  if(!$('community-view')){
    const section=doc.createElement('section');section.id='community-view';section.hidden=true;section.innerHTML=`
      <div class="section-title"><h2>Assets de la comunidad</h2><span id="community-count">Bajo demanda</span></div>
      <p class="community-summary">Solo se muestran publicaciones activas. Equipar guarda una referencia al asset; el PNG/WebP/JPEG se descarga en el teléfono únicamente cuando el avatar lo necesita.</p>
      <div class="filters"><button class="btn community-refresh" id="community-refresh" type="button">Actualizar</button></div>
      <main class="grid" id="community-grid"><div class="empty">Abre Comunidad para cargar el catálogo.</div></main>`;
    const sources=$('sources-view');sources?.parentNode?.insertBefore(section,sources);
  }
  return true;
}
function equippedByPublication(publicationId){return state.equipped.find(row=>row.publicationId===String(publicationId))||null;}
function equippedBySlot(slot){return state.equipped.find(row=>row.slot===String(slot))||null;}
function slotOptions(asset,current){
  const slots=Array.isArray(asset.equipSlots)&&asset.equipSlots.length?asset.equipSlots:[asset.defaultSlot||'outfit'];
  const selected=current?.slot&&slots.includes(current.slot)?current.slot:(asset.defaultSlot||slots[0]);
  return slots.map(slot=>`<option value="${esc(slot)}" ${slot===selected?'selected':''}>${esc(slot)}</option>`).join('');
}
function assetCard(asset){
  const equipped=equippedByPublication(asset.publicationId),profile=renderProfileFor(asset,equipped?.slot||asset.defaultSlot),status=equipped?`Equipado · ${equipped.slot}`:'Publicado',slotOwner=equippedBySlot(profile.slot),buttonLabel=equipped&&equipped.slot===profile.slot?'Quitar':slotOwner?'Reemplazar':'Equipar';
  return `<article class="card community-card" data-community-id="${esc(asset.id)}" data-publication-id="${esc(asset.publicationId)}" data-equipped="${equipped?'1':'0'}">
    <div class="preview" data-community-act="preview"><div class="preview-placeholder"><b>✦</b><span>Toca para previsualizar bajo demanda</span></div><span class="badge ${equipped?'equipped-note':''}">${esc(status)}</span><span class="kind">${esc(String(asset.kind||'asset').toUpperCase())}</span></div>
    <div class="body"><div class="name">${esc(asset.name)}</div><div class="meta">Kelo Community · ${esc(asset.visibility)} · ${(asset.bytes/1024).toFixed(1)} KB · ${asset.dimensions.width}×${asset.dimensions.height}</div>
      <select class="community-slot" data-community-slot aria-label="Slot de ${esc(asset.name)}">${slotOptions(asset,equipped)}</select>
      <div class="actions"><button class="btn primary" data-community-act="equip">${buttonLabel}</button><button class="btn" data-community-act="preview">Ver</button></div>
    </div></article>`;
}
function render(){
  const grid=$('community-grid'),count=$('community-count');if(!grid)return;
  if(state.loading){grid.innerHTML='<div class="empty">Cargando publicaciones activas…</div>';if(count)count.textContent='Cargando…';return;}
  if(state.error){grid.innerHTML=`<div class="empty">No se pudo cargar Comunidad.<br>${esc(state.error)}</div>`;if(count)count.textContent='Sin conexión';return;}
  if(count)count.textContent=`${state.assets.length} publicaciones · ${state.equipped.length} equipadas`;
  grid.innerHTML=state.assets.length?state.assets.map(assetCard).join(''):'<div class="empty">Aún no hay publicaciones comunitarias activas.</div>';
}
async function refresh(){
  if(state.loading)return;state.loading=true;state.error=null;render();
  try{
    state.assets=await listCommunityAssets({limit:60});
    const characterId=activeCharacterId();
    if(characterId){try{state.equipped=await listEquippedCommunityAssets(characterId);}catch(error){if(!/AUTH|JWT|session/i.test(String(error?.message||error)))throw error;state.equipped=[];}}
    else state.equipped=[];
    state.loaded=true;
  }catch(error){console.error('[Kelo community library]',error);state.error=String(error?.message||error).replaceAll('_',' ');}
  finally{state.loading=false;render();}
}
function resolveAsset(card){return state.assets.find(asset=>asset.publicationId===card?.dataset?.publicationId)||null;}
async function equipOrRemove(card){
  const asset=resolveAsset(card);if(!asset)return;
  const select=card.querySelector('[data-community-slot]'),slot=String(select?.value||asset.defaultSlot||'outfit'),same=state.equipped.find(row=>row.publicationId===asset.publicationId&&row.slot===slot);
  const button=card.querySelector('[data-community-act="equip"]');if(button)button.disabled=true;
  try{
    if(same){flash('Quitando del personaje…');await unequipCommunityAsset({slot});}
    else{flash(equippedBySlot(slot)?'Reemplazando asset…':'Equipando…');await equipCommunityAsset({publicationId:asset.publicationId,slot});}
    try{state.equipped=await listEquippedCommunityAssets();}catch{}
    render();
    const refreshed=await refreshGameAvatar();flash(refreshed?(same?'Quitado del personaje':'Equipado en el personaje'):'Cambio guardado · se verá al reconectar');
  }catch(error){console.error('[Kelo community equip]',error);flash(String(error?.message||error).replaceAll('_',' '));render();}
}
async function openPreview(asset){
  const modal=$('preview-modal'),stage=$('preview-stage');if(!modal||!stage||!asset)return;
  stage.className='preview-stage';stage.innerHTML='<div class="preview-loading">Descargando vista previa…</div>';
  if($('preview-name'))$('preview-name').textContent=asset.name||'Asset comunitario';
  if($('preview-subtitle'))$('preview-subtitle').textContent=`Kelo Community · ${asset.kind||'asset'} · ${asset.defaultSlot||'outfit'}`;
  if($('preview-info'))$('preview-info').textContent=`${asset.mime} · ${(asset.bytes/1024).toFixed(1)} KB · SHA verificado · el runtime volverá a validar tamaño/hash al descargar.`;
  modal.hidden=false;doc.body.style.overflow='hidden';
  try{const image=new Image();image.alt=asset.name||'Asset comunitario';image.decoding='async';await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('PREVIEW_LOAD_FAILED'));image.src=asset.previewUrl;});stage.replaceChildren(image);}
  catch(error){stage.innerHTML='<div class="preview-error">No se pudo descargar esta vista previa.</div>';}
}
function showCommunity(show){const view=$('community-view');if(view)view.hidden=!show;}

mount();
doc.addEventListener('click',event=>{
  const tab=event.target.closest?.('[data-tab]');if(tab){const community=tab.dataset.tab==='community';showCommunity(community);if(community&&!state.loaded)void refresh();return;}
  if(event.target.closest?.('#community-refresh')){event.preventDefault();void refresh();return;}
  const card=event.target.closest?.('.community-card');if(!card)return;
  const action=event.target.closest?.('[data-community-act]')?.dataset.communityAct;if(!action)return;
  event.preventDefault();event.stopImmediatePropagation();const asset=resolveAsset(card);
  if(action==='equip')void equipOrRemove(card);else if(action==='preview')void openPreview(asset);
},true);

doc.addEventListener('change',event=>{
  const select=event.target.closest?.('[data-community-slot]');if(!select)return;
  const card=select.closest('.community-card'),asset=resolveAsset(card);if(!asset)return;
  const same=state.equipped.find(row=>row.publicationId===asset.publicationId&&row.slot===select.value),owner=equippedBySlot(select.value),button=card.querySelector('[data-community-act="equip"]');if(button)button.textContent=same?'Quitar':owner?'Reemplazar':'Equipar';
});

root.addEventListener?.('pageshow',()=>{if(!$('community-view'))mount();});
export const KeloCommunityLibraryTab=Object.freeze({version:'community-library-tab-v1',refresh,get state(){return Object.freeze({loaded:state.loaded,loading:state.loading,assets:state.assets.length,equipped:state.equipped.length});}});
