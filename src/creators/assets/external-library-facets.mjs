/* KELO-INDEX
 * area: CREATORS / EXTERNAL CONTENT PROVIDERS / LIBRARY FACETS
 * owner: Kelo External Library Browser
 * keys: LIBRARY FACETS PACKS FOLDERS CATEGORIES KENNEY LPC OPENGAMEART QUATERNIUS METADATA MOBILE
 * purpose: expose real provider-backed folders/categories for in-app browsing without fetching asset binaries
 */
import {loadProviderConfig,browseProvider} from './external-asset-providers.mjs?v=10';

const cache=new Map();
const MAX_INDEXED_ROWS=1920;
const PAGE_SIZE=320;
const yieldMain=()=>globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0));
const clean=value=>String(value??'').trim();
const lower=value=>clean(value).toLowerCase();
const human=value=>clean(value).replace(/^[-_/]+|[-_/]+$/g,'').replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())||'General';

function inc(map,key,label,query,extra={}){
  key=clean(key);if(!key)return;
  const old=map.get(key)||{id:key,label:clean(label)||human(key),query:clean(query)||key,count:0,...extra};
  old.count+=1;map.set(key,old);
}
function sorted(map){return [...map.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));}
function clone(result){return{...result,categories:(result.categories||[]).map(x=>({...x})),packs:(result.packs||[]).map(x=>({...x})),declaredTypes:(result.declaredTypes||[]).map(x=>({...x})),summary:{...(result.summary||{})}};}
function supportedKenneyPath(path){return /^(?:2d|ui|icons)\//i.test(path)&&/\.(?:png|webp|jpe?g)$/i.test(path);}

async function kenneyFacets(provider){
  const response=await fetch(provider.indexUrl,{mode:'cors',cache:'force-cache'});
  if(!response.ok)throw new Error('KENNEY_FACETS_'+response.status);
  const body=await response.text();
  const categories=new Map(),packs=new Map();let assets=0,n=0;
  for(const raw of body.split('\n')){
    const line=raw.trim();if(!line)continue;
    const path=clean(line.split('\t')[0]);if(!supportedKenneyPath(path)||/^path$/i.test(path))continue;
    const parts=path.split('/').filter(Boolean),root=lower(parts[0]),pack=clean(parts[1]);assets++;
    inc(categories,root,root==='2d'?'2D':root==='ui'?'UI':'Icons',root+'/',{kind:'category'});
    if(pack)inc(packs,`${root}/${pack}`,human(pack),pack,{kind:'pack',group:root.toUpperCase(),pathPrefix:`${root}/${pack}/`});
    if(++n%4096===0)await yieldMain();
  }
  return{providerId:provider.id,mode:'full-index-folders',categories:sorted(categories),packs:sorted(packs),declaredTypes:[],summary:{assets,indexBytes:body.length,scope:'2D/UI/Icons mirror',complete:true}};
}

function assetHay(asset){return lower(`${asset.name||''} ${asset.category||''} ${asset.contentKind||''} ${(asset.tags||[]).join(' ')} ${asset.description||''} ${asset.author||''}`);}
async function indexedFacets(provider){
  const rows=[];let offset=0,hasMore=true,pages=0;
  while(hasMore&&rows.length<MAX_INDEXED_ROWS&&pages<6){
    const result=await browseProvider(provider.id,{offset,limit:PAGE_SIZE});
    if(result.error)throw new Error(result.error);
    const pageRows=result.assets||[];rows.push(...pageRows);pages++;
    hasMore=!!result.page?.hasMore&&pageRows.length>0;offset+=PAGE_SIZE;
    await yieldMain();
  }
  const categories=new Map(),packs=new Map();
  for(const asset of rows){
    const category=clean(asset.category||asset.contentKind);if(category)inc(categories,lower(category),human(category),category,{kind:'category'});
    const pack=clean(asset.pack);if(pack&&assetHay(asset).includes(lower(pack)))inc(packs,lower(pack),human(pack),pack,{kind:'pack'});
  }
  return{providerId:provider.id,mode:'bounded-index-folders',categories:sorted(categories),packs:sorted(packs),declaredTypes:[],summary:{assets:rows.length,complete:!hasMore,indexedPages:pages,maxRows:MAX_INDEXED_ROWS}};
}

function declaredFacets(provider){
  const types=(provider.contentKinds||[]).map(type=>({id:lower(type),label:human(type),query:'',count:null,kind:'declared-type'}));
  return{providerId:provider.id,mode:'search-api',categories:[],packs:[],declaredTypes:types,summary:{assets:null,complete:false,requiresQuery:provider.requiresQuery===true}};
}

export async function getExternalLibraryFacets(providerId,{refresh=false}={}){
  const id=clean(providerId);if(!id||id==='all')return{providerId:'all',mode:'federated',categories:[],packs:[],declaredTypes:[],summary:{complete:false}};
  if(!refresh&&cache.has(id))return clone(await cache.get(id));
  const promise=(async()=>{
    const cfg=await loadProviderConfig(),provider=(cfg.providers||[]).find(p=>p.id===id&&p.enabled!==false);
    if(!provider)throw new Error('PROVIDER_NOT_FOUND:'+id);
    if(id==='kenney')return kenneyFacets(provider);
    if(['live-index','lazy-live-index'].includes(String(provider.mode||'')))return indexedFacets(provider);
    return declaredFacets(provider);
  })();
  cache.set(id,promise);
  try{return clone(await promise);}catch(error){cache.delete(id);throw error;}
}

export function clearExternalLibraryFacetCache(providerId){
  if(providerId)cache.delete(String(providerId));else cache.clear();
}

export const KELO_EXTERNAL_LIBRARY_FACETS=Object.freeze({version:'external-library-facets-v1',get:getExternalLibraryFacets,clear:clearExternalLibraryFacetCache});
