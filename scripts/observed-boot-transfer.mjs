/* KELO-INDEX
 * area: BUILD / BOOT QA
 * owner: Kelo Boot Footprint QA
 * keys: OBSERVED BOOT TRANSFER PLAYWRIGHT IPHONE REQUEST RESPONSE CONTENT-LENGTH FIRST PLAYABLE
 * purpose: open exact served bytes in an iPhone-sized browser and record local requests that actually start before boot-ready
 * public-api: CLI --url --report
 * state-owned: report only
 * online: N/A; CI/build-time measurement
 * do-not: mutate runtime, count external-provider traffic as deterministic local payload, infer request from static strings
 */
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from '@playwright/test';

const args=process.argv.slice(2);
const arg=(name,fallback=null)=>{const prefix=`--${name}=`;const token=args.find(value=>value.startsWith(prefix));return token?token.slice(prefix.length):fallback;};
const target=new URL(arg('url','http://127.0.0.1:4173/'));
const reportPath=path.resolve(arg('report','test-results/observed-boot-transfer/report.json'));
const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const normalizePath=url=>{const parsed=new URL(url);return decodeURIComponent(parsed.pathname||'/');};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:IPHONE_UA,serviceWorkers:'block'});
const page=await context.newPage();
const records=[];
const byRequest=new Map();
const externalOrigins=new Set();
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));
page.on('request',request=>{
  let parsed;try{parsed=new URL(request.url());}catch{return;}
  const record={request,url:request.url(),origin:parsed.origin,path:normalizePath(request.url()),method:request.method(),resourceType:request.resourceType(),startedAtEpochMs:Date.now(),sameOrigin:parsed.origin===target.origin,response:null,failed:null};
  records.push(record);byRequest.set(request,record);if(!record.sameOrigin)externalOrigins.add(parsed.origin);
});
page.on('response',response=>{
  const record=byRequest.get(response.request());if(!record)return;
  const headers=response.headers();const raw=headers['content-length'];const contentLength=raw!=null&&Number.isFinite(Number(raw))?Math.max(0,Number(raw)):null;
  record.response={status:response.status(),contentLength,contentType:headers['content-type']||null};
});
page.on('requestfailed',request=>{const record=byRequest.get(request);if(record)record.failed=request.failure()?.errorText||'request-failed';});

await page.addInitScript(()=>{
  try{
    let current=window.__keloBootReady;
    Object.defineProperty(window,'__keloBootReady',{configurable:true,enumerable:true,get(){return current;},set(value){current=value;if(value===true&&!window.__keloObservedBootReadyEpochMs)window.__keloObservedBootReadyEpochMs=Date.now();}});
  }catch(_){ }
});

try{
  const url=new URL(target.href);url.searchParams.set('guest','1');url.searchParams.set('weightlessObservedBoot','1');
  const navigation=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:45000});
  if(!navigation||navigation.status()>=400)throw new Error(`OBSERVED_BOOT_NAVIGATION_FAILED:${navigation?.status?.()??'no-response'}`);
  await page.waitForFunction(()=>window.__keloBootReady===true&&Number.isFinite(Number(window.__keloObservedBootReadyEpochMs)),null,{timeout:30000});
  const timing=await page.evaluate(()=>({bootReadyEpochMs:Number(window.__keloObservedBootReadyEpochMs),timeOrigin:Number(performance.timeOrigin),observedAtEpochMs:Date.now()}));
  const bootEpoch=timing.bootReadyEpochMs;
  const deadline=Date.now()+3000;
  while(Date.now()<deadline){
    const pending=records.filter(record=>record.sameOrigin&&record.method==='GET'&&record.startedAtEpochMs<=bootEpoch&&!record.response&&!record.failed);
    if(!pending.length)break;
    await page.waitForTimeout(50);
  }
  const preboot=records.filter(record=>record.sameOrigin&&record.method==='GET'&&record.startedAtEpochMs<=bootEpoch);
  const grouped=new Map();let unknownLocalByteResponses=0,totalPayloadBytes=0;
  for(const record of preboot){
    const response=record.response;const good=!!response&&response.status<400;const length=good?response.contentLength:null;
    if(good&&length==null)unknownLocalByteResponses+=1;
    const payload=good&&length!=null?Math.round(length):0;totalPayloadBytes+=payload;
    const key=record.path;let item=grouped.get(key);if(!item){item={path:key,resourceType:record.resourceType,requestCount:0,bytesPerResponse:payload,totalPayloadBytes:0,statuses:[],failedCount:0};grouped.set(key,item);}
    item.requestCount+=1;item.totalPayloadBytes+=payload;if(payload>item.bytesPerResponse)item.bytesPerResponse=payload;if(response)item.statuses.push(response.status);if(record.failed)item.failedCount+=1;
  }
  const resources=[...grouped.values()].sort((a,b)=>b.totalPayloadBytes-a.totalPayloadBytes||a.path.localeCompare(b.path));
  const report={schema:'kelo-observed-boot-transfer-v1',generatedAt:new Date().toISOString(),url:target.origin+'/',viewport:{width:390,height:844,deviceScaleFactor:2},userAgent:IPHONE_UA,bootReadyMs:Math.max(0,bootEpoch-timing.timeOrigin),requestCount:preboot.length,resourceCount:resources.length,totalPayloadBytes,unknownLocalByteResponses,pageErrors,externalOrigins:[...externalOrigins].sort(),resources};
  fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
  console.log(`OBSERVED_BOOT_TRANSFER_DONE requests=${report.requestCount} resources=${report.resourceCount} payload=${report.totalPayloadBytes} bootReadyMs=${report.bootReadyMs.toFixed(1)} unknown=${unknownLocalByteResponses} pageErrors=${pageErrors.length}`);
  for(const item of resources.slice(0,12))console.log(`OBSERVED_BOOT_RESOURCE bytes=${item.totalPayloadBytes} requests=${item.requestCount} type=${item.resourceType} path=${item.path}`);
  if(unknownLocalByteResponses||pageErrors.length)process.exitCode=3;
}finally{
  await context.close();await browser.close();
}
