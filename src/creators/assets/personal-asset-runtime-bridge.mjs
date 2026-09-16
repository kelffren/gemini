/* KELO-INDEX
 * area: CREATORS / PERSONAL ASSET RUNTIME BRIDGE
 * owner: Kelo Creator Asset Bridge
 * keys: PERSONAL ASSET ATLAS PROPERTY CATALOG STUDIO LAZY
 * purpose: Register integrated vault assets with KELO_ATLAS_CONTRACT + KELO_PROPERTY_CATALOG without creating a parallel catalog.
 */
import { listAssets, getManifest, getObjectURL } from './personal-asset-vault.mjs';

const installed=new Set();
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
const safe=value=>String(value??'').trim();
const pretty=value=>safe(value).replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

function frameRect(frame){
  const r=frame?.sourceRect||frame?.frameRect||null;
  if(!r)return null;
  return {x:Number(r.x??r.sx)||0,y:Number(r.y??r.sy)||0,w:Math.max(1,Number(r.w)||1),h:Math.max(1,Number(r.h)||1)};
}

export async function registerPersonalAsset(root=globalThis,id){
  id=String(id||''); if(!id||installed.has(id))return installed.has(id);
  const A=root?.KELO_ATLAS_CONTRACT,C=root?.KELO_PROPERTY_CATALOG;
  if(!A?.register||!C?.registerTemplate)return false;
  const manifest=await getManifest(id); if(!manifest?.atlas||!Array.isArray(manifest.assets))return false;
  const src=await getObjectURL(id); if(!src)return false;
  const atlasKey=`personalVault:${id}`;
  const frames={};
  for(const frame of manifest.assets){const r=frameRect(frame);if(r)frames[String(frame.frameId||frame.assetId)]=r;}
  if(!Object.keys(frames).length)return false;
  try{
    A.register(atlasKey,{id:atlasKey,src,width:Number(manifest.atlas.width)||1,height:Number(manifest.atlas.height)||1,frameMode:'irregular',frames},{role:'optional',personal:true});
  }catch(error){if(!A.describe?.(atlasKey))throw error;}
  for(const frame of manifest.assets){
    const r=frameRect(frame);if(!r)continue;
    const frameId=String(frame.frameId||frame.assetId);
    const templateId=`personal:${id}:${frameId}`;
    if(C.getTemplate?.(templateId))continue;
    const target=clamp(frame.scale?.targetPixelWidth||frame.visualBounds?.w||r.w,16,256);
    const width=Math.max(16,Math.round(target));
    const height=Math.max(16,Math.round(r.h/Math.max(1,r.w)*width));
    const sourceCollision=frame.collider?.passThrough?null:frame.collider?.solidBounds;
    const sx=width/Math.max(1,r.w),sy=height/Math.max(1,r.h);
    const collision=sourceCollision?{x:Math.round((Number(sourceCollision.x)||0)*sx),y:Math.round((Number(sourceCollision.y)||0)*sy),w:Math.max(1,Math.round((Number(sourceCollision.w)||0)*sx)),h:Math.max(1,Math.round((Number(sourceCollision.h)||0)*sy))}:null;
    C.registerTemplate({
      id:templateId,
      label:pretty(frame.suggestedName||frame.label||frame.assetId||id),
      category:'my_assets',family:`personal/${safe(manifest.external?.provider||'vault')}`,
      districts:['*'],width,height,snap:32,collision,placeable:true,
      source:'kelo-personal-asset-vault-v1',sourceId:id,
      license:manifest.external?.license||null,author:manifest.external?.author||null,
      parts:[{assetKey:atlasKey,source:r,offset:{x:0,y:0},size:{w:width,h:height},phase:frame.layer==='props_back'?'props_back':'props_front'}]
    });
  }
  installed.add(id);
  try{root.dispatchEvent(new CustomEvent('kelo:personal-asset-runtime-ready',{detail:{id,atlasKey}}));}catch{}
  return true;
}

export async function installIntegratedPersonalAssets(root=globalThis){
  if(!root?.KELO_ATLAS_CONTRACT?.register||!root?.KELO_PROPERTY_CATALOG?.registerTemplate)return {ready:false,installed:0,total:0};
  const rows=(await listAssets()).filter(asset=>asset.integrated&&asset.downloaded);
  let count=0;
  for(const asset of rows){try{if(await registerPersonalAsset(root,asset.id))count++;}catch(error){console.warn('[Kelo personal asset bridge] skipped',asset.id,error?.message||error);}}
  return {ready:true,installed:count,total:rows.length};
}

export function bindPersonalAssetRuntime(root=globalThis){
  const handler=event=>{const id=event?.detail?.asset?.id;if(id)void registerPersonalAsset(root,id).catch(()=>{});};
  root?.addEventListener?.('kelo:personal-asset-integrated',handler);
  return ()=>root?.removeEventListener?.('kelo:personal-asset-integrated',handler);
}

export const PERSONAL_ASSET_RUNTIME_BRIDGE=Object.freeze({registerPersonalAsset,installIntegratedPersonalAssets,bindPersonalAssetRuntime});
if(typeof window!=='undefined')window.KELO_PERSONAL_ASSET_RUNTIME_BRIDGE=PERSONAL_ASSET_RUNTIME_BRIDGE;
