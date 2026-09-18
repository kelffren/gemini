/* KELO-INDEX
 * area: CREATORS / SPRITE OS
 * owner: Creator Runtime
 * keys: SPRITE SEARCH EXTERNAL READY COMPILER LICENSE PASSPORT SIMILAR TRYON RUNTIME WYSIWYG
 * purpose: Turn external sprite metadata into a normalized, license-aware, game-ready descriptor without relying on an internal asset library.
 */

const AUTO_LICENSES=new Set(['CC0','CC0-1.0','CC0 verified subset','CC0 curated subset']);
const ATTRIBUTION_LICENSES=new Set(['CC-BY-3.0','CC-BY-4.0','OGA-BY-3.0']);
const REVIEW_RE=/(?:BY-SA|GPL|UNKNOWN|PDM\/CC-BY discovery|CC0\/PDM\/CC-BY discovery)/i;
const VISUAL_KINDS=new Set(['sprite','animation','image','vfx','tileset']);
const COMMON_FRAMES=[16,24,32,48,64,96,128,192,256];
const COMMON_COLS=[1,2,3,4,6,8,9,10,12,13,16,20,24];
const COMMON_ROWS=[1,2,3,4,8];

function clean(v){return String(v??'').trim();}
function words(v){return clean(v).toLowerCase().split(/[^a-z0-9áéíóúñ]+/i).filter(Boolean);}
function finite(v,f=null){const n=Number(v);return Number.isFinite(n)&&n>0?n:f;}
function number(v,f){const n=Number(v);return Number.isFinite(n)?n:f;}
function textFor(asset){return `${asset?.name||''} ${asset?.category||''} ${asset?.contentKind||''} ${(asset?.tags||[]).join(' ')} ${asset?.description||''}`.toLowerCase();}

export function licensePassport(asset={}){
  const license=clean(asset.license)||'UNKNOWN';
  const attributionRequired=asset.attributionRequired===true||ATTRIBUTION_LICENSES.has(license);
  let state='review';
  if(AUTO_LICENSES.has(license)||/^CC0(?:-|$)/i.test(license))state='clear';
  else if(ATTRIBUTION_LICENSES.has(license)||/^CC-BY-(?:3\.0|4\.0)$/i.test(license))state='attribution';
  else if(REVIEW_RE.test(license))state='review';
  return {
    state,
    license,
    attributionRequired,
    author:clean(asset.author)||null,
    sourceUrl:clean(asset.sourceUrl)||null,
    canAutoUse:state==='clear'||(state==='attribution'&&!!clean(asset.author)&&!!clean(asset.sourceUrl)),
    credit:attributionRequired?`${clean(asset.author)||'Autor desconocido'} · ${license}`:null
  };
}

export function classifySlot(asset={}){
  const t=textFor(asset),kind=clean(asset.contentKind).toLowerCase();
  if(/aura|halo|glow|energy|flame|fire.?ring|magic.?circle/.test(t))return'aura';
  if(/wing|wings|ala|alas/.test(t))return'wings';
  if(/helmet|helm|hat|hood|crown|hair|mask|headgear|casco|sombrero|corona|cabello/.test(t))return'head';
  if(/shield|buckler|escudo/.test(t))return'shield';
  if(/sword|axe|bow|staff|spear|gun|dagger|weapon|blade|mace|wand|katana|espada|hacha|arco|lanza|arma/.test(t))return'weapon';
  if(/pants|trouser|legging|skirt|shorts|pantalon|pierna/.test(t))return'legs';
  if(/boot|shoe|feet|foot|zapato|bota/.test(t))return'feet';
  if(/armor|armour|shirt|jacket|robe|coat|hoodie|chest|torso|camisa|chaqueta|armadura|abrigo/.test(t))return'torso';
  if((kind==='sprite'||kind==='animation')&&/character|avatar|body|personaje|cuerpo|archer|knight|warrior|mage|wizard|rogue|ninja|samurai|hero|npc/.test(t))return'body';
  return'generic';
}

export function readinessFor(asset={}){
  const passport=licensePassport(asset),kind=clean(asset.contentKind).toLowerCase();
  let score=0;
  if(asset.previewUrl)score+=22;
  if(VISUAL_KINDS.has(kind))score+=12;
  if(asset.downloadUrl||asset.integrationReady===true)score+=20;
  if(asset.catalogOnly!==true)score+=8;
  if(asset.verified===true)score+=8;
  if(passport.state==='clear')score+=20;
  else if(passport.state==='attribution')score+=12;
  else score-=22;
  if(finite(asset.columns)||finite(asset.rows))score+=6;
  if(/pixel/.test(textFor(asset)))score+=4;
  score=Math.max(0,Math.min(100,score));
  const canUse=!!asset.previewUrl&&asset.catalogOnly!==true&&asset.integrationReady!==false&&passport.canAutoUse;
  const tier=canUse&&score>=72?'ready':score>=40?'adaptable':'external';
  return {tier,score,canUse,passport};
}

function scoreGrid(width,height,cols,rows){
  if(width%cols||height%rows)return null;
  const fw=width/cols,fh=height/rows;
  if(fw<8||fh<8)return null;
  const squarePenalty=Math.abs(Math.log(Math.max(.125,Math.min(8,fw/fh))))*5;
  const rowBonus=rows===8?18:rows===4?15:rows===1?4:0;
  const colBonus=[3,4,6,8,9,12,13].includes(cols)?10:cols<=16?5:0;
  const frameBonus=COMMON_FRAMES.includes(fw)?8:0;
  return rowBonus+colBonus+frameBonus-squarePenalty-Math.max(0,cols*rows-96)*.15;
}

export function detectSpriteGrid(width,height,asset={}){
  width=finite(width,1);height=finite(height,1);
  const explicitCols=finite(asset.columns),explicitRows=finite(asset.rows);
  if(explicitCols&&explicitRows&&width%explicitCols===0&&height%explicitRows===0){
    return {columns:explicitCols,rows:explicitRows,frameWidth:width/explicitCols,frameHeight:height/explicitRows,directions:[4,8].includes(explicitRows)?explicitRows:null,confidence:'declared'};
  }
  let best={columns:1,rows:1,frameWidth:width,frameHeight:height,directions:null,score:-Infinity};
  for(const rows of COMMON_ROWS)for(const cols of COMMON_COLS){const score=scoreGrid(width,height,cols,rows);if(score!=null&&score>best.score)best={columns:cols,rows,frameWidth:width/cols,frameHeight:height/rows,directions:[4,8].includes(rows)?rows:null,score};}
  if(best.columns===1&&best.rows===1&&width>height&&width%height===0){const cols=width/height;if(cols>=2&&cols<=24)best={columns:cols,rows:1,frameWidth:height,frameHeight:height,directions:null,score:12};}
  return {...best,confidence:best.score>=24?'high':best.score>=12?'medium':'low'};
}

export function compileSpriteAsset(asset={},dimensions={}){
  const width=finite(dimensions.width??asset.width,1),height=finite(dimensions.height??asset.height,1);
  const grid=detectSpriteGrid(width,height,asset),readiness=readinessFor(asset),slot=classifySlot(asset);
  const profile={slot,label:slot==='body'?'Cuerpo':slot==='generic'?'Accesorio':slot,x:.5,y:.5,scale:slot==='body'?.78:.42,rotation:0,alpha:1,layer:['aura','wings'].includes(slot)?'back':'front',order:slot==='body'?100:slot==='aura'?20:200};
  return {
    schema:'sprite-os-passport/v1',
    id:clean(asset.id),name:clean(asset.name||asset.id),provider:clean(asset.provider),sourceUrl:clean(asset.sourceUrl)||null,
    previewUrl:clean(asset.previewUrl)||null,downloadUrl:clean(asset.downloadUrl)||null,contentKind:clean(asset.contentKind)||'sprite',category:clean(asset.category)||'sprite',
    tags:Array.isArray(asset.tags)?asset.tags.slice(0,24):[],description:clean(asset.description),author:clean(asset.author)||null,license:readiness.passport.license,
    attributionRequired:readiness.passport.attributionRequired,credit:readiness.passport.credit,readiness:{tier:readiness.tier,score:readiness.score,canUse:readiness.canUse},
    width,height,columns:grid.columns,rows:grid.rows,frameWidth:grid.frameWidth,frameHeight:grid.frameHeight,directions:grid.directions,gridConfidence:grid.confidence,profile
  };
}

export function liveTryOnProfile(compiled,root=typeof document!=='undefined'?document:null){
  const fallback={...(compiled?.profile||{})};
  const modal=root?.getElementById?.('preview-modal');
  const live=modal?.__keloTryonProfile;
  if(!live?.profile||String(live.assetId||'')!==String(compiled?.id||''))return fallback;
  const p=live.profile,slot=clean(p.slot)||fallback.slot||'generic';
  return {
    ...fallback,
    slot,
    label:clean(p.label)||fallback.label||slot,
    x:number(p.x,fallback.x??.5),
    y:number(p.y,fallback.y??.5),
    scale:Math.max(.05,number(p.scale,fallback.scale??.42)),
    rotation:number(p.rotation,fallback.rotation??0),
    alpha:Math.max(.08,Math.min(1,number(p.alpha,fallback.alpha??1))),
    layer:p.layer==='back'?'back':p.layer==='front'?'front':fallback.layer||'front',
    order:number(p.order,fallback.order??200)
  };
}

export function makeLookEntry(compiled,root=typeof document!=='undefined'?document:null){
  if(!compiled?.id||!compiled?.previewUrl)throw new Error('SPRITE_OS_INVALID_DESCRIPTOR');
  const profile=liveTryOnProfile(compiled,root);
  return {id:compiled.id,name:compiled.name,previewUrl:compiled.previewUrl,previewKind:'image',contentKind:compiled.contentKind,category:compiled.category,tags:compiled.tags||[],description:compiled.description||'',columns:compiled.columns||1,rows:compiled.rows||1,profile,spritePassport:{schema:compiled.schema,provider:compiled.provider,sourceUrl:compiled.sourceUrl,license:compiled.license,author:compiled.author,credit:compiled.credit,frameWidth:compiled.frameWidth,frameHeight:compiled.frameHeight,directions:compiled.directions,gridConfidence:compiled.gridConfidence}};
}

export function buildSimilarQuery(asset={}){
  const stop=new Set(['sprite','pixel','art','asset','game','character','animation','free','cc0','the','and','for','with']);
  const tokens=[...(asset.tags||[]).flatMap(words),...words(asset.category),...words(asset.name)].filter(x=>x.length>2&&!stop.has(x));
  return [...new Set(tokens)].slice(0,5).join(' ');
}

export const SPRITE_OS_ENGINE=Object.freeze({licensePassport,classifySlot,readinessFor,detectSpriteGrid,compileSpriteAsset,liveTryOnProfile,makeLookEntry,buildSimilarQuery});
