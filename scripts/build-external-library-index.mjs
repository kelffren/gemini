import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT=path.resolve(process.cwd());
const OUTPUT_DIR=path.join(ROOT,'data','generated');
const OS3D_ROOT='https://raw.githubusercontent.com/ToxSam/open-source-3D-assets/main/data/';
const MAX_CONCURRENCY=3;
const MAX_RESPONSE_BYTES=1_000_000;

async function fetchJson(url,{maxBytes=MAX_RESPONSE_BYTES}={}){
  const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'KeloWorld-External-Index/1.0'}});
  if(!response.ok)throw new Error(`HTTP_${response.status}:${url}`);
  const declared=Number(response.headers.get('content-length')||0);if(declared>maxBytes)throw new Error(`RESPONSE_TOO_LARGE:${declared}:${url}`);
  const text=await response.text();if(Buffer.byteLength(text)>maxBytes)throw new Error(`RESPONSE_TOO_LARGE:${Buffer.byteLength(text)}:${url}`);
  return JSON.parse(text);
}

async function mapPool(rows,worker,concurrency=MAX_CONCURRENCY){
  const result=new Array(rows.length);let cursor=0;
  const runners=Array.from({length:Math.min(concurrency,rows.length)},async()=>{while(true){const i=cursor++;if(i>=rows.length)return;result[i]=await worker(rows[i],i);}});
  await Promise.all(runners);return result;
}

function clean(value){return String(value??'').trim();}
function attrTags(item){const rows=Array.isArray(item?.metadata?.attributes)?item.metadata.attributes:[],out=[];for(const row of rows){const type=clean(row?.trait_type),value=clean(row?.value);if(type)out.push(type);if(value)out.push(value);}return [...new Set(out)].slice(0,24);}

async function buildOpenSource3D(){
  const projectsRaw=await fetchJson(`${OS3D_ROOT}projects.json`,{maxBytes:250_000});
  const projects=(Array.isArray(projectsRaw)?projectsRaw:[]).filter(row=>row?.is_public!==false&&clean(row?.license).toUpperCase()==='CC0'&&clean(row?.asset_data_file));
  const manifests=await mapPool(projects,async project=>({project,assets:await fetchJson(new URL(clean(project.asset_data_file),OS3D_ROOT).href,{maxBytes:800_000})}));
  const assets=[];
  for(const {project,assets:rows} of manifests){for(const item of Array.isArray(rows)?rows:[]){if(item?.is_public===false||item?.is_draft===true)continue;const id=clean(item?.id||item?.name);if(!id)continue;assets.push({id:`opensource3d:${project.id}:${id}`,externalId:id,name:clean(item?.name||id),projectId:clean(project.id),projectName:clean(project.name),category:clean(project.name||'3d-model').toLowerCase(),contentKind:'model',tags:attrTags(item),description:clean(item?.description||project?.description||''),previewUrl:clean(item?.thumbnail_url)||null,sourceUrl:clean(project?.github_url)||'https://opensource3dassets.com/',remoteModelUrl:clean(item?.model_file_url)||null,format:clean(item?.format||'GLB'),bytes:Number(item?.metadata?.file_size||0)||0,license:'CC0-1.0',author:clean(project?.creator_id||'Polygonal Mind')});}}
  assets.sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  return{schema:'kelo.external-index.v1',provider:'opensource3d',generatedAt:new Date().toISOString(),source:'ToxSam/open-source-3D-assets',licensePolicy:'CC0-only',projects:projects.length,count:assets.length,assets};
}

async function main(){
  const requested=new Set(process.argv.slice(2).filter(arg=>arg.startsWith('--source=')).map(arg=>arg.slice(9)).filter(Boolean));
  const runAll=requested.size===0||requested.has('all');await fs.mkdir(OUTPUT_DIR,{recursive:true});const reports=[];
  if(runAll||requested.has('opensource3d')){const index=await buildOpenSource3D(),file=path.join(OUTPUT_DIR,'open-source-3d-index.json');await fs.writeFile(file,JSON.stringify(index));reports.push({provider:index.provider,count:index.count,projects:index.projects,file:path.relative(ROOT,file),bytes:Buffer.byteLength(JSON.stringify(index))});}
  console.log(JSON.stringify({ok:true,generatedAt:new Date().toISOString(),maxConcurrency:MAX_CONCURRENCY,maxResponseBytes:MAX_RESPONSE_BYTES,reports},null,2));
}

main().catch(error=>{console.error(error);process.exitCode=1;});
