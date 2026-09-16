'use strict';
const crypto=require('crypto');

function clampInt(value,min,max,fallback){const n=Math.floor(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function boolFlag(value){if(value===true)return true;const text=String(value??'').trim().toLowerCase();return text==='1'||text==='true'||text==='yes'||text==='on';}
function digest(value){return crypto.createHash('sha256').update(String(value||'')).digest('hex');}
function normalize(value){
  if(value===null||value===undefined)return value;
  if(Array.isArray(value))return value.map(normalize);
  if(typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalize(value[k])]));
  if(typeof value==='string'&&value.startsWith('data:image/'))return `data-image-sha256:${digest(value)}`;
  return value;
}
function requestKey(userId,input){return digest(`${String(userId||'')}\n${JSON.stringify(normalize(input||{}))}`);}
function estimateGpuSeconds(input={}){
  const pipeline=String(input.pipeline||'atlas-v2').toLowerCase(),mode=String(input.mode||'').toLowerCase();
  if(pipeline==='atlas-v2'&&!mode)return 45;
  if(mode==='master')return input.retryHint?28:22;
  if(mode==='rotations')return input.retryHint?48:40;
  if(mode==='direction'&&Boolean(input.realSkeleton))return input.retryHint?34:26;
  if(mode==='direction')return input.retryHint?28:22;
  if(mode==='repair')return input.retryHint?24:18;
  return 30;
}
function createSpriteAiResourceGovernor(options={}){
  const ttlMs=clampInt(options.ttlMs??process.env.KELO_SPRITE_AI_CACHE_TTL_MS,60_000,86_400_000,21_600_000);
  const maxEntries=clampInt(options.maxEntries??process.env.KELO_SPRITE_AI_CACHE_MAX_ENTRIES,4,128,32);
  const maxBytes=clampInt(options.maxBytes??process.env.KELO_SPRITE_AI_CACHE_MAX_BYTES,4*1024*1024,256*1024*1024,64*1024*1024);
  const softQuotaSeconds=clampInt(options.softQuotaSeconds??process.env.KELO_SPRITE_AI_SOFT_QUOTA_SECONDS,60,300,270);
  const enforceSoftQuota=boolFlag(options.enforceSoftQuota??process.env.KELO_SPRITE_AI_ENFORCE_SOFT_QUOTA??'0');
  const cache=new Map(),inflight=new Map(),usage=new Map();let bytes=0;
  function prune(){
    const now=Date.now();
    for(const[key,row]of cache){if(now-row.createdAt>ttlMs){cache.delete(key);bytes-=row.bytes;}}
    while(cache.size>maxEntries||bytes>maxBytes){const first=cache.keys().next().value;if(!first)break;const row=cache.get(first);cache.delete(first);bytes-=row?.bytes||0;}
    for(const[id,row]of usage){if(now-row.startedAt>=86_400_000)usage.delete(id);}
  }
  function userBudget(userId){prune();const id=String(userId||'anonymous'),now=Date.now();let row=usage.get(id);if(!row){row={startedAt:now,estimatedSeconds:0,calls:0,cacheHits:0,deduped:0};usage.set(id,row);}return row;}
  function statusFor(userId){const row=userBudget(userId);return Object.freeze({softQuotaSeconds,estimatedUsedSeconds:row.estimatedSeconds,estimatedRemainingSeconds:Math.max(0,softQuotaSeconds-row.estimatedSeconds),windowStartedAt:row.startedAt,windowResetsAt:row.startedAt+86_400_000,calls:row.calls,cacheHits:row.cacheHits,deduped:row.deduped,enforceSoftQuota,cacheEntries:cache.size,cacheBytes:bytes});}
  async function run({userId,input,execute}){
    if(typeof execute!=='function')throw new Error('SPRITE_AI_RESOURCE_EXECUTE_REQUIRED');
    prune();const force=boolFlag(input?.forceRegenerate),key=requestKey(userId,input),budget=userBudget(userId),estimate=estimateGpuSeconds(input);
    if(!force&&cache.has(key)){
      const row=cache.get(key);cache.delete(key);cache.set(key,row);budget.cacheHits++;
      return Object.freeze({...row.result,resourceGovernor:Object.freeze({mode:'cache-hit',estimatedGpuSecondsSaved:estimate,...statusFor(userId)})});
    }
    if(!force&&inflight.has(key)){
      budget.deduped++;const result=await inflight.get(key);
      return Object.freeze({...result,resourceGovernor:Object.freeze({mode:'inflight-dedup',estimatedGpuSecondsSaved:estimate,...statusFor(userId)})});
    }
    if(enforceSoftQuota&&budget.estimatedSeconds+estimate>softQuotaSeconds){const error=new Error('SPRITE_AI_SOFT_QUOTA_GUARD');error.code='SPRITE_AI_SOFT_QUOTA_GUARD';error.status=429;error.detail=`Estimated free-tier reserve reached; reset at ${new Date(budget.startedAt+86_400_000).toISOString()}`;throw error;}
    const task=(async()=>{
      const startedAt=Date.now();const result=await execute();budget.calls++;budget.estimatedSeconds+=estimate;
      const payload=Object.freeze({...result,resourceGovernor:Object.freeze({mode:'gpu-call',estimatedGpuSeconds:estimate,wallMs:Date.now()-startedAt,...statusFor(userId)})});
      const approxBytes=Buffer.byteLength(String(result?.imageDataUrl||''),'utf8');
      if(approxBytes>0&&approxBytes<=8*1024*1024){cache.set(key,{result:payload,bytes:approxBytes,createdAt:Date.now()});bytes+=approxBytes;prune();}
      return payload;
    })();
    inflight.set(key,task);try{return await task;}finally{inflight.delete(key);}
  }
  return Object.freeze({version:'kelo-sprite-ai-resource-governor-v1',run,statusFor,estimateGpuSeconds:estimateGpuSeconds,requestKey:(userId,input)=>requestKey(userId,input)});
}
module.exports={createSpriteAiResourceGovernor,estimateGpuSeconds,requestKey};
