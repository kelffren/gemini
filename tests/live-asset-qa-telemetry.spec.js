const { test, expect } = require('@playwright/test');
const fs=require('fs');

test('LIVE asset preview telemetry stays bounded across repeated preview lifecycle',async({page})=>{
 test.setTimeout(180000);fs.mkdirSync('test-results',{recursive:true});
 const errors=[];page.on('pageerror',e=>errors.push(String(e?.stack||e)));
 await page.goto('./?guest=1&assetLiveQA=1',{waitUntil:'commit',timeout:15000});
 await page.waitForFunction(()=>!!(window.KeloGuestPlay?.active?.()&&window.KELO_CREATORS_LAUNCHER),null,{timeout:45000});
 const result=await page.evaluate(async()=>{
   const t=await import('./src/creators/assets/live-asset-telemetry.mjs?v=qa');
   t.clearAssetTelemetry();
   for(let i=0;i<20;i++){t.recordAssetMetric('preview.open',{durationMs:12+i,preview:{entries:1,bytes:120000+i*1000},fps:58});t.recordAssetMetric(i%4===0?'preview.discard':'preview.swap',{durationMs:3,preview:{entries:0,bytes:0},fps:58});}
   return t.assetTelemetrySnapshot();
 });
 expect(result.count).toBeLessThanOrEqual(240);
 expect(result.summary['preview.open'].count).toBe(20);
 expect(result.summary['preview.open'].maxDurationMs).toBeLessThan(100);
 expect(errors).toEqual([]);
 fs.writeFileSync('test-results/live-asset-qa-telemetry.json',JSON.stringify(result,null,2));
});
