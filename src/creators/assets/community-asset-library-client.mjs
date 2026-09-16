/* KELO-INDEX
 * area: CREATORS / COMMUNITY LIBRARY
 * owner: Kelo Community Asset Library
 * keys: SUPABASE CATALOG EQUIP UNEQUIP CHARACTER RLS MOBILE
 * purpose: read active community publications and equip/unequip them on the active character using authenticated RPCs
 * security: publishable key only; user JWT is required for character mutations; no service key in browser
 */
import { KELO_SUPABASE_PUBLIC_CONFIG } from '../../online/kelo-supabase-public-config.mjs';
import { createKeloSupabaseBrowserSession } from '../../online/kelo-supabase-browser-session.mjs';

const ACTIVE_CHARACTER_STORAGE='kelo.active.character.v1';
const VALID_SLOTS=Object.freeze(['body','outfit','head','hair','face','weapon','offhand','back','aura','pet','mount','effect']);
const SLOT_SET=new Set(VALID_SLOTS);
const DEFAULT_LIMIT=48;
let sessionAdapter=null;

function session(){
  if(!sessionAdapter)sessionAdapter=createKeloSupabaseBrowserSession({root:globalThis});
  return sessionAdapter;
}
function cleanSlot(value){const slot=String(value||'').toLowerCase();return SLOT_SET.has(slot)?slot:null;}
function number(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function list(value){return Array.isArray(value)?value:[];}
function tagsOf(asset){return list(asset?.tags).map(value=>String(value||'').toLowerCase());}
function textHints(asset){return [asset?.name,asset?.kind,...tagsOf(asset)].filter(Boolean).join(' ').toLowerCase();}
function explicitSlots(asset){
  const metadata=asset?.metadata&&typeof asset.metadata==='object'?asset.metadata:{};
  const profile=metadata.renderProfile&&typeof metadata.renderProfile==='object'?metadata.renderProfile:{};
  const candidates=[metadata.slot,metadata.defaultSlot,profile.slot,...list(metadata.equipSlots),...list(profile.equipSlots)].map(cleanSlot).filter(Boolean);
  return [...new Set(candidates)];
}
export function suggestedSlots(asset={}){
  const explicit=explicitSlots(asset);if(explicit.length)return explicit;
  const kind=String(asset.kind||'item').toLowerCase(),hints=textHints(asset);
  if(kind==='mount'||/\bmount\b|caballo|horse|dragon mount/.test(hints))return['mount'];
  if(/\bpet\b|mascota|companion/.test(hints))return['pet'];
  if(kind==='vfx'||/\baura\b|glow|halo|energy|efecto|effect/.test(hints))return['aura','effect'];
  if(/helmet|hat|cap|crown|casco|sombrero|corona/.test(hints))return['head'];
  if(/hair|pelo|cabello/.test(hints))return['hair'];
  if(/mask|face|cara|mascara/.test(hints))return['face'];
  if(/shield|escudo|offhand/.test(hints))return['offhand'];
  if(/weapon|sword|axe|bow|gun|arma|espada|hacha|arco/.test(hints))return['weapon'];
  if(/cape|wing|back|mochila|capa|alas/.test(hints))return['back'];
  if(kind==='character')return['body'];
  return['outfit','head','weapon','back','aura'];
}

function defaultProfileFor(slot,asset={}){
  const dimensions=asset.dimensions||{},ratio=number(dimensions.width,1,2048,64)/Math.max(1,number(dimensions.height,1,2048,64));
  const base={mode:'socket',layer:'front',socket:'center',anchor:{x:.5,y:.5},scale:1,rotation:0,columns:1,rows:1,frameMs:140,faceRows:{down:0,left:0,right:0,up:0},offsets:{}};
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

export function renderProfileFor(asset={},slotInput=null){
  const slot=cleanSlot(slotInput)||suggestedSlots(asset)[0]||'outfit';
  const metadata=asset.metadata&&typeof asset.metadata==='object'?asset.metadata:{};
  const raw=metadata.renderProfile&&typeof metadata.renderProfile==='object'?metadata.renderProfile:{};
  const fallback=defaultProfileFor(slot,asset),mode=raw.mode==='sheet'?'sheet':'socket',layer=raw.layer==='back'?'back':'front';
  const anchor=raw.anchor&&typeof raw.anchor==='object'?raw.anchor:fallback.anchor;
  return Object.freeze({...fallback,...raw,mode,layer,slot,socket:String(raw.socket||fallback.socket||'center'),anchor:Object.freeze({x:number(anchor?.x,0,1,.5),y:number(anchor?.y,0,1,.5)}),scale:number(raw.scale,.1,4,1),rotation:number(raw.rotation,-360,360,0),columns:Math.round(number(raw.columns,1,32,1)),rows:Math.round(number(raw.rows,1,32,1)),frameMs:Math.round(number(raw.frameMs,50,2000,140))});
}

function normalizePublication(row){
  const revision=row?.asset_revisions||row?.revision||{},family=revision?.asset_families||revision?.family||{};
  if(!row?.id||!revision?.asset_id||!row?.public_storage_path)return null;
  const asset={publicationId:String(row.id),revisionId:String(revision.id||''),assetId:String(revision.asset_id),id:String(revision.asset_id),version:Number(revision.revision)||1,name:String(family.name||revision.asset_id),kind:String(family.kind||'item'),tags:list(family.tags),metadata:{...(family.metadata||{}),...(revision.metadata||{})},visibility:String(row.visibility||'global'),publishedAt:row.published_at||null,publicStoragePath:String(row.public_storage_path),mime:String(revision.mime_type||'image/png'),bytes:Number(revision.byte_size)||0,dimensions:{width:Number(revision.pixel_width)||0,height:Number(revision.pixel_height)||0},sha256:String(revision.content_hash||'').toLowerCase()};
  asset.url=`${KELO_SUPABASE_PUBLIC_CONFIG.url}/storage/v1/object/public/creator-global/${asset.publicStoragePath.split('/').map(encodeURIComponent).join('/')}`;
  asset.previewUrl=asset.url;asset.provider='Kelo Community';asset.license='KELO-COMMUNITY';asset.equipSlots=suggestedSlots(asset);asset.defaultSlot=asset.equipSlots[0]||'outfit';asset.renderProfile=renderProfileFor(asset,asset.defaultSlot);return Object.freeze(asset);
}

async function rest(path,{method='GET',body=null,authenticated=false}={}){
  const headers={apikey:KELO_SUPABASE_PUBLIC_CONFIG.publishableKey,'Content-Type':'application/json'};
  if(authenticated){const s=await session().ensureFresh();if(!s?.access_token)throw new Error('COMMUNITY_AUTH_REQUIRED');headers.Authorization=`Bearer ${s.access_token}`;}
  const response=await fetch(`${KELO_SUPABASE_PUBLIC_CONFIG.url}/rest/v1/${path}`,{method,headers,body:body==null?undefined:JSON.stringify(body),cache:'no-store',credentials:'omit'}),text=await response.text();
  let data=null;try{data=text?JSON.parse(text):null;}catch{data=text;}
  if(!response.ok){const code=data?.code||data?.message||`HTTP_${response.status}`;throw Object.assign(new Error(String(code)),{status:response.status,data});}
  return data;
}

export function activeCharacterId(){try{return globalThis.localStorage?.getItem(ACTIVE_CHARACTER_STORAGE)||null;}catch{return null;}}
export async function listCommunityAssets({limit=DEFAULT_LIMIT,offset=0,kind=null}={}){
  const safeLimit=Math.round(number(limit,1,100,DEFAULT_LIMIT)),safeOffset=Math.max(0,Math.floor(Number(offset)||0));
  const select='id,visibility,published_at,public_storage_path,asset_revisions!inner(id,asset_id,revision,content_hash,mime_type,byte_size,pixel_width,pixel_height,metadata,asset_families!inner(id,name,kind,tags,metadata))';
  const params=new URLSearchParams({is_active:'eq.true',visibility:'in.(global,official)',select,order:'published_at.desc',limit:String(safeLimit),offset:String(safeOffset)});
  if(kind&&kind!=='all')params.set('asset_revisions.asset_families.kind',`eq.${String(kind)}`);
  const rows=await rest(`asset_publications?${params.toString()}`);
  return list(rows).map(normalizePublication).filter(Boolean);
}
export async function listEquippedCommunityAssets(characterId=activeCharacterId()){
  if(!characterId)return[];
  const params=new URLSearchParams({character_id:`eq.${String(characterId)}`,select:'slot,publication_id,equipped_at',order:'equipped_at.desc'});
  const rows=await rest(`character_community_equipment?${params.toString()}`,{authenticated:true});
  return list(rows).map(row=>Object.freeze({slot:String(row.slot),publicationId:String(row.publication_id),equippedAt:row.equipped_at||null}));
}
export async function equipCommunityAsset({publicationId,slot,characterId=activeCharacterId()}={}){
  const safeSlot=cleanSlot(slot);if(!characterId)throw new Error('ACTIVE_CHARACTER_REQUIRED');if(!publicationId)throw new Error('PUBLICATION_REQUIRED');if(!safeSlot)throw new Error('COMMUNITY_ASSET_SLOT_INVALID');
  return rest('rpc/equip_character_community_asset',{method:'POST',authenticated:true,body:{p_character_id:String(characterId),p_slot:safeSlot,p_publication_id:String(publicationId)}});
}
export async function unequipCommunityAsset({slot,characterId=activeCharacterId()}={}){
  const safeSlot=cleanSlot(slot);if(!characterId)throw new Error('ACTIVE_CHARACTER_REQUIRED');if(!safeSlot)throw new Error('COMMUNITY_ASSET_SLOT_INVALID');
  return rest('rpc/unequip_character_community_asset',{method:'POST',authenticated:true,body:{p_character_id:String(characterId),p_slot:safeSlot}});
}
export async function refreshGameAvatar(characterId=activeCharacterId()){
  if(!characterId)return false;
  const s=await session().ensureFresh();if(!s?.access_token)return false;
  try{
    const game=globalThis.opener;if(game&&game.location?.origin===globalThis.location?.origin&&game.KeloNetAuthority?.refreshAvatar){await game.KeloNetAuthority.refreshAvatar({accessToken:s.access_token,characterId:String(characterId)});return true;}
  }catch{}
  try{globalThis.opener?.postMessage?.({type:'kelo:community-equipment-changed',characterId:String(characterId)},globalThis.location.origin);}catch{}
  return false;
}

export const COMMUNITY_EQUIPMENT_SLOTS=VALID_SLOTS;
