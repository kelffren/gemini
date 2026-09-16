/* KELO-INDEX
 * area: BUILD / BOOT QA
 * owner: Kelo Boot Footprint QA
 * keys: OBSERVED BOOT TRANSFER PLAYWRIGHT IPHONE REQUEST RESPONSE CONTENT-LENGTH FIRST PLAYABLE REPEAT STABLE CORE
 * purpose: repeat exact mobile boot observations and separate consistently-preboot resources from boundary timing races
 * public-api: CLI --url --report --runs
 * state-owned: report only
 * online: N/A; CI/build-time measurement
 * do-not: mutate runtime, hard-gate one-run boundary races, count external-provider traffic as deterministic local payload
 */
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from '@playwright/test';

const args=process.argv.slice(2);
const arg=(name,fallback=null)=>{const prefix=`--${name}=`;const token=args.find(value=>value.startsWith(prefix));return token?token.slice(prefix.length):fallback;};
const target=new URL(arg('url','http://127.0.0.1:4173/'));
const reportPath=path.resolve(arg('report','test-results/observed-boot-transfer/report.json'));
const runCount=Math.max(2,Math.min(7,Number(arg('runs','3'))||3));
const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const normalizePath=url=>{const parsed=new URL(url);return decodeURIComponent(parsed.pathname||'/');};
const median=values=>{const sorted=values.slice().sort((a,b)=>a-b);const mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;};

async function observeRun(browser,runIndex){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:IPHONE_UA,serviceWorkers:'block'});
  const page=await context.newPage(),records=[],byRequest=new Map(),externalOrigins=new Set(),pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));
  page.on('request',request=>{let parsed;try{parsed=new URL(request.url());}catch{return;}const record={request,path:normalizePath(request.url()),method:request.method(),resourceType:request.resourceType(),startedAtEpochMs:Date.now(),sameOrigin:parsed.origin===target.origin,response:null,failed:null};records.push(record);byRequest.set(request,record);if(!record.sameOrigin)externalOrigins.add(parsed.origin);});
  page.on('response',response=>{const record=byRequest.get(response.request());if(!record)return;const headers=response.headers(),raw=headers['content-length'],contentLength=raw!=null&&Number.isFinite(Number(raw))?Math.max(0,Number(raw)):null;record.response={status:response.status(),contentLength};});
  page.on('requestfailed',request=>{const record=byRequest.get(request);if(record)record.failed=request.failure()?.errorText||'request-failed';});
  await page.addInitScript(()=>{try{let current=window.__keloBootReady;Object.defineProperty(window,'__keloBootReady',{configurable:true,enumerable:true,get(){return current;},set(value){current=value;if(value===true&&!window.__keloObservedBootReadyEpochMs)window.__keloObservedBootReadyEpochMs=Date.now();}});}catch(_){}});
  try{
    const url=new URL(target.href);url.searchParams.set('guest','1');url.searchParams.set('weightlessObservedBoot','1');url.searchParams.set('weightlessRun',String(runIndex));
    const navigation=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:45000});if(!navigation||navigation.status()>=400)throw new Error(`OBSERVED_BOOT_NAVIGATION_FAILED:${navigation?.status?.()??'no-response'}`);
    await page.waitForFunction(()=>window.__keloBootReady===true&&Number.isFinite(Number(window.__keloObservedBootReadyEpochMs)),null,{timeout:30000});
    const timing=await page.evaluate(()=>({bootReadyEpochMs:Number(window.__keloObservedBootReadyEpochMs),timeOrigin:Number(performance.timeOrigin)})),bootEpoch=timing.bootReadyEpochMs,deadline=Date.now()+3000;
    while(Date.now()<deadline){const pending=records.filter(record=>record.sameOrigin&&record.method==='GET'&&record.startedAtEpochMs<=bootEpoch&&!record.response&&!record.failed);if(!pending.length)break;await page.waitForTimeout(50);}
    const preboot=records.filter(record=>record.sameOrigin&&record.method==='GET'&&record.startedAtEpochMs<=bootEpoch),grouped=new Map();let unknownLocalByteResponses=0,totalPayloadBytes=0;
    for(const record of preboot){const response=record.response,good=!!response&&response.status<400,length=good?response.contentLength:null;if(good&&length==null)unknownLocalByteResponses+=1;const payload=good&&length!=null?Math.round(length):0;totalPayloadBytes+=payload;let item=grouped.get(record.path);if(!item){item={path:record.path,resourceType:record.resourceType,requestCount:0,bytesPerResponse:payload,totalPayloadBytes:0,statuses:[],failedCount:0};grouped.set(record.path,item);}item.requestCount+=1;item.totalPayloadBytes+=payload;if(payload>item.bytesPerResponse)item.bytesPerResponse=payload;if(response)item.statuses.push(response.status);if(record.failed)item.failedCount+=1;}
    const resources=[...grouped.values()].sort((a,b)=>b.totalPayloadBytes-a.totalPayloadBytes||a.path.localeCompare(b.path));
    return{runIndex,bootReadyMs:Math.max(0,bootEpoch-timing.timeOrigin),requestCount:preboot.length,resourceCount:resources.length,totalPayloadBytes,unknownLocalByteResponses,pageErrors,externalOrigins:[...externalOrigins].sort(),resources};
  }finally{await context.close();}
}

const browser=await chromium.launch({headless:true});
try{
  const runs=[];for(let i=1;i<=runCount;i++){const run=await observeRun(browser,i);runs.push(run);console.log(`OBSERVED_BOOT_RUN index=${i} requests=${run.requestCount} resources=${run.resourceCount} payload=${run.totalPayloadBytes} bootReadyMs=${run.bootReadyMs.toFixed(1)} unknown=${run.unknownLocalByteResponses} pageErrors=${run.pageErrors.length}`);}
  const aggregate=new Map(),externalOrigins=new Set();let unknownLocalByteResponses=0;const pageErrors=[];
  for(const run of runs){unknownLocalByteResponses+=run.unknownLocalByteResponses;for(const error of run.pageErrors)pageErrors.push(`run${run.runIndex}:${error}`);for(const origin of run.externalOrigins)externalOrigins.add(origin);for(const item of run.resources){let row=aggregate.get(item.path);if(!row){row={path:item.path,resourceType:item.resourceType,presenceCount:0,requestCount:0,bytesPerResponse:0,totalPayloadBytes:0,statuses:new Set()};aggregate.set(item.path,row);}row.presenceCount+=1;row.requestCount=Math.max(row.requestCount,item.requestCount);row.bytesPerResponse=Math.max(row.bytesPerResponse,item.bytesPerResponse);row.totalPayloadBytes=Math.max(row.totalPayloadBytes,item.totalPayloadBytes);for(const status of item.statuses)row.statuses.add(status);}}
  const resources=[...aggregate.values()].map(row=>({...row,statuses:[...row.statuses].sort((a,b)=>a-b)})).sort((a,b)=>b.totalPayloadBytes-a.totalPayloadBytes||a.path.localeCompare(b.path));
  const stableResources=resources.filter(item=>item.presenceCount===runCount),unstableResources=resources.filter(item=>item.presenceCount!==runCount),stablePayloadBytes=stableResources.reduce((sum,item)=>sum+item.totalPayloadBytes,0),stableRequestCount=stableResources.reduce((sum,item)=>sum+item.requestCount,0);
  const report={schema:'kelo-observed-boot-transfer-v2-stable-core',generatedAt:new Date().toISOString(),url:target.origin+'/',runCount,viewport:{width:390,height:844,deviceScaleFactor:2},userAgent:IPHONE_UA,bootReadyMs:median(runs.map(run=>run.bootReadyMs)),requestCount:Math.round(median(runs.map(run=>run.requestCount))),resourceCount:Math.round(median(runs.map(run=>run.resourceCount))),totalPayloadBytes:Math.round(median(runs.map(run=>run.totalPayloadBytes))),stableRequestCount,stableResourceCount:stableResources.length,stablePayloadBytes,unstableResourceCount:unstableResources.length,unknownLocalByteResponses,pageErrors,externalOrigins:[...externalOrigins].sort(),resources,stableResources,unstableResources,runs};
  fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
  console.log(`OBSERVED_BOOT_TRANSFER_DONE runs=${runCount} stableRequests=${stableRequestCount} stableResources=${stableResources.length} stablePayload=${stablePayloadBytes} unstable=${unstableResources.length} medianPayload=${report.totalPayloadBytes} medianBootReadyMs=${report.bootReadyMs.toFixed(1)}`);
  for(const item of stableResources.slice(0,12))console.log(`OBSERVED_BOOT_STABLE bytes=${item.totalPayloadBytes} requests=${item.requestCount} presence=${item.presenceCount}/${runCount} type=${item.resourceType} path=${item.path}`);
  for(const item of unstableResources.slice(0,12))console.log(`OBSERVED_BOOT_BOUNDARY bytes=${item.totalPayloadBytes} presence=${item.presenceCount}/${runCount} path=${item.path}`);
  if(unknownLocalByteResponses||pageErrors.length)process.exitCode=3;
}finally{await browser.close();}
