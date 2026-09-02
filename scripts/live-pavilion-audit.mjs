import fs from 'node:fs';
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedRegistry=process.env.EXPECTED_REGISTRY||'1.10.7';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});
let loaded=false;
for(let attempt=1;attempt<=24;attempt++){
  try{
    await page.goto(`${base}?architecture-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    const s=await page.evaluate(()=>({p:window.KELO_MARKET_PAVILION||null,luxe:window.KELO_LUXE_KIOSK||null,architecture:window.KELO_ARCHITECTURE_RENDERER||null,world:window.KELO_WORLD_AUDIT||null,registry:window.KELO_TILE_REGISTRY||null,arcade:window.KELO_ARCHITECTURE_RENDERER?.getEntry?.('commerceArcade')||null}));
    if(s.world?.ready&&s.registry?.version===expectedRegistry&&s.registry?.styles?.architecture?.prefabContract==='registry-asset-placement-collision-v1'&&s.registry?.architectureAssets?.marketPavilion&&s.registry?.architecturePrefabs?.marketPavilion&&s.registry?.architectureAssets?.luxeBoutique&&s.registry?.architecturePrefabs?.luxeBoutique&&s.registry?.architectureAssets?.commerceArcade&&s.registry?.architecturePrefabs?.commerceArcade&&s.architecture?.prefabCount>=3&&s.p?.ready&&s.p?.source==='tile-registry-architecture-prefab'&&s.p?.rendererWrapped&&s.p?.depthWrapped&&s.p?.legacyHidden&&!s.p?.failed&&s.luxe?.ready&&s.luxe?.source==='tile-registry-architecture-prefab'&&s.luxe?.rendererWrapped&&s.luxe?.depthWrapped&&!s.luxe?.failed&&s.arcade?.ready&&s.arcade?.legacyHidden&&!s.arcade?.failed){loaded=true;break}
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?architecture-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(3500);
const pavilion=await page.evaluate(()=>{
  if(typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  const c=document.getElementById('game-canvas');if(!c)return null;
  localPlayer.x=1400;localPlayer.y=1860;camera.x=1400;camera.y=1870;camera.targetX=1400;camera.targetY=1870;render();
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let stone=0,roof=0,gold=0,glass=0;
  for(let i=0;i<px.length;i+=4){const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];if(a<200)continue;if((r===225&&g===214&&b===184)||(r===241&&g===232&&b===205))stone++;if((r===45&&g===84&&b===78)||(r===61&&g===111&&b===100))roof++;if(r===210&&g===165&&b===72)gold++;if((r===90&&g===176&&b===178)||(r===151&&g===220&&b===210))glass++;}
  return{dataUrl:c.toDataURL('image/png'),occluding:!!window.KELO_MARKET_PAVILION?.isOccluding?.(localPlayer),state:window.KELO_MARKET_PAVILION||null,registryVersion:window.KELO_TILE_REGISTRY?.version||null,prefab:window.KELO_TILE_REGISTRY?.architecturePrefabs?.marketPavilion||null,asset:window.KELO_TILE_REGISTRY?.architectureAssets?.marketPavilion||null,stone,roof,gold,glass};
});
if(pavilion?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-market-pavilion.png',Buffer.from(pavilion.dataUrl.split(',')[1],'base64'));
const luxe=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1440;localPlayer.y=1340;camera.x=1440;camera.y=1320;camera.targetX=1440;camera.targetY=1320;render();
  return{dataUrl:c.toDataURL('image/png'),occluding:!!window.KELO_LUXE_KIOSK?.isOccluding?.(localPlayer),state:window.KELO_LUXE_KIOSK||null,prefab:window.KELO_TILE_REGISTRY?.architecturePrefabs?.luxeBoutique||null,asset:window.KELO_TILE_REGISTRY?.architectureAssets?.luxeBoutique||null};
});
if(luxe?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-luxe-prefab.png',Buffer.from(luxe.dataUrl.split(',')[1],'base64'));
const arcade=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1580;localPlayer.y=1580;camera.x=1580;camera.y=1600;camera.targetX=1580;camera.targetY=1600;render();
  const entry=window.KELO_ARCHITECTURE_RENDERER?.getEntry?.('commerceArcade')||null;
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let roof=0,ivory=0,glass=0,gold=0;
  for(let i=0;i<px.length;i+=4){const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];if(a<200)continue;if((r===47&&g===108&&b===93)||(r===37&&g===89&&b===79))roof++;if((r===240&&g===232&&b===207)||(r===215&&g===205&&b===176))ivory++;if((r===143&&g===200&&b===199)||(r===75&&g===135&&b===144))glass++;if(r===210&&g===165&&b===72)gold++;}
  return{dataUrl:c.toDataURL('image/png'),entry,occluding:!!entry?.isOccluding?.(localPlayer),registryVersion:window.KELO_TILE_REGISTRY?.version||null,prefab:window.KELO_TILE_REGISTRY?.architecturePrefabs?.commerceArcade||null,asset:window.KELO_TILE_REGISTRY?.architectureAssets?.commerceArcade||null,renderer:window.KELO_ARCHITECTURE_RENDERER||null,roof,ivory,glass,gold};
});
if(arcade?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-commerce-arcade.png',Buffer.from(arcade.dataUrl.split(',')[1],'base64'));
const report={loaded,expectedRegistry,pavilion:pavilion?{occluding:pavilion.occluding,state:pavilion.state,registryVersion:pavilion.registryVersion,prefab:pavilion.prefab,asset:pavilion.asset,stone:pavilion.stone,roof:pavilion.roof,gold:pavilion.gold,glass:pavilion.glass}:null,luxe:luxe?{occluding:luxe.occluding,state:luxe.state,prefab:luxe.prefab,asset:luxe.asset}:null,arcade:arcade?{occluding:arcade.occluding,entry:arcade.entry,prefab:arcade.prefab,asset:arcade.asset,rendererVersion:arcade.renderer?.version,prefabCount:arcade.renderer?.prefabCount,roof:arcade.roof,ivory:arcade.ivory,glass:arcade.glass,gold:arcade.gold}:null,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/pavilion-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
await browser.close();
if(!loaded)throw new Error('Architecture prefabs did not become ready from TileRegistry on LIVE');
if(pavilion?.registryVersion!==expectedRegistry||arcade?.registryVersion!==expectedRegistry)throw new Error(`Registry mismatch ${pavilion?.registryVersion}/${arcade?.registryVersion} !== ${expectedRegistry}`);
if(!pavilion?.dataUrl?.startsWith('data:image/png;base64,')||!pavilion.occluding)throw new Error('Pavilion depth capture failed');
if(pavilion.state?.source!=='tile-registry-architecture-prefab'||pavilion.state?.prefabId!=='market-pavilion-south')throw new Error('Pavilion is not consuming registry prefab metadata');
if(pavilion.state?.asset!==pavilion.asset?.src||pavilion.state?.geometry?.x!==pavilion.prefab?.x||pavilion.state?.geometry?.y!==pavilion.prefab?.y||pavilion.state?.collision?.x!==pavilion.prefab?.collision?.x||pavilion.state?.collision?.y!==pavilion.prefab?.collision?.y)throw new Error('Pavilion runtime geometry diverged from TileRegistry prefab');
if(!pavilion.state?.legacyHidden||!pavilion.state?.rendererWrapped||!pavilion.state?.depthWrapped||pavilion.state?.failed)throw new Error('Pavilion runtime contract invalid');
if(pavilion.stone<200||pavilion.roof<100||pavilion.gold<30||pavilion.glass<40)throw new Error(`Pavilion authored pixels missing: ${JSON.stringify({stone:pavilion.stone,roof:pavilion.roof,gold:pavilion.gold,glass:pavilion.glass})}`);
if(!luxe?.dataUrl?.startsWith('data:image/png;base64,')||!luxe.occluding)throw new Error('Kelo Luxe depth capture failed');
if(luxe.state?.source!=='tile-registry-architecture-prefab'||luxe.state?.prefabId!=='luxe-boutique-central')throw new Error('Kelo Luxe is not consuming registry prefab metadata');
if(luxe.state?.asset!==luxe.asset?.src||luxe.state?.shop?.x!==luxe.prefab?.x||luxe.state?.shop?.y!==luxe.prefab?.y||luxe.state?.collision?.x!==luxe.prefab?.collision?.x||luxe.state?.collision?.y!==luxe.prefab?.collision?.y||luxe.state?.interaction?.x!==luxe.prefab?.interaction?.x||luxe.state?.interaction?.radius!==luxe.prefab?.interaction?.radius)throw new Error('Kelo Luxe runtime geometry diverged from TileRegistry prefab');
if(!luxe.state?.rendererWrapped||!luxe.state?.depthWrapped||luxe.state?.failed)throw new Error('Kelo Luxe runtime contract invalid');
if(!arcade?.dataUrl?.startsWith('data:image/png;base64,')||!arcade.occluding)throw new Error('Commerce arcade depth capture failed');
if(arcade.entry?.prefab?.id!=='commerce-arcade-east'||arcade.entry?.asset?.id!=='commerce-arcade')throw new Error('Commerce arcade is not consuming registry prefab metadata');
if(arcade.entry?.geometry?.x!==arcade.prefab?.x||arcade.entry?.geometry?.y!==arcade.prefab?.y||arcade.entry?.prefab?.collision?.x!==arcade.prefab?.collision?.x||arcade.entry?.prefab?.collision?.y!==arcade.prefab?.collision?.y)throw new Error('Commerce arcade runtime geometry diverged from TileRegistry prefab');
if(!arcade.entry?.ready||arcade.entry?.failed||!arcade.entry?.legacyHidden||arcade.renderer?.prefabCount<3)throw new Error('Commerce arcade runtime contract invalid');
if(arcade.roof<500||arcade.ivory<300||arcade.glass<100||arcade.gold<40)throw new Error(`Commerce arcade authored pixels missing: ${JSON.stringify({roof:arcade.roof,ivory:arcade.ivory,glass:arcade.glass,gold:arcade.gold})}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);