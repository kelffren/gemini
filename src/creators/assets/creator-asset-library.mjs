/* KELO-INDEX
 * area: CREATORS / ASSET LIBRARY
 * owner: Kelo Creator Asset Library authoring service
 * purpose: import manual image assets, keep immutable revisions, expose private/review/global views and bridge approved/owned revisions into existing runtime catalogs
 * public-api: createCreatorAssetLibrary()
 * consumes: Creator permission adapter + asset repository + KELO_ATLAS_CONTRACT + KELO_PROPERTY_CATALOG
 * state-owned: authoring metadata/runtime data-url cache for Creator asset revisions
 * does-not-own: Property placements, renderer, Map Forge generation, Admin Key policy or server review authority
 * extension-points: replace repository/authority; runtime continues consuming KELO_PROPERTY_CATALOG IDs
 * online: local repository/status transitions are prototype fallback; production replaces repository/review authority without changing asset IDs or consumers
 */

const MAX_FILE_BYTES=5*1024*1024;
const MAX_DIMENSION=2048;
const ALLOWED_TYPES=new Set(['image/png','image/webp','image/jpeg']);
const CATEGORIES=new Set(['nature','architecture','decor','tileset','ground','rural','dungeon','interior','other']);

function slug(value){return String(value||'asset').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'asset';}
function words(value){return String(value||'').split(/[\s,;|]+/).map(slug).filter(Boolean);}
function clampSize(value,fallback=32){return Math.max(8,Math.min(1024,Math.round((Number(value)||fallback)/8)*8));}
function freezeRecord(row){return Object.freeze({...row,tags:Object.freeze([...(row.tags||[])]),districts:Object.freeze([...(row.districts||['*'])]),worldSize:Object.freeze({...row.worldSize}),image:Object.freeze({...row.image}),collision:row.collision?Object.freeze({...row.collision}):null});}
function fnvBytes(bytes,seed=2166136261){let h=seed>>>0;for(const byte of bytes){h^=byte;h=Math.imul(h,16777619);}return h>>>0;}
async function blobHash(root,blob){
  const buffer=await blob.arrayBuffer();
  try{const subtle=root.crypto?.subtle||globalThis.crypto?.subtle;if(subtle?.digest){const digest=await subtle.digest('SHA-256',buffer);return Array.from(new Uint8Array(digest)).slice(0,8).map(v=>v.toString(16).padStart(2,'0')).join('');}}catch{}
  const bytes=new Uint8Array(buffer),a=fnvBytes(bytes),b=fnvBytes(bytes,0x9e3779b9);return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0');
}
function blobToDataUrl(root,blob){return new Promise((resolve,reject)=>{const Reader=root.FileReader||globalThis.FileReader;if(!Reader)return reject(new Error('CREATOR_ASSET_FILEREADER_UNAVAILABLE'));const reader=new Reader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('CREATOR_ASSET_DATA_URL_FAILED'));reader.readAsDataURL(blob);});}
async function inspectImage(root,blob){
  let image=null,release=()=>{};
  if(typeof root.createImageBitmap==='function')image=await root.createImageBitmap(blob);
  else{const url=root.URL?.createObjectURL?.(blob);if(!url||!root.Image)throw new Error('CREATOR_ASSET_IMAGE_DECODE_UNAVAILABLE');release=()=>root.URL?.revokeObjectURL?.(url);image=await new Promise((resolve,reject)=>{const img=new root.Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('CREATOR_ASSET_IMAGE_DECODE_FAILED'));img.src=url;});}
  try{
    const width=Number(image.width||image.naturalWidth)||0,height=Number(image.height||image.naturalHeight)||0;if(!width||!height)throw new Error('CREATOR_ASSET_IMAGE_DIMENSIONS_INVALID');if(width>MAX_DIMENSION||height>MAX_DIMENSION)throw new Error(`CREATOR_ASSET_IMAGE_TOO_LARGE:${width}x${height}`);
    let hasTransparency=null;
    try{const scale=Math.min(1,256/Math.max(width,height)),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale)),canvas=typeof root.OffscreenCanvas==='function'?new root.OffscreenCanvas(w,h):root.document?.createElement?.('canvas');if(canvas){canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx?.drawImage?.(image,0,0,w,h);const data=ctx?.getImageData?.(0,0,w,h)?.data;if(data){hasTransparency=false;for(let i=3;i<data.length;i+=4)if(data[i]<255){hasTransparency=true;break;}}}}catch{}
    return{width,height,hasTransparency};
  }finally{try{image?.close?.();}catch{}release();}
}
function defaultWorldSize(image){const max=128,ratio=Math.max(.05,image.width/Math.max(1,image.height));return ratio>=1?{w:clampSize(max),h:clampSize(max/ratio)}:{w:clampSize(max*ratio),h:clampSize(max)};}
function collisionFor(mode,size,custom=null){if(mode==='none')return null;if(mode==='rect'&&custom)return{x:Number(custom.x)||0,y:Number(custom.y)||0,w:Math.max(1,Number(custom.w)||size.w),h:Math.max(1,Number(custom.h)||size.h)};return{x:Math.round(size.w*.18),y:Math.round(size.h*.7),w:Math.max(8,Math.round(size.w*.64)),h:Math.max(8,Math.round(size.h*.3))};}

export function createCreatorAssetLibrary({root=globalThis,repository,permission}={}){
  if(!repository?.put||!repository?.list)throw new Error('CREATOR_ASSET_REPOSITORY_REQUIRED');if(!permission?.can||!permission?.actorId)throw new Error('CREATOR_ASSET_PERMISSION_REQUIRED');
  const runtimeSources=new Map(),listeners=new Set();let hydrated=false;
  const actorId=()=>String(permission.actorId()),emit=event=>listeners.forEach(fn=>{try{fn(event);}catch{}}),canUpload=()=>permission.can('creators.access',actorId()),canPublish=()=>permission.can('world.publish',actorId());

  async function runtimeRegister(record){
    const C=root.KELO_PROPERTY_CATALOG,A=root.KELO_ATLAS_CONTRACT;if(!C?.registerTemplate||!A?.register||!record?.blob)return false;if(C.get?.(record.assetId))return true;
    let src=runtimeSources.get(record.assetId);if(!src){src=await blobToDataUrl(root,record.blob);runtimeSources.set(record.assetId,src);}const atlasKey=`creatorAsset:${record.assetId}`;
    A.register(atlasKey,{id:atlasKey,src,width:record.image.width,height:record.image.height,tileWidth:record.image.width,tileHeight:record.image.height,frameWidth:record.image.width,frameHeight:record.image.height,columns:1},{role:'optional'});
    C.registerTemplate({id:record.assetId,label:record.name,category:record.category,family:record.family,districts:record.districts,width:record.worldSize.w,height:record.worldSize.h,snap:32,collision:record.collision,priceHint:0,source:'creator-library',sourceId:record.assetId,placeable:true,parts:[{assetKey:atlasKey,source:{x:0,y:0,w:record.image.width,h:record.image.height},offset:{x:0,y:0},size:{w:record.worldSize.w,h:record.worldSize.h},phase:record.phase||'props_back'}]});return true;
  }
  async function visibleRecords(){const me=actorId(),rows=await repository.list();return rows.filter(row=>String(row.ownerId)===me||row.status==='global');}
  async function hydrateRuntimeCatalog(){const rows=await visibleRecords();let registered=0;for(const row of rows){try{if(await runtimeRegister(row))registered++;}catch(error){console.warn('[Kelo Creator Assets] runtime registration failed',row.assetId,error?.message||error);}}hydrated=!!(root.KELO_PROPERTY_CATALOG?.registerTemplate&&root.KELO_ATLAS_CONTRACT?.register);emit({type:'hydrated',count:registered,available:rows.length});return registered;}

  async function importFile({file,name=null,category='decor',family=null,tags=[],districts=['*'],worldWidth=null,worldHeight=null,collisionMode='bottom',collision=null,phase='props_back'}={}){
    if(!canUpload())throw new Error('CREATOR_PERMISSION_DENIED:creators.access');const BlobCtor=root.Blob||globalThis.Blob;if(!BlobCtor||!(file instanceof BlobCtor))throw new Error('CREATOR_ASSET_FILE_REQUIRED');
    const type=String(file.type||'').toLowerCase();if(!ALLOWED_TYPES.has(type))throw new Error('CREATOR_ASSET_IMAGE_TYPE_UNSUPPORTED');if(Number(file.size)>MAX_FILE_BYTES)throw new Error('CREATOR_ASSET_FILE_TOO_LARGE');
    const image=await inspectImage(root,file),displayName=String(name||file.name||'Asset').trim().slice(0,80)||'Asset',ownerId=actorId(),categoryId=CATEGORIES.has(String(category))?String(category):'other',familyId=`creator:${slug(ownerId)}:${slug(family||displayName)}`,existing=await repository.list({familyId}),hash=await blobHash(root,file),duplicate=existing.find(row=>row.contentHash===hash);if(duplicate){await runtimeRegister(duplicate);return freezeRecord(duplicate);}const revision=(existing.reduce((m,row)=>Math.max(m,Number(row.revision)||0),0)||0)+1,assetId=`${familyId}@r${revision}-${hash.slice(0,8)}`,baseSize=defaultWorldSize(image),size={w:clampSize(worldWidth,baseSize.w),h:clampSize(worldHeight,baseSize.h)};
    const record={schema:1,assetId,familyId,revision,contentHash:hash,ownerId,name:displayName,category:categoryId,family:String(family||categoryId||'generic').trim().slice(0,60)||'generic',tags:Array.from(new Set([...words(tags),...words(displayName),...words(family)])),districts:Array.isArray(districts)&&districts.length?districts.map(String):['*'],status:'private',image:{mime:type,width:image.width,height:image.height,bytes:Number(file.size)||0,hasTransparency:image.hasTransparency},worldSize:size,collision:collisionFor(collisionMode,size,collision),phase:phase==='props_front'?'props_front':'props_back',createdAt:Date.now(),submittedAt:null,publishedAt:null,blob:file};
    await repository.put(record);await runtimeRegister(record);emit({type:'imported',assetId});return freezeRecord(record);
  }
  async function list({scope='visible'}={}){const me=actorId(),rows=await repository.list();let filtered=rows;if(scope==='mine')filtered=rows.filter(row=>String(row.ownerId)===me);else if(scope==='global')filtered=rows.filter(row=>row.status==='global');else if(scope==='review')filtered=canPublish()?rows.filter(row=>row.status==='review'):rows.filter(row=>row.status==='review'&&String(row.ownerId)===me);else filtered=rows.filter(row=>String(row.ownerId)===me||row.status==='global');return filtered.map(freezeRecord);}
  async function submit(assetId){const row=await repository.get(assetId);if(!row)throw new Error('CREATOR_ASSET_NOT_FOUND');if(String(row.ownerId)!==actorId())throw new Error('CREATOR_ASSET_OWNER_REQUIRED');if(row.status==='global')return freezeRecord(row);row.status='review';row.submittedAt=Date.now();await repository.put(row);emit({type:'submitted',assetId:row.assetId});return freezeRecord(row);}
  async function publish(assetId){if(!canPublish())throw new Error('CREATOR_PERMISSION_DENIED:world.publish');const row=await repository.get(assetId);if(!row)throw new Error('CREATOR_ASSET_NOT_FOUND');row.status='global';row.publishedAt=Date.now();await repository.put(row);await runtimeRegister(row);emit({type:'published',assetId:row.assetId});return freezeRecord(row);}
  async function remove(assetId){const row=await repository.get(assetId);if(!row)return false;if(String(row.ownerId)!==actorId())throw new Error('CREATOR_ASSET_OWNER_REQUIRED');if(row.status==='global')throw new Error('CREATOR_ASSET_GLOBAL_REVISION_IMMUTABLE');const ok=await repository.remove(assetId);runtimeSources.delete(String(assetId));emit({type:'removed',assetId:String(assetId),runtimeRemovalDeferred:true});return ok;}
  function catalogSnapshot(){const rows=root.KELO_PROPERTY_CATALOG?.list?.()||[];return rows.map(row=>({id:String(row.id),label:String(row.label||row.id),category:String(row.category||'other'),family:String(row.family||'generic'),districts:[...(row.districts||['*'])],source:String(row.source||'registry'),sourceId:String(row.sourceId||row.id)})).sort((a,b)=>a.id.localeCompare(b.id));}
  function catalogVersion(){const rows=catalogSnapshot(),idBytes=new TextEncoder().encode(rows.map(x=>x.id).join('|'));return `${root.KELO_PROPERTY_CATALOG?.version||'property-catalog'}+creator-${fnvBytes(idBytes).toString(16).padStart(8,'0')}-${rows.length}`;}
  function onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}
  async function close(){await repository.close?.();runtimeSources.clear();hydrated=false;}
  return Object.freeze({version:'creator-asset-library-v1.0.1',importFile,list,submit,publish,remove,hydrateRuntimeCatalog,runtimeRegister,catalogSnapshot,catalogVersion,onChange,close,get hydrated(){return hydrated;},get capabilities(){return Object.freeze({upload:canUpload(),publish:canPublish()});},limits:Object.freeze({maxFileBytes:MAX_FILE_BYTES,maxDimension:MAX_DIMENSION,types:Object.freeze(Array.from(ALLOWED_TYPES)),categories:Object.freeze(Array.from(CATEGORIES))})});
}
