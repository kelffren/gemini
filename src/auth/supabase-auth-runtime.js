/* KELO-INDEX
 * area: AUTH / ONLINE IDENTITY
 * owner: KeloOnlineAuth
 * keys: SUPABASE SESSION JWT CHARACTER ANONYMOUS ACCOUNT LINK
 * purpose: resolver una sesión Supabase real y un characterId propio antes de autenticar el transporte online
 * online: solo expone accessToken + characterId al owner KeloNetAuthority; nunca decide gameplay ni guarda secrets de backend
 * do-not: NO service_role/sb_secret, NO refresh token hacia WebSocket, NO confiar en metadata para autorización
 */
(function(){
'use strict';
const VERSION='kelo-online-auth-v1';
const SUPABASE_URL='https://iapxdbitjdwvtbpjghct.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_t0RI7co82Rh1wOAWUIo4Zg_rZK5EQ9S';
const CHARACTER_STORAGE_KEY='kelo_character_id_v1';
const LEGACY_PLAYER_KEY='kelo_player_key_v1';
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let client=null,current=null,state='booting',lastError=null;

function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail}))}catch(_){}}
function stored(key){try{return localStorage.getItem(key)}catch(_){return null}}
function store(key,value){try{if(value)localStorage.setItem(key,value);else localStorage.removeItem(key)}catch(_){}}
function publicState(){return Object.freeze({version:VERSION,state,authenticated:!!current,accountId:current?.accountId||null,characterId:current?.characterId||null,characterName:current?.characterName||null,isAnonymous:!!current?.isAnonymous,error:lastError?String(lastError.message||lastError):null});}
function preferredCharacterName(){const raw=stored('kelo_player_name_v1')||'Kelo';const clean=String(raw).trim().replace(/[^\p{L}\p{N} _.-]/gu,'').slice(0,24);return clean.length>=3?clean:'Kelo';}

async function ensureCharacter(session){
  const token=session?.access_token,user=session?.user;
  if(!token||!user?.id)throw new Error('AUTH_SESSION_REQUIRED');
  const verified=await client.auth.getUser(token);
  if(verified.error||!verified.data?.user?.id)throw verified.error||new Error('AUTH_USER_INVALID');
  const accountId=String(verified.data.user.id).toLowerCase();
  let query=await client.from('characters').select('id,name,legacy_player_key,status').eq('status','active').limit(3);
  if(query.error)throw query.error;
  let rows=Array.isArray(query.data)?query.data:[];
  const storedId=String(stored(CHARACTER_STORAGE_KEY)||'').toLowerCase();
  let character=rows.find(row=>String(row.id).toLowerCase()===storedId)||rows[0]||null;
  if(!character){
    const created=await client.rpc('create_character',{p_name:preferredCharacterName()});
    if(created.error)throw created.error;
    character=Array.isArray(created.data)?created.data[0]:created.data;
  }
  if(!character?.id||!UUID_RE.test(String(character.id)))throw new Error('CHARACTER_RESOLUTION_FAILED');
  const characterId=String(character.id).toLowerCase();
  store(CHARACTER_STORAGE_KEY,characterId);
  const legacy=String(stored(LEGACY_PLAYER_KEY)||'').toLowerCase();
  if(UUID_RE.test(legacy)&&!character.legacy_player_key){
    const claimed=await client.rpc('claim_legacy_player_key',{p_character_id:characterId,p_player_key:legacy});
    if(!claimed.error){
      const row=Array.isArray(claimed.data)?claimed.data[0]:claimed.data;
      if(row)character=row;
    }
  }
  return {accessToken:token,accountId,characterId,characterName:String(character.name||preferredCharacterName()).slice(0,24),isAnonymous:Boolean(verified.data.user.is_anonymous)};
}

async function resolveSession(){
  if(!window.supabase||typeof window.supabase.createClient!=='function')throw new Error('SUPABASE_JS_UNAVAILABLE');
  if(!client){
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  }
  let result=await client.auth.getSession();
  if(result.error)throw result.error;
  let session=result.data?.session||null;
  if(!session){
    const guest=await client.auth.signInAnonymously();
    if(guest.error)throw guest.error;
    session=guest.data?.session||null;
  }
  if(!session)throw new Error('AUTH_SESSION_MISSING');
  current=await ensureCharacter(session);
  state='ready';lastError=null;emit('kelo:online-auth-ready',publicState());
  return current;
}

const bootPromise=resolveSession().catch(error=>{lastError=error;state='transition';current=null;emit('kelo:online-auth-error',publicState());return null});

async function credentials(){
  if(!client)await bootPromise;
  if(!client)return null;
  const result=await client.auth.getSession();
  if(result.error||!result.data?.session)return current;
  try{current=await ensureCharacter(result.data.session);state='ready';lastError=null;return current}catch(error){lastError=error;state='transition';return current;}
}

async function ready(timeoutMs){
  const ms=Math.max(500,Math.min(10000,Number(timeoutMs)||5000));
  return Promise.race([bootPromise,new Promise(resolve=>setTimeout(()=>resolve(current),ms))]);
}

async function signInWithPassword(email,password){
  if(!client)await bootPromise;
  const result=await client.auth.signInWithPassword({email:String(email||'').trim(),password:String(password||'')});
  if(result.error)throw result.error;
  current=await ensureCharacter(result.data.session);state='ready';return publicState();
}
async function signUp(email,password){
  if(!client)await bootPromise;
  const result=await client.auth.signUp({email:String(email||'').trim(),password:String(password||'')});
  if(result.error)throw result.error;
  if(result.data?.session){current=await ensureCharacter(result.data.session);state='ready';}
  return publicState();
}
async function signInWithOtp(email){
  if(!client)await bootPromise;
  const result=await client.auth.signInWithOtp({email:String(email||'').trim(),options:{emailRedirectTo:location.origin+location.pathname}});
  if(result.error)throw result.error;
  return {ok:true};
}
async function signOut(){if(client)await client.auth.signOut();current=null;state='signed-out';store(CHARACTER_STORAGE_KEY,null);return publicState();}

window.KeloOnlineAuth=Object.freeze({version:VERSION,ready,credentials,state:publicState,signInWithPassword,signUp,signInWithOtp,signOut,getClient:()=>client});
})();
