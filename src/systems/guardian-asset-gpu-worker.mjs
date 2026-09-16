/* KELO-INDEX
 * area: GUARDIAN / ASSET COMPUTE
 * owner: KeloGuardian (GPU asset-compute extension)
 * keys: GUARDIAN GPU WEBGPU ASSET PROCEDURAL CANDIDATE QUORUM HASH DONOR
 * purpose: ejecuta presets WebGPU acotados para producir candidatos procedurales de Asset Forge usando GPU donada y valida resultados por hash/quorum
 * public-api: globalThis.KeloGuardianGpuAssets.state/requestProceduralAsset
 * consumes: KeloGuardian WebRTC data plane + WebGPU
 * state-owned: jobs efímeros, consenso de resultados y diagnóstico local; nunca assets publicados
 * online: mensajes P2P son no autoritativos; outputs son candidatos y deben pasar Asset Forge/QA antes de persistir/publicar
 * do-not: NO WGSL remoto; NO eval; NO publicar assets; NO economía/KC; NO gameplay authority; NO segundo loop; NO trabajos en background oculto
 */
const root=globalThis;
if(!root.KeloGuardian)throw new Error('GUARDIAN_REQUIRED');

const VERSION='kelo-guardian-gpu-assets-v1';
const SCHEMA=1;
const MAX_DIM=64;
const MIN_DIM=8;
const MAX_PIXELS=MAX_DIM*MAX_DIM;
const MAX_RESULT_B64=24000;
const JOB_TIMEOUT_MS=7000;
const PRESETS=Object.freeze({
  'material-noise-v1':0,
  'aura-field-v1':1,
  'terrain-speckle-v1':2
});
const pending=new Map();
let devicePromise=null,lastError=null,lastCandidate=null;
const stats={jobsReceived:0,jobsExecuted:0,jobsRejected:0,resultsAccepted:0,resultsRejected:0,candidatesCreated:0,quorumCandidates:0,totalComputeMs:0};

function clamp(n,min,max,fallback){n=Number(n);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function safeId(value,max=80){const s=String(value||'').replace(/[^A-Za-z0-9:_-]/g,'').slice(0,max);return s||null;}
function guardianState(){try{return root.KeloGuardian.state()||{};}catch(_){return{};}}
function eligible(){const s=guardianState(),p=s.preferences||{},g=s.localGpu||{};return !!(s.enabled&&p.allowGpuAssets&&g.webgpu&&document.visibilityState==='visible');}
function normalizeJob(raw){if(!raw||typeof raw!=='object')return null;const preset=String(raw.preset||'');if(!(preset in PRESETS))return null;const jobId=safeId(raw.jobId,80),width=Math.round(clamp(raw.width,MIN_DIM,MAX_DIM,32)),height=Math.round(clamp(raw.height,MIN_DIM,MAX_DIM,32)),seed=(Number(raw.seed)>>>0),epoch=Math.max(0,Math.floor(Number(raw.epoch)||0));if(!jobId||width*height>MAX_PIXELS)return null;return Object.freeze({jobId,preset,width,height,seed,epoch,requestedAt:Number(raw.requestedAt)||Date.now(),deadlineAt:Number(raw.deadlineAt)||Date.now()+JOB_TIMEOUT_MS});}
function toBase64(bytes){let out='';for(let i=0;i<bytes.length;i+=8192){const part=bytes.subarray(i,Math.min(bytes.length,i+8192));out+=String.fromCharCode(...part);}return btoa(out);}
function fromBase64(value){if(typeof value!=='string'||value.length>MAX_RESULT_B64)return null;try{const raw=atob(value),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}catch(_){return null;}}
async function sha256(bytes){const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function gpuDevice(){if(devicePromise)return devicePromise;devicePromise=(async()=>{if(!navigator.gpu)throw new Error('GUARDIAN_WEBGPU_UNAVAILABLE');const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});if(!adapter)throw new Error('GUARDIAN_WEBGPU_ADAPTER_UNAVAILABLE');const device=await adapter.requestDevice();device.lost.then(()=>{devicePromise=null;}).catch(()=>{devicePromise=null;});return device;})();try{return await devicePromise;}catch(error){devicePromise=null;throw error;}}

const WGSL=`
struct Params { width:u32, height:u32, seed:u32, style:u32 };
@group(0) @binding(0) var<storage,read_write> pixels:array<u32>;
@group(0) @binding(1) var<uniform> params:Params;
fn mix(v:u32)->u32{
  var x=v;
  x=(x^61u)^(x>>16u);
  x=x+(x<<3u);
  x=x^(x>>4u);
  x=x*0x27d4eb2du;
  return x^(x>>15u);
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid:vec3<u32>){
  let i=gid.x;
  let count=params.width*params.height;
  if(i>=count){return;}
  let x=i%params.width;
  let y=i/params.width;
  let h=mix(i ^ params.seed ^ (x*374761393u) ^ (y*668265263u));
  var r:u32;
  var g:u32;
  var b:u32;
  if(params.style==1u){
    let cx=abs(f32(x)-f32(params.width-1u)*0.5)/max(1.0,f32(params.width)*0.5);
    let cy=abs(f32(y)-f32(params.height-1u)*0.5)/max(1.0,f32(params.height)*0.5);
    let glow=u32(clamp((1.0-sqrt(cx*cx+cy*cy))*255.0,0.0,255.0));
    r=(h&63u)+glow/3u; g=((h>>8u)&63u)+glow/2u; b=min(255u,120u+glow/2u);
  }else if(params.style==2u){
    let n=h&255u; r=38u+n/5u; g=58u+n/3u; b=34u+n/7u;
  }else{
    let n=h&255u; r=50u+n/2u; g=55u+n/3u; b=62u+n/4u;
  }
  pixels[i]=(min(r,255u))|(min(g,255u)<<8u)|(min(b,255u)<<16u)|(255u<<24u);
}`;

async function executeJob(job){if(!eligible())throw new Error('GUARDIAN_GPU_DONATION_NOT_ELIGIBLE');if(Date.now()>job.deadlineAt)throw new Error('GUARDIAN_GPU_JOB_EXPIRED');const started=performance.now(),device=await gpuDevice(),byteLength=job.width*job.height*4,usage=root.GPUBufferUsage,mapMode=root.GPUMapMode;if(!usage||!mapMode)throw new Error('GUARDIAN_WEBGPU_CONSTANTS_UNAVAILABLE');
  const output=device.createBuffer({size:byteLength,usage:usage.STORAGE|usage.COPY_SRC});
  const readback=device.createBuffer({size:byteLength,usage:usage.COPY_DST|usage.MAP_READ});
  const params=device.createBuffer({size:16,usage:usage.UNIFORM|usage.COPY_DST});
  device.queue.writeBuffer(params,0,new Uint32Array([job.width,job.height,job.seed,PRESETS[job.preset]]));
  const module=device.createShaderModule({code:WGSL});
  const pipeline=device.createComputePipeline({layout:'auto',compute:{module,entryPoint:'main'}});
  const bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:output}},{binding:1,resource:{buffer:params}}]});
  const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil((job.width*job.height)/64));pass.end();encoder.copyBufferToBuffer(output,0,readback,0,byteLength);device.queue.submit([encoder.finish()]);await readback.mapAsync(mapMode.READ);const bytes=new Uint8Array(readback.getMappedRange()).slice();readback.unmap();output.destroy();readback.destroy();params.destroy();const hash=await sha256(bytes),computeMs=Math.max(0,performance.now()-started);stats.jobsExecuted++;stats.totalComputeMs+=computeMs;return Object.freeze({jobId:job.jobId,preset:job.preset,width:job.width,height:job.height,seed:job.seed,epoch:job.epoch,hash,bytesBase64:toBase64(bytes),computeMs:Number(computeMs.toFixed(2))});}

async function validateResult(raw){if(!raw||raw.t!=='guardian:asset_gpu_result'||raw.schema!==SCHEMA)return null;const jobId=safeId(raw.jobId,80),preset=String(raw.preset||''),width=Math.round(Number(raw.width)||0),height=Math.round(Number(raw.height)||0),hash=String(raw.hash||'').toLowerCase();if(!jobId||!(preset in PRESETS)||width<MIN_DIM||height<MIN_DIM||width>MAX_DIM||height>MAX_DIM||!/^[a-f0-9]{64}$/.test(hash))return null;const bytes=fromBase64(raw.bytesBase64);if(!bytes||bytes.byteLength!==width*height*4)return null;const actual=await sha256(bytes);if(actual!==hash)return null;return Object.freeze({jobId,preset,width,height,seed:Number(raw.seed)>>>0,epoch:Math.max(0,Math.floor(Number(raw.epoch)||0)),hash,bytes,computeMs:clamp(raw.computeMs,0,60000,0)});}
function rgbaBlob(bytes,width,height){try{const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(width,height):document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:true});ctx.putImageData(new ImageData(new Uint8ClampedArray(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),width,height),0,0);if(typeof canvas.convertToBlob==='function')return canvas.convertToBlob({type:'image/png'});return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('GUARDIAN_GPU_PNG_ENCODE_FAILED')),'image/png'));}catch(error){return Promise.reject(error);}}
async function finalizeCandidate(record,group,verifiedByQuorum){if(record.done)return;record.done=true;clearTimeout(record.timer);pending.delete(record.job.jobId);const exemplar=group[0],blob=await rgbaBlob(exemplar.bytes,exemplar.width,exemplar.height),candidate=Object.freeze({source:'guardian-gpu-community',preset:exemplar.preset,width:exemplar.width,height:exemplar.height,seed:exemplar.seed,hash:exemplar.hash,pngBlob:blob,contributors:Object.freeze(group.map(row=>row.nodeId)),verifiedByQuorum:!!verifiedByQuorum,quorum:record.quorum,createdAt:Date.now(),publishAuthority:false,requiresAssetForgeQA:true});lastCandidate=candidate;stats.candidatesCreated++;if(verifiedByQuorum)stats.quorumCandidates++;try{root.dispatchEvent(new CustomEvent('kelo:guardian-asset-candidate',{detail:candidate}));}catch(_){}record.resolve(candidate);}
async function acceptResult(nodeId,raw){const validated=await validateResult(raw);if(!validated){stats.resultsRejected++;return false;}const record=pending.get(validated.jobId);if(!record||record.done||validated.epoch!==record.job.epoch||validated.preset!==record.job.preset||validated.width!==record.job.width||validated.height!==record.job.height||validated.seed!==record.job.seed){stats.resultsRejected++;return false;}nodeId=safeId(nodeId,96);if(!nodeId||record.nodes.has(nodeId)){stats.resultsRejected++;return false;}record.nodes.add(nodeId);const row=Object.freeze({...validated,nodeId}),group=record.byHash.get(row.hash)||[];group.push(row);record.byHash.set(row.hash,group);stats.resultsAccepted++;if(group.length>=record.quorum)await finalizeCandidate(record,group,true);return true;}
function timeoutRecord(record){if(record.done)return;let best=[];for(const group of record.byHash.values())if(group.length>best.length)best=group;if(best.length){finalizeCandidate(record,best,false).catch(error=>record.reject(error));return;}record.done=true;pending.delete(record.job.jobId);record.reject(new Error('GUARDIAN_GPU_NO_RESULT'));}

async function onGuardianData(event){const detail=event?.detail||{},msg=detail.payload||{},from=String(detail.fromNodeId||''),s=guardianState();if(msg.t==='guardian:asset_gpu_job'){
    if(s.masterActive||!eligible())return;const master=s.master||{};if(!master.nodeId||from!==String(master.nodeId)||Number(msg.epoch)!==Number(master.epoch)){stats.jobsRejected++;return;}const job=normalizeJob(msg);if(!job||Date.now()>job.deadlineAt){stats.jobsRejected++;return;}stats.jobsReceived++;try{const result=await executeJob(job);root.KeloGuardian.sendToMaster({t:'guardian:asset_gpu_result',schema:SCHEMA,...result});}catch(error){lastError=String(error&&error.message||error);stats.jobsRejected++;}return;
  }
  if(msg.t==='guardian:asset_gpu_result'&&s.masterActive){acceptResult(from,msg).catch(error=>{lastError=String(error&&error.message||error);stats.resultsRejected++;});}
}

async function requestProceduralAsset(options={}){const s=guardianState();if(!s.masterActive)throw new Error('GUARDIAN_GPU_MASTER_REQUIRED');const width=Math.round(clamp(options.width,MIN_DIM,MAX_DIM,32)),height=Math.round(clamp(options.height,MIN_DIM,MAX_DIM,32)),preset=String(options.preset||'material-noise-v1');if(!(preset in PRESETS))throw new Error('GUARDIAN_GPU_PRESET_INVALID');const epoch=Math.max(1,Math.floor(Number(s.master?.epoch||s.masterEpoch||0))),job=normalizeJob({jobId:'ga_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),preset,width,height,seed:Number.isFinite(Number(options.seed))?Number(options.seed):Math.floor(Math.random()*0xffffffff),epoch,requestedAt:Date.now(),deadlineAt:Date.now()+JOB_TIMEOUT_MS});if(!job)throw new Error('GUARDIAN_GPU_JOB_INVALID');const advertised=Math.max(0,Math.floor(Number(s.network?.gpuAssetDonors)||0)),localEligible=eligible(),quorum=Math.max(1,Math.min(2,advertised|| (localEligible?1:0)));
  return new Promise((resolve,reject)=>{const record={job,quorum,byHash:new Map(),nodes:new Set(),resolve,reject,done:false,timer:null};record.timer=setTimeout(()=>timeoutRecord(record),JOB_TIMEOUT_MS);pending.set(job.jobId,record);const sent=root.KeloGuardian.broadcast({t:'guardian:asset_gpu_job',schema:SCHEMA,...job});if(localEligible)executeJob(job).then(result=>acceptResult(s.nodeId||'local-master',{t:'guardian:asset_gpu_result',schema:SCHEMA,...result})).catch(error=>{lastError=String(error&&error.message||error);});if(sent===0&&!localEligible){clearTimeout(record.timer);pending.delete(job.jobId);record.done=true;reject(new Error('GUARDIAN_GPU_NO_DONORS_CONNECTED'));}});
}
function state(){const s=guardianState();return Object.freeze({version:VERSION,eligible:eligible(),masterActive:!!s.masterActive,activeJobs:pending.size,lastError,lastCandidate:lastCandidate?Object.freeze({hash:lastCandidate.hash,preset:lastCandidate.preset,contributors:lastCandidate.contributors.length,verifiedByQuorum:lastCandidate.verifiedByQuorum,createdAt:lastCandidate.createdAt}):null,stats:Object.freeze({...stats}),safePresets:Object.freeze(Object.keys(PRESETS)),arbitraryShaderAllowed:false,publishAuthority:false});}

root.addEventListener('kelo:guardian-data',onGuardianData,{passive:true});
root.KeloGuardianGpuAssets=Object.freeze({version:VERSION,state,requestProceduralAsset,presets:Object.freeze(Object.keys(PRESETS))});
root.KELO_GUARDIAN_GPU_ASSETS_AUDIT=Object.freeze({version:VERSION,owner:'KeloGuardian',webgpu:true,optInRequired:true,safePresetOnly:true,arbitraryShaderAllowed:false,sha256Validation:true,quorumUpTo:2,publishAuthority:false,gameplayAuthority:false,secondLoop:false});
try{root.dispatchEvent(new CustomEvent('kelo:guardian-gpu-ready',{detail:state()}));}catch(_){}
