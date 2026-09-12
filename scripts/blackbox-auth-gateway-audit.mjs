import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const TARGET='https://kelffren.github.io/gemini/';
const OUT='ui-auth-gateway-artifacts';
await fs.rm(OUT,{recursive:true,force:true}); await fs.mkdir(path.join(OUT,'screens'),{recursive:true});
const results=[]; const errors=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function shot(page,n){const p=path.join(OUT,'screens',`${n}.png`);await page.screenshot({path:p,fullPage:false});return p}
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
async function run(name,viewport,fn){const ctx=await browser.newContext({viewport,hasTouch:viewport.width<900,isMobile:viewport.width<900,ignoreHTTPSErrors:true});const page=await ctx.newPage();const telemetry={console:[],bad:[],failed:[],ws:[]};page.on('console',m=>{if(m.type()==='error')telemetry.console.push(m.text())});page.on('response',r=>{if(r.status()>=400)telemetry.bad.push({status:r.status(),url:r.url()})});page.on('requestfailed',r=>telemetry.failed.push({url:r.url(),error:r.failure()?.errorText}));page.on('websocket',ws=>{const rec={url:ws.url(),errors:[],closed:false};telemetry.ws.push(rec);ws.on('socketerror',e=>rec.errors.push(String(e)));ws.on('close',()=>rec.closed=true)});try{await page.goto(TARGET,{waitUntil:'domcontentloaded',timeout:30000});await sleep(1800);await fn(page,telemetry);results.push({name,ok:true,telemetry});}catch(e){results.push({name,ok:false,error:String(e.stack||e),telemetry});errors.push({name,error:String(e.message||e)});}finally{await ctx.close()}}

await run('guest-desktop',{width:1440,height:900},async(page,t)=>{
  const guest=page.getByRole('button',{name:/jugar como invitado/i});
  const before=await guest.isVisible(); await shot(page,'guest-desktop-before');
  if(!before) throw new Error('Guest button is not visible');
  await guest.click();
  const checkpoints=[];
  for(const ms of [2000,8000,12000]){await sleep(ms);checkpoints.push({afterMs:checkpoints.reduce((a,x)=>a+x.afterMs,0)+ms,guestVisible:await guest.isVisible().catch(()=>false),loginVisible:await page.getByRole('button',{name:/^entrar$/i}).first().isVisible().catch(()=>false),canvasVisible:await page.locator('canvas').first().isVisible().catch(()=>false),url:page.url()});}
  await shot(page,'guest-desktop-after');
  const escaped=!checkpoints.at(-1).guestVisible;
  results.push({name:'guest-desktop-evidence',escaped,checkpoints});
  if(!escaped) errors.push({name:'guest-desktop','error':'Guest mode did not dismiss the account gateway after 22s'});
});

await run('signup-tab-network',{width:1440,height:900},async(page,t)=>{
  const signupRequests=[]; page.on('request',r=>{if(/\/auth\/v1\/signup/i.test(r.url()))signupRequests.push({method:r.method(),url:r.url()})});
  const tabs=page.getByRole('button',{name:/crear cuenta/i});
  await tabs.first().click(); await sleep(1500); await shot(page,'signup-tab');
  results.push({name:'signup-tab-evidence',signupRequests});
  if(signupRequests.length)errors.push({name:'signup-tab-network',error:'Opening Create account tab unexpectedly sent a signup request',signupRequests});
});

await run('signup-empty-submit',{width:1440,height:900},async(page,t)=>{
  const signupRequests=[]; page.on('request',r=>{if(/\/auth\/v1\/signup/i.test(r.url()))signupRequests.push({method:r.method(),url:r.url()})});
  await page.getByRole('button',{name:/crear cuenta/i}).first().click(); await sleep(500);
  const buttons=page.getByRole('button',{name:/crear cuenta/i});
  const n=await buttons.count(); if(n<2)throw new Error(`Expected signup submit button, got ${n} create-account buttons`);
  await buttons.nth(n-1).click(); await sleep(1800); await shot(page,'signup-empty-submit');
  const visibleText=(await page.locator('body').innerText()).replace(/\s+/g,' ');
  results.push({name:'signup-empty-submit-evidence',signupRequests,bodyText:visibleText.slice(0,1200),bad:t.bad.filter(x=>/signup/i.test(x.url))});
  if(signupRequests.length)errors.push({name:'signup-empty-submit',error:'Empty signup form reached backend instead of being blocked by client validation',signupRequests,bad:t.bad.filter(x=>/signup/i.test(x.url))});
});

for(const [name,viewport] of [['guest-iphone-portrait',{width:390,height:844}],['guest-iphone-landscape',{width:844,height:390}]]){
 await run(name,viewport,async(page,t)=>{
   const guest=page.getByRole('button',{name:/jugar como invitado/i});
   const b0=await guest.boundingBox(); const scroll0=await page.evaluate(()=>({y:scrollY,h:innerHeight,sh:document.documentElement.scrollHeight}));
   await page.mouse.wheel(0,900); await sleep(700);
   const b1=await guest.boundingBox(); const scroll1=await page.evaluate(()=>({y:scrollY,h:innerHeight,sh:document.documentElement.scrollHeight}));
   await shot(page,name+'-scrolled');
   let clicked=false; try{await guest.click({timeout:4000});clicked=true}catch{}
   await sleep(5000); const still=await guest.isVisible().catch(()=>false); await shot(page,name+'-after-guest');
   results.push({name:name+'-evidence',beforeBox:b0,afterScrollBox:b1,scroll0,scroll1,clicked,guestStillVisible:still});
   if(!clicked)errors.push({name,error:'Guest button cannot be reached/clicked after scrolling'}); else if(still)errors.push({name,error:'Guest click succeeds physically but gateway remains visible'});
 });
}
await browser.close();
const report={target:TARGET,generatedAt:new Date().toISOString(),errors,results};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
let md=`# Auth gateway black-box audit\n\nErrors: ${errors.length}\n\n`;for(const e of errors)md+=`- **${e.name}**: ${e.error}\n`;await fs.writeFile(path.join(OUT,'REPORT.md'),md);console.log(JSON.stringify({errors,tests:results.map(x=>x.name)},null,2));
