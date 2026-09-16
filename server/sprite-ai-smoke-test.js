/* KELO-INDEX
 * area: SERVER / SPRITE AI TEST
 * owner: Kelo Sprite AI deterministic smoke coverage
 * purpose: verify ZeroGPU-first selection, V3 staged contract, OpenAI compatibility, auth/CORS/rate limits and explicit paid fallback policy
 * online: exercises the same /api/sprite-generate authority boundary used by the Creator UI
 */
'use strict';
const assert=require('assert');
const http=require('http');
const {createSpriteAiService,createOpenAiProvider,buildPrompt,buildHuggingFacePrompt,buildStagePrompt}=require('./sprite-ai-service');
const {createHuggingFaceSpriteProvider}=require('./sprite-ai-provider-huggingface');
const {createSpriteAiHttpHandler}=require('./sprite-ai-http');

(async()=>{
  const png=Buffer.from('89504e470d0a1a0a','hex').toString('base64'),dataUrl=`data:image/png;base64,${png}`;
  assert(buildPrompt({}).includes('exactly 4 equal columns by 8 equal rows'));
  assert(buildHuggingFacePrompt({action:'walk'}).includes('Animation: looping walk.'));
  assert(buildStagePrompt({mode:'direction',direction:'NE',action:'walk'}).includes('direction NE'));

  const hfCalls=[];
  const hf=createHuggingFaceSpriteProvider({space:'kelo/free-sprite-ai',token:'hf-test',connectImpl:async(space,options)=>({predict:async(apiName,payload)=>{hfCalls.push({space,options,apiName,payload});return{data:[dataUrl,null,JSON.stringify({ok:true})]};}})});
  const disabledOpenAi={status:()=>({configured:false,provider:'openai',model:'none'}),generate:async()=>{throw new Error('PAID_PROVIDER_MUST_NOT_RUN');}};
  const service=createSpriteAiService({provider:'auto',huggingFaceProvider:hf,openAiProvider:disabledOpenAi,maxSourceBytes:1024*1024});
  assert.equal(service.status().provider,'huggingface-zerogpu');
  assert.equal(service.status().allowPaidFallback,false);
  assert(service.status().pipelines.includes('identity-skeleton-v3'));
  const hfOut=await service.generate({action:'walk',seed:17,prompt:'teal coat warrior'});
  assert.equal(hfOut.provider,'huggingface-zerogpu');assert.equal(hfOut.layout.rows,8);assert.equal(hfOut.pipeline,'atlas-v2');assert.equal(hfCalls.length,1);assert.equal(hfCalls[0].apiName,'/generate');assert.equal(hfCalls[0].payload[2],17);assert(hfCalls[0].payload[0].includes('teal coat warrior'));

  const v3Out=await service.generate({pipeline:'identity-skeleton-v3',mode:'direction',direction:'NE',action:'walk',seed:23,prompt:'teal coat warrior',poseTemplate:{phase:'contact'}});
  assert.equal(v3Out.pipeline,'identity-skeleton-v3');assert.equal(v3Out.stage,'direction');assert.equal(v3Out.identityLocked,true);assert.equal(hfCalls.length,2);assert.equal(hfCalls[1].apiName,'/generate_v3');assert.equal(hfCalls[1].payload[0],'direction');assert.equal(hfCalls[1].payload[3],23);assert.equal(hfCalls[1].payload[5],'NE');assert.equal(hfCalls[1].payload[6],'walk');
  await assert.rejects(()=>service.generate({pipeline:'identity-skeleton-v3',mode:'magic'}),error=>error.code==='SPRITE_AI_V3_UNKNOWN_STAGE');

  const openAiCalls=[];
  const fakeFetch=async(url,options)=>{openAiCalls.push({url,options});return new Response(JSON.stringify({data:[{b64_json:png}],usage:{total_tokens:1}}),{status:200,headers:{'content-type':'application/json'}});};
  const openai=createOpenAiProvider({apiKey:'test-key',model:'gpt-image-test',quality:'low',size:'1024x2048',fetchImpl:fakeFetch,maxSourceBytes:1024*1024});
  const openAiService=createSpriteAiService({provider:'openai',openAiProvider:openai,huggingFaceProvider:{status:()=>({configured:false,provider:'huggingface-zerogpu'}),generate:async()=>{throw new Error('HF_MUST_NOT_RUN');}},maxSourceBytes:1024*1024});
  const textOut=await openAiService.generate({action:'walk'});assert(textOut.imageDataUrl.startsWith('data:image/png;base64,'));assert.equal(openAiCalls[0].url,'https://api.openai.com/v1/images/generations');
  const src='data:image/png;base64,'+Buffer.from('fakepng').toString('base64');await openAiService.generate({sourceImageDataUrl:src});assert.equal(openAiCalls[1].url,'https://api.openai.com/v1/images/edits');assert(openAiCalls[1].options.body instanceof FormData);

  const failingHf={status:()=>({configured:true,provider:'huggingface-zerogpu',space:'test'}),generate:async()=>{const error=new Error('quota');error.code='SPRITE_AI_HF_UPSTREAM_ERROR';error.status=502;throw error;},generateStage:async()=>{const error=new Error('quota');error.code='SPRITE_AI_HF_UPSTREAM_ERROR';error.status=502;throw error;}};
  const paidTrap={status:()=>({configured:true,provider:'openai',model:'paid'}),generate:async()=>{throw new Error('PAID_FALLBACK_RAN');}};
  const noPaidFallback=createSpriteAiService({provider:'auto',huggingFaceProvider:failingHf,openAiProvider:paidTrap});
  await assert.rejects(()=>noPaidFallback.generate({}),error=>error.code==='SPRITE_AI_HF_UPSTREAM_ERROR');
  await assert.rejects(()=>noPaidFallback.generate({pipeline:'identity-skeleton-v3',mode:'master'}),error=>error.code==='SPRITE_AI_HF_UPSTREAM_ERROR');
  let paidFallbackCalls=0;
  const paidAllowed={status:()=>({configured:true,provider:'openai',model:'paid'}),generate:async()=>{paidFallbackCalls++;return{imageDataUrl:dataUrl,provider:'openai',model:'paid',sourceMode:'text-generation'};}};
  const explicitPaidFallback=createSpriteAiService({provider:'auto',allowPaidFallback:true,huggingFaceProvider:failingHf,openAiProvider:paidAllowed});
  const fallbackOut=await explicitPaidFallback.generate({action:'walk'});assert.equal(paidFallbackCalls,1);assert.equal(fallbackOut.provider,'openai');assert.equal(fallbackOut.fallbackFrom,'huggingface-zerogpu');assert.equal(explicitPaidFallback.status().allowPaidFallback,true);

  const identity={verifyAccessToken:async token=>token==='good'?{id:'user-1',isAnonymous:false}:token==='guest'?{id:'guest-1',isAnonymous:true}:Promise.reject(Object.assign(new Error('INVALID_AUTH_USER'),{code:'INVALID_AUTH_USER',status:401}))};
  const handler=createSpriteAiHttpHandler({service,identity,allowedOrigins:'https://example.test',rateLimit:3,maxBodyBytes:1024*1024});
  const server=http.createServer((req,res)=>{handler(req,res).then(handled=>{if(!handled){res.writeHead(404);res.end();}});});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  try{
    let r=await fetch(base+'/api/sprite-generate/status',{headers:{Origin:'https://example.test'}});assert.equal(r.status,200);let j=await r.json();assert.equal(j.configured,true);assert.equal(j.provider,'huggingface-zerogpu');assert(j.pipelines.includes('identity-skeleton-v3'));assert.equal(r.headers.get('access-control-allow-origin'),'https://example.test');
    r=await fetch(base+'/api/sprite-generate',{method:'POST',headers:{Origin:'https://example.test','content-type':'application/json'},body:'{}'});assert.equal(r.status,401);
    r=await fetch(base+'/api/sprite-generate',{method:'POST',headers:{Origin:'https://example.test',Authorization:'Bearer guest','content-type':'application/json'},body:'{}'});assert.equal(r.status,403);
    r=await fetch(base+'/api/sprite-generate',{method:'POST',headers:{Origin:'https://example.test',Authorization:'Bearer good','content-type':'application/json'},body:JSON.stringify({action:'walk'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.ok,true);assert.equal(j.rateLimit.remaining,2);
    r=await fetch(base+'/api/sprite-generate',{method:'POST',headers:{Origin:'https://example.test',Authorization:'Bearer good','content-type':'application/json'},body:JSON.stringify({pipeline:'identity-skeleton-v3',mode:'master',prompt:'test hero'})});assert.equal(r.status,200);j=await r.json();assert.equal(j.pipeline,'identity-skeleton-v3');assert.equal(j.stage,'master');
    r=await fetch(base+'/api/sprite-generate',{method:'POST',headers:{Origin:'https://example.test',Authorization:'Bearer good','content-type':'application/json'},body:'{}'});assert.equal(r.status,200);
    r=await fetch(base+'/api/sprite-generate',{method:'POST',headers:{Origin:'https://example.test',Authorization:'Bearer good','content-type':'application/json'},body:'{}'});assert.equal(r.status,429);
    r=await fetch(base+'/api/sprite-generate/status',{headers:{Origin:'https://evil.test'}});assert.equal(r.status,403);
  }finally{await new Promise(r=>server.close(r));}
  console.log('Sprite AI smoke passed: ZeroGPU-first + V3 staged contract + OpenAI compatibility + explicit paid fallback + auth/CORS/rate limit');
})().catch(error=>{console.error(error);process.exit(1);});
