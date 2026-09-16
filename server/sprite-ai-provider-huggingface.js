/* KELO-INDEX
 * area: SERVER / SPRITE AI
 * owner: Kelo Sprite AI provider adapter
 * purpose: call a compatible Hugging Face Gradio/ZeroGPU Space without exposing HF credentials to the browser
 * public-api: createHuggingFaceSpriteProvider
 * consumes: @gradio/client, KELO_SPRITE_AI_HF_SPACE, optional HF_TOKEN
 * state-owned: cached Gradio client connection only
 * extension-points: v2 /generate + V3 /generate_v3, injected connectImpl for deterministic tests
 * online: server-only inference adapter behind the existing /api/sprite-generate authority boundary
 * do-not: NO browser token, NO gameplay state, NO second public HTTP API
 */
'use strict';

function providerError(code,status=502,detail=null){const error=new Error(code);error.code=code;error.status=status;if(detail)error.detail=detail;return error;}
function clampInt(value,min,max,fallback){const n=Math.floor(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function dataUrlOrThrow(value){const text=String(value||'').trim();if(!/^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/=\r\n]+$/i.test(text))throw providerError('SPRITE_AI_HF_INVALID_IMAGE',502);return text;}
function safeJson(value){if(value&&typeof value==='object')return value;if(typeof value!=='string'||!value.trim())return null;try{return JSON.parse(value);}catch{return null;}}

function createHuggingFaceSpriteProvider(options={}){
  const space=String(options.space??process.env.KELO_SPRITE_AI_HF_SPACE??'').trim();
  const apiName=String(options.apiName??process.env.KELO_SPRITE_AI_HF_API_NAME??'/generate').trim()||'/generate';
  const v3ApiName=String(options.v3ApiName??process.env.KELO_SPRITE_AI_HF_V3_API_NAME??'/generate_v3').trim()||'/generate_v3';
  const token=String(options.token??process.env.HF_TOKEN??process.env.HUGGINGFACE_TOKEN??'').trim();
  const timeoutMs=clampInt(options.timeoutMs??process.env.KELO_SPRITE_AI_TIMEOUT_MS,10000,600000,180000);
  const connectImpl=options.connectImpl||null;
  let clientPromise=null;

  async function connect(){
    if(!space)throw providerError('SPRITE_AI_HF_NOT_CONFIGURED',503);
    if(clientPromise)return clientPromise;
    clientPromise=(async()=>{
      if(connectImpl)return connectImpl(space,{token:token||undefined});
      let mod;try{mod=await import('@gradio/client');}catch(error){throw providerError('SPRITE_AI_HF_CLIENT_MISSING',500,String(error?.message||error));}
      const Client=mod.Client;if(!Client?.connect)throw providerError('SPRITE_AI_HF_CLIENT_INVALID',500);
      return Client.connect(space,token?{token}:undefined);
    })();
    try{return await clientPromise;}catch(error){clientPromise=null;throw error;}
  }

  function status(){return Object.freeze({configured:Boolean(space),provider:'huggingface-zerogpu',space:space||null,apiName,v3ApiName,authenticated:Boolean(token),timeoutMs,supportsStages:true});}

  async function predict(name,payload){
    const client=await connect();let timer=null;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(providerError('SPRITE_AI_HF_TIMEOUT',504,String(timeoutMs))),timeoutMs);timer.unref?.();});
    try{return await Promise.race([client.predict(name,payload),timeout]);}
    catch(error){if(error?.code)throw error;throw providerError('SPRITE_AI_HF_UPSTREAM_ERROR',502,String(error?.message||error));}
    finally{if(timer)clearTimeout(timer);}
  }

  async function generate({prompt='',sourceImageDataUrl=null,seed=0,retryHint=''}={}){
    const payload=[String(prompt||''),String(sourceImageDataUrl||''),Number.isFinite(Number(seed))?Math.floor(Number(seed)):0,String(retryHint||'')];
    const result=await predict(apiName,payload);
    const imageDataUrl=dataUrlOrThrow(result?.data?.[0]);
    return Object.freeze({imageDataUrl,usage:null,provider:'huggingface-zerogpu',model:space,sourceMode:sourceImageDataUrl?'reference-edit':'text-generation'});
  }

  async function generateStage({mode='master',prompt='',sourceImageDataUrl=null,seed=0,retryHint='',direction='',action='walk',poseTemplate=null,targetFrameDataUrl=null,repairRegions=[]}={}){
    const stage=String(mode||'master').trim().toLowerCase();
    const payload=[
      stage,
      String(prompt||''),
      String(sourceImageDataUrl||''),
      Number.isFinite(Number(seed))?Math.floor(Number(seed)):0,
      String(retryHint||''),
      String(direction||''),
      String(action||'walk'),
      JSON.stringify(poseTemplate||null),
      String(targetFrameDataUrl||''),
      JSON.stringify(Array.isArray(repairRegions)?repairRegions:[])
    ];
    const result=await predict(v3ApiName,payload);
    const imageDataUrl=dataUrlOrThrow(result?.data?.[0]);
    const metadata=safeJson(result?.data?.[2])||Object.freeze({mode:stage});
    return Object.freeze({imageDataUrl,metadata,usage:null,provider:'huggingface-zerogpu',model:space,sourceMode:sourceImageDataUrl?'reference-edit':'text-generation',stage});
  }

  return Object.freeze({version:'kelo-sprite-ai-hf-v2',status,generate,generateStage});
}

module.exports={createHuggingFaceSpriteProvider,providerError,dataUrlOrThrow};
