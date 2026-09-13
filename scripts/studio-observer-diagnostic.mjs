import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'http://127.0.0.1:4173/';
const url=new URL(base);url.searchParams.set('mapEditor','1');url.searchParams.set('studioObserverDiagnostic',String(Date.now()));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();
page.on('console',msg=>console.log(`[browser] ${msg.type()}:${msg.text()}`));
page.on('pageerror',error=>console.log(`[pageerror] ${String(error?.stack||error)}`));

async function installGuard(){
  await page.evaluate(()=>{
    const NativeObserver=window.MutationObserver;if(!NativeObserver||window.__studioObserverDiagnosticInstalled)return;
    window.__studioObserverDiagnosticInstalled=true;window.__studioObserverStats=[];let sequence=0;
    const nodeName=node=>{if(!node)return 'null';if(node===document)return 'document';if(node===document.documentElement)return 'html';if(node===document.body)return 'body';return `${node.nodeName?.toLowerCase?.()||'node'}${node.id?'#'+node.id:''}${node.classList?.length?'.'+[...node.classList].slice(0,3).join('.'):''}`;};
    window.MutationObserver=class DiagnosticMutationObserver{
      constructor(callback){
        const id=++sequence,createdAt=String(new Error(`Studio observer #${id}`).stack||'');
        const stat={id,count:0,records:0,firstAt:0,lastAt:0,maxBatch:0,types:{},targets:{},added:0,removed:0,createdAt};window.__studioObserverStats.push(stat);
        this._native=new NativeObserver((records)=>{
          const now=performance.now();stat.count++;stat.records+=records.length;stat.firstAt||=now;stat.lastAt=now;stat.maxBatch=Math.max(stat.maxBatch,records.length);
          for(const record of records){stat.types[record.type]=(stat.types[record.type]||0)+1;const target=nodeName(record.target);stat.targets[target]=(stat.targets[target]||0)+1;stat.added+=record.addedNodes?.length||0;stat.removed+=record.removedNodes?.length||0;}
          callback(records,this);
        });
      }
      observe(...args){return this._native.observe(...args)} disconnect(){return this._native.disconnect()} takeRecords(){return this._native.takeRecords()}
    };
  });
}

try{
  await page.goto(String(url),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_ADMIN_KEYS?.can?.('world.edit',window.KELO_ADMIN_KEYS?.playerId?.()),null,{timeout:12000});
  await page.locator('#lx-side-menu').click();await page.locator('#lx-create-studio').click();await page.locator('#kelo-creators-hub').waitFor({state:'visible',timeout:10000});
  await installGuard();
  await page.getByRole('button',{name:'Abrir World'}).click();await page.locator('#kelo-studio-live').waitFor({state:'visible',timeout:15000});
  const snapshots=[];
  for(const delay of [250,750,1500,3000]){await page.waitForTimeout(delay-(snapshots.at(-1)?.delay||0));snapshots.push({delay,stats:await page.evaluate(()=>window.__studioObserverStats.map(row=>({...row,targets:Object.fromEntries(Object.entries(row.targets).sort((a,b)=>b[1]-a[1]).slice(0,8))})))});}
  console.log('STUDIO_OBSERVER_DIAGNOSTIC='+JSON.stringify({url:String(url),snapshots},null,2));
}finally{await browser.close();}
