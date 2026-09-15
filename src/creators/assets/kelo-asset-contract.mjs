/* KELO-INDEX
 * area: CREATORS / ASSET CONTRACT
 * owner: Kelo Asset Forge
 * owns: portable asset metadata, pixel QA, safe repair heuristics, residency hints and seasonal briefs
 * does-not-own: DOM, persistence, marketplace payments, moderation authority or remote AI credentials
 * performance: pure functions only; no timers, observers, loops outside direct calls
 */
export const KELO_ASSET_SCHEMA_VERSION = 'kelo.asset.v1';
export const MAX_FORGE_EDGE = 64;

const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
const cleanText=(value,fallback='')=>String(value??fallback).trim();
const slug=(value,fallback='asset')=>cleanText(value,fallback).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||fallback;

export function createAssetId(name='asset', now=Date.now()){
  return `${slug(name)}-${Number(now).toString(36)}`;
}

export function createKeloAssetManifest({
  id=null,name='Untitled Asset',creatorId='local_pioneer',category='prop',tags=[],width=32,height=32,
  anchor={x:.5,y:1},collision=null,dependencies=[],season=null,createdAt=new Date().toISOString(),updatedAt=createdAt,
  source='asset-forge',license='creator-owned',priceKC=0,status='draft'
}={}){
  const w=clamp(Math.round(width),1,MAX_FORGE_EDGE),h=clamp(Math.round(height),1,MAX_FORGE_EDGE);
  const normalizedTags=[...new Set((Array.isArray(tags)?tags:[]).map(v=>slug(v,'')).filter(Boolean))].slice(0,16);
  const safeId=slug(id||createAssetId(name));
  const safeCollision=collision&&typeof collision==='object'?{
    x:clamp(collision.x,0,w),y:clamp(collision.y,0,h),
    width:clamp(collision.width,0,w),height:clamp(collision.height,0,h)
  }:null;
  return Object.freeze({
    schema:KELO_ASSET_SCHEMA_VERSION,id:safeId,name:cleanText(name,'Untitled Asset').slice(0,80),
    creatorId:cleanText(creatorId,'local_pioneer').slice(0,80),category:slug(category,'prop'),tags:Object.freeze(normalizedTags),
    dimensions:Object.freeze({width:w,height:h}),anchor:Object.freeze({x:clamp(anchor?.x,0,1),y:clamp(anchor?.y,0,1)}),
    collision:safeCollision?Object.freeze(safeCollision):null,dependencies:Object.freeze((Array.isArray(dependencies)?dependencies:[]).map(String).slice(0,32)),
    season:season?slug(season):null,source:cleanText(source,'asset-forge'),license:cleanText(license,'creator-owned'),
    commerce:Object.freeze({priceKC:Math.max(0,Math.round(Number(priceKC)||0)),status:cleanText(status,'draft')}),
    lifecycle:Object.freeze({createdAt,updatedAt})
  });
}

export function inspectPixelBuffer({width,height,data}={}){
  const w=Math.max(1,Math.round(Number(width)||0)),h=Math.max(1,Math.round(Number(height)||0));
  if(!data||typeof data.length!=='number'||data.length<w*h*4)throw new Error('KELO_ASSET_PIXEL_BUFFER_INVALID');
  let visible=0,semi=0,minX=w,minY=h,maxX=-1,maxY=-1;
  const palette=new Set();
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,a=data[i+3];
    if(a===0)continue;
    visible++;
    if(a<255)semi++;
    minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    if(a>24)palette.add(`${data[i]>>3},${data[i+1]>>3},${data[i+2]>>3},${a>>5}`);
  }
  const bounds=visible?{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}:null;
  return Object.freeze({
    width:w,height:h,totalPixels:w*h,visiblePixels:visible,coverage:visible/(w*h),semiTransparentPixels:semi,
    paletteBuckets:palette.size,bounds,estimatedRgbaBytes:w*h*4
  });
}

export function evaluateAsset({width,height,data,manifest=null}={}){
  const metrics=inspectPixelBuffer({width,height,data});
  const issues=[];let score=100;
  if(metrics.visiblePixels===0){issues.push({code:'EMPTY',severity:'error',message:'El asset está vacío.'});score-=70;}
  if(metrics.coverage>0.92){issues.push({code:'EDGE_DENSITY',severity:'warn',message:'Casi todo el canvas está ocupado; deja margen para evitar cortes.'});score-=10;}
  if(metrics.coverage>0&&metrics.coverage<0.015){issues.push({code:'TOO_SPARSE',severity:'warn',message:'Hay muy pocos píxeles visibles; puede ser ruido o un asset demasiado pequeño.'});score-=14;}
  if(metrics.semiTransparentPixels>Math.max(4,metrics.visiblePixels*.28)){issues.push({code:'ALPHA_NOISE',severity:'warn',message:'Demasiados píxeles semitransparentes para pixel art; revisa bordes.'});score-=8;}
  if(metrics.paletteBuckets>48){issues.push({code:'PALETTE_HEAVY',severity:'info',message:'Paleta muy amplia. Reducir colores suele mejorar coherencia y compresión.'});score-=5;}
  if(metrics.width>MAX_FORGE_EDGE||metrics.height>MAX_FORGE_EDGE){issues.push({code:'EDGE_LIMIT',severity:'error',message:`Asset Forge V1 limita cada lado a ${MAX_FORGE_EDGE}px.`});score-=30;}
  if(metrics.bounds){
    const touches=metrics.bounds.x===0||metrics.bounds.y===0||metrics.bounds.x+metrics.bounds.width===metrics.width||metrics.bounds.y+metrics.bounds.height===metrics.height;
    if(touches){issues.push({code:'TOUCHES_BORDER',severity:'info',message:'El dibujo toca el borde; añade margen si no es un tile seamless.'});score-=3;}
  }
  if(manifest&&manifest.schema!==KELO_ASSET_SCHEMA_VERSION){issues.push({code:'SCHEMA',severity:'error',message:'Metadata incompatible con el contrato actual.'});score-=20;}
  score=clamp(Math.round(score),0,100);
  const grade=score>=90?'A':score>=80?'B':score>=70?'C':score>=55?'D':'F';
  return Object.freeze({score,grade,issues:Object.freeze(issues),metrics});
}

function neighborCount(data,w,h,x,y){
  let n=0;
  for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
    if(!ox&&!oy)continue;const nx=x+ox,ny=y+oy;if(nx<0||ny<0||nx>=w||ny>=h)continue;
    if(data[(ny*w+nx)*4+3]>24)n++;
  }
  return n;
}

export function autoRepairPixelBuffer({width,height,data}={}){
  const w=Math.max(1,Math.round(Number(width)||0)),h=Math.max(1,Math.round(Number(height)||0));
  if(!data||data.length<w*h*4)throw new Error('KELO_ASSET_PIXEL_BUFFER_INVALID');
  const output=new Uint8ClampedArray(data);let alphaSnapped=0,isolatedRemoved=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,a=output[i+3];
    if(a>0&&a<24){output[i+3]=0;alphaSnapped++;continue;}
    if(a>231&&a<255){output[i+3]=255;alphaSnapped++;}
  }
  const snapshot=new Uint8ClampedArray(output);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,a=snapshot[i+3];
    if(a===0)continue;
    if(neighborCount(snapshot,w,h,x,y)===0&&a<210){output[i+3]=0;isolatedRemoved++;}
  }
  return Object.freeze({data:output,changes:Object.freeze({alphaSnapped,isolatedRemoved,total:alphaSnapped+isolatedRemoved})});
}

export function suggestResidency({uses7d=0,sizeBytes=0,lastUsedAt=null,owned=false}={}){
  const uses=Math.max(0,Number(uses7d)||0),bytes=Math.max(0,Number(sizeBytes)||0);
  const last=lastUsedAt?Date.parse(lastUsedAt):0,ageDays=last?Math.max(0,(Date.now()-last)/86400000):Infinity;
  if(owned||uses>=12||ageDays<=2)return Object.freeze({tier:'hot',policy:'memory-or-fast-cache'});
  if(uses>=2||ageDays<=30)return Object.freeze({tier:'warm',policy:'local-cache'});
  if(uses>0||ageDays<=180)return Object.freeze({tier:'cold',policy:'remote-on-demand'});
  return Object.freeze({tier:'archive',policy:bytes>2_000_000?'remote-archive':'metadata-only-until-requested'});
}

export function getSeasonalBrief(date=new Date()){
  const month=date.getMonth()+1,day=date.getDate();
  if((month===10&&day>=1)||(month===11&&day<=2))return Object.freeze({id:'halloween',label:'Halloween',tags:['seasonal','halloween'],palette:['#22152f','#f47c20','#111111','#7cbe3f'],ideas:['pumpkin lamp','haunted hedge','shadow banner']});
  if((month===11&&day>=20)||month===12)return Object.freeze({id:'winter',label:'Winter / Holidays',tags:['seasonal','winter'],palette:['#dfefff','#2b5d78','#b18a45','#f7f3df'],ideas:['snowy planter','winter lantern','gift crate']});
  if(month===2&&day<=18)return Object.freeze({id:'valentine',label:'Valentine',tags:['seasonal','valentine'],palette:['#f25f87','#ffd6df','#7d2144','#fff4ef'],ideas:['heart bench','rose planter','love banner']});
  if(month>=6&&month<=8)return Object.freeze({id:'summer',label:'Summer',tags:['seasonal','summer'],palette:['#f3c14b','#2bb5a8','#5b83e3','#f28f5b'],ideas:['beach umbrella','summer drink cart','festival lights']});
  return Object.freeze({id:'evergreen',label:'Evergreen',tags:['evergreen'],palette:['#d3b66f','#31585d','#233036','#ece4cf'],ideas:['street planter','market crate','luxury lamp']});
}
