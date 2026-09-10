/* KELO-INDEX
 * area: SERVER / IDENTITY
 * owner: Kelo server authority
 * keys: SUPABASE AUTH JWT CHARACTER ACCOUNT PUBLISHABLE KEY
 * purpose: verifica sesión Supabase y resuelve account -> character sin necesitar una secret key de Supabase en Render
 * online: Auth valida el JWT; la consulta de characters usa el mismo JWT + RLS; server/index.js conserva autoridad gameplay
 * do-not: NO confiar userId/characterId declarados por cliente, NO exponer secret/service-role key, NO usar user_metadata para autorización
 */
'use strict';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function cleanBase(value){return String(value||'').trim().replace(/\/+$/,'');}
function short(value,max){return value==null?'':String(value).trim().slice(0,max||256);}
function keyModel(value){const key=String(value||'');if(key.startsWith('sb_publishable_'))return'publishable';if(key.startsWith('sb_secret_'))return'secret';if(key.split('.').length===3)return'legacy-jwt-key';return key?'unknown':'none';}

function createOnlineIdentityStore(options={}){
  const supabaseUrl=cleanBase(options.supabaseUrl||process.env.SUPABASE_URL);
  const apiKey=String(options.supabasePublishableKey||process.env.SUPABASE_PUBLISHABLE_KEY||options.supabaseServerKey||options.supabaseServiceKey||'').trim();
  const requireAuth=options.requireAuth===true;
  const configured=Boolean(supabaseUrl&&apiKey);
  const tokenCache=new Map();
  const CACHE_TTL_MS=60_000,MAX_CACHE=256;

  async function request(url,options={}){
    const res=await fetch(url,options);const text=await res.text();
    if(!res.ok){const error=new Error(`SUPABASE_${res.status}:${text.slice(0,240)}`);error.status=res.status;throw error;}
    return text?JSON.parse(text):null;
  }
  function userHeaders(token){return{apikey:apiKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'};}
  function cacheGet(token){const hit=tokenCache.get(token);if(!hit)return null;if(Date.now()-hit.at>CACHE_TTL_MS){tokenCache.delete(token);return null;}return hit.user;}
  function cacheSet(token,user){tokenCache.set(token,{at:Date.now(),user});while(tokenCache.size>MAX_CACHE)tokenCache.delete(tokenCache.keys().next().value);}

  async function verifyAccessToken(rawToken){
    if(!configured)throw new Error('SUPABASE_NOT_CONFIGURED');
    const token=short(rawToken,8192);if(!token)throw new Error('AUTH_TOKEN_REQUIRED');
    const cached=cacheGet(token);if(cached)return cached;
    const user=await request(`${supabaseUrl}/auth/v1/user`,{method:'GET',headers:userHeaders(token)});
    if(!user||!UUID_RE.test(String(user.id||'')))throw new Error('INVALID_AUTH_USER');
    const normalized={id:String(user.id).toLowerCase(),email:user.email||null,isAnonymous:Boolean(user.is_anonymous)};cacheSet(token,normalized);return normalized;
  }

  async function getCharacter(accountId,characterId,rawToken){
    if(!configured)throw new Error('SUPABASE_NOT_CONFIGURED');
    if(!UUID_RE.test(String(accountId||''))||!UUID_RE.test(String(characterId||'')))throw new Error('INVALID_CHARACTER_ID');
    const token=short(rawToken,8192);if(!token)throw new Error('AUTH_TOKEN_REQUIRED');
    const query=new URLSearchParams({id:`eq.${String(characterId).toLowerCase()}`,account_id:`eq.${String(accountId).toLowerCase()}`,status:'eq.active',select:'id,account_id,name,legacy_player_key,status',limit:'1'});
    const rows=await request(`${supabaseUrl}/rest/v1/characters?${query.toString()}`,{method:'GET',headers:userHeaders(token)});
    return Array.isArray(rows)&&rows[0]?rows[0]:null;
  }

  async function resolve(input={}){
    const accessToken=short(input.accessToken,8192),characterId=short(input.characterId,80);
    if(!configured){if(requireAuth)throw new Error('SUPABASE_NOT_CONFIGURED');return{authenticated:false,source:'legacy-local'};}
    if(!accessToken){if(requireAuth)throw new Error('AUTH_TOKEN_REQUIRED');return{authenticated:false,source:'legacy-transition'};}
    const user=await verifyAccessToken(accessToken);if(!characterId)throw new Error('CHARACTER_REQUIRED');
    const character=await getCharacter(user.id,characterId,accessToken);if(!character)throw new Error('CHARACTER_NOT_OWNED');
    return{authenticated:true,source:'supabase-auth-rls',accountId:user.id,characterId:String(character.id).toLowerCase(),playerKey:String(character.id).toLowerCase(),name:short(character.name,24)||short(input.name,24)||'Kelo',legacyPlayerKey:character.legacy_player_key||null,isAnonymous:user.isAnonymous};
  }

  return Object.freeze({version:'kelo-online-identity-v2',configured,requireAuth,source:configured?'supabase-auth-ready':'legacy-local',verifyAccessToken,getCharacter,resolve,audit:()=>({version:'kelo-online-identity-v2',configured,requireAuth,cacheSize:tokenCache.size,apiKeyModel:keyModel(apiKey)})});
}
module.exports={createOnlineIdentityStore};
