/* KELO-INDEX
 * area: MOUNTS / ASSETS
 * owner: KeloMountAssets
 * purpose: adapter de bundles de montura sobre KeloAssetRegistry; lazy-load sin segundo loader
 * public-api: registerBundle/registerMany/ensureLoaded/isReady/resources/getBundle
 * consumes: KeloMountCatalog, KeloAssetRegistry
 * state-owned: metadata ligera de bundles; KeloAssetRegistry posee recursos/cache reales
 * extension-points: bundles data-driven por assetBundleId
 * online: solo resuelve contenido visual local por IDs estables; no decide ownership/gameplay
 * do-not: no fetch/Image propios; no precargar catálogo completo; no reglas por mountId/species
 */
(function(root){'use strict';
if(root.KeloMountAssets)return;
const Catalog=root.KeloMountCatalog,Registry=root.KeloAssetRegistry;
const VERSION='mount-asset-adapter-v1.0.0';
const bundles=new Map();
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function registry(){const r=root.KeloAssetRegistry||Registry;if(!r)throw new Error('KELO_ASSET_REGISTRY_UNAVAILABLE');return r;}
function normalize(raw){if(!raw||typeof raw!=='object'||!raw.id)throw new Error('MOUNT_ASSET_BUNDLE_INVALID');const assets=Array.isArray(raw.assets)?raw.assets.map(a=>clone(a)):[];if(!assets.length)throw new Error('MOUNT_ASSET_BUNDLE_EMPTY:'+raw.id);return Object.freeze({id:String(raw.id),assets:Object.freeze(assets.map(Object.freeze)),metadata:Object.freeze(clone(raw.metadata||{}))});}
function registerBundle(raw){const bundle=normalize(raw);if(bundles.has(bundle.id))throw new Error('MOUNT_ASSET_BUNDLE_DUPLICATE:'+bundle.id);const r=registry();for(const asset of bundle.assets)r.register(asset);bundles.set(bundle.id,bundle);return bundle;}
function registerMany(rows){return (rows||[]).map(registerBundle);}
function getBundle(id){return bundles.get(String(id))||null;}
function bundleForMount(mountId){const def=Catalog?.get?.(String(mountId));if(!def)return{ok:false,error:'MOUNT_NOT_FOUND',mountId:String(mountId)};const bundle=getBundle(def.assetBundleId);if(!bundle)return{ok:false,error:'MOUNT_ASSET_BUNDLE_UNREGISTERED',mountId:def.id,bundleId:def.assetBundleId};return{ok:true,mount:def,bundle};}
async function ensureLoaded(mountId){const found=bundleForMount(mountId);if(!found.ok)return found;const r=registry(),ids=found.bundle.assets.map(a=>String(a.id));await r.preload(ids);return{ok:true,mountId:found.mount.id,bundleId:found.bundle.id,assetIds:ids,resources:ids.map(id=>r.resource(id))};}
function isReady(mountId){const found=bundleForMount(mountId);if(!found.ok)return false;const r=registry();return found.bundle.assets.every(a=>r.isReady(String(a.id)));}
function resources(mountId){const found=bundleForMount(mountId);if(!found.ok)return found;const r=registry();return{ok:true,mountId:found.mount.id,bundleId:found.bundle.id,resources:found.bundle.assets.map(a=>({id:String(a.id),resource:r.resource(String(a.id)),ready:r.isReady(String(a.id))}))};}
root.KeloMountAssets=Object.freeze({version:VERSION,registerBundle,registerMany,getBundle,ensureLoaded,isReady,resources,get count(){return bundles.size;}});
root.KELO_MOUNT_ASSET_AUDIT=Object.freeze({version:VERSION,reusesKeloAssetRegistry:true,secondLoader:false,lazyByMountId:true,preloadsWholeCatalog:false});
})(typeof globalThis!=='undefined'?globalThis:window);
