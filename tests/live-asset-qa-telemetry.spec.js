/* KELO-INDEX
 * area: TEST / ASSET LIBRARY / LIVE QA
 * owner: Asset Intelligence acceptance
 * purpose: exercise the deployed external search + real remote preview lifecycle and assert bounded resources.
 */
const { test, expect } = require('@playwright/test');
const fs=require('fs');

const BASE=process.env.KELO_PAGES_URL||'./';

test('LIVE Asset Library: real tree search and remote previews stay bounded',async({page})=>{
 test.setTimeout(180000);fs.mkdirSync('test-results',{recursive:true});
 const errors=[];page.on('pageerror',e=>errors.push(String(e?.stack||e)));
 await page.goto(new URL('?guest=1&assetLiveQA=1',BASE).href,{waitUntil:'commit',timeout:30000});
 await page.waitForFunction(()=>!!window.KeloGuestPlay?.active?.(),null,{timeout:45000});

 const result=await page.evaluate(async()=>{
   const telemetry=await import('./src/creators/assets/live-asset-telemetry.mjs?v=live-e2e');
   const providers=await import('./src/creators/assets/external-asset-providers.mjs?v=live-e2e');
   const studioMod=await import('./src/studio/studio-entry.mjs?v=live-e2e');
   telemetry.clearAssetTelemetry();

   const searched=await providers.searchExternalAssets('tree',{includeLazy:true,limit:60});
   const candidates=searched.assets.filter(a=>a.previewUrl&&a.supportsRemotePreview!==false&&a.supportsCORS!==false).slice(0,8);
   if(!candidates.length)return{searched:searched.assets.length,candidates:0,reason:'NO_PREVIEWABLE_TREE'};

   let studio=studioMod.getKeloStudioSession?.();
   if(!studio?.kernel)studio=await studioMod.bootKeloStudio({root:window});
   const service=studio.assetPreview;
   const samples=[];
   for(let i=0;i<Math.min(8,candidates.length);i++){
     const asset=candidates[i],id=`qa-live:${i}:${asset.id}`;
     const started=performance.now();
     try{
       await service.registerRemotePreview(id,{url:asset.previewUrl,width:96,height:96,label:asset.name,category:asset.category});
       samples.push({ok:true,id:asset.id,ms:Math.round(performance.now()-started),stats:service.remoteStats()});
     }catch(error){
       samples.push({ok:false,id:asset.id,ms:Math.round(performance.now()-started),error:String(error?.message||error),stats:service.remoteStats()});
     }
     if(i>0)service.unregisterRemotePreview(`qa-live:${i-1}:${candidates[i-1].id}`);
   }
   for(let i=0;i<candidates.length;i++)service.unregisterRemotePreview(`qa-live:${i}:${candidates[i].id}`);
   return{searched:searched.assets.length,candidates:candidates.length,samples,finalStats:service.remoteStats(),telemetry:telemetry.assetTelemetrySnapshot(),top:candidates.slice(0,3).map(a=>({id:a.id,provider:a.provider,score:a.finalScore}))};
 });
 console.log('ASSET_LIVE_REAL_QA',JSON.stringify(result,null,2));
 expect(result.searched).toBeGreaterThan(0);
 expect(result.candidates).toBeGreaterThan(0);
 expect(result.samples.some(x=>x.ok)).toBeTruthy();
 expect(result.samples.every(x=>Number(x.stats?.entries||0)<=3)).toBeTruthy();
 expect(Number(result.finalStats?.entries||0)).toBe(0);
 expect(Number(result.finalStats?.bytes||0)).toBe(0);
 expect(errors).toEqual([]);
 fs.writeFileSync('test-results/live-asset-real-qa.json',JSON.stringify({result,errors},null,2));
});
