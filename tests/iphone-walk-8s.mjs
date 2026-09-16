/* KELO-INDEX
 * area: TEST / IPHONE / PERFORMANCE FIREWALL
 * owner: Playwright validation only
 * keys: IPHONE WALK 8S FREEZE EVALUATE 400MS JOYSTICK MOBILE
 * purpose: exige caminata táctil sostenida 8 s en 390x844 y falla ante cualquier page.evaluate que tarde más de 400 ms
 * online: N/A; valida responsividad del runtime cliente sin alterar autoridad
 * do-not: NO tolerar hitches >400 ms, NO bypass de input real
 */
import { chromium } from 'playwright';
const URL = process.env.KELO_URL || 'http://127.0.0.1:8096/?guest=1&v=665-walk';
const t0=Date.now();
const log=m=>console.log(`[${Date.now()-t0}ms] ${m}`);
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const page=await (await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})).newPage();
let crashed=false;
page.on('crash',()=>{crashed=true;log('CRASH');});
page.on('pageerror',e=>log('ERR '+String(e.message||e).slice(0,160)));
await page.goto(URL,{waitUntil:'load',timeout:25000});

async function timedEvaluate(fn,arg,label='evaluate'){
  const started=Date.now();
  const result=await Promise.race([
    page.evaluate(fn,arg),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(label.toUpperCase()+'_TIMEOUT')),2000))
  ]);
  const ms=Date.now()-started;
  if(ms>400)throw new Error(label.toUpperCase()+'_SLOW_'+ms+'MS');
  return {result,ms};
}

const {result:boot}=await timedEvaluate(()=>({
  title:document.title,
  hasLP:!!(typeof localPlayer!=='undefined'&&localPlayer),
  x:typeof localPlayer!=='undefined'&&localPlayer?localPlayer.x:null,
  y:typeof localPlayer!=='undefined'&&localPlayer?localPlayer.y:null,
  loader:!!window.KELO_MODULE_LOADER
}),undefined,'boot-evaluate');
log('boot '+JSON.stringify(boot));
if(!boot.hasLP){await browser.close();process.exit(2);}

async function evalSnap(){
  const {result,ms}=await timedEvaluate(()=>({x:localPlayer.x,y:localPlayer.y,t:performance.now()}),undefined,'snapshot-evaluate');
  return{snap:result,ms};
}

async function pointer(type,x,y,extra={}){
  await timedEvaluate(({type,x,y,extra})=>{
    const c=document.getElementById('game-canvas');
    if(!c)throw new Error('NO_CANVAS');
    c.dispatchEvent(new PointerEvent(type,{
      pointerId:9,pointerType:'touch',isPrimary:true,
      clientX:x,clientY:y,buttons:type==='pointerup'?0:1,
      pressure:type==='pointerup'?0:.5,bubbles:true,...extra
    }));
  },{type,x,y,extra},'pointer-evaluate');
}

const {result:box}=await timedEvaluate(()=>{
  const c=document.getElementById('game-canvas');
  if(!c)throw new Error('NO_CANVAS');
  const r=c.getBoundingClientRect();
  return{w:r.width,h:r.height,left:r.left,top:r.top};
},undefined,'canvas-box-evaluate');
const sx=box.left+box.w*0.20,sy=box.top+box.h*0.70;

await pointer('pointerdown',sx,sy);
const samples=[];
let stall=0,maxStall=0;
try{
  for(let i=1;i<=40;i++){
    const px=sx+90*(0.5+0.5*Math.sin(i/5));
    await pointer('pointermove',px,sy);
    const {snap,ms}=await evalSnap();
    samples.push({x:snap.x,ms});
    if(samples.length>=2){
      const dx=Math.abs(snap.x-samples[samples.length-2].x);
      if(dx<0.4)stall++;else stall=0;
      if(stall>maxStall)maxStall=stall;
    }
    await page.waitForTimeout(200);
  }
}catch(e){
  log('FREEZE '+e.message);
  await browser.close();
  process.exit(3);
}
await pointer('pointerup',sx+80,sy);
const moved=Math.abs(samples.at(-1).x-samples[0].x);
log('movedX='+moved.toFixed(1)+' maxStall='+maxStall+' waiting 10s');
await page.waitForTimeout(10000);
const mid=await evalSnap();
log('afterWait evalMs='+mid.ms+' x='+mid.snap.x.toFixed(1));
const {result:chat}=await timedEvaluate(()=>({
  premium:!!document.querySelector('#lx-chat-drawer.kc-premium, #lx-chat-tab.kc-chat-tab'),
  loader:!!document.getElementById('kelo-chat-drawer-loader'),
  keloChat:!!window.KeloChatUI
}),undefined,'chat-evaluate');
log('chat '+JSON.stringify(chat));
if(chat.premium||chat.loader||chat.keloChat){console.log('FAIL chat auto-mounted');await browser.close();process.exit(4);}

await pointer('pointerdown',sx,sy);
const later=[];
try{
  for(let i=1;i<=20;i++){
    const px=sx+90*(0.5+0.5*Math.sin(i/5));
    await pointer('pointermove',px,sy);
    const {snap,ms}=await evalSnap();
    later.push({x:snap.x,ms});
    await page.waitForTimeout(200);
  }
}catch(e){
  log('FREEZE2 '+e.message);
  await browser.close();
  process.exit(3);
}
await pointer('pointerup',sx+80,sy);
const moved2=Math.abs(later.at(-1).x-later[0].x);
log('moved2='+moved2.toFixed(1));
await browser.close();
if(crashed){console.log('FAIL page crash');process.exit(4);}
if(moved<40){console.log('FAIL little movement');process.exit(2);}
if(moved2<20){console.log('FAIL freeze after wait');process.exit(4);}
if(maxStall>=10){console.log('FAIL movement stall');process.exit(4);}
console.log('PASS strict 8s + 10s wait + 4s walk; all evaluate calls <=400ms');
process.exit(0);
