/* KELO-INDEX
 * area: CREATORS / CONTENT DELIVERY
 * owner: Kelo Creator Content Delivery
 * owns: exact-revision manifest fetch + lazy runtime activation of entitled published Creator content
 * does-not-own: auth UI, KC, entitlements, publication, rendering, inventory, asset bytes or server gameplay authority
 * rule: request one revision at a time; manifest is metadata-only; specialized owners load bytes only after activation
 */
import '../../systems/creator-entitlement-system.js';
import { createRuntimeContentRegistry } from './runtime-content-registry.mjs';
import { installCreatorAvatarRuntime } from '../../characters/creator-avatar-runtime.mjs';
import { KELO_SUPABASE_PUBLIC_CONFIG } from '../../online/kelo-supabase-public-config.mjs';

const F=Object.freeze;
const MAX_MANIFESTS=48;
const text=v=>String(v==null?'':v).trim();
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FEATURE_BY_TYPE=Object.freeze({world:'properties',tile:'properties',appearance:'appearance',equipment:'appearance',mount:'mounts'});
const encPath=p=>String(p||'').split('/').filter(Boolean).map(encodeURIComponent).join('/');
const publicUrl=(bucket,path)=>`${String(KELO_SUPABASE_PUBLIC_CONFIG.url).replace(/\/+$/,'')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encPath(path)}`;

function normalizeAsset(row){
  const bucket=text(row?.publicStorageBucket),path=text(row?.publicStoragePath);
  if(!bucket||!path)throw new Error('DELIVERY_ASSET_PUBLIC_LOCATION_REQUIRED');
  return F({
    role:text(row.role||'primary'),ordinal:Math.max(0,Number(row.ordinal)||0),assetRevisionId:text(row.assetRevisionId),assetId:text(row.assetId),
    contentHash:text(row.contentHash),mimeType:text(row.mimeType),byteSize:Math.max(0,Number(row.byteSize)||0),pixelWidth:Math.max(0,Number(row.pixelWidth)||0),pixelHeight:Math.max(0,Number(row.pixelHeight)||0),
    worldWidth:row.worldWidth==null?null:Number(row.worldWidth),worldHeight:row.worldHeight==null?null:Number(row.worldHeight),collisionMode:text(row.collisionMode||'none'),renderPhase:text(row.renderPhase||'world'),
    metadata:F({...row.metadata}),bindingMetadata:F({...row.bindingMetadata}),publicStorageBucket:bucket,publicStoragePath:path,runtimeUrl:publicUrl(bucket,path)
  });
}
function normalizeManifest(raw){
  if(!raw||typeof raw!=='object')throw new Error('DELIVERY_MANIFEST_REQUIRED');
  const revisionId=text(raw.revisionId),contentId=text(raw.contentId),contentType=text(raw.contentType);
  if(!UUID_RE.test(revisionId)||!contentId||!contentType)throw new Error('DELIVERY_MANIFEST_IDENTITY_INVALID');
  return F({
    revisionId,definitionId:text(raw.definitionId),ownerUserId:text(raw.ownerUserId),contentId,stableKey:text(raw.stableKey||contentId),revision:Math.max(1,Number(raw.revision)||1),schemaVersion:Math.max(1,Number(raw.schemaVersion)||1),
    contentHash:text(raw.contentHash),contentType,displayName:text(raw.displayName||contentId),tags:F((raw.tags||[]).map(String)),payload:F({...raw.payload}),publicationId:text(raw.publicationId),visibility:text(raw.visibility),publishedAt:raw.publishedAt||null,
    accessReason:text(raw.accessReason),licenseKey:text(raw.licenseKey||'standard'),assets:F((raw.assets||[]).map(normalizeAsset)),source:'creator-content'
  });
}

export function createCreatorContentDelivery({root=globalThis,runtimeRegistry=null}={}){
  const cache=new Map(),inflight=new Map();let provider=null,registry=runtimeRegistry||root.KELO_CREATOR_CONTENT_REGISTRY||null;
  function accountId(){
    if(provider)return text(provider.accountId?.());
    try{return text(root.KeloOnlineAuth?.state?.()?.accountId);}catch{return'';}
  }
  function cacheKey(revisionId){return `${accountId()||'signed-out'}:${revisionId}`;}
  function prune(){while(cache.size>MAX_MANIFESTS)cache.delete(cache.keys().next().value);}
  function bindProvider(next){
    if(!next||typeof next.accountId!=='function'||typeof next.getManifest!=='function')throw new Error('CREATOR_DELIVERY_PROVIDER_INVALID');
    provider=F({name:text(next.name||'bound-provider'),accountId:next.accountId,getManifest:next.getManifest});cache.clear();inflight.clear();return api;
  }
  async function fallbackManifest(revisionId){
    const credentials=await root.KeloOnlineAuth?.credentials?.();if(!credentials?.accountId)throw new Error('AUTH_REQUIRED');
    const client=root.KeloOnlineAuth?.getClient?.();if(!client?.rpc)throw new Error('CREATOR_DELIVERY_AUTH_CLIENT_REQUIRED');
    const result=await client.rpc('get_creator_content_delivery',{p_revision_id:revisionId});if(result?.error)throw result.error;return result?.data;
  }
  async function ensureAccess(revisionId){
    const gate=root.KeloCreatorEntitlements;if(!gate?.checkRecord||!gate?.verifyRevision)throw new Error('CREATOR_ENTITLEMENT_GUARD_REQUIRED');
    let access=gate.checkRecord({source:'creator-content',revisionId});
    if(access.ok)return access;
    await gate.verifyRevision(revisionId);access=gate.checkRecord({source:'creator-content',revisionId});
    if(!access.ok)throw new Error(access.reason||'ENTITLEMENT_REQUIRED');return access;
  }
  async function getManifest(revisionId,{force=false}={}){
    const id=text(revisionId);if(!UUID_RE.test(id))throw new Error('REVISION_REQUIRED');if(!accountId()){
      if(provider)throw new Error('AUTH_REQUIRED');
      await root.KeloOnlineAuth?.ready?.(5000);
    }
    if(!accountId())throw new Error('AUTH_REQUIRED');
    await ensureAccess(id);const key=cacheKey(id);if(!force&&cache.has(key))return cache.get(key);if(inflight.has(key))return inflight.get(key);
    const job=(async()=>{const raw=provider?await provider.getManifest(id):await fallbackManifest(id);const manifest=normalizeManifest(raw);if(manifest.revisionId!==id)throw new Error('DELIVERY_REVISION_MISMATCH');cache.set(key,manifest);prune();return manifest;})().finally(()=>inflight.delete(key));
    inflight.set(key,job);return job;
  }
  async function ensureOwner(contentType){
    const type=text(contentType),feature=FEATURE_BY_TYPE[type];
    if(feature&&root.KELO_MODULE_LOADER?.ensure)await root.KELO_MODULE_LOADER.ensure(feature);
    if(type==='character'&&!root.KeloCreatorAvatars)installCreatorAvatarRuntime({root});
    try{if(!root.KELO_CREATOR_USE_AUTHORITY&&root.KeloCreatorUse?.load)await root.KeloCreatorUse.load();root.KELO_CREATOR_USE_AUTHORITY?.attachRuntimeGuards?.();}catch(error){console.warn('[Creator delivery] use authority arm failed',error);}
  }
  function ensureRegistry(){
    if(registry)return registry;if(root.KELO_CREATOR_CONTENT_REGISTRY){registry=root.KELO_CREATOR_CONTENT_REGISTRY;return registry;}
    registry=createRuntimeContentRegistry({root});try{root.KELO_CREATOR_CONTENT_REGISTRY=registry;}catch{}return registry;
  }
  function runtimeRecord(manifest){return F({
    revisionId:manifest.revisionId,ownerUserId:manifest.ownerUserId,contentId:manifest.contentId,stableKey:manifest.stableKey,revision:manifest.revision,contentType:manifest.contentType,displayName:manifest.displayName,tags:manifest.tags,payload:manifest.payload,assets:manifest.assets,contentHash:manifest.contentHash,source:'creator-content'
  });}
  async function activateRevision(revisionId,{forceManifest=false}={}){
    const manifest=await getManifest(revisionId,{force:forceManifest});await ensureOwner(manifest.contentType);const target=ensureRegistry(),existing=target.get?.(manifest.contentId);
    if(existing){if(existing.activation?.status!=='active'&&typeof target.reactivate==='function')return F({manifest,row:target.reactivate(manifest.contentId),cached:true});return F({manifest,row:existing,cached:true});}
    const row=target.register(runtimeRecord(manifest));return F({manifest,row,cached:false});
  }
  function invalidateIdentity(){cache.clear();inflight.clear();return diagnostics();}
  function diagnostics(){return F({version:'creator-content-delivery-v1.0.2-use-authority-arm',provider:provider?.name||'KeloOnlineAuth',accountId:accountId()||null,cachedManifests:cache.size,inflight:inflight.size,registryVersion:registry?.version||root.KELO_CREATOR_CONTENT_REGISTRY?.version||null});}
  const api=F({version:'creator-content-delivery-v1.0.2-use-authority-arm',bindProvider,getManifest,activateRevision,invalidateIdentity,diagnostics});return api;
}

export function getOrCreateCreatorContentDelivery({root=globalThis,runtimeRegistry=null}={}){
  if(root.KELO_CREATOR_CONTENT_DELIVERY)return root.KELO_CREATOR_CONTENT_DELIVERY;
  const api=createCreatorContentDelivery({root,runtimeRegistry});try{root.KELO_CREATOR_CONTENT_DELIVERY=api;}catch{}return api;
}
