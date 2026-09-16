/* KELO-INDEX
 * area: CREATORS / EXTERNAL PROVIDER RUNTIME
 * owner: Kelo Universal Content Bridge
 * keys: NETWORK BUDGET CACHE LRU TIMEOUT CIRCUIT BREAKER SAVE DATA MOBILE
 * purpose: let many remote catalogs coexist without allowing metadata search to saturate mobile bandwidth, RAM, or provider APIs
 */

const MAX_CONCURRENCY=3;
const DEFAULT_TIMEOUT_MS=6500;
const DEFAULT_MAX_BYTES=1_500_000;
const DEFAULT_TTL_MS=5*60*1000;
const MAX_CACHE_ENTRIES=48;
const BREAKER_FAILURES=3;
const BREAKER_COOLDOWN_MS=30_000;

let active=0;
const waiters=[];
const cache=new Map();
const inFlight=new Map();
const breakers=new Map();

function now(){return Date.now();}
function connection(){try{return globalThis.navigator?.connection||globalThis.navigator?.mozConnection||globalThis.navigator?.webkitConnection||null;}catch{return null;}}
function emit(type,detail){try{globalThis.dispatchEvent?.(new CustomEvent(type,{detail}));}catch{}}
function touchCache(key,row){cache.delete(key);cache.set(key,row);while(cache.size>MAX_CACHE_ENTRIES)cache.delete(cache.keys().next().value);}
function acquire(){if(active<MAX_CONCURRENCY){active++;return Promise.resolve();}return new Promise(resolve=>waiters.push(resolve)).then(()=>{active++;});}
function release(){active=Math.max(0,active-1);waiters.shift()?.();}
function breaker(providerId){const id=String(providerId||'external');let row=breakers.get(id);if(!row){row={failures:0,openUntil:0,lastError:null};breakers.set(id,row);}return row;}
function breakerAssert(providerId){const row=breaker(providerId);if(row.openUntil>now())throw new Error(`PROVIDER_CIRCUIT_OPEN:${providerId}`);if(row.openUntil&&row.openUntil<=now()){row.openUntil=0;row.failures=0;}}
function breakerSuccess(providerId){const row=breaker(providerId);row.failures=0;row.openUntil=0;row.lastError=null;}
function breakerFailure(providerId,error){const row=breaker(providerId);row.failures++;row.lastError=String(error?.message||error);if(row.failures>=BREAKER_FAILURES)row.openUntil=now()+BREAKER_COOLDOWN_MS;emit('kelo:external-provider-error',{providerId:String(providerId),failures:row.failures,openUntil:row.openUntil,error:row.lastError});}

export function mobilePageBudget(requested=24,{heavy=false}={}){
  const conn=connection(),saveData=conn?.saveData===true,type=String(conn?.effectiveType||'').toLowerCase();
  let cap=heavy?16:32;
  if(type==='3g')cap=heavy?8:16;
  if(type==='2g'||type==='slow-2g')cap=heavy?4:8;
  if(saveData)cap=Math.min(cap,heavy?4:8);
  return Math.max(1,Math.min(Math.floor(Number(requested)||1),cap));
}

async function boundedText(response,maxBytes){
  const declared=Number(response.headers?.get?.('content-length')||0);
  if(declared>maxBytes)throw new Error(`PROVIDER_RESPONSE_TOO_LARGE:${declared}`);
  if(!response.body?.getReader){const text=await response.text();if(new TextEncoder().encode(text).byteLength>maxBytes)throw new Error('PROVIDER_RESPONSE_TOO_LARGE');return text;}
  const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,text='';
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value?.byteLength||0;if(bytes>maxBytes){try{await reader.cancel();}catch{}throw new Error(`PROVIDER_RESPONSE_TOO_LARGE:${bytes}`);}text+=decoder.decode(value,{stream:true});}
  text+=decoder.decode();return text;
}

export async function fetchProviderJson(providerId,url,{ttlMs=DEFAULT_TTL_MS,timeoutMs=DEFAULT_TIMEOUT_MS,maxBytes=DEFAULT_MAX_BYTES,cacheKey=null,headers=null}={}){
  const key=String(cacheKey||url),cached=cache.get(key);
  if(cached&&cached.expiresAt>now()){touchCache(key,cached);return cached.value;}
  if(inFlight.has(key))return inFlight.get(key);
  breakerAssert(providerId);
  const task=(async()=>{
    await acquire();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort('timeout'),Math.max(1000,timeoutMs));
    try{
      const response=await fetch(url,{method:'GET',mode:'cors',cache:'no-store',credentials:'omit',signal:controller.signal,headers:{Accept:'application/json',...(headers||{})}});
      if(!response.ok)throw new Error(`PROVIDER_HTTP_${response.status}`);
      const text=await boundedText(response,Math.max(32_768,maxBytes)),value=JSON.parse(text);
      touchCache(key,{value,expiresAt:now()+Math.max(1000,ttlMs)});breakerSuccess(providerId);return value;
    }catch(error){breakerFailure(providerId,error);throw error;}
    finally{clearTimeout(timer);release();}
  })();
  inFlight.set(key,task);try{return await task;}finally{inFlight.delete(key);}
}

export function clearExternalProviderRuntimeCache(prefix=''){
  const p=String(prefix||'');for(const key of [...cache.keys()])if(!p||key.includes(p))cache.delete(key);
}
export function getExternalProviderRuntimeStats(){
  return Object.freeze({active,queued:waiters.length,cacheEntries:cache.size,inFlight:inFlight.size,maxConcurrency:MAX_CONCURRENCY,breakers:[...breakers.entries()].map(([providerId,row])=>({providerId,...row}))});
}

export const EXTERNAL_PROVIDER_RUNTIME=Object.freeze({version:'kelo-external-provider-runtime-v1',fetchProviderJson,mobilePageBudget,clearExternalProviderRuntimeCache,getExternalProviderRuntimeStats});
