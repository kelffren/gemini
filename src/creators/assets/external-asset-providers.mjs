/* KELO-INDEX
 * area: CREATORS / EXTERNAL CONTENT PROVIDERS
 * owner: Kelo Universal Content Bridge
 * keys: EXTERNAL CONTENT SPRITECOOK KENNEY LPC OPENGAMEART POLYHAVEN AMBIENTCG OPENVERSE 3DASSETS GOBKIT SFXMINT OPENSOURCE3D QUATERNIUS KELO ABILITY SCENE AUDIO LAZY PAGED FEDERATED PREVIEW 10K BOUNDED THUMBNAIL TRYON LOOKBUILDER CATALOG-ONLY
 * purpose: Browse provider metadata without downloading content binaries, with bounded federated pages and viewport-only previews suitable for catalogs far beyond 10k items.
 */
import {searchKenneyPage,clearKenneyCache,getKenneyProviderStats} from './kenney-live-provider.mjs?v=3';
import {searchLpcAssets} from './lpc-live-provider.mjs?v=2';
import {searchOpenGameArtAssets,clearOpenGameArtCache} from './opengameart-live-provider.mjs?v=3';
import {searchKeloContent,clearKeloContentCache} from './kelo-content-live-provider.mjs?v=3';
import {searchAmbientCgAssets,clearAmbientCgCache} from './ambientcg-live-provider.mjs?v=1';
import {searchPolyHavenAssets,clearPolyHavenCache} from './polyhaven-live-provider.mjs?v=1';
import {searchOpenverseAssets,clearOpenverseCache} from './openverse-live-provider.mjs?v=1';
import {searchThreeDAssets,clearThreeDAssetsCache} from './three-d-assets-live-provider.mjs?v=1';
import {searchGobkitAssets,clearGobkitCache} from './gobkit-live-provider.mjs?v=1';
import {searchSfxMintAssets,clearSfxMintCache} from './sfxmint-live-provider.mjs?v=1';
import {searchOpenSource3DAssets,clearOpenSource3DCache} from './open-source-3d-live-provider.mjs?v=1';
import {getExternalProviderRuntimeStats,clearExternalProviderRuntimeCache} from './external-provider-runtime.mjs?v=4';
import {installUniversalPreviewInspector} from './universal-preview-inspector.mjs?v=1';
import {installUniversalSpritePreview} from './universal-sprite-preview.mjs?v=3';
import {installUniversalAvatarTryOn} from './universal-avatar-tryon.mjs?v=1';
import {installUniversalLookBuilder} from './universal-look-builder.mjs?v=1';

const CONFIG_URL=new URL('../../../data/external-asset-providers.json?v=14',import.meta.url).href;
const DEFAULT_PAGE_SIZE=80,MAX_PROVIDER_PAGE=320,MAX_FEDERATED_RESULTS=160,MAX_RECENT_ASSETS=640,MAX_THUMBNAIL_CONCURRENCY=6;
let configPromise=null;let liveCache=new Map();const recentAssets=new Map();
function clean(v){return String(v??'').trim();}function join(base,path){return new URL(path,base).href;}function normalizeCategory(v){const x=clean(v).toLowerCase();return x||'other';}
function isLazy(provider){return String(provider?.mode||'').startsWith('lazy-');}
function isLive(provider){return ['live-index','lazy-live-index','live-api','lazy-live-api'].includes(String(provider?.mode||''));}
function browserQA(){if(typeof location==='undefined')return{};try{const p=new URLSearchParams(location.search);return{provider:clean(p.get('qaProvider')),preview:p.get('qaPreview')==='1'};}catch{return{};}}
function visualKind(category=''){const c=normalizeCategory(category);if(c.includes('tile'))return'tileset';if(c.includes('anim'))return'animation';if(c.includes('vfx')||c.includes('effect'))return'vfx';if(c.includes('character')||c.includes('sprite'))return'sprite';return'image';}
function pageOptions(options={}){return{offset:Math.max(0,Number(options.offset)||0),limit:Math.max(1,Math.min(Number(options.limit)||DEFAULT_PAGE_SIZE,MAX_PROVIDER_PAGE))};}
function matches(asset,q){if(!q)return true;const hay=`${asset.name} ${asset.category} ${asset.contentKind||''} ${(asset.tags||[]).join(' ')} ${asset.description||''} ${asset.author||''}`.toLowerCase();return q.split(/\s+/).filter(Boolean).every(token=>hay.includes(token));}
function rememberRecent(assets=[]){for(const asset of assets){if(!asset?.id)continue;recentAssets.delete(asset.id);recentAssets.set(asset.id,asset);}while(recentAssets.size>MAX_RECENT_ASSETS)recentAssets.delete(recentAssets.keys().next().value);}
function filterKind(rows,contentKind){return !contentKind||contentKind==='all'?rows:(rows||[]).filter(a=>(a.contentKind||visualKind(a.category))===contentKind);}
export function getRecentExternalAsset(id){return recentAssets.get(String(id))||null;}
export async function loadProviderConfig(){if(configPromise)return configPromise;configPromise=fetch(CONFIG_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('PROVIDER_CONFIG_'+r.status);return r.json();}).catch(error=>{configPromise=null;throw error;});return configPromise;}
function normalizeSpriteCook(example,provider){const preview=example.previewPath?join(provider.assetBaseUrl,example.previewPath):null,category=normalizeCategory(example.category);return{id:`spritecook:${example.slug}`,provider:'spritecook',externalId:clean(example.slug),name:clean(example.title||example.slug),category,contentKind:visualKind(category),previewKind:'image',tags:[category,'pixel-art'].filter(Boolean),previewUrl:preview,downloadUrl:preview,sourceUrl:example.sourceUrl||provider.sourceUrl,license:'CC0-1.0',author:'SpriteCook',attributionRequired:false,ownership:'discovered',description:clean(example.prompt),settings:Array.isArray(example.settings)?example.settings:[],downloadable:!!preview,integrationReady:!!preview};}
async function loadSpriteCook(provider){if(liveCache.has(provider.id))return liveCache.get(provider.id);const data=await fetch(provider.indexUrl,{mode:'cors',cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('SPRITECOOK_INDEX_'+r.status);return r.json();});const list=Array.isArray(data?.examples)?data.examples:[],result=list.map(x=>normalizeSpriteCook(x,provider));liveCache.set(provider.id,result);return result;}
function normalizeCuratedAsset(row,provider){const category=normalizeCategory(row.category),contentKind=clean(row.contentKind)||provider.contentKinds?.[0]||visualKind(category),downloadUrl=row.downloadUrl||null,previewUrl=row.previewUrl||row.thumbnailUrl||null;return{...row,id:clean(row.id||`${provider.id}:${row.slug||row.name}`),provider:provider.id,externalId:clean(row.externalId||row.id||row.slug||row.name),name:clean(row.name||row.title||row.id),category,contentKind,previewKind:row.previewKind||'image',tags:Array.isArray(row.tags)?row.tags:[],previewUrl,downloadUrl,sourceUrl:row.sourceUrl||provider.sourceUrl,license:row.license||provider.license||'UNKNOWN',author:row.author||provider.name,attributionRequired:provider.attributionRequired===true,ownership:'discovered',description:clean(row.description),downloadable:provider.catalogOnly===true?false:!!downloadUrl,integrationReady:provider.catalogOnly===true?false:!!downloadUrl,catalogOnly:provider.catalogOnly===true,verified:provider.verified===true};}
async function loadCuratedCatalog(provider){if(liveCache.has(provider.id))return liveCache.get(provider.id);const url=new URL(provider.indexUrl,import.meta.url).href,data=await fetch(url,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error(`${provider.id.toUpperCase()}_INDEX_${r.status}`);return r.json();}),list=Array.isArray(data?.assets)?data.assets:[],result=list.map(row=>normalizeCuratedAsset(row,provider));liveCache.set(provider.id,result);return result;}
function normalizeKenney(rows){return(rows||[]).map(a=>({...a,contentKind:a.contentKind||visualKind(a.category),previewKind:a.previewKind||'image'}));}
export async function getProviderStatuses(){const cfg=await loadProviderConfig();return(cfg.providers||[]).filter(p=>p.enabled!==false).map(p=>({id:p.id,name:p.name,mode:p.mode,license:p.license,sourceUrl:p.sourceUrl,browseUrl:p.browseUrl||p.sourceUrl,notes:p.notes,live:isLive(p),lazy:isLazy(p),verified:p.verified===true,apiAttributionRequired:p.apiAttributionRequired===true,catalogOnly:p.catalogOnly===true,requiresQuery:p.requiresQuery===true}));}
export async function getCatalogScaleStatus(){let kenney=null;try{kenney=await getKenneyProviderStats();}catch{}const providers=await getProviderStatuses();return{mode:'metadata-windowed',binaryPreload:false,maxFederatedResults:MAX_FEDERATED_RESULTS,maxRecentMetadata:MAX_RECENT_ASSETS,maxPreviewConcurrency:MAX_THUMBNAIL_CONCURRENCY,providers:providers.length,kenney,externalRuntime:getExternalProviderRuntimeStats()};}
export async function browseProvider(id,options={}){const cfg=await loadProviderConfig(),provider=(cfg.providers||[]).find(p=>p.id===id&&p.enabled!==false);if(!provider)throw new Error('PROVIDER_NOT_FOUND:'+id);const {offset,limit}=pageOptions(options),query=clean(options.query).toLowerCase();try{
if(provider.id==='kelo-content'&&provider.mode==='live-index'){const assets=await searchKeloContent(query,{...options,offset,limit});return{provider,assets,error:null,page:{offset,limit,hasMore:assets.length>=limit}};}
if(provider.id==='spritecook'&&provider.mode==='live-index'){let rows=await loadSpriteCook(provider);if(query)rows=rows.filter(a=>matches(a,query));if(options.contentKind&&options.contentKind!=='all')rows=rows.filter(a=>(a.contentKind||visualKind(a.category))===options.contentKind);const assets=rows.slice(offset,offset+limit);return{provider,assets,error:null,page:{offset,limit,total:rows.length,hasMore:offset+assets.length<rows.length}};}
if(provider.id==='kenney'&&provider.mode==='lazy-live-index'){const page=await searchKenneyPage(query,{...options,offset,limit});return{provider,assets:normalizeKenney(page.assets),error:null,page:{offset:page.offset,limit:page.limit,total:page.total,hasMore:page.hasMore,engine:page.engine}};}
if(provider.id==='quaternius'&&provider.mode==='lazy-live-index'){let rows=await loadCuratedCatalog(provider);if(query)rows=rows.filter(a=>matches(a,query));rows=filterKind(rows,options.contentKind);const assets=rows.slice(offset,offset+limit);return{provider,assets,error:null,page:{offset,limit,total:rows.length,hasMore:offset+assets.length<rows.length,engine:'curated-local-index'}};}
if(provider.id==='lpc'&&provider.mode==='live-index'){const assets=await searchLpcAssets(query,{...options,offset,limit});return{provider,assets,error:null,page:{offset,limit,hasMore:assets.length>=limit}};}
if(provider.id==='opengameart'&&provider.mode==='live-index'){const assets=await searchOpenGameArtAssets(query,{...options,offset,limit});return{provider,assets,error:null,page:{offset,limit,hasMore:assets.length>=limit}};}
if(provider.id==='ambientcg'&&provider.mode==='lazy-live-api'){const result=await searchAmbientCgAssets(query,{...options,offset,limit});const assets=filterKind(result.assets,options.contentKind);return{provider,assets,error:null,page:{offset:result.offset,limit:result.limit,total:result.total,hasMore:result.hasMore,engine:result.engine}};}
if(provider.id==='polyhaven'&&provider.mode==='lazy-live-api'){const result=await searchPolyHavenAssets(query,{...options,offset,limit});const assets=filterKind(result.assets,options.contentKind);return{provider,assets,error:null,page:{offset:result.offset,limit:result.limit,total:result.total,hasMore:result.hasMore,engine:result.engine,requiresQuery:result.requiresQuery===true}};}
if(provider.id==='openverse-images'&&provider.mode==='lazy-live-api'){if(options.contentKind&&options.contentKind!=='all'&&options.contentKind!=='image')return{provider,assets:[],error:null,page:{offset,limit,hasMore:false}};const result=await searchOpenverseAssets(query,{...options,media:'images',offset,limit});return{provider,assets:result.assets,error:null,page:{offset:result.offset,limit:result.limit,total:result.total,hasMore:result.hasMore,engine:result.engine,requiresQuery:result.requiresQuery===true}};}
if(provider.id==='openverse-audio'&&provider.mode==='lazy-live-api'){if(options.contentKind&&options.contentKind!=='all'&&!['sfx','music','ambience'].includes(options.contentKind))return{provider,assets:[],error:null,page:{offset,limit,hasMore:false}};const result=await searchOpenverseAssets(query,{...options,media:'audio',offset,limit});return{provider,assets:result.assets,error:null,page:{offset:result.offset,limit:result.limit,total:result.total,hasMore:result.hasMore,engine:result.engine,requiresQuery:result.requiresQuery===true}};}
if(provider.id==='3dassets'&&provider.mode==='lazy-live-api'){if(options.contentKind&&options.contentKind!=='all'&&options.contentKind!=='model')return{provider,assets:[],error:null,page:{offset,limit,hasMore:false}};const result=await searchThreeDAssets(query,{...options,offset,limit});return{provider,assets:result.assets,error:null,page:{offset:result.offset,limit:result.limit,total:result.total,hasMore:result.hasMore,engine:result.engine,requiresQuery:result.requiresQuery===true}};}
if(provider.id==='gobkit'&&provider.mode==='lazy-live-api'){if(options.contentKind&&options.contentKind!=='all'&&options.contentKind!=='model')return{provider,assets:[],error:null,page:{offset,limit,hasMore:false}};const result=await searchGobkitAssets(query,{...options,offset,limit});return{provider,assets:result.assets,error:null,page:{offset:result.offset,limit:result.limit,total:result.total,hasMore:result.hasMore,engine:result.engine}};}
if(provider.id==='sfxmint'&&provider.mode==='lazy-live-api'){if(options.contentKind&&options.contentKind!=='all'&&options.contentKind!=='sfx')return{provider,assets:[],error:null,page:{offset,limit,hasMore:false}};const result=await searchSfxMintAssets(query,{...options,offset,limit});return{provider,assets:result.assets,error:null,page:{offset:result.offset,limit:result.limit,total:result.total,hasMore:result.hasMore,engine:result.engine,requiresQuery:result.requiresQuery===true}};}
if(provider.id==='opensource3d'&&provider.mode==='lazy-live-api'){if(options.contentKind&&options.contentKind!=='all'&&options.contentKind!=='model')return{provider,assets:[],error:null,page:{offset,limit,hasMore:false}};const result=await searchOpenSource3DAssets(query,{...options,offset,limit});return{provider,assets:result.assets,error:null,page:{offset:result.offset,limit:result.limit,total:result.total,hasMore:result.hasMore,engine:result.engine,requiresQuery:result.requiresQuery===true}};}
return{provider,assets:[],error:null,page:{offset,limit,hasMore:false}};}catch(error){return{provider,assets:[],error:String(error?.message||error),page:{offset,limit,hasMore:false}};}}
export async function searchExternalAssets(query='',options={}){const cfg=await loadProviderConfig(),providers=(cfg.providers||[]).filter(p=>p.enabled!==false),qa=browserQA(),wanted=options.providers?.length?new Set(options.providers):qa.provider?new Set([qa.provider]):null,q=clean(query).toLowerCase(),includeLazy=!!wanted||options.includeLazy===true,{offset,limit}=pageOptions(options),selected=providers.filter(p=>wanted?wanted.has(p.id):(!isLazy(p)||(includeLazy&&(q.length>0||p.requiresQuery!==true)))),perProviderLimit=wanted?limit:Math.max(1,Math.min(limit,Math.floor(MAX_FEDERATED_RESULTS/Math.max(1,selected.length)))),bundles=await Promise.all(selected.map(p=>browseProvider(p.id,{query:q,offset,limit:perProviderLimit,contentKind:options.contentKind})));let assets=bundles.flatMap(b=>b.assets||[]);if(q)assets=assets.filter(a=>matches(a,q)||['kenney','ambientcg','polyhaven','openverse-images','openverse-audio','3dassets','gobkit','sfxmint','opensource3d'].includes(a.provider));if(options.category&&options.category!=='all')assets=assets.filter(a=>a.category===options.category);if(options.contentKind&&options.contentKind!=='all')assets=assets.filter(a=>(a.contentKind||visualKind(a.category))===options.contentKind);const seen=new Set();assets=assets.filter(a=>a?.id&&!seen.has(a.id)&&seen.add(a.id)).slice(0,wanted?MAX_PROVIDER_PAGE:MAX_FEDERATED_RESULTS);rememberRecent(assets);return{assets,providers:bundles.map(b=>({id:b.provider.id,name:b.provider.name,mode:b.provider.mode,error:b.error,count:b.assets?.length||0,total:b.page?.total??null,engine:b.page?.engine||null,browseUrl:b.provider.browseUrl||b.provider.sourceUrl,license:b.provider.license,lazy:isLazy(b.provider),verified:b.provider.verified===true,requiresQuery:b.page?.requiresQuery===true||b.provider.requiresQuery===true})),page:{offset,limit:perProviderLimit,hasMore:bundles.some(b=>!!b.page?.hasMore),lazyIncluded:includeLazy,bounded:true,maxResults:MAX_FEDERATED_RESULTS}};}
function activePagePreviewConcurrency(){
  let conn=null;try{conn=globalThis.navigator?.connection||globalThis.navigator?.mozConnection||globalThis.navigator?.webkitConnection||null;}catch{}
  const type=String(conn?.effectiveType||'').toLowerCase();
  const mobile=globalThis.matchMedia?.('(max-width: 760px)')?.matches===true||Number(globalThis.navigator?.maxTouchPoints||0)>0;
  if(conn?.saveData===true)return 1;
  if(type==='2g'||type==='slow-2g')return 1;
  if(type==='3g')return 2;
  if(type==='4g')return mobile?4:MAX_THUMBNAIL_CONCURRENCY;
  return mobile?3:MAX_THUMBNAIL_CONCURRENCY;
}
function installActivePageThumbnailHydrator(){
  if(typeof document==='undefined')return;
  let active=0,sweepTimer=0;
  const urgent=[],background=[],queued=new Set(),jobs=new Map();
  const previewAsset=node=>recentAssets.get(node?.closest?.('.card[data-id]')?.dataset?.id)||null;
  const eligible=node=>{
    if(!node?.isConnected||!node.closest?.('#explore-grid'))return false;
    const asset=previewAsset(node),kind=asset?.contentKind;
    return !!asset?.previewUrl&&asset.previewKind!=='audio'&&asset.previewKind!=='video'&&!['sfx','music','ambience','ability','scene','prefab'].includes(kind);
  };
  const removeFrom=(list,node)=>{const i=list.indexOf(node);if(i>=0)list.splice(i,1);};
  const enqueue=(node,priority='background')=>{
    if(!eligible(node)||node.dataset.thumbLoaded==='1'||node.dataset.thumbLoaded==='loading'||node.dataset.thumbLoaded==='error')return;
    if(queued.has(node)){
      if(priority==='urgent'){removeFrom(background,node);if(!urgent.includes(node))urgent.unshift(node);}
      return;
    }
    queued.add(node);(priority==='urgent'?urgent:background).push(node);run();
  };
  const finish=(node,img,ok)=>{
    if(jobs.get(node)!==img)return;
    jobs.delete(node);active=Math.max(0,active-1);
    if(ok&&eligible(node)){
      node.querySelector('.preview-placeholder')?.remove();
      node.insertBefore(img,node.firstChild);
      node.dataset.thumbLoaded='1';
    }else{
      try{img.removeAttribute('src');img.remove();}catch{}
      if(node?.isConnected)node.dataset.thumbLoaded='error';
    }
    run();
  };
  const cancelStale=()=>{
    for(const [node,img] of [...jobs]){
      if(eligible(node))continue;
      jobs.delete(node);active=Math.max(0,active-1);
      img.onload=null;img.onerror=null;
      try{img.removeAttribute('src');img.remove();}catch{}
    }
  };
  const next=()=>{
    while(urgent.length){const node=urgent.shift();queued.delete(node);if(eligible(node))return{node,priority:'urgent'};}
    while(background.length){const node=background.shift();queued.delete(node);if(eligible(node))return{node,priority:'background'};}
    return null;
  };
  function run(){
    cancelStale();
    const cap=activePagePreviewConcurrency();
    while(active<cap){
      const job=next();if(!job)break;
      const {node,priority}=job,asset=previewAsset(node);if(!asset)continue;
      active++;node.dataset.thumbLoaded='loading';
      const img=document.createElement('img');
      jobs.set(node,img);
      img.alt=asset.name||'Vista previa';
      img.loading='eager';
      img.decoding='async';
      img.fetchPriority=priority==='urgent'?'high':'low';
      img.style.cssText='display:block;width:100%;height:100%;object-fit:contain;image-rendering:auto';
      if(['sprite','tileset','animation','vfx'].includes(asset.contentKind))img.style.imageRendering='pixelated';
      img.onload=()=>finish(node,img,true);
      img.onerror=()=>finish(node,img,false);
      img.src=asset.previewUrl;
    }
  }
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      observer.unobserve(entry.target);
      enqueue(entry.target,'urgent');
    }
  },{root:null,rootMargin:'320px 0px',threshold:.01});
  const scan=()=>{
    const grid=document.getElementById('explore-grid');if(!grid)return;
    const nodes=[...grid.querySelectorAll('.card[data-id] .preview')];
    nodes.forEach(node=>{if(node.dataset.thumbObserved!=='1'){node.dataset.thumbObserved='1';observer?.observe(node);}});
    clearTimeout(sweepTimer);
    sweepTimer=setTimeout(()=>{if(!grid.isConnected)return;grid.querySelectorAll('.card[data-id] .preview').forEach(node=>enqueue(node,'background'));},120);
  };
  scan();
  const grid=document.getElementById('explore-grid');
  if(grid)new MutationObserver(()=>{cancelStale();scan();}).observe(grid,{childList:true,subtree:true});
  globalThis.addEventListener?.('pagehide',()=>{clearTimeout(sweepTimer);urgent.length=0;background.length=0;queued.clear();for(const [node,img] of [...jobs]){jobs.delete(node);img.onload=null;img.onerror=null;try{img.removeAttribute('src');}catch{}}active=0;});
}
function installCatalogOnlyActions(){if(typeof document==='undefined')return;const decorate=root=>root.querySelectorAll?.('.card[data-id]').forEach(card=>{const asset=recentAssets.get(card.dataset.id);if(!asset?.catalogOnly)return;card.dataset.catalogOnly='1';const primary=card.querySelector('[data-act="primary"]');if(primary)primary.textContent='Abrir fuente';});const toast=text=>{const node=document.getElementById('toast');if(!node)return;node.textContent=text;node.classList.add('on');clearTimeout(installCatalogOnlyActions.timer);installCatalogOnlyActions.timer=setTimeout(()=>node.classList.remove('on'),1900);};document.addEventListener('click',event=>{const primary=event.target.closest?.('.card[data-id] [data-act="primary"]');if(!primary)return;const card=primary.closest('.card[data-id]'),asset=recentAssets.get(card?.dataset.id);if(!asset?.catalogOnly)return;event.preventDefault();event.stopImmediatePropagation();if(asset.sourceUrl)window.open(asset.sourceUrl,'_blank','noopener');toast(asset.licenseReviewRequired?'Fuente abierta · verifica licencia antes de integrar':'Fuente abierta · sin descargar al teléfono');},true);decorate(document);new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)decorate(node.matches?.('.card[data-id]')?node.parentNode||node:node);}).observe(document.documentElement,{childList:true,subtree:true});}
function installQAPreviewHook(){const qa=browserQA();if(!qa.preview||typeof document==='undefined')return;let observer=null;const reveal=()=>{const node=document.querySelector('.card .preview[data-preview]:not([data-qa-revealed])');if(!node)return false;const url=clean(node.getAttribute('data-preview'));if(!url)return false;node.setAttribute('data-qa-revealed','1');node.querySelector('.preview-placeholder')?.remove();const img=document.createElement('img');img.loading='eager';img.alt='Contenido externo listo para descargar';img.src=url;const badge=node.querySelector('.badge');node.insertBefore(img,badge||node.firstChild);return true;};if(reveal())return;observer=new MutationObserver(()=>{if(reveal()){observer.disconnect();observer=null;}});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{observer?.disconnect();observer=null;},12000);}
export function clearProviderCache(){liveCache=new Map();configPromise=null;recentAssets.clear();clearKenneyCache();clearOpenGameArtCache();clearKeloContentCache();clearAmbientCgCache();clearPolyHavenCache();clearOpenverseCache();clearThreeDAssetsCache();clearGobkitCache();clearSfxMintCache();clearOpenSource3DCache();clearExternalProviderRuntimeCache();}
export const EXTERNAL_ASSET_PROVIDERS=Object.freeze({loadProviderConfig,getProviderStatuses,getCatalogScaleStatus,browseProvider,searchExternalAssets,getRecentExternalAsset,clearProviderCache});
export const EXTERNAL_CONTENT_PROVIDERS=EXTERNAL_ASSET_PROVIDERS;
if(typeof window!=='undefined'){window.KELO_EXTERNAL_ASSET_PROVIDERS=EXTERNAL_ASSET_PROVIDERS;window.KELO_EXTERNAL_CONTENT_PROVIDERS=EXTERNAL_CONTENT_PROVIDERS;installQAPreviewHook();installActivePageThumbnailHydrator();installCatalogOnlyActions();installUniversalPreviewInspector();installUniversalSpritePreview();installUniversalAvatarTryOn();installUniversalLookBuilder();}
