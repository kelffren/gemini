/* KELO-INDEX
 * area: CREATORS / ASSET FORGE TEMPLATE CONTROLS
 * owner: Kelo Asset Forge UI
 * owns: progressive enhancement for game-aware template selection inside the existing Asset Forge
 * does-not-own: drawing engine, manifest contract, gameplay renderer, persistence or marketplace settlement
 * performance: installed only while Asset Forge is open; no render loop and no observers
 */
import {getAssetTemplate,inferAssetTemplateId,listAssetTemplates} from '../assets/asset-template-registry.mjs';

const CONTROL_ID='kelo-asset-template-controls';
const TEMPLATE_TAGS=new Set(['wearable','head','helmet','legs','pants']);

function splitTags(value=''){return String(value).split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);}
function unique(values){return [...new Set(values.filter(Boolean))];}
function option(document,value,label){const node=document.createElement('option');node.value=value;node.textContent=label;return node;}

export function installAssetForgeTemplateControls({root=globalThis,session=null}={}){
  const document=root.document,shell=session?.shell||document?.getElementById('kelo-asset-forge');
  if(!document||!shell)return()=>{};
  shell.querySelector(`#${CONTROL_ID}`)?.remove();
  const fields=shell.querySelector('.kaf-fields');
  if(!fields)return()=>{};
  const inputs=[...fields.querySelectorAll('input')];
  const nameInput=inputs.find(input=>input.maxLength===80)||inputs.find(input=>input.type==='text');
  const tagsInput=inputs.find(input=>String(input.placeholder||'').toLowerCase().includes('tags'));
  const categoryInput=fields.querySelector('select');
  const sizeInput=shell.querySelector('select[aria-label="Tamaño del asset"]');
  if(!nameInput||!tagsInput||!categoryInput)return()=>{};

  const wrap=document.createElement('div');wrap.id=CONTROL_ID;wrap.className='wide';
  wrap.style.cssText='display:grid;gap:7px;padding:9px;border:1px solid rgba(216,183,102,.18);border-radius:10px;background:#101618';
  const label=document.createElement('label');label.className='kaf-label';label.textContent='GAME TEMPLATE';
  const select=document.createElement('select');select.className='kaf-select';select.setAttribute('aria-label','Game asset template');
  for(const template of listAssetTemplates())select.append(option(document,template.id,template.label));
  const info=document.createElement('div');info.style.cssText='font-size:8px;line-height:1.45;color:#9eada7';
  const quick=document.createElement('div');quick.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:6px';
  const helmetBtn=document.createElement('button');helmetBtn.type='button';helmetBtn.className='kaf-btn';helmetBtn.textContent='NEW HELMET';
  const pantsBtn=document.createElement('button');pantsBtn.type='button';pantsBtn.className='kaf-btn';pantsBtn.textContent='NEW PANTS';quick.append(helmetBtn,pantsBtn);
  wrap.append(label,select,info,quick);fields.prepend(wrap);

  function currentTemplate(){return getAssetTemplate(select.value);}
  function renderInfo(){
    const template=currentTemplate();
    const layers=template.layerPlan.filter(name=>!name.includes('reference')).join(' · ');
    const states=template.previewStates.join(' / ');
    info.textContent=`${template.description} Slot: ${template.slot||'world'}. Capas: ${layers}. Preview: ${states}.`;
  }
  function applyTemplate(id,{resetName=false}={}){
    const template=getAssetTemplate(id);select.value=template.id;
    const preserved=splitTags(tagsInput.value).filter(tag=>!TEMPLATE_TAGS.has(tag));
    tagsInput.value=unique([...preserved,...template.requiredTags]).join(', ');
    categoryInput.value=[...categoryInput.options].some(item=>item.value===template.category)?template.category:categoryInput.value;
    if(resetName||nameInput.value==='New Asset')nameInput.value=template.id==='helmet'?'New Helmet':template.id==='pants'?'New Pants':template.id==='wearable'?'New Wearable':'New Asset';
    if(sizeInput&&template.recommendedSizes.includes(32)&&sizeInput.value!=='32'){sizeInput.value='32';sizeInput.dispatchEvent(new Event('change',{bubbles:true}));}
    renderInfo();
    nameInput.dispatchEvent(new Event('input',{bubbles:true}));tagsInput.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function inferFromFields(){
    const inferred=inferAssetTemplateId({name:nameInput.value,category:categoryInput.value,tags:splitTags(tagsInput.value)});
    if(select.value!==inferred){select.value=inferred;renderInfo();}
  }
  select.addEventListener('change',()=>applyTemplate(select.value));
  helmetBtn.addEventListener('click',()=>applyTemplate('helmet',{resetName:true}));
  pantsBtn.addEventListener('click',()=>applyTemplate('pants',{resetName:true}));
  nameInput.addEventListener('input',inferFromFields);tagsInput.addEventListener('input',inferFromFields);categoryInput.addEventListener('change',inferFromFields);
  select.value=inferAssetTemplateId({name:nameInput.value,category:categoryInput.value,tags:splitTags(tagsInput.value)});renderInfo();

  return()=>{
    nameInput.removeEventListener('input',inferFromFields);tagsInput.removeEventListener('input',inferFromFields);categoryInput.removeEventListener('change',inferFromFields);wrap.remove();
  };
}
