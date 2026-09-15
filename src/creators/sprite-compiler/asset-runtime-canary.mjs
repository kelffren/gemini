/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / RUNTIME VERIFICATION
 * purpose: gate asset releases on measured decode/upload/render behavior from real runtime samples
 * public-api: normalizeRuntimeSample(), evaluateRuntimeCanary()
 */
const F=Object.freeze;
const finite=(value,fallback=null)=>Number.isFinite(Number(value))?Number(value):fallback;
const percentile=(values,q)=>{const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!sorted.length)return null;const index=Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*q)-1));return sorted[index];};
export function normalizeRuntimeSample(raw={}){return F({deviceClass:String(raw.deviceClass||'unknown'),platform:String(raw.platform||'unknown'),renderer:String(raw.renderer||'unknown'),api:String(raw.api||'unknown'),decodeMs:finite(raw.decodeMs),uploadMs:finite(raw.uploadMs),firstRenderMs:finite(raw.firstRenderMs),peakMemoryMiB:finite(raw.peakMemoryMiB),textureUploadOk:raw.textureUploadOk===true,renderOk:raw.renderOk===true,contextLost:raw.contextLost===true,errorCode:raw.errorCode?String(raw.errorCode):null});}
export function evaluateRuntimeCanary(samples,{minimumSamples=5,budgets={},requiredDeviceClasses=[]}={}){
 const normalized=F((samples||[]).map(normalizeRuntimeSample)),reasons=[];if(normalized.length<minimumSamples)reasons.push('CANARY_INSUFFICIENT_SAMPLES');
 for(const deviceClass of requiredDeviceClasses||[])if(!normalized.some(sample=>sample.deviceClass===deviceClass))reasons.push(`CANARY_MISSING_DEVICE_CLASS:${deviceClass}`);
 const failures=normalized.filter(sample=>!sample.textureUploadOk||!sample.renderOk||sample.contextLost||sample.errorCode);if(failures.length)reasons.push('CANARY_RUNTIME_FAILURE');
 const metrics=F({decodeP95Ms:percentile(normalized.map(x=>x.decodeMs),.95),uploadP95Ms:percentile(normalized.map(x=>x.uploadMs),.95),firstRenderP95Ms:percentile(normalized.map(x=>x.firstRenderMs),.95),peakMemoryP95MiB:percentile(normalized.map(x=>x.peakMemoryMiB),.95),failureRate:normalized.length?failures.length/normalized.length:1});
 const checks=[['decodeP95Ms','maxDecodeP95Ms'],['uploadP95Ms','maxUploadP95Ms'],['firstRenderP95Ms','maxFirstRenderP95Ms'],['peakMemoryP95MiB','maxPeakMemoryP95MiB']];for(const [metric,budget] of checks){const limit=finite(budgets?.[budget]);if(limit!==null&&metrics[metric]!==null&&metrics[metric]>limit)reasons.push(`CANARY_BUDGET_EXCEEDED:${metric}`);}
 const unique=F([...new Set(reasons)]),status=unique.length?'BLOCKED':'PASSED';return F({schema:'kelo-runtime-canary-v1',status,pass:status==='PASSED',sampleCount:normalized.length,requiredDeviceClasses:F([...(requiredDeviceClasses||[])]),budgets:F({...budgets}),metrics,failures:F(failures),reasons:unique,samples:normalized});
}
