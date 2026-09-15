import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const cwd=process.cwd();
const mode=String(process.env.FORENSIC_MODE||'WORLD_MOUNT').toUpperCase();
const port=Number(process.env.FORENSIC_PORT||4179);
const timeout=Number(process.env.FORENSIC_TIMEOUT_MS||30000);
const evidenceDir=process.env.FORENSIC_EVIDENCE_DIR||path.join(cwd,'forensics','probe-evidence');
fs.mkdirSync(evidenceDir,{recursive:true});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitHttp(url,ms=15000){
  const until=Date.now()+ms;
  let last='';
  while(Date.now()<until){
    try{const r=await fetch(url);if(r.ok)return;}catch(e){last=String(e?.message||e);}
    await sleep(250);
  }
  throw new Error(`FORENSIC_HTTP_NOT_READY:${last}`);
}

function resolvePlaywright(){
  const candidates=[
    path.join(cwd,'node_modules','playwright','index.mjs'),
    path.join(cwd,'node_modules','playwright-core','index.mjs')
  ];
  const file=candidates.find(fs.existsSync);
  if(!file)throw new Error('FORENSIC_PLAYWRIGHT_NOT_INSTALLED');
  return import(pathToFileURL(file).href);
}

const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{
  cwd,stdio:['ignore','pipe','pipe']
});
let serverLog='';
server.stdout.on('data',d=>serverLog+=d);
server.stderr.on('data',d=>serverLog+=d);

let browser;
const result={
  mode,
  sha:null,
  startedAt:new Date().toISOString(),
  ok:false,
  phase:'INIT',
  pageErrors:[],
  consoleErrors:[],
  milestones:[]
};

try{
  result.sha=(await import('node:child_process')).execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  await waitHttp(`http://127.0.0.1:${port}/`);
  const {chromium}=await resolvePlaywright();
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({
    viewport:{width:390,height:844},
    screen:{width:390,height:844},
    isMobile:true,
    hasTouch:true,
    deviceScaleFactor:3,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });
  const page=await context.newPage();
  page.setDefaultTimeout(timeout);
  page.on('pageerror',e=>result.pageErrors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());});

  result.phase='BOOT_NAVIGATE';
  const response=await page.goto(`http://127.0.0.1:${port}/?guest=1&mapEditor=1&forensic=1`,{waitUntil:'domcontentloaded',timeout});
  if(!response||response.status()>=400)throw new Error(`FORENSIC_HTTP_STATUS:${response?.status()}`);
  result.milestones.push('DOM_CONTENT_LOADED');

  result.phase='BOOT_RESPONSIVE';
  await page.waitForTimeout(750);
  const boot=await page.evaluate(()=>({
    ready:document.readyState,
    body:!!document.body,
    canvas:!!document.querySelector('#game-canvas,canvas'),
    now:performance.now()
  }));
  if(!boot.body)throw new Error('FORENSIC_BODY_MISSING');
  result.milestones.push('BOOT_RESPONSIVE');

  if(mode==='BOOT'){
    result.ok=true;
    result.phase='DONE';
  }else if(mode==='WORLD_MOUNT'){
    result.phase='CREATOR_HUB';
    await page.evaluate(async()=>{
      const mod=await import('./src/creators/ui/creator-hub.mjs');
      if(typeof mod.openCreatorHub!=='function')throw new Error('OPEN_CREATOR_HUB_MISSING');
      await mod.openCreatorHub({root:window});
    });
    await page.locator('#kelo-creators-hub').waitFor({state:'visible',timeout});
    result.milestones.push('CREATOR_HUB_VISIBLE');

    result.phase='WORLD_CLICK';
    const world=page.locator('#kelo-creators-hub [data-workspace="world"]');
    await world.waitFor({state:'visible',timeout});
    await world.click();
    result.milestones.push('WORLD_CLICKED');

    result.phase='WORLD_MOUNT';
    const studio=page.locator('#kelo-studio-live');
    await studio.waitFor({state:'visible',timeout});
    await page.waitForFunction(()=>{
      const el=document.getElementById('kelo-studio-live');
      return !!el&&el.getAttribute('data-kelo-world-loading')!=='1';
    },null,{timeout});
    result.milestones.push('WORLD_MOUNTED');

    result.phase='POST_MOUNT_RESPONSIVE';
    await page.waitForTimeout(2500);
    const ping=await page.evaluate(()=>new Promise(resolve=>setTimeout(()=>resolve({now:performance.now(),studio:!!document.getElementById('kelo-studio-live')}),120)));
    if(!ping?.studio)throw new Error('FORENSIC_STUDIO_DISAPPEARED');
    result.milestones.push('POST_MOUNT_RESPONSIVE');
    result.ok=true;
    result.phase='DONE';
  }else{
    throw new Error(`FORENSIC_UNSUPPORTED_BUILTIN_MODE:${mode}`);
  }

  await context.close();
}catch(error){
  result.ok=false;
  result.error=String(error?.stack||error?.message||error);
}finally{
  result.endedAt=new Date().toISOString();
  result.serverLog=serverLog.slice(-12000);
  try{if(browser)await browser.close();}catch{}
  try{server.kill('SIGTERM');}catch{}
  fs.writeFileSync(path.join(evidenceDir,`${result.sha||'unknown'}-${mode.toLowerCase()}.json`),JSON.stringify(result,null,2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

process.exit(result.ok?0:1);
