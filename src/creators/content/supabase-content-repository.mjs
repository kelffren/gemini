/* KELO-INDEX
 * area: CREATORS / CONTENT ONLINE
 * owner: Supabase Creator content repository adapter
 * keys: CONTENT REVIEW PUBLICATION RELEASE MARKETPLACE DISCOVER LISTING ENTITLEMENT ACCESS DELIVERY USE AUTHORITY KC RPC RLS OWNER FILTER
 * owns: authenticated REST/RPC/Storage transport for Creator content and thin Creator marketplace/access/delivery/use RPC access
 * does-not-own: auth UI, schemas, runtime owners, service-role secrets, review decisions, publish authority or marketplace business policy
 * security: publishable key is public; every write still requires JWT + RLS/security-definer validation; client never supplies trusted price/split during purchase
 */
const trimSlash=v=>String(v||'').replace(/\/+$/,'');
const encPath=p=>String(p||'').split('/').filter(Boolean).map(encodeURIComponent).join('/');
const revisionIds=ids=>Array.from(new Set(Array.from(ids||[]).map(v=>String(v||'').trim()).filter(v=>/^[0-9a-f-]{36}$/i.test(v))));
function decodeJwt(token){try{const part=String(token||'').split('.')[1];if(!part)return{};const normalized=part.replace(/-/g,'+').replace(/_/g,'/');const json=decodeURIComponent(Array.from(atob(normalized),c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join(''));return JSON.parse(json);}catch{return{};}}
async function bodyJson(response){const text=await response.text();let data=null;try{data=text?JSON.parse(text):null;}catch{data=text;}if(!response.ok){const message=data?.message||data?.error_description||data?.error||`HTTP_${response.status}`;const error=new Error(String(message));error.status=response.status;error.data=data;throw error;}return data;}

export function createSupabaseCreatorContentRepository({url,publishableKey,getAccessToken=()=>null,fetchImpl=globalThis.fetch}={}){
  const base=trimSlash(url);if(!base||!publishableKey||typeof fetchImpl!=='function')throw new Error('SUPABASE_CONTENT_CONFIG_REQUIRED');
  const token=()=>String(getAccessToken?.()||'').trim();
  function headers(extra={}){const jwt=token();return Object.assign({'apikey':publishableKey,'Accept':'application/json'},jwt?{'Authorization':`Bearer ${jwt}`}:{},extra);}
  async function rpc(name,payload={}){const r=await fetchImpl(`${base}/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:headers({'Content-Type':'application/json','Prefer':'return=representation'}),body:JSON.stringify(payload)});return bodyJson(r);}
  async function select(path){const r=await fetchImpl(`${base}/rest/v1/${path}`,{headers:headers()});return bodyJson(r);}
  async function upload(bucket,path,file,{upsert=false}={}){const r=await fetchImpl(`${base}/storage/v1/object/${encodeURIComponent(bucket)}/${encPath(path)}`,{method:'POST',headers:headers({'Content-Type':file.type||'application/octet-stream','x-upsert':String(!!upsert)}),body:file});return bodyJson(r);}
  async function remove(bucket,paths){const r=await fetchImpl(`${base}/storage/v1/object/${encodeURIComponent(bucket)}`,{method:'DELETE',headers:headers({'Content-Type':'application/json'}),body:JSON.stringify({prefixes:Array.from(paths||[])})});return bodyJson(r);}
  async function signedUrl(bucket,path,expiresIn=3600){const r=await fetchImpl(`${base}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encPath(path)}`,{method:'POST',headers:headers({'Content-Type':'application/json'}),body:JSON.stringify({expiresIn:Math.max(60,Number(expiresIn)||3600)})});const data=await bodyJson(r),signed=data?.signedURL||data?.signedUrl;return signed?`${base}/storage/v1${signed.startsWith('/')?'':'/'}${signed}`:null;}
  const publicUrl=(bucket,path)=>`${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encPath(path)}`;
  const userId=()=>decodeJwt(token()).sub||null;
  function listMyContent(){const uid=userId();if(!uid)return Promise.resolve([]);return select(`content_definition_revisions?select=id,definition_id,revision,content_id,schema_version,content_hash,payload,created_at&owner_user_id=eq.${encodeURIComponent(uid)}&order=created_at.desc&limit=500`);}
  function listMyDefinitions(){const uid=userId();if(!uid)return Promise.resolve([]);return select(`content_definitions?select=id,content_type,slug,display_name,tags,metadata,created_at,updated_at&owner_user_id=eq.${encodeURIComponent(uid)}&order=updated_at.desc&limit=500`);}
  function listActivePublicationsForRevisions(ids){const clean=revisionIds(ids);if(!clean.length)return Promise.resolve([]);return select(`content_publications?select=id,revision_id,visibility,published_at,is_active&is_active=eq.true&revision_id=in.(${clean.join(',')})&order=published_at.desc&limit=500`);}
  function listMyCharacters(){return userId()?select('characters?select=id,name,status,active_avatar_content_id,created_at&status=eq.active&order=created_at.asc&limit=3'):Promise.resolve([]);}
  async function getCharacterWallet(characterId,currencyKey='kc'){
    const id=String(characterId||'').trim(),key=String(currencyKey||'kc').toLowerCase();if(!id||!userId())return null;
    const rows=await select(`character_wallets?select=character_id,currency_key,amount,revision,updated_at&character_id=eq.${encodeURIComponent(id)}&currency_key=eq.${encodeURIComponent(key)}&limit=1`);
    return Array.isArray(rows)&&rows[0]?rows[0]:{character_id:id,currency_key:key,amount:0,revision:0,updated_at:null};
  }
  return Object.freeze({
    version:'supabase-creator-content-repository-v1.6.0-use-authority',userId,rpc,select,upload,remove,signedUrl,publicUrl,
    createAssetFamily:p=>rpc('create_asset_family',p),registerAssetRevision:p=>rpc('register_asset_revision',p),submitAssetRevision:id=>rpc('submit_asset_revision',{p_revision_id:id}),
    createContentDefinition:p=>rpc('create_content_definition',p),registerContentRevision:p=>rpc('register_content_revision',p),submitContentRevision:id=>rpc('submit_content_revision',{p_revision_id:id}),
    listMyRoles:()=>select('account_roles?select=role_key&order=role_key.asc'),
    listMyContent,listMyDefinitions,
    listMyReviews:()=>select('content_review_requests?select=id,revision_id,status,submitted_at,decided_at,note&order=submitted_at.desc&limit=500'),
    listActivePublicationsForRevisions,
    listMyCharacters,getCharacterWallet,
    createCharacter:name=>rpc('create_character',{p_name:name}),
    setActiveCharacterAvatar:(characterId,contentId)=>rpc('set_active_character_avatar',{p_character_id:characterId,p_content_id:contentId}),
    getAvatarManifest:contentId=>rpc('get_avatar_manifest',{p_content_id:contentId}),
    getCreatorProfile:userIdValue=>rpc('get_creator_profile',{p_user_id:userIdValue||null}),
    upsertCreatorProfile:({displayName=null,handle=null,tagline='',bio=''})=>rpc('upsert_creator_profile',{p_display_name:displayName,p_handle:handle,p_tagline:tagline,p_bio:bio}),
    discoverCreatorMarket:({query='',contentType='',limit=40,offset=0}={})=>rpc('discover_creator_market_v2',{p_query:query||null,p_content_type:contentType||null,p_limit:limit,p_offset:offset}),
    listMyCreatorMarketListings:()=>rpc('list_my_creator_market_listings',{}),
    createCreatorMarketListing:({revisionId,payoutCharacterId,priceKc,licenseKey='standard'})=>rpc('create_creator_market_listing',{p_revision_id:revisionId,p_payout_character_id:payoutCharacterId,p_price_kc:Math.max(0,Math.floor(Number(priceKc)||0)),p_license_key:licenseKey}),
    cancelCreatorMarketListing:listingId=>rpc('cancel_creator_market_listing',{p_listing_id:listingId}),
    purchaseCreatorMarketListing:({listingId,buyerCharacterId,correlationId})=>rpc('purchase_creator_market_listing',{p_listing_id:listingId,p_buyer_character_id:buyerCharacterId,p_correlation_id:correlationId}),
    listMyCreatorEntitlements:()=>rpc('list_my_creator_entitlements',{}),
    listMyCreatorContentAccess:()=>rpc('list_my_creator_content_access',{}),
    checkCreatorContentAccess:revisionId=>rpc('check_creator_content_access',{p_revision_id:revisionId}),
    getCreatorContentDelivery:revisionId=>rpc('get_creator_content_delivery',{p_revision_id:revisionId}),
    setCharacterCreatorContent:({characterId,slotKey,revisionId=null})=>rpc('set_character_creator_content',{p_character_id:characterId,p_slot_key:slotKey,p_revision_id:revisionId}),
    setCharacterCreatorMount:({characterId,revisionId=null})=>rpc('set_character_creator_mount',{p_character_id:characterId,p_revision_id:revisionId}),
    authorizeCreatorPropertyPlacement:({characterId,revisionId,parcelKey,transform={}})=>rpc('authorize_creator_property_placement',{p_character_id:characterId,p_revision_id:revisionId,p_parcel_key:parcelKey,p_transform:transform||{}}),
    getMyCreatorUseState:characterId=>rpc('get_my_creator_use_state',{p_character_id:characterId})
  });
}
