/* KELO-INDEX
 * area: CREATORS / EXTERNAL CONTENT / OPEN SOURCE 3D ASSETS
 * owner: Kelo Universal Content Bridge
 * keys: OS3D CC0 GLB PROJECT MANIFEST LAZY MOBILE SEARCH
 * purpose: search the OpenSource3DAssets registry through small project manifests without mirroring GLB binaries on player devices
 */
import {fetchProviderJson,mobilePageWindow,mobilePageBudget,clearExternalProviderRuntimeCache} from './external-provider-runtime.mjs?v=1';

const ROOT='https://raw.githubusercontent.com/ToxSam/open-source-3D-assets/main/data/';
const PROJECTS=`${ROOT}projects.json`;
const MAX_PROJECT_MANIFESTS=6;
function clean(value){return String(value??'').trim();}
function words(value){return clean(value).toLowerCase().split(/[^a-z0-9]+/).filter(token=>token.length>1);}
function scoreProject(project,q){if(!q)return 0;const tokens=words(q),hay=`${project?.id||''} ${project?.name||''} ${project?.description||''}`.toLowerCase();let score=0;for(const token of tokens)if(hay.includes(token))score+=token.length>5?3:1;return score;}
function attrTags(item){const rows=Array.isArray(item?.metadata?.attributes)?item.metadata.attributes:[],tags=[];for(const row of rows){const type=clean(row?.trait_type),value=clean(row?.value);if(type)tags.push(type);if(value)tags.push(value);}return [...new Set(tags)].slice(0,30);}
function normalize(item,project){
  const id=clean(item?.id||item?.name),license=clean(project?.license||'UNKNOWN').toUpperCase()==='CC0'?'CC0-1.0':clean(project?.license||'UNKNOWN'),model=clean(item?.model_file_url),preview=clean(item?.thumbnail_url),source=clean(project?.github_url)||'https://opensource3dassets.com/';
  return{id:`opensource3d:${project?.id||'project'}:${id}`,provider:'opensource3d',externalId:id,name:clean(item?.name||id),category:clean(project?.name||'3d-model').toLowerCase(),contentKind:'model',previewKind:'image',tags:attrTags(item),previewUrl:preview||null,downloadUrl:null,sourceUrl:source,license,author:clean(project?.creator_id||'Polygonal Mind'),attributionRequired:false,ownership:'discovered',description:clean(item?.description||project?.description||''),downloadable:false,integrationReady:false,verified:license==='CC0-1.0',catalogOnly:true,heavyExternal:true,remoteModelUrl:model||null,format:clean(item?.format||'GLB'),bytes:Number(item?.metadata?.file_size||0)||0,projectId:clean(project?.id),projectName:clean(project?.name)};
}
function matchesAsset(asset,q){if(!q)return true;const hay=`${asset.name} ${asset.category} ${asset.description} ${(asset.tags||[]).join(' ')}`.toLowerCase();return words(q).every(token=>hay.includes(token));}

export async function searchOpenSource3DAssets(query='',options={}){
  const q=clean(query);if(!q)return{assets:[],offset:0,limit:0,total:0,hasMore:false,requiresQuery:true,engine:'opensource3d-project-manifests-v1'};
  const window=mobilePageWindow(Math.max(1,Number(options.limit)||24),Math.max(0,Number(options.offset)||0),{heavy:true}),projectsRaw=await fetchProviderJson('opensource3d',PROJECTS,{ttlMs:60*60*1000,maxBytes:220_000,cacheKey:'opensource3d:projects:v1'}),projects=(Array.isArray(projectsRaw)?projectsRaw:[]).filter(project=>project?.is_public!==false&&clean(project?.license).toUpperCase()==='CC0'&&clean(project?.asset_data_file));
  const ranked=projects.map(project=>({project,score:scoreProject(project,q)})).sort((a,b)=>b.score-a.score||String(a.project?.name||'').localeCompare(String(b.project?.name||''))),positive=ranked.filter(row=>row.score>0),manifestBudget=mobilePageBudget(MAX_PROJECT_MANIFESTS,{heavy:true}),selected=(positive.length?positive:ranked).slice(0,manifestBudget),manifestResults=await Promise.allSettled(selected.map(({project})=>fetchProviderJson('opensource3d',new URL(clean(project.asset_data_file),ROOT).href,{ttlMs:60*60*1000,maxBytes:650_000,cacheKey:`opensource3d:project:${project.id}`}))),all=[];
  for(let i=0;i<selected.length;i++){const result=manifestResults[i];if(result?.status!=='fulfilled')continue;const project=selected[i].project,items=Array.isArray(result.value)?result.value:[];for(const item of items){if(item?.is_public===false||item?.is_draft===true)continue;const asset=normalize(item,project);if(asset.externalId&&matchesAsset(asset,q))all.push(asset);}}
  const start=window.offset,assets=all.slice(start,start+window.limit);return{assets,offset:start,limit:window.limit,total:all.length,hasMore:start+assets.length<all.length,requiresQuery:true,engine:'opensource3d-project-manifests-v1',projectsScanned:selected.length};
}
export function clearOpenSource3DCache(){clearExternalProviderRuntimeCache('opensource3d:');}
