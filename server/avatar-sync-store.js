/* KELO-INDEX
 * area: SERVER / AVATAR
 * owner: Kelo server authority
 * keys: SUPABASE AVATAR MANIFEST CHARACTER CONTENT RLS SANITIZE COMMUNITY ASSETS STREAMING EQUIPMENT RENDERPROFILE
 * purpose: resolve the active creator avatar and its server-trusted community cosmetic references from persisted character state
 * online: server derives runtime manifest from Supabase; clients never declare asset URLs, frame metadata, or public community paths
 * do-not: NO renderer, NO client-trusted URL, NO service-role requirement, NO duplicate avatar persistence
 */
'use strict';

function cleanBase(value){return String(value||'').trim().replace(/\/+$/,'');}
function cleanPath(value){
  const raw=String(value||'').trim().replace(/^\/+/, '');
  if(!raw||raw.includes('..')||!/^[a-zA-Z0-9_./-]+$/.test(raw))return null;
  return raw.slice(0,512);
}
function cleanId(value,max=180){
  const raw=String(value||'').trim();
  if(!raw||!/^[a-zA-Z0-9_:@.\/-]+$/.test(raw))return null;
  return raw.slice(0,max);
}
function int(value,min,max,fallback){const n=Math.floor(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function num(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
const DIRECTION_KEYS=Object.freeze(['n','ne','e','se','s','sw','w','nw']);
const COMMUNITY_MIME=Object.freeze(new Set(['image/png','image/webp','image/jpeg']));
const COMMUNITY_SLOTS=Object.freeze(new Set(['body','outfit','head','hair','face','weapon','offhand','back','aura','pet','mount','effect']));
const COMMUNITY_SOCKETS=Object.freeze(new Set(['center','foot','head','handR','handL']));
const MAX_COMMUNITY_ASSETS=12;
function directions(raw,rows){const source=Array.isArray(raw)?raw.map(value=>String(value||'').toLowerCase()):[];if(source.length===rows&&source.every(key=>DIRECTION_KEYS.includes(key))&&new Set(source).size===source.length)return source;if(rows===8)return [...DIRECTION_KEYS];if(rows===4)return['s','w','e','n'];return['s',...new Array(Math.max(0,rows-1)).fill(0).map((_,index)=>`row${index+2}`)];}
function rowMap(raw,rows,directionKeys){const src=raw&&typeof raw==='object'?raw:{},fallback={down:0,left:1,right:2,up:3},out={};for(const key of ['down','left','right','up'])out[key]=int(src[key],0,Math.max(0,rows-1),Math.min(fallback[key],Math.max(0,rows-1)));for(const key of DIRECTION_KEYS){const fallbackRow=directionKeys.indexOf(key);if(src[key]!=null||fallbackRow>=0)out[key]=int(src[key],0,Math.max(0,rows-1),Math.max(0,fallbackRow));}return out;}
function frameCounts(raw,rows,columns){const source=Array.isArray(raw)?raw:[];return new Array(rows).fill(columns).map((fallback,row)=>int(source[row],1,columns,fallback));}
function encodePath(path){return path.split('/').map(encodeURIComponent).join('/');}
function defaultCommunityProfile(slot,width,height){
  const ratio=Math.max(.1,Math.min(10,(Number(width)||64)/Math.max(1,Number(height)||64))),base={mode:'socket',layer:'front',socket:'center',anchor:{x:.5,y:.5},scale:1,rotation:0,columns:1,rows:1,frameMs:140,faceRows:{down:0,left:0,right:0,up:0},offsets:{},pixelated:false};
  if(slot==='body'||slot==='outfit')Object.assign(base,{socket:'foot',anchor:{x:.5,y:1},heightScale:1,widthScale:.7});
  else if(slot==='head'||slot==='hair'||slot==='face')Object.assign(base,{socket:'head',anchor:{x:.5,y:.55},heightScale:.38,widthScale:.38*ratio});
  else if(slot==='weapon')Object.assign(base,{socket:'handR',anchor:{x:.5,y:.72},heightScale:.5,widthScale:.5*ratio});
  else if(slot==='offhand')Object.assign(base,{socket:'handL',anchor:{x:.5,y:.65},heightScale:.42,widthScale:.42*ratio});
  else if(slot==='back')Object.assign(base,{socket:'center',layer:'back',anchor:{x:.5,y:.55},heightScale:.72,widthScale:.72*ratio});
  else if(slot==='aura')Object.assign(base,{socket:'foot',layer:'back',anchor:{x:.5,y:.72},heightScale:1.25,widthScale:1.25*ratio});
  else if(slot==='effect')Object.assign(base,{socket:'center',anchor:{x:.5,y:.5},heightScale:1.05,widthScale:1.05*ratio});
  else if(slot==='pet')Object.assign(base,{socket:'foot',anchor:{x:.5,y:1},heightScale:.44,widthScale:.44*ratio,offsets:{default:{x:42,y:2}}});
  else if(slot==='mount')Object.assign(base,{socket:'foot',layer:'back',anchor:{x:.5,y:.78},heightScale:1.35,widthScale:1.35*ratio,offsets:{default:{x:0,y:12}}});
  return base;
}
function communityRenderProfile(raw,slot,width,height){
  const fallback=defaultCommunityProfile(slot,width,height),source=raw&&typeof raw==='object'?raw:{},mode=source.mode==='sheet'?'sheet':'socket',layer=source.layer==='back'?'back':'front',socket=COMMUNITY_SOCKETS.has(String(source.socket))?String(source.socket):fallback.socket,anchorSource=source.anchor&&typeof source.anchor==='object'?source.anchor:fallback.anchor;
  const offsets={};for(const face of ['default','down','left','right','up','down-left','down-right','up-left','up-right']){const value=source.offsets&&typeof source.offsets==='object'?source.offsets[face]:null;if(!value||typeof value!=='object')continue;offsets[face]=Object.freeze({x:num(value.x,-160,160,0),y:num(value.y,-160,160,0),scale:num(value.scale,.2,4,1),rotation:num(value.rotation,-360,360,0)});}
  if(!Object.keys(offsets).length&&fallback.offsets)Object.assign(offsets,fallback.offsets);
  const rows=int(source.rows,1,32,1),columns=int(source.columns,1,32,1),faceRows=rowMap(source.faceRows,rows,rows===8?DIRECTION_KEYS:rows===4?['s','w','e','n']:['s']);
  return Object.freeze({mode,layer,socket,anchor:Object.freeze({x:num(anchorSource.x,0,1,.5),y:num(anchorSource.y,0,1,.5)}),scale:num(source.scale,.1,4,1),rotation:num(source.rotation,-360,360,0),columns,rows,frameMs:int(source.frameMs,50,2000,140),idleFrame:int(source.idleFrame,0,Math.max(0,columns-1),0),faceRows:Object.freeze(faceRows),heightScale:num(source.heightScale,.08,4,num(fallback.heightScale,.08,4,.5)),widthScale:num(source.widthScale,.08,4,num(fallback.widthScale,.08,4,.5)),offsets:Object.freeze(offsets),pixelated:source.pixelated===true});
}
function communityAssets(raw,supabaseUrl){
  if(!Array.isArray(raw)||!supabaseUrl)return Object.freeze([]);
  const out=[],seen=new Set();
  for(const source of raw){
    if(out.length>=MAX_COMMUNITY_ASSETS)break;
    if(!source||typeof source!=='object')continue;
    const id=cleanId(source.assetId||source.id),path=cleanPath(source.publicStoragePath||source.path),mime=String(source.mime||source.mimeType||'').toLowerCase(),sha256=String(source.sha256||source.contentHash||'').toLowerCase(),slot=String(source.slot||source.mountSlot||'effect').toLowerCase();
    if(!id||!path||!COMMUNITY_MIME.has(mime)||!COMMUNITY_SLOTS.has(slot)||!/^[0-9a-f]{64}$/.test(sha256))continue;
    const bytes=int(source.bytes||source.byteSize,1,5*1024*1024,0),width=int(source.width||source.pixelWidth,1,2048,0),height=int(source.height||source.pixelHeight,1,2048,0);
    if(!bytes||!width||!height)continue;
    const publicationId=cleanId(source.publicationId,100),revisionId=cleanId(source.revisionId,100),version=int(source.version||source.revision,1,1_000_000,1),key=`${slot}:${id}@${version}:${sha256}`;
    if(seen.has(key))continue;seen.add(key);
    out.push(Object.freeze({schema:'kelo.community-asset.v1',id,assetId:id,version,slot,type:String(source.type||source.kind||'cosmetic').slice(0,32),publicationId,revisionId,bucket:'creator-global',path,url:`${supabaseUrl}/storage/v1/object/public/creator-global/${encodePath(path)}`,mime,bytes,width,height,sha256,renderProfile:communityRenderProfile(source.renderProfile,slot,width,height),moderation:'server-verified'}));
  }
  return Object.freeze(out);
}

function createAvatarSyncStore(options={}){
  const supabaseUrl=cleanBase(options.supabaseUrl||process.env.SUPABASE_URL);
  const apiKey=String(options.supabaseApiKey||process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
  const fetchImpl=options.fetchImpl||global.fetch;
  const configured=Boolean(supabaseUrl&&apiKey&&fetchImpl);

  async function request(url,opts={}){
    const res=await fetchImpl(url,opts),text=await res.text();
    if(!res.ok){const e=new Error(`SUPABASE_${res.status}:${text.slice(0,200)}`);e.status=res.status;e.body=text;throw e;}
    return text?JSON.parse(text):null;
  }
  function headers(token){return{apikey:apiKey,Authorization:`Bearer ${String(token||'')}`,'Content-Type':'application/json'};}
  function missingCharacterManifestRpc(error){return Number(error?.status)===404||/PGRST202|Could not find the function|get_character_avatar_manifest/i.test(String(error?.body||error?.message||''));}
  function sanitize(raw){
    if(!raw||typeof raw!=='object'||!raw.contentId)return null;
    const payload=raw.payload&&typeof raw.payload==='object'?raw.payload:{},rt=payload.avatarRuntime&&typeof payload.avatarRuntime==='object'?payload.avatarRuntime:null;
    if(!rt||rt.bucket!=='avatars')return null;
    const path=cleanPath(rt.path);if(!path)return null;
    const columns=int(rt.columns,1,16,1),rows=int(rt.rows,1,16,1),directionKeys=directions(rt.directionKeys,rows);
    const runtime={bucket:'avatars',path,publicUrl:`${supabaseUrl}/storage/v1/object/public/avatars/${encodePath(path)}`,columns,rows,directionKeys:Object.freeze(directionKeys),frameCounts:Object.freeze(frameCounts(rt.frameCounts,rows,columns)),rowMap:Object.freeze(rowMap(rt.rowMap,rows,directionKeys)),frameMs:int(rt.frameMs,70,1000,140),renderHeight:int(rt.renderHeight,44,180,82)};
    const safePayload={rigProfileId:String(payload.rigProfileId||`sprite-rig-${rows}d`).slice(0,80),directions:int(payload.directions,1,8,directionKeys.length),avatarRuntime:Object.freeze(runtime),communityAssets:communityAssets(payload.communityAssets,supabaseUrl)};
    return Object.freeze({contentId:String(raw.contentId).slice(0,160),displayName:String(raw.displayName||'Avatar').slice(0,100),payload:Object.freeze(safePayload)});
  }
  async function resolve(characterId,accessToken){
    if(!configured||!characterId||!accessToken)return null;
    try{
      const characterManifest=await request(`${supabaseUrl}/rest/v1/rpc/get_character_avatar_manifest`,{method:'POST',headers:headers(accessToken),body:JSON.stringify({p_character_id:String(characterId)})});
      return sanitize(characterManifest);
    }catch(error){
      if(!missingCharacterManifestRpc(error))throw error;
    }
    const query=new URLSearchParams({id:`eq.${String(characterId)}`,status:'eq.active',select:'id,active_avatar_content_id',limit:'1'});
    const chars=await request(`${supabaseUrl}/rest/v1/characters?${query}`,{method:'GET',headers:headers(accessToken)}),row=Array.isArray(chars)?chars[0]:null;
    const contentId=row&&row.active_avatar_content_id;if(!contentId)return null;
    const legacyManifest=await request(`${supabaseUrl}/rest/v1/rpc/get_avatar_manifest`,{method:'POST',headers:headers(accessToken),body:JSON.stringify({p_content_id:contentId})});
    return sanitize(legacyManifest);
  }
  return Object.freeze({version:'avatar-sync-store-v5-community-render-profile',configured,resolve,sanitize,audit:()=>({version:'avatar-sync-store-v5-community-render-profile',configured,clientManifestTrusted:false,publicBucket:'avatars',communityBucket:'creator-global',communityClientUrlTrusted:false,maxCommunityAssets:MAX_COMMUNITY_ASSETS,characterEquipmentManifest:true,communityRenderProfiles:true,legacyManifestFallback:true,directionRigs:[1,4,8]})});
}
module.exports={createAvatarSyncStore};
