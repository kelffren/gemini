// Focused live smoke: prove deployed Sprite Ability opens in zero-training Easy Mode.
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const url=new URL(base);
url.searchParams.set('mapEditor','1');
url.searchParams.set('spriteAbilityEasySmoke',String(Date.now()));

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();
page.setDefaultTimeout(12000);
const errors=[];
page.on('pageerror',error=>errors.push(String(error?.stack||error)));
page.on('console',msg=>console.log(`[browser] ${msg.type()}:${msg.text()}`));
const report={ok:false,url:String(url),hub:false,spriteAbility:false,easy:false,actions:[],diagnostics:null,errors};
try{
  await page.goto(String(url),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_ADMIN_KEYS?.can?.('ability.edit',window.KELO_ADMIN_KEYS?.playerId?.()),null,{timeout:15000});
  const authGate=page.locator('#kelo-account-auth');
  if(await authGate.count()&&await authGate.isVisible().catch(()=>false))throw new Error('ACCOUNT_GATE_BLOCKS_EXPLICIT_EDITOR_MODE');
  await page.locator('#lx-side-menu').click();
  await page.locator('#lx-create-studio').click();
  await page.locator('#kelo-creators-hub').waitFor({state:'visible'});report.hub=true;

  report.diagnostics=await page.evaluate(async()=>{
    const out={};
    const timed=async(label,promise,ms=3500)=>{
      const started=performance.now();
      try{
        const value=await Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label.toUpperCase()}_TIMEOUT_${ms}MS`)),ms))]);
        out[label]={ok:true,ms:Math.round(performance.now()-started)};
        return value;
      }catch(error){out[label]={ok:false,ms:Math.round(performance.now()-started),error:String(error?.stack||error)};return null;}
    };
    try{
      const hubUrl=new URL('./src/creators/ui/creator-hub.mjs',location.href).href;
      const controllerUrl=new URL('./src/creators/sprite-ability/sprite-ability-live-controller.mjs',location.href).href;
      const hubMod=await timed('hubImport',import(hubUrl));
      const hub=hubMod?.getCreatorHub?.();
      out.platformVersion=hub?.platform?.version||null;
      out.inputLocks={present:!!window.KeloInputLocks,acquire:typeof window.KeloInputLocks?.acquire,release:typeof window.KeloInputLocks?.release,fallback:!!window.KeloInputLocks?.__keloCreatorFallback};
      if(!hub?.platform){out.fatal='CREATOR_HUB_PLATFORM_UNAVAILABLE';return out;}
      const p=hub.platform,owner=p.permission.actorId();out.owner=String(owner||'');
      const rows=await timed('projectList',p.projects.list({ownerId:owner,type:'SPRITE_ABILITY'}));
      out.projectCount=Array.isArray(rows)?rows.length:null;
      const probe=await timed('projectCreate',p.projects.create({type:'SPRITE_ABILITY',name:'Sprite Ability LIVE Probe',ownerId:owner}));
      if(probe?.projectId){out.probeProjectId=probe.projectId;await timed('draftLoad',p.projects.loadDraft(probe.projectId));}
      const controller=await timed('controllerImport',import(controllerUrl));
      out.controllerEntry=typeof controller?.openSpriteAbilityBuilder;
    }catch(error){out.fatal=String(error?.stack||error);}
    return out;
  });
  console.log('[diagnostics]',JSON.stringify(report.diagnostics));

  await page.getByRole('button',{name:'Abrir Sprite Ability'}).click();
  const workspace=page.locator('#kelo-studio-workspace');
  try{await workspace.waitFor({state:'visible',timeout:15000});}
  catch(error){
    report.postClick=await page.evaluate(async()=>({bodyClass:document.body.className,hubVisible:!!document.querySelector('#kelo-creators-hub'),workspacePresent:!!document.querySelector('#kelo-studio-workspace'),toasts:[...document.querySelectorAll('[class*="toast"],#toast,.toast')].map(n=>n.textContent?.trim()).filter(Boolean).slice(-8),inputLocks:{present:!!window.KeloInputLocks,size:window.KeloInputLocks?.size??null,fallback:!!window.KeloInputLocks?.__keloCreatorFallback}}));
    throw error;
  }
  report.spriteAbility=true;
  await page.locator('.sab-easy-dock').waitFor({state:'visible',timeout:10000});
  report.easy=await workspace.getAttribute('data-sab-easy')==='1';
  if(!report.easy)throw new Error('SPRITE_ABILITY_EASY_MODE_NOT_DEFAULT');
  report.actions=await page.locator('.sab-easy-dock button span').allTextContents();
  const expected=['SUBIR','VER','PROBAR','AJUSTAR','GUARDAR'];
  if(JSON.stringify(report.actions)!==JSON.stringify(expected))throw new Error(`SPRITE_ABILITY_EASY_ACTIONS_MISMATCH:${JSON.stringify(report.actions)}`);
  const welcome=page.locator('.sab-easy-welcome');
  if(!await welcome.isVisible())throw new Error('SPRITE_ABILITY_EASY_WELCOME_NOT_VISIBLE');
  const advanced=page.locator('.sab-easy-mode-toggle');
  if(!await advanced.isVisible())throw new Error('SPRITE_ABILITY_ADVANCED_ESCAPE_NOT_VISIBLE');
  if(errors.length)throw new Error(`PAGE_ERRORS:${JSON.stringify(errors)}`);
  report.ok=true;
  console.log(JSON.stringify(report,null,2));
} catch(error){report.failure=String(error?.stack||error);console.error(JSON.stringify(report,null,2));throw error;}
finally{await browser.close();}