/* KELO-INDEX
 * area: CREATORS / UNIVERSAL CONTENT VAULT
 * owner: Kelo Universal Content Bridge
 * keys: CONTENT ROUTER IMAGE SPRITE TILESET ANIMATION VFX AUDIO SFX MUSIC AMBIENCE ABILITY SCENE PREFAB
 * purpose: Validate and compile downloaded personal content without executing external code.
 */
import {analyzeAssetSheetPixels,buildAssetSheetManifest} from './asset-sheet-compiler.mjs';
import {normalizeSceneDocument} from '../importers/scene-importer.mjs';

export const CONTENT_KINDS=Object.freeze(['image','sprite','tileset','animation','vfx','sfx','music','ambience','ability','scene','prefab']);
const IMAGE_KINDS=new Set(['image','sprite','tileset','animation','vfx']);
const AUDIO_KINDS=new Set(['sfx','music','ambience']);
const SUPPORTED_DELIVERY=new Set(['projectile','self_aoe','chain','dash','blink','instant','persistent_area','wall','trap','aura']);
const SUPPORTED_EFFECTS=new Set(['damage','status','heal','shield']);
const safe=v=>String(v??'').trim();
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));

export function inferContentKind(asset={},mime=''){
  const explicit=safe(asset.contentKind).toLowerCase();if(CONTENT_KINDS.includes(explicit))return explicit;
  const category=safe(asset.category).toLowerCase(),m=safe(mime||asset.mime).toLowerCase();
  if(m.startsWith('audio/'))return category.includes('music')?'music':category.includes('ambient')?'ambience':'sfx';
  if(category.includes('ability')||category.includes('skill'))return 'ability';
  if(category.includes('scene'))return 'scene';
  if(category.includes('prefab'))return 'prefab';
  if(category.includes('anim'))return 'animation';
  if(category.includes('vfx')||category.includes('effect'))return 'vfx';
  if(category.includes('tile'))return 'tileset';
  if(category.includes('sprite')||category.includes('character'))return 'sprite';
  return 'image';
}

async function blobToCanvas(blob){
  let bitmap=null,width=0,height=0,cleanup=()=>{};
  if('createImageBitmap' in globalThis){bitmap=await createImageBitmap(blob);width=bitmap.width;height=bitmap.height;cleanup=()=>bitmap.close?.();}
  else{const url=URL.createObjectURL(blob),img=new Image();img.decoding='async';await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('CONTENT_IMAGE_DECODE_FAILED'));img.src=url;});bitmap=img;width=img.naturalWidth;height=img.naturalHeight;cleanup=()=>URL.revokeObjectURL(url);}
  if(!width||!height){cleanup();throw new Error('CONTENT_ZERO_DIMENSIONS');}
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx){cleanup();throw new Error('CONTENT_CANVAS_UNAVAILABLE');}
  ctx.clearRect(0,0,width,height);ctx.drawImage(bitmap,0,0);cleanup();return canvas;
}

async function compileVisual(asset,blob,kind){
  const canvas=await blobToCanvas(blob),ctx=canvas.getContext('2d',{willReadFrequently:true});
  let pixels;try{pixels=ctx.getImageData(0,0,canvas.width,canvas.height);}catch(error){throw new Error('CONTENT_PIXEL_READ_FAILED:'+(error?.message||error));}
  const analysis=analyzeAssetSheetPixels(pixels.data,canvas.width,canvas.height,{});if(!analysis?.version||!Array.isArray(analysis.assets))throw new Error('CONTENT_COMPILER_REJECTED');
  const atlasId=`personal-${asset.provider}-${asset.externalId}`.toLowerCase().replace(/[^a-z0-9_-]+/g,'-');
  const manifest=buildAssetSheetManifest(analysis,{sourceName:asset.name,sourcePath:asset.sourceUrl||asset.downloadUrl,atlasId});
  manifest.contentKind=kind;
  manifest.external=Object.freeze({provider:asset.provider,externalAssetId:asset.externalId,license:asset.license,author:asset.author||null,sourceUrl:asset.sourceUrl||null});
  return manifest;
}

function compileAudio(asset,blob,kind){
  return Object.freeze({schema:'kelo-personal-audio-v1',version:1,contentKind:kind,id:asset.id,name:asset.name,playback:Object.freeze({loop:asset.loop===true||kind!=='sfx',preload:'none',volume:1}),blob:Object.freeze({mime:blob.type||asset.mime||null,bytes:blob.size}),external:Object.freeze({provider:asset.provider,license:asset.license,author:asset.author||null,sourceUrl:asset.sourceUrl||null})});
}

async function parseJson(blob){
  if(blob.size>1024*1024)throw new Error('CONTENT_JSON_TOO_LARGE');
  let value;try{value=JSON.parse(await blob.text());}catch{throw new Error('CONTENT_JSON_INVALID');}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('CONTENT_JSON_OBJECT_REQUIRED');return value;
}

function validateAbilityDefinition(raw){
  const def=raw.definition||raw;
  if(!Number.isFinite(Number(def.id))||!safe(def.key)||!def.targeting||!def.delivery||!Array.isArray(def.effects))throw new Error('CONTENT_ABILITY_SCHEMA_INVALID');
  if(!SUPPORTED_DELIVERY.has(safe(def.delivery.type)))throw new Error('CONTENT_ABILITY_DELIVERY_UNSUPPORTED:'+safe(def.delivery.type));
  for(const effect of def.effects){if(!effect||!SUPPORTED_EFFECTS.has(safe(effect.type)))throw new Error('CONTENT_ABILITY_EFFECT_UNSUPPORTED:'+safe(effect?.type));}
  const clean=copy(def);delete clean.__proto__;delete clean.constructor;delete clean.prototype;return clean;
}

function compileScene(raw,asset,kind){
  const normalized=normalizeSceneDocument(raw,asset);
  const prefabDefinition={...normalized.prefabDefinition,external:{provider:asset.provider,license:asset.license,author:asset.author||null,sourceUrl:asset.sourceUrl||null}};
  return {kind,manifest:{schema:'kelo-personal-scene-v2',version:2,contentKind:kind,id:asset.id,name:asset.name,prefabDefinition,importReport:normalized.importReport,external:{provider:asset.provider,license:asset.license,author:asset.author||null,sourceUrl:asset.sourceUrl||null}},compiler:'scene-importer-v1'};
}

export async function integrateContentBlob(asset,blob){
  if(!asset||!blob)throw new Error('CONTENT_INTEGRATION_INPUT_REQUIRED');
  const kind=inferContentKind(asset,blob.type);
  if(IMAGE_KINDS.has(kind))return{kind,manifest:await compileVisual(asset,blob,kind),compiler:'asset-sheet-compiler'};
  if(AUDIO_KINDS.has(kind))return{kind,manifest:compileAudio(asset,blob,kind),compiler:'personal-audio-manifest'};
  if(kind==='ability'){const json=await parseJson(blob),definition=validateAbilityDefinition(json);return{kind,manifest:{schema:'kelo-personal-ability-v1',version:1,contentKind:'ability',id:asset.id,name:asset.name,definition,external:{provider:asset.provider,license:asset.license,author:asset.author||null,sourceUrl:asset.sourceUrl||null}},compiler:'ability-contract-validator'};}
  if(kind==='scene'||kind==='prefab'){const json=await parseJson(blob);return compileScene(json,asset,kind);}}
  throw new Error('CONTENT_KIND_UNSUPPORTED:'+kind);
}

export const CONTENT_INTEGRATION_ROUTER=Object.freeze({CONTENT_KINDS,inferContentKind,integrateContentBlob});
