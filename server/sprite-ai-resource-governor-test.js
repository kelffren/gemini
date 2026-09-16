'use strict';
const assert=require('assert');
const {createSpriteAiResourceGovernor,estimateGpuSeconds,requestKey}=require('./sprite-ai-resource-governor');

(async()=>{
  assert.equal(estimateGpuSeconds({pipeline:'identity-skeleton-v3',mode:'direction',realSkeleton:true}),26);
  assert.equal(requestKey('u1',{a:1,b:2}),requestKey('u1',{b:2,a:1}));
  assert.notEqual(requestKey('u1',{a:1}),requestKey('u2',{a:1}));

  const governor=createSpriteAiResourceGovernor({ttlMs:60000,maxEntries:8,maxBytes:1024*1024,softQuotaSeconds:270,enforceSoftQuota:false});
  let calls=0;
  const input={pipeline:'identity-skeleton-v3',mode:'direction',realSkeleton:true,direction:'S',seed:7,sourceImageDataUrl:'data:image/png;base64,QUJD'};
  const execute=async()=>{calls++;await new Promise(r=>setTimeout(r,20));return{ok:true,imageDataUrl:'data:image/png;base64,QUJDRA==',provider:'test'};};

  const first=await governor.run({userId:'u1',input,execute});
  assert.equal(calls,1);assert.equal(first.resourceGovernor.mode,'gpu-call');
  const cached=await governor.run({userId:'u1',input,execute});
  assert.equal(calls,1);assert.equal(cached.resourceGovernor.mode,'cache-hit');

  const otherUser=await governor.run({userId:'u2',input,execute});
  assert.equal(calls,2);assert.equal(otherUser.resourceGovernor.mode,'gpu-call');

  const input2={...input,direction:'N'};
  const p1=governor.run({userId:'u1',input:input2,execute});
  const p2=governor.run({userId:'u1',input:input2,execute});
  const [a,b]=await Promise.all([p1,p2]);
  assert.equal(calls,3);assert(['gpu-call','inflight-dedup'].includes(a.resourceGovernor.mode));assert(['gpu-call','inflight-dedup'].includes(b.resourceGovernor.mode));

  const forced=await governor.run({userId:'u1',input:{...input,forceRegenerate:true},execute});
  assert.equal(calls,4);assert.equal(forced.resourceGovernor.mode,'gpu-call');

  const strict=createSpriteAiResourceGovernor({softQuotaSeconds:60,enforceSoftQuota:true});
  let strictCalls=0;
  const heavy={pipeline:'atlas-v2'};
  await strict.run({userId:'strict',input:heavy,execute:async()=>{strictCalls++;return{ok:true,imageDataUrl:'data:image/png;base64,QQ=='};}});
  await assert.rejects(()=>strict.run({userId:'strict',input:{...heavy,seed:2},execute:async()=>{strictCalls++;return{ok:true,imageDataUrl:'data:image/png;base64,Qg=='};}}),error=>error.code==='SPRITE_AI_SOFT_QUOTA_GUARD');
  assert.equal(strictCalls,1);

  console.log('Sprite AI resource governor passed: cache + inflight dedupe + user isolation + soft quota guard');
})().catch(error=>{console.error(error);process.exit(1);});
