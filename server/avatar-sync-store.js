/* KELO-INDEX
 * area: SERVER / AVATAR + MODULAR APPEARANCE
 * owner: Kelo server authority
 * keys: SUPABASE AVATAR MANIFEST CHARACTER CREATOR APPEARANCE RLS SANITIZE PRESENTATION ENVELOPE
 * purpose: resolve trusted full-body avatar plus current published modular Creator visuals from persisted character state
 * online: server derives presentation metadata with the verified owner JWT; remote clients never declare asset URLs or revision bindings
 * do-not: NO renderer, NO client-trusted URL, NO service-role requirement, NO duplicate avatar/appearance persistence
 */
'use strict';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLOT_RE=/^[A-Za-z0-9_.:-]{1,64}$/;
const FACE_KEYS=Object.freeze(['down','left','right','up']);
const PUBLIC_CREATOR_BUCKET='creator-global';
const PUBLIC_CREATOR_VISIBILITY=new Set(['global','official']);
function cleanBase(value){return String(value||'').trim().replace(/\/+$/,'');}
function cleanPath(value){
  const raw=String(value||'').trim().replace(/^\/+/, '');
  if(!raw||raw.includes('..')||!/^[a-zA-Z0-9_./-]+$/.test(raw))return null;
  return raw.slice(0,512);
}
function cleanBucket(value){const raw=String(value||'').trim();return /^[a-zA-Z0-9_-]{1,80}$/.test(raw)?raw:null;}
function cleanText(value,max){return String(value==null?'':value).trim().slice(0,max||120);}
function num(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function int(value,min,max,fallback){const n=Math.floor(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
const DIRECTION_KEYS=Object.freeze(['n','ne','e','se','s','sw','w','nw']);
function directions(raw,rows){const source=Array.isArray(raw)?raw.map(value=>String(value||'').toLowerCase()):[];if(source.length===rows&&source.every(key=>DIRECTION_KEYS.includes(key))&&new Set(source).size===source.length)return source;if(rows===8)return [...DIRECTION_KEYS];if(rows===4)return['s','w','e','n'];return['s',...new Array(Math.max(0,rows-1)).fill(0).map((_,index)=>`row${index+2}`)];}
function rowMap(raw,rows,directionKeys){const src=raw&&typeof raw==='object'?raw:{},fallback={down:0,left:1,right:2,up:3},out={};for(const key of FACE_KEYS)out[key]=int(src[key],0,Math.max(0,rows-1),Math.min(fallback[key],Math.max(0,rows-1)));for(const key of DIRECTION_KEYS){const fallbackRow=directionKeys.indexOf(key);if(src[key]!=null||fallbackRow>=0)out[key]=int(src[key],0,Math.max(0,rows-1),Math.max(0,fallbackRow));}return out;}
function frameCounts(raw,rows,columns){const source=Array.isArray(raw)?raw:[];return new Array(rows).fill(columns).map((fallback,row)=>int(source[row],1,columns,fallback));}
function encodePath(path){return path.split('/').map(encodeURIComponent).join('/');}
function safeTransform(raw){const t=raw&&typeof raw==='object'?raw:{};return Object.freeze({x:num(t.x,-512,512,0),y:num(t.y,-512,512,0),scaleX:num(t.scaleX,.1,8,1),scaleY:num(t.scaleY,.1,8,1),rotation:num(t.rotation,-360,360,0)});}
function safeTransforms(raw){const src=raw&&typeof raw==='object'?raw:{},out={default:safeTransform(src.default)};for(const face of FACE_KEYS)if(src[face]&&typeof src[face]==='object')out[face]=safeTransform(src[face]);return Object.freeze(out);}
function safeCharacterVisual(raw){
  const v=raw&&typeof raw==='object'?raw:{},mode=v.mode==='sheet'?'sheet':v.mode==='socket'?'socket':null;if(!mode)return null;
  const faceRows={};for(const face of FACE_KEYS)faceRows[face]=int(v.faceRows&&v.faceRows[face],0,15,{down:0,left:1,right:2,up:3}[face]);
  return Object.freeze({mode,socket:cleanText(v.socket||'center',40),layer:v.layer==='back'?'back':'front',columns:int(v.columns,1,16,4),rows:int(v.rows,1,16,4),faceRows:Object.freeze(faceRows),anchor:Object.freeze({x:num(v.anchor&&v.anchor.x,-4,4,.5),y:num(v.anchor&&v.anchor.y,-4,4,1)}),width:num(v.width,1,512,28),height:num(v.height,1,512,28),heightScale:num(v.heightScale,.1,8,1),rotation:num(v.rotation,-360,360,0)});
}

function createAvatarSyncStore(options={}){
  const supabaseUrl=cleanBase(options.supabaseUrl||process.env.SUPABASE_URL);
  const apiKey=String(options.supabaseApiKey||process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
  const fetchImpl=options.fetchImpl||global.fetch;
  const configured=Boolean(supabaseUrl&&apiKey&&fetchImpl);
  let appearanceRpcErrors=0,lastAppearanceError=null;

  async function request(url,opts={}){
    const res=await fetchImpl(url,opts),body=await res.text();
    if(!res.ok){const e=new Error(`SUPABASE_${res.status}:${body.slice(0,200)}`);e.status=res.status;throw e;}
    return body?JSON.parse(body):null;
  }
  function headers(token){return{apikey:apiKey,Authorization:`Bearer ${String(token||'')}`,'Content-Type':'application/json'};}
  function sanitizeAvatar(raw){
    if(!raw||typeof raw!=='object'||!raw.contentId)return null;
    const payload=raw.payload&&typeof raw.payload==='object'?raw.payload:{},rt=payload.avatarRuntime&&typeof payload.avatarRuntime==='object'?payload.avatarRuntime:null;
    if(!rt||rt.bucket!=='avatars')return null;
    const path=cleanPath(rt.path);if(!path)return null;
    const columns=int(rt.columns,1,16,1),rows=int(rt.rows,1,16,1),directionKeys=directions(rt.directionKeys,rows);
    const runtime={bucket:'avatars',path,publicUrl:`${supabaseUrl}/storage/v1/object/public/avatars/${encodePath(path)}`,columns,rows,directionKeys:Object.freeze(directionKeys),frameCounts:Object.freeze(frameCounts(rt.frameCounts,rows,columns)),rowMap:Object.freeze(rowMap(rt.rowMap,rows,directionKeys)),frameMs:int(rt.frameMs,70,1000,140),renderHeight:int(rt.renderHeight,44,180,82)};
    const safePayload={rigProfileId:String(payload.rigProfileId||`sprite-rig-${rows}d`).slice(0,80),directions:int(payload.directions,1,8,directionKeys.length),avatarRuntime:Object.freeze(runtime)};
    return Object.freeze({revisionId:String(raw.revisionId||''),ownerUserId:String(raw.ownerUserId||''),contentId:String(raw.contentId).slice(0,160),displayName:String(raw.displayName||'Avatar').slice(0,100),payload:Object.freeze(safePayload),source:'server-authoritative-published'});
  }
  function sanitizePublicAsset(raw){
    const a=raw&&typeof raw==='object'?raw:null;if(!a)return null;
    const bucket=cleanBucket(a.publicStorageBucket),path=cleanPath(a.publicStoragePath),revisionId=String(a.assetRevisionId||''),visibility=String(a.assetVisibility||'');
    if(bucket!==PUBLIC_CREATOR_BUCKET||!PUBLIC_CREATOR_VISIBILITY.has(visibility)||!path||!UUID_RE.test(revisionId))return null;
    return Object.freeze({role:String(a.role||'primary').slice(0,40),ordinal:int(a.ordinal,0,64,0),assetRevisionId:revisionId,assetId:String(a.assetId||'').slice(0,160),contentHash:String(a.contentHash||'').slice(0,160),mimeType:String(a.mimeType||'image/png').slice(0,80),byteSize:Math.max(0,Number(a.byteSize)||0),pixelWidth:int(a.pixelWidth,1,8192,1),pixelHeight:int(a.pixelHeight,1,8192,1),worldWidth:num(a.worldWidth,0,8192,0),worldHeight:num(a.worldHeight,0,8192,0),publicStorageBucket:bucket,publicStoragePath:path,assetVisibility:visibility,runtimeUrl:`${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodePath(path)}`});
  }
  function sanitizeAppearance(raw){
    if(!raw||typeof raw!=='object'||!UUID_RE.test(String(raw.characterId||'')))return null;
    const rows=Array.isArray(raw.loadout)?raw.loadout.slice(0,24):[],loadout=[];
    for(const row of rows){
      const revisionId=String(row&&row.revisionId||''),slotKey=String(row&&row.slotKey||''),contentType=String(row&&row.contentType||''),kind=String(row&&row.bindingKind||contentType),payload=row&&row.payload&&typeof row.payload==='object'?row.payload:{},target=String(payload.targetType||'character').toLowerCase(),serverSlot=String(payload.slotId||payload.slot||slotKey),asset=sanitizePublicAsset(row&&row.asset);
      if(!UUID_RE.test(revisionId)||!SLOT_RE.test(slotKey)||serverSlot!==slotKey||!['appearance','equipment'].includes(contentType)||kind!==contentType||!['character','player'].includes(target)||!asset)continue;
      const safePayload=Object.freeze({slotId:slotKey,targetType:target,rarity:cleanText(payload.rarity||'common',32),transforms:safeTransforms(payload.transforms),characterVisual:safeCharacterVisual(payload.characterVisual)});
      loadout.push(Object.freeze({slotKey,bindingKind:kind,revisionId,contentId:cleanText(row.contentId,160),stableKey:cleanText(row.stableKey||row.contentId,160),revision:Math.max(1,Math.floor(Number(row.revision)||1)),contentHash:cleanText(row.contentHash,160),contentType,displayName:cleanText(row.displayName||row.contentId,100),tags:Object.freeze((Array.isArray(row.tags)?row.tags:[]).slice(0,24).map(v=>cleanText(v,48)).filter(Boolean)),payload:safePayload,assets:Object.freeze([asset])}));
    }
    if(!loadout.length)return null;
    const revisionKey=loadout.map(row=>`${row.slotKey}:${row.revisionId}`).sort().join('|');
    return Object.freeze({version:'creator-modular-appearance-v1',source:'server-authoritative-published',characterId:String(raw.characterId),revisionKey,loadout:Object.freeze(loadout)});
  }
  async function resolveAppearance(characterId,accessToken){
    try{const raw=await request(`${supabaseUrl}/rest/v1/rpc/get_my_public_creator_character_appearance`,{method:'POST',headers:headers(accessToken),body:JSON.stringify({p_character_id:characterId})});lastAppearanceError=null;return sanitizeAppearance(raw);}catch(error){appearanceRpcErrors+=1;lastAppearanceError=String(error&&error.message||error);return null;}
  }
  async function resolve(characterId,accessToken){
    if(!configured||!characterId||!accessToken)return null;
    const appearancePromise=resolveAppearance(characterId,accessToken),query=new URLSearchParams({id:`eq.${String(characterId)}`,status:'eq.active',select:'id,active_avatar_content_id',limit:'1'});
    const chars=await request(`${supabaseUrl}/rest/v1/characters?${query}`,{method:'GET',headers:headers(accessToken)}),row=Array.isArray(chars)?chars[0]:null,contentId=row&&row.active_avatar_content_id;let avatar=null;
    if(contentId){const raw=await request(`${supabaseUrl}/rest/v1/rpc/get_avatar_manifest`,{method:'POST',headers:headers(accessToken),body:JSON.stringify({p_content_id:contentId})});avatar=sanitizeAvatar(raw);}
    const creatorAppearance=await appearancePromise;if(!avatar&&!creatorAppearance)return null;return Object.freeze(Object.assign({source:'server-authoritative-presentation'},avatar||{}, {creatorAppearance}));
  }
  return Object.freeze({version:'avatar-sync-store-v3.1-creator-modular',configured,resolve,sanitize:sanitizeAvatar,sanitizeAppearance,audit:()=>({version:'avatar-sync-store-v3.1-creator-modular',configured,clientManifestTrusted:false,publicBucket:'avatars',creatorPublicBucket:PUBLIC_CREATOR_BUCKET,creatorVisibility:[...PUBLIC_CREATOR_VISIBILITY],directionRigs:[1,4,8],creatorAppearance:true,creatorAppearanceSource:'owner-jwt + published exact revisions',appearanceRpcErrors,lastAppearanceError})});
}
module.exports={createAvatarSyncStore};
