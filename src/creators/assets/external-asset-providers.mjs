/* KELO-INDEX
 * area: CREATORS / EXTERNAL ASSET PROVIDERS
 * owner: Kelo Creator Asset Bridge
 * keys: EXTERNAL ASSETS PROVIDERS SPRITECOOK KENNEY LPC OPENGAMEART LAZY
 * purpose: Browse provider metadata without downloading asset binaries.
 */
import {searchKenneyAssets,clearKenneyCache} from './kenney-live-provider.mjs';

const CONFIG_URL='../../../data/external-asset-providers.json?v=2';
let configPromise=null;
let liveCache=new Map();

function clean(v){return String(v??'').trim();}
function join(base,path){return new URL(path,base).href;}
function normalizeCategory(v){const x=clean(v).toLowerCase();return x||'other';}

export async function loadProviderConfig(){
  if(configPromise)return configPromise;
  configPromise=fetch(CONFIG_URL,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('PROVIDER_CONFIG_'+r.status);return r.json();});
  return configPromise;
}

function normalizeSpriteCook(example,provider){
  const preview=example.previewPath?join(provider.assetBaseUrl,example.previewPath):null;
  return {
    id:`spritecook:${example.slug}`,
    provider:'spritecook',externalId:clean(example.slug),name:clean(example.title||example.slug),
    category:normalizeCategory(example.category),tags:[normalizeCategory(example.category),'pixel-art'].filter(Boolean),
    previewUrl:preview,downloadUrl:preview,sourceUrl:example.sourceUrl||provider.sourceUrl,
    license:'CC0-1.0',author:'SpriteCook',attributionRequired:false,ownership:'discovered',
    description:clean(example.prompt),settings:Array.isArray(example.settings)?example.settings:[],
    downloadable:!!preview,integrationReady:!!preview
  };
}

async function loadSpriteCook(provider){
  if(liveCache.has(provider.id))return liveCache.get(provider.id);
  const data=await fetch(provider.indexUrl,{mode:'cors',cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('SPRITECOOK_INDEX_'+r.status);return r.json();});
  const list=Array.isArray(data?.examples)?data.examples:[];
  const result=list.map(x=>normalizeSpriteCook(x,provider));
  liveCache.set(provider.id,result);return result;
}

export async function getProviderStatuses(){
  const cfg=await loadProviderConfig();
  return (cfg.providers||[]).filter(p=>p.enabled!==false).map(p=>({
    id:p.id,name:p.name,mode:p.mode,license:p.license,sourceUrl:p.sourceUrl,browseUrl:p.browseUrl||p.sourceUrl,notes:p.notes,
    live:p.mode==='live-index'||p.mode==='lazy-live-index',lazy:p.mode==='lazy-live-index'
  }));
}

export async function browseProvider(id,options={}){
  const cfg=await loadProviderConfig();const provider=(cfg.providers||[]).find(p=>p.id===id&&p.enabled!==false);
  if(!provider)throw new Error('PROVIDER_NOT_FOUND:'+id);
  try{
    if(provider.id==='spritecook'&&provider.mode==='live-index')return {provider,assets:await loadSpriteCook(provider),error:null};
    if(provider.id==='kenney'&&provider.mode==='lazy-live-index')return {provider,assets:await searchKenneyAssets(options.query||'',{limit:options.limit||320}),error:null};
    return {provider,assets:[],error:null};
  }catch(error){return {provider,assets:[],error:String(error?.message||error)};}
}

export async function searchExternalAssets(query='',options={}){
  const cfg=await loadProviderConfig();const providers=(cfg.providers||[]).filter(p=>p.enabled!==false);
  const wanted=options.providers?.length?new Set(options.providers):null;
  const q=clean(query).toLowerCase();
  const selected=providers.filter(p=>{
    if(wanted)return wanted.has(p.id);
    return p.mode!=='lazy-live-index';
  });
  const bundles=await Promise.all(selected.map(p=>browseProvider(p.id,{query:q,limit:options.limit})));
  let assets=bundles.flatMap(b=>b.assets||[]);
  if(q)assets=assets.filter(a=>`${a.name} ${a.category} ${(a.tags||[]).join(' ')} ${a.description||''}`.toLowerCase().includes(q)||a.provider==='kenney');
  if(options.category&&options.category!=='all')assets=assets.filter(a=>a.category===options.category);
  return {assets,providers:bundles.map(b=>({id:b.provider.id,name:b.provider.name,mode:b.provider.mode,error:b.error,count:b.assets?.length||0,browseUrl:b.provider.browseUrl||b.provider.sourceUrl,license:b.provider.license,lazy:b.provider.mode==='lazy-live-index'}))};
}

export function clearProviderCache(){liveCache=new Map();configPromise=null;clearKenneyCache();}
export const EXTERNAL_ASSET_PROVIDERS=Object.freeze({loadProviderConfig,getProviderStatuses,browseProvider,searchExternalAssets,clearProviderCache});
if(typeof window!=='undefined')window.KELO_EXTERNAL_ASSET_PROVIDERS=EXTERNAL_ASSET_PROVIDERS;
