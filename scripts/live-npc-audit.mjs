import fs from 'node:fs';
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedRegistry=process.env.EXPECTED_REGISTRY||'';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});
let state=null;
for(let attempt=1;attempt<=24;attempt++){
  await page.goto(`${base}?npc-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
  await page.waitForTimeout(1200);
  state=await page.evaluate(()=>({npc:window.KELO_PLAZA_NPC_AUDIT||null,registry:window.KELO_TILE_REGISTRY||null}));
  if(state.npc?.ready&&state.npc?.assetLoaded&&!state.npc?.failed&&state.npc?.fallbackActive===false&&state.npc?.version==='plaza-npcs-v1'&&state.registry?.atlases?.plazaNpcs?.src?.includes('plaza-npcs-v1.svg')&&(!expectedRegistry||state.registry?.version===expectedRegistry))break;
  await page.waitForTimeout(8000);
}
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?npc-audit=final-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(1800);
const frame=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');
  if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1580;localPlayer.y=1740;camera.x=1510;camera.y=1605;camera.targetX=1510;camera.targetY=1605;render();
  const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let blue=0,forest=0,burgundy=0;
  for(let i=0;i<px.length;i+=4){
    const r=px[i],g=px[i+1],b=px[i+2],a=px[i+3];if(a<220)continue;
    if(r===62&&g===111&&b===153)blue++;
    if(r===31&&g===90&&b===73)forest++;
    if(r===127&&g===48&&b===66)burgundy++;
  }
  return{dataUrl:c.toDataURL('image/png'),blue,forest,burgundy,npc:window.KELO_PLAZA_NPC_AUDIT||null,registryVersion:window.KELO_TILE_REGISTRY?.version||null,npcCount:(window.keloNpcs||[]).length,canvas:{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}};
});
if(frame?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-plaza-npcs.png',Buffer.from(frame.dataUrl.split(',')[1],'base64'));
const report={frame:frame?{blue:frame.blue,forest:frame.forest,burgundy:frame.burgundy,npc:frame.npc,registryVersion:frame.registryVersion,npcCount:frame.npcCount,canvas:frame.canvas}:null,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/npc-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(!frame?.npc?.ready||!frame.npc.assetLoaded||frame.npc.failed||frame.npc.fallbackActive)throw new Error(`Authored NPC visual state invalid: ${JSON.stringify(frame?.npc)}`);
if(frame.npc.mode!=='registry-authored-npc-visual-v1'||frame.npc.labelMode!=='proximity-name-v1')throw new Error(`NPC registry mode invalid: ${JSON.stringify(frame.npc)}`);
if(frame.npcCount!==3)throw new Error(`Expected 3 Plaza NPCs, got ${frame.npcCount}`);
if(expectedRegistry&&frame.registryVersion!==expectedRegistry)throw new Error(`Registry mismatch ${frame.registryVersion} !== ${expectedRegistry}`);
if(frame.blue<80||frame.forest<80||frame.burgundy<80)throw new Error(`Authored NPC pixels not visible: ${JSON.stringify({blue:frame.blue,forest:frame.forest,burgundy:frame.burgundy})}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);