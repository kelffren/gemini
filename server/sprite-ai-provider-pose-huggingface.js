/* KELO-INDEX
 * area: SERVER / SPRITE AI / POSE
 * owner: Kelo real skeleton conditioning adapter
 * purpose: call a dedicated Hugging Face Space that combines OpenPose ControlNet + IP-Adapter identity guidance
 * public-api: createHuggingFacePoseProvider
 * consumes: @gradio/client, KELO_SPRITE_AI_HF_POSE_SPACE, optional HF_TOKEN
 * state-owned: cached Gradio client only
 * online: server-only; browser never sees provider credentials
 * do-not: NO silent semantic fallback, NO browser token, NO gameplay state
 */
'use strict';

function poseProviderError(code,status=502,detail=null){const error=new Error(code);error.code=code;error.status=status;if(detail)error.detail=detail;return error;}
function clampInt(value,min,max,fallback){const n=Math.floor(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function dataUrlOrThrow(value){const text=String(value||'').trim();if(!/^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/=\r\n]+$/i.test(text))throw poseProviderError('SPRITE_AI_POSE_INVALID_IMAGE',502);return text;}
function safeJson(value){if(value&&typeof value==='object')return value;if(typeof value!=='string'||!value.trim())return null;try{return JSON.parse(value);}catch{return null;}}

function createHuggingFacePoseProvider(options={}){
  const space=String(options.space??process.env.KELO_SPRITE_AI_HF_POSE_SPACE??'').trim();
  const apiName=String(options.apiName??process.env.KELO_SPRITE_AI_HF_POSE_API_NAME??'/generate_pose').trim()||'/generate_pose';
  const token=String(options.token??process.env.HF_TOKEN??process.env.HUGGINGFACE_TOKEN??'').trim();
  const timeoutMs=clampInt(options.timeoutMs??process.env.KELO_SPRITE_AI_POSE_TIMEOUT_MS??process.env.KELO_SPRITE_AI_TIMEOUT_MS,10000,600000,240000);
  const connectImpl=options.connectImpl||null;
  let clientPromise=null;

  async function connect(){
    if(!space)throw poseProviderError('SPRITE_AI_POSE_NOT_CONFIGURED',503,'Set KELO_SPRITE_AI_HF_POSE_SPACE.');
    if(clientPromise)return clientPromise;
    clientPromise=(async()=>{
      if(connectImpl)return connectImpl(space,{token:token||undefined});
      let mod;try{mod=await import('@gradio/client');}catch(error){throw poseProviderError('SPRITE_AI_HF_CLIENT_MISSING',500,String(error?.message||error));}
      const Client=mod.Client;if(!Client?.connect)throw poseProviderError('SPRITE_AI_HF_CLIENT_INVALID',500);
      return Client.connect(space,token?{token}:undefined);
    })();
    try{return await clientPromise;}catch(error){clientPromise=null;throw error;}
  }

  function status(){return Object.freeze({configured:Boolean(space),provider:'huggingface-zerogpu-pose',space:space||null,apiName,authenticated:Boolean(token),timeoutMs,conditioning:'controlnet-openpose+ip-adapter',supportsRealSkeleton:true});}

  async function generateDirection({prompt='',sourceImageDataUrl='',seed=0,direction='S',action='walk',poseTemplate=null,styleHint='',retryHint=''}={}){
    if(!sourceImageDataUrl)throw poseProviderError('SPRITE_AI_POSE_REFERENCE_REQUIRED',400);
    if(!poseTemplate||typeof poseTemplate!=='object')throw poseProviderError('SPRITE_AI_POSE_TEMPLATE_REQUIRED',400);
    const client=await connect();
    const payload=[String(prompt||''),String(sourceImageDataUrl||''),Number.isFinite(Number(seed))?Math.floor(Number(seed)):0,String(direction||'S'),String(action||'walk'),JSON.stringify(poseTemplate),String(styleHint||''),String(retryHint||'')];
    let timer=null;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(poseProviderError('SPRITE_AI_POSE_TIMEOUT',504,String(timeoutMs))),timeoutMs);timer.unref?.();});
    let result;
    try{result=await Promise.race([client.predict(apiName,payload),timeout]);}
    catch(error){if(error?.code)throw error;throw poseProviderError('SPRITE_AI_POSE_UPSTREAM_ERROR',502,String(error?.message||error));}
    finally{if(timer)clearTimeout(timer);}
    const imageDataUrl=dataUrlOrThrow(result?.data?.[0]);
    const metadata=safeJson(result?.data?.[2])||{};
    return Object.freeze({imageDataUrl,metadata:Object.freeze({...metadata,conditioning:'controlnet-openpose+ip-adapter'}),usage:null,provider:'huggingface-zerogpu-pose',model:space,sourceMode:'reference+pose',stage:'direction',poseConditioning:'controlnet-openpose+ip-adapter'});
  }

  return Object.freeze({version:'kelo-sprite-ai-pose-hf-v1',status,generateDirection});
}

module.exports={createHuggingFacePoseProvider,poseProviderError,dataUrlOrThrow};
