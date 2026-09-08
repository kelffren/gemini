import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const url = new URL(base);
url.searchParams.set('mapEditor','1');
url.searchParams.set('studioClickAudit',String(Date.now()));
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const pageErrors=[];const consoleErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
let report={ok:false,url:String(url),createVisible:false,studioVisible:false,permission:false,pageErrors,consoleErrors,toasts:[]};
try{
  await page.goto(String(url),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_ADMIN_KEYS?.can?.('world.edit',window.KELO_ADMIN_KEYS?.playerId?.()),null,{timeout:12000});
  report.permission=true;
  await page.waitForSelector('#lx-side-menu',{state:'visible',timeout:8000});
  await page.click('#lx-side-menu');
  await page.waitForSelector('#lx-create-studio',{state:'visible',timeout:8000});
  report.createVisible=true;
  await page.click('#lx-create-studio');
  try{await page.waitForSelector('#kelo-studio-live',{state:'visible',timeout:10000});report.studioVisible=true;}catch{}
  report.toasts=await page.locator('#toast-container > *').allTextContents().catch(()=>[]);
  report.session=await page.evaluate(()=>({
    launcher:window.KELO_STUDIO_LAUNCHER?.version||null,
    allowed:window.KELO_STUDIO_LAUNCHER?.allowed??null,
    inputLocks:window.KeloInputLocks?.snapshot?.()||null,
    cameraOwner:window.KeloCamera?.version||null,
    studioNode:!!document.querySelector('#kelo-studio-live')
  }));
  if(!report.studioVisible)throw new Error(`CREATE_CLICK_DID_NOT_OPEN_STUDIO: ${JSON.stringify(report)}`);
  report.ok=true;
  console.log(JSON.stringify(report,null,2));
} catch(error){
  report.toasts=await page.locator('#toast-container > *').allTextContents().catch(()=>report.toasts||[]);
  report.session=await page.evaluate(()=>({launcher:window.KELO_STUDIO_LAUNCHER?.version||null,allowed:window.KELO_STUDIO_LAUNCHER?.allowed??null,cameraOwner:window.KeloCamera?.version||null,studioNode:!!document.querySelector('#kelo-studio-live')})).catch(()=>null);
  console.error(JSON.stringify(report,null,2));
  throw error;
} finally {await browser.close();}
