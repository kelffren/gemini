/* KELO-INDEX
 * area: STUDIO / ENTRY A10 FACADE
 * owns: mobile-safe importCurrent boundary only
 * does-not-own: Studio composition; delegated intact to studio-entry-legacy.mjs
 * public-api: bootKeloStudio(), getKeloStudioSession()
 * mobile: one raw snapshot import → one kernel normalization → cooperative spatial rebuild
 */
import { bootKeloStudio as bootLegacyStudio, getKeloStudioSession as getLegacySession } from './studio-entry-legacy.mjs';
import { yieldStudioBoot } from './integration/studio-boot-pace.mjs';

let facadeSession=null;
function isPhone(root){
  const ua=String(root?.navigator?.userAgent||'');
  const short=Math.min(Number(root?.innerWidth)||999,Number(root?.innerHeight)||999);
  return /iPhone|iPad|iPod|Android/i.test(ua)||short<=500;
}
function perfNow(root){try{return Number(root?.performance?.now?.())||Date.now();}catch{return Date.now();}}
function stats(root,document,extra={}){
  const dom=root?.document;
  let resources=0,heapMb='';
  try{resources=(root?.performance?.getEntriesByType?.('resource')||[]).filter(row=>String(row?.name||'').includes('/src/studio/')).length;}catch{}
  try{const bytes=Number(root?.performance?.memory?.usedJSHeapSize);if(Number.isFinite(bytes)&&bytes>0)heapMb=Math.round(bytes/1048576);}catch{}
  return {
    t:Math.round(perfNow(root)),
    entities:Array.isArray(document?.entities)?document.entities.length:0,
    terrain:Object.keys(document?.terrain||{}).length,
    collisions:Object.keys(document?.navigation?.collisions||{}).length,
    resources,
    canvases:dom?.querySelectorAll?.('canvas')?.length||0,
    heapMb,
    ...extra
  };
}
function mark(root,name,document,extra={}){try{root?.KELO_A10_OBSERVER?.mark?.(name,stats(root,document,extra));}catch{}}

export async function bootKeloStudio(options={}){
  const root=options.root||globalThis;
  const current=getLegacySession();
  if(current&&facadeSession&&Object.getPrototypeOf(facadeSession)===current)return facadeSession;
  const base=await bootLegacyStudio(options);
  if(!base?.kernel||typeof base?.importCurrent!=='function'){
    facadeSession=base;
    return base;
  }
  const facade=Object.create(base);
  Object.defineProperty(facade,'version',{value:'kelo-studio-foundation-v1.36.0-a10',enumerable:true});
  Object.defineProperty(facade,'importCurrent',{enumerable:true,value:async(importOptions={})=>{
    const { importCurrentKeloWorld }=await import('./adapters/current-world-importer.mjs');
    const { seedCatalogPrefabs }=await import('./adapters/catalog-prefab-seeder.mjs');
    const started=perfNow(root);
    mark(root,'A10_IMPORT_START',base.kernel.document);
    const next=await base.profiler.measure('import.current',()=>importCurrentKeloWorld({adapter:base.adapter,mode:base.mode,actorId:base.actorId,...importOptions}));
    mark(root,'A10_IMPORT_SNAPSHOT_READY',next,{durationMs:Math.round(perfNow(root)-started)});
    const setStarted=perfNow(root);
    mark(root,'A10_DOCUMENT_SET_START',next);
    if(isPhone(root)&&typeof base.kernel.setDocumentAsync==='function'){
      await base.kernel.setDocumentAsync(next,{
        batchSize:100,
        yieldControl:()=>yieldStudioBoot(root),
        onBatch:batch=>mark(root,'A10_SPATIAL_BATCH',base.kernel.document,batch)
      });
    }else base.kernel.setDocument(next);
    mark(root,'A10_DOCUMENT_SET_DONE',base.kernel.document,{durationMs:Math.round(perfNow(root)-setStarted)});
    seedCatalogPrefabs({prefabRegistry:base.kernel.prefabs,assetCatalog:base.adapter.assetCatalog});
    try{base.assetPalette?.refresh?.();base.assetFavorites?.refresh?.();base.multiAlign?.refresh?.();base.historyHints?.refresh?.();}catch{}
    return base.kernel.document;
  }});
  Object.defineProperty(facade,'close',{enumerable:true,value:()=>{try{return base.close();}finally{facadeSession=null;}}});
  facadeSession=Object.freeze(facade);
  return facadeSession;
}
export function getKeloStudioSession(){
  const legacy=getLegacySession();
  if(!legacy){facadeSession=null;return null;}
  return facadeSession||legacy;
}
if(typeof window!=='undefined')window.KELO_STUDIO_LAZY_BOOT=bootKeloStudio;
