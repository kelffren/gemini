/* KELO-INDEX
 * area: CREATORS / ASSET TEMPLATES
 * owner: Kelo Asset Forge
 * owns: game-aware asset templates, slot metadata and template-specific QA hints
 * does-not-own: DOM, gameplay equipment state, renderer composition, marketplace settlement or remote AI
 * performance: immutable data + pure functions; no timers, observers or network calls
 */

export const ASSET_TEMPLATE_SCHEMA_VERSION = 'kelo.asset-template.v1';

const freeze = value => Object.freeze(value);
const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const TEMPLATES = freeze({
  prop: freeze({
    id:'prop', label:'Free Asset', category:'prop', slot:null, recommendedSizes:freeze([16,24,32,48,64]),
    anchor:freeze({x:.5,y:1}), safeBounds:null, requiredTags:freeze([]), occludes:freeze([]),
    layerPlan:freeze(['reference','base','shadow','highlight']),
    directions:freeze([]), previewStates:freeze(['static']),
    description:'Plantilla libre para props y objetos del mundo.'
  }),
  wearable: freeze({
    id:'wearable', label:'Wearable', category:'wearable', slot:'wearable', recommendedSizes:freeze([32,48,64]),
    anchor:freeze({x:.5,y:.5}), safeBounds:freeze({x:.05,y:.05,width:.9,height:.9}), requiredTags:freeze(['wearable']), occludes:freeze([]),
    layerPlan:freeze(['body-reference','wearable-base','shadow','highlight']),
    directions:freeze(['down','left','right','up']), previewStates:freeze(['idle','walk','run','attack']),
    description:'Base genérica para ropa y accesorios equipables.'
  }),
  helmet: freeze({
    id:'helmet', label:'Helmet / Casco', category:'wearable', slot:'head', recommendedSizes:freeze([32,48,64]),
    anchor:freeze({x:.5,y:.43}), safeBounds:freeze({x:.12,y:.02,width:.76,height:.58}), requiredTags:freeze(['wearable','head','helmet']), occludes:freeze(['hair']),
    layerPlan:freeze(['head-reference','face-safe-area','hair-occlusion','helmet-base','shadow','highlight']),
    directions:freeze(['down','left','right','up']), previewStates:freeze(['idle','walk','run','attack']),
    description:'Casco alineado a cabeza, con zona segura de cara y oclusión de cabello.'
  }),
  pants: freeze({
    id:'pants', label:'Pants / Pantalón', category:'wearable', slot:'legs', recommendedSizes:freeze([32,48,64]),
    anchor:freeze({x:.5,y:.86}), safeBounds:freeze({x:.18,y:.34,width:.64,height:.64}), requiredTags:freeze(['wearable','legs','pants']), occludes:freeze([]),
    layerPlan:freeze(['body-reference','pelvis-guide','legs-safe-area','pants-base','shadow','highlight']),
    directions:freeze(['down','left','right','up']), previewStates:freeze(['idle','walk','run','attack']),
    description:'Pantalón preparado para pelvis y piernas, pensado para probarse en movimiento.'
  })
});

export function listAssetTemplates(){
  return Object.values(TEMPLATES);
}

export function getAssetTemplate(id='prop'){
  return TEMPLATES[normalize(id)] || TEMPLATES.prop;
}

export function inferAssetTemplateId({templateId='',name='',category='',tags=[]}={}){
  const explicit=normalize(templateId);
  if(explicit&&TEMPLATES[explicit])return explicit;
  const words=[normalize(name),normalize(category),...(Array.isArray(tags)?tags:[]).map(normalize)].join('-');
  if(/(^|-)(helmet|helm|casco|headgear)(-|$)/.test(words))return 'helmet';
  if(/(^|-)(pants|pant|trousers|pantalon|pantalones|jeans)(-|$)/.test(words))return 'pants';
  if(normalize(category)==='wearable'||/(^|-)wearable(-|$)/.test(words))return 'wearable';
  return 'prop';
}

export function applyAssetTemplateMetadata({templateId='',name='',category='',tags=[],anchor=null}={}){
  const resolved=inferAssetTemplateId({templateId,name,category,tags});
  const template=getAssetTemplate(resolved);
  const mergedTags=[...new Set([...(Array.isArray(tags)?tags:[]),...template.requiredTags].map(normalize).filter(Boolean))].slice(0,16);
  return freeze({
    templateId:template.id,
    category:template.category||normalize(category)||'prop',
    tags:freeze(mergedTags),
    anchor:freeze({x:clamp01(anchor?.x ?? template.anchor.x),y:clamp01(anchor?.y ?? template.anchor.y)}),
    authoring:freeze({
      schema:ASSET_TEMPLATE_SCHEMA_VERSION,templateId:template.id,slot:template.slot,
      layerPlan:template.layerPlan,directions:template.directions,previewStates:template.previewStates,occludes:template.occludes
    })
  });
}

function normalizedBounds(metrics){
  if(!metrics?.bounds||!metrics.width||!metrics.height)return null;
  return {
    x:metrics.bounds.x/metrics.width,
    y:metrics.bounds.y/metrics.height,
    right:(metrics.bounds.x+metrics.bounds.width)/metrics.width,
    bottom:(metrics.bounds.y+metrics.bounds.height)/metrics.height
  };
}

export function evaluateTemplateCompliance({metrics,manifest}={}){
  const templateId=manifest?.authoring?.templateId || inferAssetTemplateId({name:manifest?.name,category:manifest?.category,tags:manifest?.tags});
  const template=getAssetTemplate(templateId);
  const issues=[];
  if(template.id==='prop')return freeze({template,issues:freeze(issues)});
  const width=Number(metrics?.width||manifest?.dimensions?.width||0);
  const height=Number(metrics?.height||manifest?.dimensions?.height||0);
  if(width&&height&&!template.recommendedSizes.includes(Math.max(width,height))){
    issues.push({code:'TEMPLATE_SIZE',severity:'info',message:`${template.label}: ${Math.max(width,height)}px funciona, pero ${template.recommendedSizes.join('/')}px son los tamaños recomendados.`});
  }
  const bounds=normalizedBounds(metrics);
  const safe=template.safeBounds;
  if(bounds&&safe){
    const outside=bounds.x<safe.x||bounds.y<safe.y||bounds.right>safe.x+safe.width||bounds.bottom>safe.y+safe.height;
    if(outside)issues.push({code:'TEMPLATE_SAFE_AREA',severity:'warn',message:`${template.label}: hay píxeles fuera de la zona segura de ${template.slot||'asset'}. Revísalos antes de probarlo sobre el personaje.`});
  }
  if(manifest?.category!==template.category){
    issues.push({code:'TEMPLATE_CATEGORY',severity:'warn',message:`La plantilla ${template.label} espera category="${template.category}".`});
  }
  const tagSet=new Set(Array.isArray(manifest?.tags)?manifest.tags:[]);
  const missing=template.requiredTags.filter(tag=>!tagSet.has(tag));
  if(missing.length)issues.push({code:'TEMPLATE_TAGS',severity:'info',message:`Faltan tags de plantilla: ${missing.join(', ')}.`});
  return freeze({template,issues:freeze(issues)});
}

export function createAssetTemplateSeed(id='prop'){
  const template=getAssetTemplate(id);
  return freeze({
    schema:ASSET_TEMPLATE_SCHEMA_VERSION,
    templateId:template.id,
    category:template.category,
    slot:template.slot,
    recommendedSizes:template.recommendedSizes,
    anchor:template.anchor,
    safeBounds:template.safeBounds,
    layers:template.layerPlan,
    directions:template.directions,
    previewStates:template.previewStates,
    occludes:template.occludes,
    description:template.description
  });
}
