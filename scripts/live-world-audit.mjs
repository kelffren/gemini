import fs from 'node:fs';
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedWorld=process.env.EXPECTED_WORLD||'world-v1.4';
const expectedRegistry=process.env.EXPECTED_REGISTRY||'';
const expectedTitle=process.env.EXPECTED_TITLE||'';
const expectedPlaza=process.env.EXPECTED_PLAZA||'';
const expectedArchitectureVersion=process.env.EXPECTED_ARCHITECTURE_VERSION||'';
const expectedArchitectureMode=process.env.EXPECTED_ARCHITECTURE_MODE||'';
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
    await page.goto(`${base}?world-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    const d=await page.evaluate(()=>({title:document.title,world:window.KELO_WORLD_AUDIT||null,plaza:window.KELO_PLAZA_AUDIT||null,tileset:window.KELO_PLAZA_TILESET||null,registry:window.KELO_TILE_REGISTRY||null,architecture:window.KELO_ARCHITECTURE_RENDERER||null,kiosk:window.KELO_LUXE_KIOSK||null,market:window.KELO_MARKET_PAVILION||null,nature:window.KELO_PLAZA_NATURE_AUDIT||null,layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null}));
    const okTitle=!expectedTitle||d.title===expectedTitle;
    const okPlaza=(!expectedPlaza||d.plaza?.version===expectedPlaza)&&d.plaza?.ready&&d.plaza?.groundAssetLoaded&&d.plaza?.fallbackActive===false&&d.plaza?.worldLayerWrapped===true&&d.plaza?.renderingMode==='authored-plaza-ground-v1'&&d.tileset?.sourceMode==='authored-raster-ground-v1'&&d.tileset?.authoredGround===true;
    const okArch=(!expectedArchitectureVersion||d.architecture?.version===expectedArchitectureVersion)&&(!expectedArchitectureMode||d.architecture?.mode===expectedArchitectureMode);
    const frontLayer=d.layers?.layers?.find?.(l=>l.id==='plaza-nature-front');
    const okNature=d.nature?.ready&&d.nature?.assetLoaded&&!d.nature?.failed&&d.nature?.version==='plaza-nature-v3'&&d.nature?.propCount===4&&d.nature?.depthMode==='formal-back-front-layer-stack-v1'&&d.nature?.rendererWrapper===false&&d.layers?.version==='environment-layer-stack-v2'&&d.layers?.postActorLayerCount>=1&&frontLayer?.phase==='props_front'&&frontLayer?.timing==='post_actor';
    if(okTitle&&okPlaza&&okArch&&okNature&&d.world?.ready&&d.world?.version===expectedWorld&&d.world?.grassVariationAssetLoaded&&d.world?.grassVariationMode==='authored-eight-variant-atlas-v1'&&d.world?.grassVariationCount===8&&d.registry?.version===expectedRegistry&&d.registry?.atlases?.grassVariation?.src?.includes('grass-variation-v1.png')&&d.registry?.atlases?.plazaGround?.src?.includes('plaza-ground-v1.png')&&d.registry?.atlases?.plazaNature?.src?.includes('plaza-nature-v1.svg')&&d.architecture?.prefabCount===1&&d.kiosk?.ready&&d.market?.disabled===true){loaded=true;break;}
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?world-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(2500);
const state=await page.evaluate(()=>({title:document.title,world:window.KELO_WORLD_AUDIT||null,plaza:window.KELO_PLAZA_AUDIT||null,tileset:window.KELO_PLAZA_TILESET||null,registryVersion:window.KELO_TILE_REGISTRY?.version||null,architectureRenderer:window.KELO_ARCHITECTURE_RENDERER||null,kiosk:window.KELO_LUXE_KIOSK||null,market:window.KELO_MARKET_PAVILION||null,nature:window.KELO_PLAZA_NATURE_AUDIT||null,layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,canvas:(()=>{const c=document.getElementById('game-canvas');return c?{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}:null})()}));
await page.screenshot({path:'artifacts/live-mobile.png',fullPage:false});
const plaza=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1440;localPlayer.y=1520;camera.x=1440;camera.y=1520;camera.targetX=1440;camera.targetY=1520;render();
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let ivory=0,gold=0,teal=0;
  for(let i=0;i<px.length;i+=4){const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];if(a<200)continue;if(r>205&&g>190&&b>155)ivory++;if(r>150&&g>95&&g<205&&b<110)gold++;if(r<90&&g>80&&g<190&&b>75&&b<200)teal++;}
  return{dataUrl:c.toDataURL('image/png'),ivory,gold,teal};
});
if(plaza?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-plaza.png',Buffer.from(plaza.dataUrl.split(',')[1],'base64'));
const grass=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=760;localPlayer.y=760;camera.x=760;camera.y=760;camera.targetX=760;camera.targetY=760;render();
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let base=0,light=0,dark=0,pink=0,blue=0;
  for(let i=0;i<px.length;i+=4){const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];if(a<200)continue;if(r===72&&g===198&&b===55)base++;if(r===91&&g===218&&b===68)light++;if(r===50&&g===157&&b===44)dark++;if(r===242&&g===130&&b===178)pink++;if(r===104&&g===159&&b===229)blue++;}
  return{dataUrl:c.toDataURL('image/png'),base,light,dark,pink,blue};
});
if(grass?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-grass.png',Buffer.from(grass.dataUrl.split(',')[1],'base64'));
const plazaTree=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1168;localPlayer.y=1406;camera.x=1168;camera.y=1388;camera.targetX=1168;camera.targetY=1388;render();
  return{dataUrl:c.toDataURL('image/png'),nature:window.KELO_PLAZA_NATURE_AUDIT||null,layers:window.KELO_ENVIRONMENT_LAYER_AUDIT||null,registryNature:window.KELO_TILE_REGISTRY?.plazaNatureProps||null};
});
if(plazaTree?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-plaza-tree.png',Buffer.from(plazaTree.dataUrl.split(',')[1],'base64'));
const report={loaded,state,plaza:plaza?{ivory:plaza.ivory,gold:plaza.gold,teal:plaza.teal}:null,grass:grass?{base:grass.base,light:grass.light,dark:grass.dark,pink:grass.pink,blue:grass.blue}:null,plazaTree:plazaTree?{nature:plazaTree.nature,layers:plazaTree.layers,propCount:plazaTree.registryNature?.length||0}:null,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
await browser.close();
if(!loaded)throw new Error('LIVE never reached current Luxe-only grass + formal plaza-nature layer contract');
if(expectedTitle&&state.title!==expectedTitle)throw new Error(`Title mismatch ${state.title} !== ${expectedTitle}`);
if(expectedPlaza&&state.plaza?.version!==expectedPlaza)throw new Error(`Plaza mismatch ${state.plaza?.version} !== ${expectedPlaza}`);
if(!state.plaza?.ready||!state.plaza?.assetLoaded||!state.plaza?.groundAssetLoaded||state.plaza?.fallbackActive||!state.plaza?.worldLayerWrapped||state.plaza?.renderingMode!=='authored-plaza-ground-v1')throw new Error('Authored plaza ground did not become the active world layer');
if(state.plaza?.groundWidth!==800||state.plaza?.groundHeight!==560||state.tileset?.sourceMode!=='authored-raster-ground-v1'||state.tileset?.authoredGround!==true||!state.tileset?.assetPath?.includes('plaza-ground-v1.png'))throw new Error('Authored plaza ground contract invalid');
if(!plaza?.dataUrl?.startsWith('data:image/png;base64,')||plaza.ivory<10000||plaza.gold<100||plaza.teal<10)throw new Error(`Authored plaza materials not visible: ${JSON.stringify(plaza)}`);
if(state.world?.version!==expectedWorld||state.world?.plazaRoadAlignment!=='authored-plaza-ground-v1'||!state.world?.grassVariationAssetLoaded||state.world?.grassVariationCount!==8)throw new Error('World/plaza road alignment contract invalid');
if(state.registryVersion!==expectedRegistry)throw new Error(`Registry mismatch ${state.registryVersion} !== ${expectedRegistry}`);
if(state.architectureRenderer?.prefabCount!==1||state.architectureRenderer?.mode!=='luxe-only-v1')throw new Error('Luxe-only architecture contract invalid');
if(!state.kiosk?.ready||state.kiosk?.failed||state.market?.disabled!==true)throw new Error('Luxe architecture state invalid');
const frontLayer=state.layers?.layers?.find?.(l=>l.id==='plaza-nature-front');
if(!state.nature?.ready||!state.nature?.assetLoaded||state.nature?.failed||state.nature?.propCount!==4||state.nature?.version!=='plaza-nature-v3'||state.nature?.depthMode!=='formal-back-front-layer-stack-v1'||state.nature?.rendererWrapper!==false)throw new Error(`Plaza nature contract invalid: ${JSON.stringify(state.nature)}`);
if(state.layers?.version!=='environment-layer-stack-v2'||state.layers?.postActorLayerCount<1||frontLayer?.phase!=='props_front'||frontLayer?.timing!=='post_actor')throw new Error(`Formal post-actor layer contract invalid: ${JSON.stringify(state.layers)}`);
if(!plazaTree?.dataUrl?.startsWith('data:image/png;base64,')||plazaTree.registryNature?.length!==4)throw new Error('Plaza nature screenshot evidence missing');
if(!grass?.dataUrl?.startsWith('data:image/png;base64,')||grass.base<1000||grass.light<20||grass.dark<20||(grass.pink+grass.blue)<2)throw new Error(`Authored grass pixels missing: ${JSON.stringify(grass)}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
