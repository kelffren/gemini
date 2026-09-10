/* KELO-INDEX
 * area: SERVER / IDENTITY
 * owner: Kelo server authority
 * keys: SUPABASE AUTH JWT CHARACTER ACCOUNT LEGACY BRIDGE SECRET KEY
 * purpose: verifica sesión Supabase y resuelve account -> character antes de entrar a sistemas autoritativos
 * online: Supabase autentica cuenta; server/index.js conserva la autoridad de gameplay y usa character.id como playerKey canónico
 * do-not: NO confiar userId/characterId declarados por cliente, NO exponer secret/service-role key, NO crear segundo transporte
 */
'use strict';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanBase(value){return String(value||'').trim().replace(/\/+$/,'');}
function isSecretKey(value){return String(value||'').startsWith('sb_secret_');}
function short(value,max){return value==null?'':String(value).trim().slice(0,max||256);}

function createOnlineIdentityStore(options={}){
  const supabaseUrl=cleanBase(options.supabaseUrl);
  const serverKey=String(options.supabaseServerKey||options.supabaseServiceKey||'').trim();
  const requireAuth=options.requireAuth===true;
  const configured=Boolean(supabaseUrl&&serverKey);
  const tokenCache=new Map();
  const CACHE_TTL_MS=60_000,MAX_CACHE=256;

  function adminHeaders(extra={}){
    const headers={apikey:serverKey,'Content-Type':'application/json',...extra};
    if(serverKey&&!isSecretKey(serverKey))headers.Authorization=`Bearer ${serverKey}`;
    return headers;
  }

  async function request(url,options={}){
    const res=await fetch(url,options);
    const text=await res.text();
    if(!res.ok){
      const error=new Error(`SUPABASE_${res.status}:${text.slice(0,240)}`);
      error.status=res.status;
      throw error;
    }
    return text?JSON.parse(text):null;
  }

  function cacheGet(token){
    const hit=tokenCache.get(token);
    if(!hit)return null;
    if(Date.now()-hit.at>CACHE_TTL_MS){tokenCache.delete(token);return null;}
    return hit.user;
  }

  function cacheSet(token,user){
    tokenCache.set(token,{at:Date.now(),user});
    while(tokenCache.size>MAX_CACHE)tokenCache.delete(tokenCache.keys().next().value);
  }

  async function verifyAccessToken(rawToken){
    if(!configured)throw new Error('SUPABASE_NOT_CONFIGURED');
    const token=short(rawToken,8192);
    if(!token)throw new Error('AUTH_TOKEN_REQUIRED');
    const cached=cacheGet(token);if(cached)return cached;
    const user=await request(`${supabaseUrl}/auth/v1/user`,{
      method:'GET',
      headers:{apikey:serverKey,Authorization:`Bearer ${token}`}
    });
    if(!user||!UUID_RE.test(String(user.id||'')))throw new Error('INVALID_AUTH_USER');
    const normalized={id:String(user.id).toLowerCase(),email:user.email||null,isAnonymous:Boolean(user.is_anonymous)};
    cacheSet(token,normalized);
    return normalized;
  }

  async function getCharacter(accountId,characterId){
    if(!configured)throw new Error('SUPABASE_NOT_CONFIGURED');
    if(!UUID_RE.test(String(accountId||''))||!UUID_RE.test(String(characterId||'')))throw new Error('INVALID_CHARACTER_ID');
    const query=new URLSearchParams({
      id:`eq.${String(characterId).toLowerCase()}`,
      account_id:`eq.${String(accountId).toLowerCase()}`,
      status:'eq.active',
      select:'id,account_id,name,legacy_player_key,status',
      limit:'1'
    });
    const rows=await request(`${supabaseUrl}/rest/v1/characters?${query.toString()}`,{method:'GET',headers:adminHeaders()});
    return Array.isArray(rows)&&rows[0]?rows[0]:null;
  }

  async function resolve(input={}){
    const accessToken=short(input.accessToken,8192);
    const characterId=short(input.characterId,80);
    if(!configured){
      if(requireAuth)throw new Error('SUPABASE_NOT_CONFIGURED');
      return{authenticated:false,source:'legacy-local'};
    }
    if(!accessToken){
      if(requireAuth)throw new Error('AUTH_TOKEN_REQUIRED');
      return{authenticated:false,source:'legacy-transition'};
    }
    const user=await verifyAccessToken(accessToken);
    if(!characterId)throw new Error('CHARACTER_REQUIRED');
    const character=await getCharacter(user.id,characterId);
    if(!character)throw new Error('CHARACTER_NOT_OWNED');
    return{
      authenticated:true,
      source:'supabase-auth',
      accountId:user.id,
      characterId:String(character.id).toLowerCase(),
      playerKey:String(character.id).toLowerCase(),
      name:short(character.name,24)||short(input.name,24)||'Kelo',
      legacyPlayerKey:character.legacy_player_key||null,
      isAnonymous:user.isAnonymous
    };
  }

  return Object.freeze({
    version:'kelo-online-identity-v1',
    configured,
    requireAuth,
    source:configured?'supabase-auth-ready':'legacy-local',
    verifyAccessToken,
    getCharacter,
    resolve,
    audit:()=>({version:'kelo-online-identity-v1',configured,requireAuth,cacheSize:tokenCache.size,secretKeyModel:isSecretKey(serverKey)?'sb_secret':'legacy-service-role'})
  });
}

module.exports={createOnlineIdentityStore};
