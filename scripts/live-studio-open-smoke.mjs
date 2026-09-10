import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const url=new URL(base);
url.searchParams.set('mapEditor','1');
url.searchParams.set('studioOpenSmoke',String(Date.now()));

const browser=await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
  args:['--no-sandbox','--disable-dev-shm-usage']
});

const context=await browser.newContext({
  viewport:{width:390,height:844},
  isMobile:true,
  hasTouch:true,
  serviceWorkers:'block'
});
const page=await context.newPage();
page.setDefaultTimeout(10000);
const errors=[];
page.on('pageerror',error=>errors.push(String(error?.stack||error)));

const report={ok:false,url:String(url),permission:false,menu:false,creators:false,studio:false,accountGateHidden:false,closed:false,errors};
try{
  await page.goto(String(url),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_ADMIN_KEYS?.can?.('world.edit',window.KELO_ADMIN_KEYS?.playerId?.()),null,{timeout:12000});
  report.permission=true;

  const authGate=page.locator('#kelo-account-auth');
  report.accountGateHidden=await authGate.count()===0||await authGate.isHidden().catch(()=>false);
  if(!report.accountGateHidden)throw new Error('ACCOUNT_GATE_BLOCKS_EXPLICIT_EDITOR_MODE');

  await page.locator('#lx-side-menu').click();
  report.menu=true;
  await page.locator('#lx-create-studio').click();
  await page.locator('#kelo-creators-hub').waitFor({state:'visible',timeout:10000});
  report.creators=true;

  await page.getByRole('button',{name:'Abrir World'}).click();
  await page.locator('#kelo-studio-live').waitFor({state:'visible',timeout:15000});
  report.studio=true;

  const shell=await page.locator('#kelo-studio-live').evaluate(node=>({
    id:node.id,
    shellVersion:node.dataset.shellVersion||null,
    compact:node.dataset.compact||null
  }));
  report.shell=shell;

  await page.locator('#kelo-studio-live [data-act="close"]').click();
  await page.locator('#kelo-studio-live').waitFor({state:'detached',timeout:8000});
  report.closed=true;
  if(errors.length)throw new Error(`PAGE_ERRORS:${JSON.stringify(errors)}`);
  report.ok=true;
  console.log(JSON.stringify(report,null,2));
} catch(error){
  report.failure=String(error?.stack||error);
  console.error(JSON.stringify(report,null,2));
  throw error;
} finally {
  await browser.close();
}
