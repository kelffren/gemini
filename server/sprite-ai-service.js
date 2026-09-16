/* KELO-INDEX
 * area: SERVER / SPRITE AI
 * owner: Kelo Sprite AI service
 * purpose: preserve one /api/sprite-generate contract while selecting a server-side inference provider
 * public-api: createSpriteAiService, buildPrompt, buildHuggingFacePrompt, buildStagePrompt
 * consumes: Hugging Face ZeroGPU adapter and optional OpenAI Image API fallback
 * state-owned: provider selection/configuration only; generated assets are returned to Creator QA and are not persisted here
 * extension-points: provider=auto|huggingface|openai, pipeline=atlas-v2|identity-skeleton-v3, injected provider adapters for tests
 * online: server is the only authority allowed to hold provider credentials; browser only calls the stable Kelo endpoint
 * do-not: NO provider secret in browser, NO silent paid fallback unless KELO_SPRITE_AI_ALLOW_PAID_FALLBACK=1
 */
'use strict';

const {createHuggingFaceSpriteProvider}=require('./sprite-ai-provider-huggingface');

const DEFAULT_MODEL='gpt-image-2.5-sunburst';
const DEFAULT_SIZE='1024x2048';
const DEFAULT_DIRECTIONS=Object.freeze(['N','NE','E','SE','S','SW','W','NW']);
const V3_STAGES=Object.freeze(new Set(['master','rotations','direction','repair']));
const ALLOWED_IMAGE_TYPES=new Set(['image/png','image/webp','image/jpeg']);

function clampInt(value,min,max,fallback){const n=Math.floor(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function short(value,max=400){return String(value||'').trim().slice(0,max);}
function boolFlag(value){if(value===true)return true;const text=String(value??'').trim().toLowerCase();return text==='1'||text==='true'||text==='yes'||text==='on';}
function serviceError(code,status=500,detail=null){const error=new Error(code);error.code=code;error.status=status;if(detail)error.detail=detail;return error;}
function parseImageDataUrl(value,maxBytes){if(!value)return null;const match=/^data:(image\/(?:png|webp|jpeg));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(value));if(!match)throw serviceError('SPRITE_AI_INVALID_SOURCE_IMAGE',400);const bytes=Buffer.from(match[2].replace(/\s/g,''),'base64');if(!bytes.length)throw serviceError('SPRITE_AI_EMPTY_SOURCE_IMAGE',400);if(bytes.length>maxBytes)throw serviceError('SPRITE_AI_SOURCE_TOO_LARGE',413);if(!ALLOWED_IMAGE_TYPES.has(match[1]))throw serviceError('SPRITE_AI_UNSUPPORTED_SOURCE_IMAGE',415);const ext=match[1]==='image/jpeg'?'jpg':match[1].split('/')[1];return{mime:match[1],bytes,ext};}

function buildPrompt(input={}){
  const action=short(input.action||'walk',24).toLowerCase(),styleHint=short(input.styleHint,300),retryHint=short(input.retryHint,500),characterPrompt=short(input.prompt||input.characterPrompt,600),directions=Array.isArray(input.directions)&&input.directions.length===8?input.directions.map(x=>short(x,4)):DEFAULT_DIRECTIONS;
  return [
    'Create ONE production-ready 2D game character sprite sheet with a transparent background.',characterPrompt?`Character description: ${characterPrompt}`:'',
    'The output MUST be a strict atlas: exactly 4 equal columns by 8 equal rows. No margins, no gutters, no grid lines, no labels, no text, no border, no scenery, no shadow outside each cell.',
    `Rows from top to bottom are exactly: ${directions.join(', ')}.`,`Every row shows the SAME character performing a looping ${action} cycle in exactly four chronological phases: contact, passing, opposite-contact, passing.`,
    'Keep identity, clothing, equipment, silhouette, body proportions, lighting and scale identical across all 32 cells. Only facing direction and animation phase may change.',
    'Center the feet on the same baseline inside every cell. Leave at least 8% transparent safety padding on all four sides of every cell so no sprite touches a cell edge.',
    'Use clean readable game-sprite rendering with crisp separated limbs and strong silhouette. Do not merge neighboring cells.',styleHint?`Art direction: ${styleHint}`:'Art direction: premium dark-fantasy MMORPG character, readable at small size, restrained gold accents.',retryHint?`Previous QA failed. Correct these exact issues: ${retryHint}`:'','Return only the sprite sheet image.'
  ].filter(Boolean).join('\n');
}

function buildHuggingFacePrompt(input={}){
  const action=short(input.action||'walk',24).toLowerCase(),styleHint=short(input.styleHint,300),retryHint=short(input.retryHint,500),characterPrompt=short(input.prompt||input.characterPrompt,600);
  return [characterPrompt?`Character description: ${characterPrompt}`:'Create a premium dark-fantasy MMORPG character with a clean readable silhouette and restrained gold accents.',`Animation: looping ${action}.`,styleHint?`Art direction: ${styleHint}`:'','Keep one identical character identity, clothing, equipment, proportions, palette and lighting across every generated view.','Pixel art must remain readable after reduction to a 64x64 game frame. Use transparent background and no scenery, text, labels, borders or cast shadow outside the sprite.',retryHint?`Previous Kelo QA feedback: ${retryHint}`:''].filter(Boolean).join('\n');
}

function buildStagePrompt(input={}){
  const mode=short(input.mode||'master',24).toLowerCase(),direction=short(input.direction,4).toUpperCase(),action=short(input.action||'walk',24).toLowerCase(),base=buildHuggingFacePrompt(input),regions=Array.isArray(input.repairRegions)?input.repairRegions.map(x=>short(x,40)).filter(Boolean):[];
  const rules={
    master:'Create exactly one canonical master character. Preserve a neutral readable stance, full body, centered feet, clear silhouette and enough transparent padding. This image becomes the immutable identity reference for later stages.',
    rotations:'Using the supplied master character as the identity anchor, create directional views while preserving face, hair, clothing, armor, weapon, proportions, palette and scale. Rotation may change orientation only; do not redesign the character.',
    direction:`Generate exactly four chronological ${action} frames for direction ${direction||'S'}: contact, passing, opposite-contact, passing. Keep the head identity and equipment fixed while only the pose changes.`,
    repair:`Repair only the defective region(s): ${regions.join(', ')||'the region described by QA'}. Preserve every healthy pixel conceptually: same identity, clothing, equipment, palette, framing and pose unless QA explicitly requests otherwise.`
  };
  return [base,rules[mode]||rules.master,input.poseTemplate?`Pose/keypoint intent JSON: ${JSON.stringify(input.poseTemplate).slice(0,1800)}`:''].filter(Boolean).join('\n');
}

function createOpenAiProvider(options={}){
  const apiKey=String(options.apiKey??process.env.OPENAI_API_KEY??'').trim();const model=String(options.model??process.env.KELO_SPRITE_AI_MODEL??DEFAULT_MODEL).trim()||DEFAULT_MODEL;const quality=String(options.quality??process.env.KELO_SPRITE_AI_QUALITY??'low').trim()||'low';const size=String(options.size??process.env.KELO_SPRITE_AI_SIZE??DEFAULT_SIZE).trim()||DEFAULT_SIZE;const fetchImpl=options.fetchImpl||globalThis.fetch;const maxSourceBytes=clampInt(options.maxSourceBytes??process.env.KELO_SPRITE_AI_MAX_SOURCE_BYTES,256*1024,12*1024*1024,6*1024*1024);if(typeof fetchImpl!=='function')throw new Error('SPRITE_AI_FETCH_REQUIRED');
  function status(){return Object.freeze({configured:Boolean(apiKey),provider:'openai',model,quality,size,outputFormat:'png',background:'transparent'});}
  async function parseResponse(res){const text=await res.text();let data=null;try{data=text?JSON.parse(text):null;}catch{}if(!res.ok){const upstreamCode=short(data?.error?.code||data?.error?.type||`HTTP_${res.status}`,80);throw serviceError('SPRITE_AI_UPSTREAM_ERROR',res.status===429?429:502,upstreamCode);}const b64=data?.data?.[0]?.b64_json;if(!b64||typeof b64!=='string')throw serviceError('SPRITE_AI_NO_IMAGE_RETURNED',502);return{imageDataUrl:`data:image/png;base64,${b64}`,usage:data?.usage||null};}
  async function generate(input,prompt){if(!apiKey)throw serviceError('SPRITE_AI_OPENAI_NOT_CONFIGURED',503);const source=parseImageDataUrl(input.sourceImageDataUrl||input.targetFrameDataUrl,maxSourceBytes),headers={Authorization:`Bearer ${apiKey}`};let res;if(source){const form=new FormData();form.append('model',model);form.append('prompt',prompt);form.append('size',size);form.append('quality',quality);form.append('background','transparent');form.append('output_format','png');form.append('image[]',new Blob([source.bytes],{type:source.mime}),`source.${source.ext}`);res=await fetchImpl('https://api.openai.com/v1/images/edits',{method:'POST',headers,body:form});}else{res=await fetchImpl('https://api.openai.com/v1/images/generations',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({model,prompt,size,quality,background:'transparent',output_format:'png'})});}const out=await parseResponse(res);return{...out,provider:'openai',model,size,quality,sourceMode:source?'reference-edit':'text-generation'};}
  return Object.freeze({status,generate});
}

function createSpriteAiService(options={}){
  const requested=String(options.provider??process.env.KELO_SPRITE_AI_PROVIDER??'auto').trim().toLowerCase()||'auto';
  const defaultPipeline=String(options.pipeline??process.env.KELO_SPRITE_AI_PIPELINE??'atlas-v2').trim().toLowerCase()||'atlas-v2';
  const maxSourceBytes=clampInt(options.maxSourceBytes??process.env.KELO_SPRITE_AI_MAX_SOURCE_BYTES,256*1024,12*1024*1024,6*1024*1024);const allowPaidFallback=boolFlag(options.allowPaidFallback??process.env.KELO_SPRITE_AI_ALLOW_PAID_FALLBACK??'0');const openai=options.openAiProvider||createOpenAiProvider({...options,maxSourceBytes});const huggingface=options.huggingFaceProvider||createHuggingFaceSpriteProvider(options.huggingFace||{});const hfStatus=huggingface.status(),openaiStatus=openai.status();
  function resolvePrimary(){if(requested==='huggingface'||requested==='hf'||requested==='zerogpu')return huggingface;if(requested==='openai')return openai;if(requested!=='auto')throw serviceError('SPRITE_AI_UNKNOWN_PROVIDER',500,requested);if(hfStatus.configured)return huggingface;if(openaiStatus.configured)return openai;return huggingface;}
  function status(){const primary=resolvePrimary(),primaryStatus=primary.status();return Object.freeze({...primaryStatus,configured:Boolean(primaryStatus.configured),requestedProvider:requested,allowPaidFallback,defaultPipeline,pipelines:Object.freeze(['atlas-v2','identity-skeleton-v3']),v3Stages:Object.freeze([...V3_STAGES]),directions:8,framesPerDirection:4,providers:Object.freeze({huggingface:hfStatus,openai:openaiStatus})});}
  async function generateV2(input,primary){let out;if(primary===huggingface){try{out=await huggingface.generate({prompt:buildHuggingFacePrompt(input),sourceImageDataUrl:input.sourceImageDataUrl||null,seed:input.seed||0,retryHint:input.retryHint||''});}catch(error){if(!(allowPaidFallback&&openaiStatus.configured))throw error;out=await openai.generate(input,buildPrompt(input));out={...out,fallbackFrom:'huggingface-zerogpu'};}}else out=await openai.generate(input,buildPrompt(input));return Object.freeze({ok:true,...out,pipeline:'atlas-v2',layout:{columns:4,rows:8,directions:DEFAULT_DIRECTIONS,framesPerDirection:4},generatedAt:Date.now()});}
  async function generateV3(input,primary){const mode=short(input.mode||'master',24).toLowerCase();if(!V3_STAGES.has(mode))throw serviceError('SPRITE_AI_V3_UNKNOWN_STAGE',400,mode);if(input.sourceImageDataUrl)parseImageDataUrl(input.sourceImageDataUrl,maxSourceBytes);if(input.targetFrameDataUrl)parseImageDataUrl(input.targetFrameDataUrl,maxSourceBytes);const prompt=buildStagePrompt({...input,mode});let out;if(primary===huggingface&&typeof huggingface.generateStage==='function'){try{out=await huggingface.generateStage({...input,mode,prompt});}catch(error){if(!(allowPaidFallback&&openaiStatus.configured))throw error;out=await openai.generate(input,prompt);out={...out,fallbackFrom:'huggingface-zerogpu',stage:mode};}}else{out=await openai.generate(input,prompt);out={...out,stage:mode};}return Object.freeze({ok:true,...out,pipeline:'identity-skeleton-v3',stage:mode,identityLocked:mode!=='master',generatedAt:Date.now()});}
  async function generate(input={}){if(input.sourceImageDataUrl)parseImageDataUrl(input.sourceImageDataUrl,maxSourceBytes);const primary=resolvePrimary(),primaryStatus=primary.status();if(!primaryStatus.configured)throw serviceError('SPRITE_AI_NOT_CONFIGURED',503,requested==='auto'?'Set KELO_SPRITE_AI_HF_SPACE for free ZeroGPU or OPENAI_API_KEY for paid fallback.':requested);const pipeline=String(input.pipeline||defaultPipeline||'atlas-v2').trim().toLowerCase();if(pipeline==='identity-skeleton-v3'||input.mode)return generateV3(input,primary);if(pipeline!=='atlas-v2')throw serviceError('SPRITE_AI_UNKNOWN_PIPELINE',400,pipeline);return generateV2(input,primary);}
  return Object.freeze({version:'kelo-sprite-ai-service-v3',status,generate,buildPrompt,buildHuggingFacePrompt,buildStagePrompt});
}

module.exports={createSpriteAiService,createOpenAiProvider,buildPrompt,buildHuggingFacePrompt,buildStagePrompt,parseImageDataUrl,serviceError,DEFAULT_DIRECTIONS,V3_STAGES};
