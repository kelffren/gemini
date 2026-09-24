/* KELO-INDEX
 * area: CREATORS / LIVE ASSET TELEMETRY
 * keys: SEARCH PREVIEW KEEP DISCARD SWAP FPS MEMORY BANDWIDTH FAILURES
 * purpose: bounded local metrics for mobile Asset Library QA; no network export.
 */
const KEY='kelo.asset.live-telemetry.v1',MAX=240;
const now=()=>globalThis.performance?.now?.()??Date.now();
const wall=()=>Date.now();
function store(){try{return globalThis.localStorage||null}catch{return null}}
function read(){try{const x=JSON.parse(store()?.getItem(KEY)||'null');return x&&Array.isArray(x.events)?x:{version:1,events:[]}}catch{return{version:1,events:[]}}}
function write(x){try{store()?.setItem(KEY,JSON.stringify(x))}catch{}}
function memory(){const m=globalThis.performance?.memory;return m?{usedJSHeapSize:m.usedJSHeapSize,totalJSHeapSize:m.totalJSHeapSize,jsHeapSizeLimit:m.jsHeapSizeLimit}:null}
export function recordAssetMetric(type,data={}){const x=read();x.events.push({type:String(type),at:wall(),t:now(),memory:memory(),...data});if(x.events.length>MAX)x.events.splice(0,x.events.length-MAX);write(x);try{globalThis.dispatchEvent?.(new CustomEvent('kelo:asset-metric',{detail:x.events.at(-1)}))}catch{}return x.events.at(-1)}
export function beginAssetMetric(type,data={}){const start=now();return extra=>recordAssetMetric(type,{...data,...extra,durationMs:Math.max(0,Math.round((now()-start)*10)/10)})}
export function assetTelemetrySnapshot(){const events=read().events,byType={};for(const e of events)(byType[e.type]||(byType[e.type]=[])).push(e);const avg=rows=>rows.length?Math.round(rows.reduce((n,x)=>n+Number(x.durationMs||0),0)/rows.length*10)/10:0;return{version:1,count:events.length,events:events.slice(),summary:Object.fromEntries(Object.entries(byType).map(([k,v])=>[k,{count:v.length,avgDurationMs:avg(v),maxDurationMs:Math.max(0,...v.map(x=>Number(x.durationMs||0)))}]))};}
export function clearAssetTelemetry(){write({version:1,events:[]})}
export function sampleAssetPreviewRuntime({previewService=null}={}){const perf=globalThis.KELO_PERF?.getSnapshot?.()||null;return{fps:Number(perf?.fps)||null,preview:previewService?.remoteStats?.()||null,memory:memory()};}
export const KELO_ASSET_LIVE_TELEMETRY=Object.freeze({version:'1.0.0',record:recordAssetMetric,begin:beginAssetMetric,snapshot:assetTelemetrySnapshot,clear:clearAssetTelemetry,sample:sampleAssetPreviewRuntime});
if(typeof window!=='undefined')window.KELO_ASSET_LIVE_TELEMETRY=KELO_ASSET_LIVE_TELEMETRY;
