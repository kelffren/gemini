import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'Kelo World — V6.19';
const expectedBridge='stone-backpack-bridge-v1.0.0';
const chromeBin=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const artifacts=path.resolve('artifacts');
fs.mkdirSync(artifacts,{recursive:true});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-backpack-cdp-'));
const chrome=spawn(chromeBin,[
  '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
  '--remote-debugging-pipe',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check'
],{stdio:['ignore','ignore','inherit','pipe','pipe']});

let nextId=1,buffer='';
const pending=new Map();
const listeners=new Map();
function on(method,fn){if(!listeners.has(method))listeners.set(method,[]);listeners.get(method).push(fn);}
chrome.stdio[4].setEncoding('utf8');
chrome.stdio[4].on('data',chunk=>{
  buffer+=chunk;
  let i;
  while((i=buffer.indexOf('\0'))>=0){
    const raw=buffer.slice(0,i);buffer=buffer.slice(i+1);
    if(!raw)continue;
    let msg;try{msg=JSON.parse(raw);}catch{continue;}
    if(msg.id&&pending.has(msg.id)){
      const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);
      if(msg.error)reject(new Error(`${msg.error.message||'CDP error'} ${JSON.stringify(msg.error.data||'')}`));else resolve(msg.result||{});
    }else if(msg.method){for(const fn of listeners.get(msg.method)||[])try{fn(msg.params||{},msg.sessionId);}catch{}}
  }
});
function send(method,params={},sessionId){
  return new Promise((resolve,reject)=>{
    const id=nextId++;pending.set(id,{resolve,reject});
    const msg={id,method,params};if(sessionId)msg.sessionId=sessionId;
    chrome.stdio[3].write(JSON.stringify(msg)+'\0');
    setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(new Error(`CDP timeout: ${method}`));}},30000).unref();
  });
}
async function evalJs(expression,sessionId){
  const out=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true},sessionId);
  if(out.exceptionDetails)throw new Error(`Runtime exception: ${out.exceptionDetails.text||'unknown'}`);
  return out.result?.value;
}
async function waitFor(fn,sessionId,label,timeout=90000){
  const start=Date.now();
  while(Date.now()-start<timeout){
    try{if(await evalJs(`(${fn.toString()})()`,sessionId))return true;}catch{}
    await sleep(1500);
  }
  throw new Error(`Timeout waiting for ${label}`);
}
async function navigate(url,sessionId){
  await send('Page.navigate',{url},sessionId);
  await waitFor(()=>document.readyState==='complete',sessionId,'document complete',60000);
}

const target=await send('Target.createTarget',{url:'about:blank'});
const attached=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
const sid=attached.sessionId;
await send('Page.enable',{},sid);await send('Runtime.enable',{},sid);await send('Network.enable',{},sid);
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true,screenWidth:390,screenHeight:844},sid);
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5},sid);

const consoleErrors=[],failedRequests=[],httpErrors=[];
on('Runtime.consoleAPICalled',p=>{if(p.type==='error')consoleErrors.push((p.args||[]).map(a=>a.value??a.description??'').join(' '));});
on('Runtime.exceptionThrown',p=>consoleErrors.push(`EXCEPTION: ${p.exceptionDetails?.text||'unknown'}`));
on('Network.loadingFailed',p=>{if(!p.canceled)failedRequests.push({requestId:p.requestId,error:p.errorText||'failed'});});
on('Network.responseReceived',p=>{const s=Number(p.response?.status)||0;if(s>=400)httpErrors.push({status:s,url:p.response?.url||''});});

const readyExpr=`document.title===${JSON.stringify(expectedTitle)}&&window.KELO_STONE_BACKPACK_BRIDGE_AUDIT?.version===${JSON.stringify(expectedBridge)}&&window.KELO_BACKPACK_AUDIT?.version==='backpack-v1.0.0'&&window.KELO_BACKPACK_UI_AUDIT?.version==='backpack-ui-v1.0.0'&&!!window.KeloBackpack&&!!window.KeloEquipment&&!!document.getElementById('lx-side-menu')`;
let liveReady=false;
for(let attempt=1;attempt<=30;attempt++){
  await navigate(`${base}?backpack-cdp=${Date.now()}-${attempt}`,sid);
  try{liveReady=!!(await evalJs(readyExpr,sid));}catch{}
  if(liveReady)break;
  await sleep(6000);
}
if(!liveReady)throw new Error(`LIVE never reached exact backpack runtime + ${expectedBridge}`);

await evalJs(`localStorage.removeItem('kelo_world_state_v2_1'); true`,sid);
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await navigate(`${base}?backpack-cdp=clean-${Date.now()}`,sid);
await sleep(900);
if(!(await evalJs(readyExpr,sid)))throw new Error('Clean exact backpack runtime not ready');

await evalJs(`(()=>{document.getElementById('lx-side-menu')?.click();const b=[...document.querySelectorAll('button')].find(x=>/Mochila/i.test(x.textContent||''));if(!b)return false;b.click();return true;})()`,sid);
await sleep(180);

const initial=await evalJs(`(()=>{const root=document.getElementById('kelo-bag'),slots=KeloBackpack.getSlots(),stats=KeloBackpack.getStats(),occupied=slots.find(s=>s.item),empty=slots.find(s=>!s.item),el=root?.querySelector('.kb-slot');return {title:document.title,visible:!!root&&getComputedStyle(root).display!=='none',touchAction:root?getComputedStyle(root).touchAction:null,viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio,canvasW:document.getElementById('game-canvas')?.width,canvasH:document.getElementById('game-canvas')?.height},stats,slotCount:slots.length,firstSlotTarget:el?{w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}:null,occupiedIndex:occupied?.index??null,emptyIndex:empty?.index??null,occupiedKey:occupied?.key??null,equipmentCount:STATE.inventory.filter(x=>x?.kind==='equipment').length,inventoryOrder:STATE.inventory.map((x,i)=>x.id||x.uid||x._backpackId||('index:'+i)),modelAudit:KELO_BACKPACK_AUDIT,uiAudit:KELO_BACKPACK_UI_AUDIT,bridgeAudit:KELO_STONE_BACKPACK_BRIDGE_AUDIT};})()`,sid);
if(initial.occupiedIndex==null||initial.emptyIndex==null||initial.equipmentCount<1)throw new Error(`Invalid initial backpack: ${JSON.stringify(initial)}`);

await evalJs(`(()=>{const a=document.querySelector('.kb-slot[data-slot="${initial.occupiedIndex}"]');a?.click();const m=[...document.querySelectorAll('.kb-action')].find(x=>x.textContent==='Mover');m?.click();const d=document.querySelector('.kb-slot[data-slot="${initial.emptyIndex}"]');d?.click();return true;})()`,sid);
await sleep(120);
const moved=await evalJs(`(()=>{const slots=KeloBackpack.getSlots(),order=STATE.inventory.map((x,i)=>x.id||x.uid||x._backpackId||('index:'+i));return {sourceEmpty:!slots[${initial.occupiedIndex}].item,destinationKey:slots[${initial.emptyIndex}].key,inventoryOrder:order,stateSlotKey:STATE.backpack?.slots?.[${initial.emptyIndex}]||null};})()`,sid);

await send('Page.reload',{ignoreCache:true},sid);await waitFor(()=>document.readyState==='complete',sid,'reload');await sleep(600);
if(!(await evalJs(readyExpr,sid)))throw new Error('Exact runtime missing after reload');
const persisted=await evalJs(`(()=>({persistedKey:KeloBackpack.getSlots()[${initial.emptyIndex}]?.key||null,equipmentCount:STATE.inventory.filter(x=>x?.kind==='equipment').length,inventoryKinds:STATE.inventory.map(x=>x?.kind||'stone')}))()`,sid);

await evalJs(`KeloSocialUI.openBag(); true`,sid);await sleep(100);
const equipmentIndex=await evalJs(`KeloBackpack.getSlots().find(s=>s.item?.kind==='equipment')?.index??null`,sid);
if(equipmentIndex==null)throw new Error(`No equipment after reload: ${JSON.stringify(persisted)}`);
await evalJs(`document.querySelector('.kb-slot[data-slot="${equipmentIndex}"]')?.click(); true`,sid);
const before=await evalJs(`([...document.querySelectorAll('.kb-actions .kb-action')].map(x=>x.textContent).find(x=>x==='Equipar'||x==='Desequipar'))||null`,sid);
if(!before)throw new Error('Equipment action missing');
await evalJs(`([...document.querySelectorAll('.kb-actions .kb-action')].find(x=>x.textContent===${JSON.stringify(before)}))?.click(); true`,sid);await sleep(120);
const after=await evalJs(`([...document.querySelectorAll('.kb-actions .kb-action')].map(x=>x.textContent).find(x=>x==='Equipar'||x==='Desequipar'))||null`,sid);
if(!after||after===before)throw new Error(`Equipment did not toggle: ${before} -> ${after}`);
await evalJs(`([...document.querySelectorAll('.kb-actions .kb-action')].find(x=>x.textContent===${JSON.stringify(after)}))?.click(); true`,sid);await sleep(120);
const restored=await evalJs(`([...document.querySelectorAll('.kb-actions .kb-action')].map(x=>x.textContent).find(x=>x==='Equipar'||x==='Desequipar'))||null`,sid);

const final=await evalJs(`(()=>{const root=document.getElementById('kelo-bag');return {visible:!!root&&getComputedStyle(root).display!=='none',detailText:(root?.querySelector('.kb-detail')?.textContent||'').trim(),stats:KeloBackpack.getStats(),slotCount:KeloBackpack.getSlots().length,legacyInventoryLength:STATE.inventory.length,equipmentCount:KeloEquipment.getEquipment().length};})()`,sid);
const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false},sid);
fs.writeFileSync(path.join(artifacts,'live-backpack-mobile.png'),Buffer.from(shot.data,'base64'));
const report={liveReady,initial,moved,persisted,equipmentToggle:{before,after,restored},final,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync(path.join(artifacts,'backpack-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

const sameOrder=JSON.stringify(moved.inventoryOrder)===JSON.stringify(initial.inventoryOrder);
if(initial.title!==expectedTitle)throw new Error('Title mismatch');
if(!initial.visible||initial.touchAction!=='pan-y')throw new Error('Backpack mobile panel contract failed');
if(initial.viewport.w!==390||initial.viewport.h!==844)throw new Error(`Viewport mismatch ${JSON.stringify(initial.viewport)}`);
if(initial.stats.capacity<20||initial.slotCount!==initial.stats.capacity)throw new Error('Capacity contract failed');
if(initial.firstSlotTarget?.w<48||initial.firstSlotTarget?.h<48)throw new Error(`Touch target too small ${JSON.stringify(initial.firstSlotTarget)}`);
if(initial.modelAudit?.mutatesLegacyInventoryOrder!==false)throw new Error('Legacy inventory ownership regression');
if(!moved.sourceEmpty||moved.destinationKey!==initial.occupiedKey||!sameOrder)throw new Error(`Move contract failed ${JSON.stringify(moved)}`);
if(persisted.persistedKey!==initial.occupiedKey||persisted.equipmentCount<1)throw new Error(`Persistence failed ${JSON.stringify(persisted)}`);
if(restored!==before)throw new Error(`Equipment restore failed ${before}/${after}/${restored}`);
if(consoleErrors.length||failedRequests.length||httpErrors.length)throw new Error(`LIVE errors ${JSON.stringify({consoleErrors,failedRequests,httpErrors})}`);

try{await send('Browser.close');}catch{}finally{setTimeout(()=>chrome.kill('SIGKILL'),1000).unref();}
