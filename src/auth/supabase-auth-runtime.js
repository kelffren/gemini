/* KELO-INDEX
 * area: AUTH / ONLINE IDENTITY
 * owner: KeloOnlineAuth
 * keys: SUPABASE SESSION JWT CHARACTER ACCOUNT LOGIN REGISTER GUEST MAGIC LINK PASSWORD WEBSOCKET HELLO
 * purpose: resolver identidad durable de cuenta/personaje y ofrecer auth explícita sin crear transporte paralelo
 * online: accessToken solo viaja al server en hello; nunca se envía refresh token ni credenciales backend
 * do-not: NO service_role/sb_secret, NO segundo WebSocket, NO confiar metadata para autorización, NO crear invitados sin acción explícita
 */
(function(){
'use strict';
const VERSION='kelo-online-auth-v3';
const SUPABASE_URL='https://iapxdbitjdwvtbpjghct.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_t0RI7co82Rh1wOAWUIo4Zg_rZK5EQ9S';
const CHARACTER_STORAGE_KEY='kelo_character_id_v1',LEGACY_PLAYER_KEY='kelo_player_key_v1',PLAYER_NAME_KEY='kelo_player_name_v1';
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let client=null,current=null,state='booting',lastError=null,bootPromise=null;
function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail}))}catch(_){}}
function stored(key){try{return localStorage.getItem(key)}catch(_){return null}}
function store(key,value){try{if(value)localStorage.setItem(key,value);else localStorage.removeItem(key)}catch(_){}}
function cleanEmail(value){return String(value||'').trim().toLowerCase()}
function cleanPassword(value){return String(value||'')}
function cleanDisplayName(value){const raw=String(value||'').trim().replace(/[^\p{L}\p{N} _.-]/gu,'').slice(0,24);return raw.length>=3?raw:null}
function publicState(){return Object.freeze({version:VERSION,state,authenticated:!!current,accountId:current?.accountId||null,characterId:current?.characterId||null,characterName:current?.characterName||null,email:current?.email||null,isAnonymous:!!current?.isAnonymous,confirmationRequired:state==='confirmation-required',error:lastError?String(lastError.message||lastError):null});}
function preferredCharacterName(){return cleanDisplayName(stored(PLAYER_NAME_KEY))||'Kelo'}
function setState(next,error){state=next;lastError=error||null;const snapshot=publicState();emit('kelo:online-auth-state',snapshot);return snapshot}
function initClient(){
  if(client)return client;
  if(!window.supabase||typeof window.supabase.createClient!=='function')throw new Error('SUPABASE_JS_UNAVAILABLE');
  client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  client.auth.onAuthStateChange((event,session)=>{try{emit('kelo:online-auth-event',{event,hasSession:!!session,isAnonymous:!!session?.user?.is_anonymous})}catch(_){}});
  return client;
}
async function ensureCharacter(session){
  const token=session?.access_token,user=session?.user;if(!token||!user?.id)throw new Error('AUTH_SESSION_REQUIRED');
  const verified=await initClient().auth.getUser(token);if(verified.error||!verified.data?.user?.id)throw verified.error||new Error('AUTH_USER_INVALID');
  const accountId=String(verified.data.user.id).toLowerCase();
  const query=await client.from('characters').select('id,name,legacy_player_key,status').eq('status','active').limit(3);if(query.error)throw query.error;
  const rows=Array.isArray(query.data)?query.data:[],storedId=String(stored(CHARACTER_STORAGE_KEY)||'').toLowerCase();let character=rows.find(row=>String(row.id).toLowerCase()===storedId)||rows[0]||null;
  if(!character){const created=await client.rpc('create_character',{p_name:preferredCharacterName()});if(created.error)throw created.error;character=Array.isArray(created.data)?created.data[0]:created.data;}
  if(!character?.id||!UUID_RE.test(String(character.id)))throw new Error('CHARACTER_RESOLUTION_FAILED');
  const characterId=String(character.id).toLowerCase();store(CHARACTER_STORAGE_KEY,characterId);
  const legacy=String(stored(LEGACY_PLAYER_KEY)||'').toLowerCase();if(UUID_RE.test(legacy)&&!character.legacy_player_key){const claimed=await client.rpc('claim_legacy_player_key',{p_character_id:characterId,p_player_key:legacy});if(!claimed.error){const row=Array.isArray(claimed.data)?claimed.data[0]:claimed.data;if(row)character=row;}}
  return{accessToken:token,accountId,characterId,characterName:String(character.name||preferredCharacterName()).slice(0,24),email:verified.data.user.email||null,isAnonymous:Boolean(verified.data.user.is_anonymous)};
}
async function resolveSession(){
  initClient();const result=await client.auth.getSession();if(result.error)throw result.error;const session=result.data?.session||null;
  if(!session){current=null;setState('signed-out');emit('kelo:online-auth-required',publicState());return null;}
  current=await ensureCharacter(session);setState('ready');emit('kelo:online-auth-ready',publicState());return current;
}
function ensureBoot(){if(!bootPromise)bootPromise=resolveSession().catch(error=>{current=null;setState('transition',error);emit('kelo:online-auth-error',publicState());return null;});return bootPromise;}
async function credentials(){
  initClient();const result=await client.auth.getSession();if(result.error||!result.data?.session)return current;
  try{current=await ensureCharacter(result.data.session);setState('ready');return current}catch(error){setState('transition',error);return current;}
}
async function ready(timeoutMs){const ms=Math.max(500,Math.min(10000,Number(timeoutMs)||5000));return Promise.race([ensureBoot(),new Promise(resolve=>setTimeout(()=>resolve(current),ms))]);}
async function signInWithPassword(email,password){
  initClient();const normalized=cleanEmail(email),secret=cleanPassword(password);if(!normalized||secret.length<6)throw new Error('EMAIL_AND_PASSWORD_REQUIRED');
  const result=await client.auth.signInWithPassword({email:normalized,password:secret});if(result.error)throw result.error;
  current=await ensureCharacter(result.data.session);setState('ready');emit('kelo:account-signed-in',publicState());return publicState();
}
async function signUp(email,password,displayName){
  initClient();const normalized=cleanEmail(email),secret=cleanPassword(password),name=cleanDisplayName(displayName)||preferredCharacterName();if(!normalized||secret.length<6)throw new Error('EMAIL_AND_PASSWORD_REQUIRED');
  const existing=await client.auth.getSession();if(existing.data?.session?.user?.is_anonymous)throw new Error('GUEST_ACCOUNT_MUST_BE_PROTECTED_OR_SEPARATED');
  store(PLAYER_NAME_KEY,name);
  const result=await client.auth.signUp({email:normalized,password:secret,options:{data:{display_name:name},emailRedirectTo:location.origin+location.pathname}});if(result.error)throw result.error;
  if(result.data?.session){current=await ensureCharacter(result.data.session);setState('ready');emit('kelo:account-created',publicState());return publicState();}
  current=null;setState('confirmation-required');emit('kelo:account-confirmation-required',{email:normalized});return publicState();
}
async function signInWithOtp(email){
  initClient();const normalized=cleanEmail(email);if(!normalized)throw new Error('EMAIL_REQUIRED');
  const result=await client.auth.signInWithOtp({email:normalized,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:false}});if(result.error)throw result.error;return{ok:true,email:normalized};
}
async function resetPassword(email){
  initClient();const normalized=cleanEmail(email);if(!normalized)throw new Error('EMAIL_REQUIRED');
  const result=await client.auth.resetPasswordForEmail(normalized,{redirectTo:location.origin+location.pathname});if(result.error)throw result.error;return{ok:true,email:normalized};
}
async function signInAsGuest(){
  initClient();const existing=await client.auth.getSession();if(existing.data?.session){current=await ensureCharacter(existing.data.session);setState('ready');return publicState();}
  const guest=await client.auth.signInAnonymously();if(guest.error)throw guest.error;if(!guest.data?.session)throw new Error('GUEST_SESSION_MISSING');
  current=await ensureCharacter(guest.data.session);setState('ready');emit('kelo:guest-created',publicState());return publicState();
}
async function protectGuestWithEmail(email,displayName){
  initClient();const normalized=cleanEmail(email),name=cleanDisplayName(displayName)||preferredCharacterName();if(!normalized)throw new Error('EMAIL_REQUIRED');
  const existing=await client.auth.getSession(),session=existing.data?.session;if(!session?.user?.is_anonymous)throw new Error('ANONYMOUS_SESSION_REQUIRED');
  store(PLAYER_NAME_KEY,name);
  const result=await client.auth.updateUser({email:normalized,data:{display_name:name}},{emailRedirectTo:location.origin+location.pathname});if(result.error)throw result.error;
  setState('confirmation-required');emit('kelo:guest-protection-pending',{email:normalized,characterId:current?.characterId||null});return{ok:true,email:normalized,confirmationRequired:true};
}
async function setPassword(password){
  initClient();const secret=cleanPassword(password);if(secret.length<6)throw new Error('PASSWORD_TOO_SHORT');const result=await client.auth.updateUser({password:secret});if(result.error)throw result.error;await credentials();return publicState();
}
async function signOut(){if(client)await client.auth.signOut();current=null;store(CHARACTER_STORAGE_KEY,null);setState('signed-out');emit('kelo:account-signed-out',publicState());return publicState();}
const api=Object.freeze({version:VERSION,ready,credentials,state:publicState,signInWithPassword,signUp,signInWithOtp,resetPassword,signInAsGuest,protectGuestWithEmail,setPassword,signOut,getClient:()=>client});window.KeloOnlineAuth=api;ensureBoot();

// Compatibility bridge for the existing KeloNetAuthority. It modifies only the existing hello payload; it never creates a socket.
(function installHelloInjector(){
  const Native=window.WebSocket;if(!Native||!Native.prototype||typeof Native.prototype.send!=='function'||Native.prototype.send.__keloAuthWrapped)return;
  const nativeSend=Native.prototype.send;
  function send(data){
    let msg=null;try{if(typeof data==='string')msg=JSON.parse(data)}catch(_){}
    if(!msg||msg.t!=='hello'||msg.accessToken||msg.characterId)return nativeSend.call(this,data);
    const socket=this,sendHello=auth=>{if(socket.readyState!==Native.OPEN)return;const out={...msg};if(auth?.accessToken&&auth?.characterId){out.accessToken=auth.accessToken;out.characterId=auth.characterId;if(auth.characterName)out.name=auth.characterName;}nativeSend.call(socket,JSON.stringify(out));};
    if(current){sendHello(current);return;}ready(4500).then(sendHello).catch(()=>sendHello(null));
  }
  Object.defineProperty(send,'__keloAuthWrapped',{value:true});Native.prototype.send=send;
})();
})();
