/* KELO-INDEX
 * area: SUPABASE / EDGE FUNCTIONS / SPRITE AI
 * owner: Kelo Sprite AI transport boundary
 * purpose: Supabase Edge -> owned ZeroGPU when available, explicit public community fallback while HF hosting is locked
 * security: authenticated generation, server-side HF token only, allowlisted community fallback, no paid fallback
 * runtime: Deno 2.1 compatible Supabase Edge Function
 */

const VERSION = 'kelo-sprite-edge-v1.1-public-fallback';
const ALLOWED_ORIGINS = new Set([
  'https://kelffren.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]);
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const MAX_REMOTE_IMAGE_BYTES = 12 * 1024 * 1024;
const HF_WAIT_MS = 100_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 8;
const PUBLIC_FALLBACK_SPACE = 'multimodalart/sprite-forge';
const PUBLIC_FALLBACK_URL = 'https://multimodalart-sprite-forge.hf.space';
const PUBLIC_FALLBACK_API = 'forge';
const PUBLIC_FALLBACK_DIRECTION = 'E';
const completeCache = new Map<string,{expires:number,value:any}>();

type Target = 'atlas'|'pose';
type Transport = 'owned'|'public-sprite-forge';
type JobContext = {
  target: Target;
  apiName: string;
  pipeline: string;
  stage: string|null;
  realSkeleton: boolean;
  sourceMode: string;
  model: string|null;
  requestKey: string;
  transport: Transport;
  resultIndex?: number;
  layoutColumns?: number;
  layoutRows?: number;
  fallbackDirection?: string;
};

function env(...names:string[]){for(const name of names){const value=Deno.env.get(name);if(value?.trim())return value.trim();}return '';}
function short(value:unknown,max=600){return String(value??'').trim().slice(0,max);}
function boolFlag(value:unknown){if(value===true)return true;const s=String(value??'').trim().toLowerCase();return s==='1'||s==='true'||s==='yes'||s==='on';}
function seed(value:unknown){const n=Math.floor(Number(value));return Number.isFinite(n)&&n>0?n:0;}
function normalizeOrigin(value:string|null){return String(value||'').trim().replace(/\/$/,'');}
function corsOrigin(req:Request){const origin=normalizeOrigin(req.headers.get('origin'));return origin&&ALLOWED_ORIGINS.has(origin)?origin:'';}
function headers(origin=''){const h:Record<string,string>={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};if(origin){h['access-control-allow-origin']=origin;h.vary='Origin';}return h;}
function json(data:unknown,status=200,origin=''){return new Response(JSON.stringify(data),{status,headers:headers(origin)});}
function error(code:string,status=500,detail=''){return Object.assign(new Error(code),{code,status,detail});}
function bearer(req:Request){const m=/^Bearer\s+(.+)$/i.exec(req.headers.get('authorization')||'');return m?m[1].trim():'';}
function cleanApiName(value:string,fallback:string){const v=String(value||fallback).trim().replace(/^\//,'');return /^[A-Za-z0-9_-]{1,80}$/.test(v)?v:fallback;}
function resolveSpaceUrl(explicit:string,space:string){
  if(explicit){try{const u=new URL(explicit);if(u.protocol==='https:')return u.origin;}catch{}}
  const id=String(space||'').trim();if(!id)return '';
  if(/^https:\/\//i.test(id)){try{return new URL(id).origin;}catch{return '';}}
  const parts=id.split('/');if(parts.length!==2)return '';
  const slug=parts.map(x=>x.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'')).join('-');
  return slug?`https://${slug}.hf.space`:'';
}
function config(){
  const atlasSpace=env('KELO_SPRITE_AI_HF_SPACE');
  const poseSpace=env('KELO_SPRITE_AI_HF_POSE_SPACE');
  const fallbackRaw=env('KELO_SPRITE_AI_PUBLIC_FALLBACK');
  const publicFallbackEnabled=fallbackRaw?boolFlag(fallbackRaw):true;
  return {
    atlasSpace,
    poseSpace,
    atlasUrl:resolveSpaceUrl(env('KELO_SPRITE_AI_HF_URL'),atlasSpace),
    poseUrl:resolveSpaceUrl(env('KELO_SPRITE_AI_HF_POSE_URL'),poseSpace),
    atlasApi:cleanApiName(env('KELO_SPRITE_AI_HF_API_NAME'),'generate'),
    v3Api:cleanApiName(env('KELO_SPRITE_AI_HF_V3_API_NAME'),'generate_v3'),
    poseApi:cleanApiName(env('KELO_SPRITE_AI_HF_POSE_API_NAME'),'generate_pose'),
    hfToken:env('HF_TOKEN'),
    publicFallbackEnabled,
  };
}
function statusPayload(){
  const c=config(),fallbackActive=!c.atlasUrl&&c.publicFallbackEnabled;
  return {
    ok:true,
    service:'kelo-sprite-ai',
    version:VERSION,
    transport:fallbackActive?'supabase-edge->public-community-zerogpu':'supabase-edge->owned-huggingface-zerogpu',
    renderIndependent:true,
    configured:Boolean(c.atlasUrl)||fallbackActive,
    fullAtlasReady:Boolean(c.atlasUrl),
    realSkeletonReady:Boolean(c.poseUrl),
    authenticatedZeroGpu:Boolean(c.hfToken),
    paidFallback:false,
    pipelines:['atlas-v2','identity-skeleton-v3'],
    directions:8,
    framesPerDirection:4,
    publicFallback:{
      enabled:c.publicFallbackEnabled,
      active:fallbackActive,
      experimental:true,
      scope:'walk-row-only',
      direction:PUBLIC_FALLBACK_DIRECTION,
      source:PUBLIC_FALLBACK_SPACE,
      quotaAttribution:'community-space-shared-when-no-x-ip-token',
      automaticRetry:false,
    },
    providers:{
      atlas:{configured:Boolean(c.atlasUrl),space:c.atlasSpace||null,url:c.atlasUrl||null,apiName:c.atlasApi},
      pose:{configured:Boolean(c.poseUrl),space:c.poseSpace||null,url:c.poseUrl||null,apiName:c.poseApi},
    },
  };
}

function publishableKey(){
  const mapped=env('SUPABASE_PUBLISHABLE_KEYS');
  if(mapped){try{const value=JSON.parse(mapped)?.default;if(typeof value==='string'&&value)return value;}catch{}}
  return env('SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY');
}
async function requireUser(req:Request){
  const token=bearer(req);if(!token)throw error('AUTH_TOKEN_REQUIRED',401);
  const base=env('SUPABASE_URL').replace(/\/$/,'');const key=publishableKey();if(!base||!key)throw error('SUPABASE_RUNTIME_KEYS_MISSING',503);
  const res=await fetch(`${base}/auth/v1/user`,{headers:{apikey:key,authorization:`Bearer ${token}`}});
  if(!res.ok)throw error('INVALID_AUTH_USER',401);
  const user=await res.json();if(!user?.id)throw error('INVALID_AUTH_USER',401);if(user?.is_anonymous===true)throw error('SPRITE_AI_ANONYMOUS_DENIED',403);
  return user;
}
async function readBody(req:Request){
  const declared=Number(req.headers.get('content-length')||0);if(declared>MAX_BODY_BYTES)throw error('SPRITE_AI_BODY_TOO_LARGE',413);
  const raw=await req.text();if(new TextEncoder().encode(raw).byteLength>MAX_BODY_BYTES)throw error('SPRITE_AI_BODY_TOO_LARGE',413);
  let body:any={};try{body=raw?JSON.parse(raw):{};}catch{throw error('SPRITE_AI_INVALID_JSON',400);}if(!body||typeof body!=='object'||Array.isArray(body))throw error('SPRITE_AI_INVALID_BODY',400);
  return {body,raw};
}
async function digestKey(userId:string,raw:string){const bytes=new TextEncoder().encode(`${userId}\n${raw}`);const d=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join('');}
function cacheGet(key:string){const row=completeCache.get(key);if(!row)return null;if(row.expires<=Date.now()){completeCache.delete(key);return null;}return row.value;}
function cacheSet(key:string,value:any){while(completeCache.size>=CACHE_MAX){const first=completeCache.keys().next().value;if(!first)break;completeCache.delete(first);}completeCache.set(key,{expires:Date.now()+CACHE_TTL_MS,value});}

function subjectPrompt(input:any){return short(input.prompt||input.characterPrompt||input.styleHint||'Premium dark-fantasy MMORPG character, clean readable silhouette, restrained gold accents.',1000);}
function stagePrompt(input:any){
  const mode=short(input.mode||'master',24).toLowerCase(),direction=short(input.direction||'S',4).toUpperCase(),action=short(input.action||'walk',24).toLowerCase(),base=subjectPrompt(input);
  const pose=input.poseTemplate?JSON.stringify(input.poseTemplate).slice(0,1800):'';
  const rule=mode==='master'?'Create one canonical full-body identity master with a clean silhouette and centered feet.'
    :mode==='rotations'?'Preserve the exact master identity while changing facing direction only.'
    :mode==='repair'?`Repair only these regions: ${(Array.isArray(input.repairRegions)?input.repairRegions:[]).join(', ')||'the QA defect'}. Preserve healthy regions.`
    :`Generate four chronological ${action} frames facing ${direction}, preserving exact identity, equipment, palette and proportions.`;
  return [base,rule,pose?`Pose/keypoint intent JSON: ${pose}`:'',short(input.retryHint,500)?`QA correction: ${short(input.retryHint,500)}`:''].filter(Boolean).join('\n');
}
function authOnlyHeaders(){const token=config().hfToken;const h:Record<string,string>={accept:'application/json'};if(token)h.authorization=`Bearer ${token}`;return h;}
function hfHeaders(){return{...authOnlyHeaders(),'content-type':'application/json'};}
function parseDataUrl(value:string){
  const match=/^data:(image\/(?:png|webp|jpeg));base64,([A-Za-z0-9+/=]+)$/i.exec(String(value||''));
  if(!match)return null;
  const binary=atob(match[2]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return{mime:match[1].toLowerCase(),bytes};
}
async function uploadDataUrl(baseUrl:string,value:string){
  const parsed=parseDataUrl(value);if(!parsed)throw error('SPRITE_AI_REFERENCE_DATA_URL_INVALID',400);
  const ext=parsed.mime.includes('webp')?'webp':parsed.mime.includes('jpeg')?'jpg':'png';
  const form=new FormData();form.append('files',new File([parsed.bytes],`kelo-reference.${ext}`,{type:parsed.mime}));
  const res=await fetch(`${baseUrl}/gradio_api/upload`,{method:'POST',headers:authOnlyHeaders(),body:form});const text=await res.text();let data:any=null;try{data=text?JSON.parse(text):null;}catch{}
  if(!res.ok)throw error('SPRITE_AI_PUBLIC_UPLOAD_FAILED',502,short(data?.detail||text,300));
  const path=Array.isArray(data)?String(data[0]||''):String(data?.path||'');if(!path)throw error('SPRITE_AI_PUBLIC_UPLOAD_PATH_MISSING',502);
  return{path,orig_name:`kelo-reference.${ext}`,meta:{_type:'gradio.FileData'}};
}
async function plan(input:any,requestKey:string):Promise<{baseUrl:string,data:any[],context:JobContext}>{
  const c=config(),pipeline=String(input.pipeline||'atlas-v2').trim().toLowerCase(),mode=short(input.mode||'',24).toLowerCase(),realSkeleton=(mode==='direction')&&boolFlag(input.realSkeleton);
  const source=String(input.sourceImageDataUrl||''),retry=short(input.retryHint,500),action=short(input.action||'walk',24).toLowerCase(),direction=short(input.direction||'S',4).toUpperCase();
  if(realSkeleton){
    if(!c.poseUrl)throw error('SPRITE_AI_POSE_NOT_CONFIGURED',503,'Real skeleton stays locked until the dedicated pose Space is available. Public fallback does not silently downgrade skeleton conditioning.');
    if(!source)throw error('SPRITE_AI_POSE_REFERENCE_REQUIRED',400);
    const apiName=c.poseApi;return{baseUrl:c.poseUrl,data:[stagePrompt(input),source,seed(input.seed),direction,action,JSON.stringify(input.poseTemplate||{}),short(input.styleHint,300),retry],context:{target:'pose',apiName,pipeline:'identity-skeleton-v3',stage:'direction',realSkeleton:true,sourceMode:'reference+pose',model:c.poseSpace||c.poseUrl,requestKey,transport:'owned'}};
  }
  if(c.atlasUrl){
    if(pipeline==='identity-skeleton-v3'||mode){
      const stage=mode||'master',apiName=c.v3Api;return{baseUrl:c.atlasUrl,data:[stage,subjectPrompt(input),source,seed(input.seed),retry,direction,action,JSON.stringify(input.poseTemplate||{}),String(input.targetFrameDataUrl||''),JSON.stringify(Array.isArray(input.repairRegions)?input.repairRegions:[])],context:{target:'atlas',apiName,pipeline:'identity-skeleton-v3',stage,realSkeleton:false,sourceMode:source?'reference-edit':'text-generation',model:c.atlasSpace||c.atlasUrl,requestKey,transport:'owned'}};
    }
    const apiName=c.atlasApi;return{baseUrl:c.atlasUrl,data:[subjectPrompt(input),source,seed(input.seed),retry],context:{target:'atlas',apiName,pipeline:'atlas-v2',stage:null,realSkeleton:false,sourceMode:source?'reference-edit':'text-generation',model:c.atlasSpace||c.atlasUrl,requestKey,transport:'owned'}};
  }
  if(!c.publicFallbackEnabled)throw error('SPRITE_AI_NOT_CONFIGURED',503,'Owned ZeroGPU unavailable and public fallback disabled.');
  if(pipeline!=='atlas-v2'||mode)throw error('SPRITE_AI_PUBLIC_FALLBACK_SCOPE',503,'Community fallback only supports the basic Walk-row preview. It does not replace V3 rotations or real skeleton.');
  if(action!=='walk')throw error('SPRITE_AI_PUBLIC_FALLBACK_ACTION',400,'Community fallback currently supports Walk only.');
  const uploaded=source?await uploadDataUrl(PUBLIC_FALLBACK_URL,source):null;
  const fallbackSeed=seed(input.seed)||1234;
  const data=[
    subjectPrompt(input),
    uploaded,
    'Chunky pixel-friendly',
    'FLUX.2 Klein 4B — fast',
    'Square · fast (544²)',
    ['Walk'],
    2,
    4,
    fallbackSeed,
    0.10,
    0.09,
    1.0,
    2,
    0.30,
    16,
    true,
    12,
    256,
  ];
  return{baseUrl:PUBLIC_FALLBACK_URL,data,context:{target:'atlas',apiName:PUBLIC_FALLBACK_API,pipeline:'public-walk-row-v1',stage:'walk-row',realSkeleton:false,sourceMode:source?'reference-animation':'text-generation',model:PUBLIC_FALLBACK_SPACE,requestKey,transport:'public-sprite-forge',resultIndex:3,layoutColumns:8,layoutRows:1,fallbackDirection:PUBLIC_FALLBACK_DIRECTION}};
}
function targetBase(context:JobContext){const c=config();if(context.transport==='public-sprite-forge')return PUBLIC_FALLBACK_URL;return context.target==='pose'?c.poseUrl:c.atlasUrl;}
async function submit(baseUrl:string,apiName:string,data:any[]){
  const res=await fetch(`${baseUrl}/gradio_api/call/${apiName}`,{method:'POST',headers:hfHeaders(),body:JSON.stringify({data})});const text=await res.text();let parsed:any=null;try{parsed=text?JSON.parse(text):null;}catch{}
  if(!res.ok)throw error(res.status===429?'SPRITE_AI_ZERO_GPU_QUOTA':'SPRITE_AI_HF_SUBMIT_FAILED',res.status===429?429:502,short(parsed?.detail||parsed?.error||text,300));
  const eventId=String(parsed?.event_id||'');if(!/^[A-Za-z0-9_-]{4,160}$/.test(eventId))throw error('SPRITE_AI_HF_EVENT_ID_MISSING',502);
  return eventId;
}
function parseEventData(data:string){try{return JSON.parse(data);}catch{return[data];}}
function parseSse(text:string){
  const blocks=text.replace(/\r/g,'').split('\n\n');let failure='',latest:any=null;
  for(const block of blocks){let event='',data='';for(const line of block.split('\n')){if(line.startsWith('event:'))event=line.slice(6).trim();else if(line.startsWith('data:'))data+=(data?'\n':'')+line.slice(5).trim();}
    if(event==='generating'&&data)latest=parseEventData(data);
    if(event==='complete')return{done:true,data:data?parseEventData(data):latest};
    if((event==='error'||event==='cancelled')&&data)failure=data;
  }
  if(failure)throw error('SPRITE_AI_HF_JOB_FAILED',502,short(failure,300));return{done:false,data:latest};
}
async function waitResult(baseUrl:string,apiName:string,eventId:string){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),HF_WAIT_MS);
  try{const h:Record<string,string>={accept:'text/event-stream'};const token=config().hfToken;if(token)h.authorization=`Bearer ${token}`;const res=await fetch(`${baseUrl}/gradio_api/call/${apiName}/${eventId}`,{headers:h,signal:controller.signal});if(!res.ok){const text=await res.text();throw error('SPRITE_AI_HF_WAIT_FAILED',res.status===429?429:502,short(text,300));}const text=await res.text();return parseSse(text);}catch(e:any){if(e?.name==='AbortError')return{done:false,data:null};throw e;}finally{clearTimeout(timer);}
}
function bytesToBase64(bytes:Uint8Array){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+chunk)));return btoa(binary);}
function fileUrl(value:any,baseUrl:string){
  if(typeof value==='string'){if(/^https:\/\//i.test(value))return value;if(value)return`${baseUrl}/gradio_api/file=${encodeURIComponent(value)}`;}
  if(value&&typeof value==='object'){
    const direct=String(value.url||'');if(/^https:\/\//i.test(direct))return direct;
    const path=String(value.path||'');if(/^https:\/\//i.test(path))return path;if(path)return`${baseUrl}/gradio_api/file=${encodeURIComponent(path)}`;
  }
  return'';
}
async function remoteImageDataUrl(value:any,baseUrl:string){
  if(typeof value==='string'&&/^data:image\/(?:png|webp|jpeg);base64,/i.test(value))return value;
  const url=fileUrl(value,baseUrl);if(!url)throw error('SPRITE_AI_PUBLIC_IMAGE_URL_MISSING',502);
  const res=await fetch(url,{headers:authOnlyHeaders()});if(!res.ok)throw error('SPRITE_AI_PUBLIC_IMAGE_FETCH_FAILED',502,`HTTP ${res.status}`);
  const size=Number(res.headers.get('content-length')||0);if(size>MAX_REMOTE_IMAGE_BYTES)throw error('SPRITE_AI_PUBLIC_IMAGE_TOO_LARGE',502);
  const buffer=new Uint8Array(await res.arrayBuffer());if(buffer.byteLength>MAX_REMOTE_IMAGE_BYTES)throw error('SPRITE_AI_PUBLIC_IMAGE_TOO_LARGE',502);
  const mime=(res.headers.get('content-type')||'image/png').split(';')[0].trim();if(!/^image\/(?:png|webp|jpeg)$/i.test(mime))throw error('SPRITE_AI_PUBLIC_IMAGE_TYPE_INVALID',502,mime);
  return`data:${mime};base64,${bytesToBase64(buffer)}`;
}
async function completePayload(context:JobContext,data:any[]){
  if(context.transport==='public-sprite-forge'){
    const index=Number.isInteger(context.resultIndex)?Number(context.resultIndex):3;
    const imageDataUrl=await remoteImageDataUrl(data?.[index],PUBLIC_FALLBACK_URL);
    return{
      ok:true,pending:false,imageDataUrl,
      metadata:{layout:{columns:context.layoutColumns||8,rows:context.layoutRows||1,sourceFrames:8,targetFrames:4},communitySpace:PUBLIC_FALLBACK_SPACE,scope:'walk-row-only',quotaAttribution:'community-space-shared-when-no-x-ip-token'},
      provider:'huggingface-public-community-zerogpu',model:PUBLIC_FALLBACK_SPACE,sourceMode:context.sourceMode,pipeline:context.pipeline,stage:context.stage,realSkeleton:false,poseConditioning:null,renderIndependent:true,paidFallback:false,fallbackMode:'public-sprite-forge-walk-row',fallbackDirection:context.fallbackDirection||PUBLIC_FALLBACK_DIRECTION,generatedAt:Date.now(),
    };
  }
  const imageDataUrl=typeof data?.[0]==='string'?data[0]:'';if(!/^data:image\/(?:png|webp|jpeg);base64,/i.test(imageDataUrl))throw error('SPRITE_AI_NO_IMAGE_RETURNED',502);
  let metadata:any=null;const rawMeta=data?.[2];if(typeof rawMeta==='string'){try{metadata=JSON.parse(rawMeta);}catch{metadata={raw:short(rawMeta,500)};}}else if(rawMeta!==undefined)metadata={seed:rawMeta};
  return{ok:true,pending:false,imageDataUrl,metadata,provider:'huggingface-zerogpu-via-supabase',model:context.model,sourceMode:context.sourceMode,pipeline:context.pipeline,stage:context.stage,realSkeleton:context.realSkeleton,poseConditioning:context.realSkeleton?'controlnet-openpose+ip-adapter':context.stage==='direction'?'semantic-keypoint-intent':null,renderIndependent:true,paidFallback:false,generatedAt:Date.now()};
}
function validContext(raw:any):JobContext{
  const c=config(),transport:Transport=raw?.transport==='public-sprite-forge'?'public-sprite-forge':'owned',target:Target=raw?.target==='pose'?'pose':'atlas';
  if(transport==='public-sprite-forge'){
    const apiName=cleanApiName(raw?.apiName,PUBLIC_FALLBACK_API);if(apiName!==PUBLIC_FALLBACK_API)throw error('SPRITE_AI_INVALID_JOB_CONTEXT',400);
    return{target:'atlas',apiName,pipeline:'public-walk-row-v1',stage:'walk-row',realSkeleton:false,sourceMode:short(raw?.sourceMode,40)||'generated',model:PUBLIC_FALLBACK_SPACE,requestKey:/^[a-f0-9]{64}$/.test(String(raw?.requestKey||''))?String(raw.requestKey):'',transport,resultIndex:3,layoutColumns:8,layoutRows:1,fallbackDirection:PUBLIC_FALLBACK_DIRECTION};
  }
  const apiName=cleanApiName(raw?.apiName,target==='pose'?c.poseApi:c.atlasApi),allowed=target==='pose'?new Set([c.poseApi]):new Set([c.atlasApi,c.v3Api]);if(!allowed.has(apiName))throw error('SPRITE_AI_INVALID_JOB_CONTEXT',400);
  return{target,apiName,pipeline:raw?.pipeline==='identity-skeleton-v3'?'identity-skeleton-v3':'atlas-v2',stage:raw?.stage?short(raw.stage,24):null,realSkeleton:Boolean(raw?.realSkeleton),sourceMode:short(raw?.sourceMode,40)||'generated',model:short(raw?.model,200)||null,requestKey:/^[a-f0-9]{64}$/.test(String(raw?.requestKey||''))?String(raw.requestKey):'',transport};
}

Deno.serve(async(req:Request)=>{
  const origin=corsOrigin(req);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':origin||'https://kelffren.github.io','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Authorization, Content-Type','access-control-max-age':'600',vary:'Origin'}});
  try{
    if(req.method==='GET')return json(statusPayload(),200,origin);
    if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405,origin);
    const user=await requireUser(req),{body,raw}=await readBody(req),op=String(body.op||'generate');
    if(op==='status')return json(statusPayload(),200,origin);
    if(op==='wait'){
      const eventId=String(body.eventId||'');if(!/^[A-Za-z0-9_-]{4,160}$/.test(eventId))throw error('SPRITE_AI_INVALID_EVENT_ID',400);const context=validContext(body.context),baseUrl=targetBase(context);if(!baseUrl)throw error('SPRITE_AI_NOT_CONFIGURED',503);
      const result=await waitResult(baseUrl,context.apiName,eventId);if(!result.done)return json({ok:true,pending:true,eventId,context},202,origin);const value=await completePayload(context,result.data||[]);if(context.requestKey)cacheSet(context.requestKey,value);return json(value,200,origin);
    }
    const requestKey=await digestKey(String(user.id),raw),cached=cacheGet(requestKey);if(cached)return json({...cached,cache:{hit:true,scope:'edge-isolate'}},200,origin);
    const p=await plan(body,requestKey),eventId=await submit(p.baseUrl,p.context.apiName,p.data),result=await waitResult(p.baseUrl,p.context.apiName,eventId);
    if(!result.done)return json({ok:true,pending:true,eventId,context:p.context,provider:p.context.transport==='public-sprite-forge'?'huggingface-public-community-zerogpu':'huggingface-zerogpu-via-supabase'},202,origin);
    const value=await completePayload(p.context,result.data||[]);cacheSet(requestKey,value);return json({...value,cache:{hit:false,scope:'edge-isolate'}},200,origin);
  }catch(e:any){const status=Number(e?.status)||500,code=String(e?.code||e?.message||'SPRITE_AI_EDGE_ERROR'),detail=short(e?.detail||'',300);console.error('[kelo-sprite-generate]',code,detail);return json({ok:false,error:code,detail:detail||null,renderIndependent:true,paidFallback:false},status,origin);}
});
