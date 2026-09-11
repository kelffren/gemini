import fs from 'node:fs';
import { chromium } from 'playwright';
const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:8000/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
fs.mkdirSync('artifacts/sprite-ability-loose',{recursive:true});
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
try{
  await page.goto(`${BASE}?offline=1&mapEditor=1&loose-import-audit=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_CREATORS_LAUNCHER&&window.KELO_ADMIN_KEYS?.can?.('ability.edit',window.KELO_ADMIN_KEYS.playerId())===true&&window.KeloInputLocks,{timeout:20000});
  await page.evaluate(()=>{document.documentElement.dataset.keloAuthGate='off';void window.KELO_CREATORS_LAUNCHER.open();});
  await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:10000});
  await page.getByRole('button',{name:'Abrir Sprite Ability'}).click();
  await page.waitForSelector('#kelo-studio-workspace',{state:'visible',timeout:10000});
  await page.waitForSelector('.sab-easy-mode-toggle',{state:'visible',timeout:5000});
  await page.getByRole('button',{name:'⚙ AVANZADO'}).click();
  await page.waitForFunction(()=>document.getElementById('kelo-studio-workspace')?.dataset?.sabEasy==='0');
  await page.waitForSelector('.sab-loose-launch',{state:'attached',timeout:5000});
  await page.waitForSelector('.sab-loose-file',{state:'attached',timeout:5000});

  const files=[];
  for(let index=0;index<4;index++){
    const b64=await page.evaluate(i=>{const widths=[94,126,82,112],heights=[132,96,148,118],w=widths[i],h=heights[i],c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,w,h);x.fillStyle=`rgb(${45+i*35},${105+i*20},${220-i*20})`;const left=i===3?0:Math.round(w*.2),top=Math.round(h*.12),rw=Math.round(w*.58),rh=Math.round(h*.76);x.fillRect(left,top,rw,rh);x.fillStyle='#f6d866';x.fillRect(left+Math.round(rw*.3),top+Math.round(rh*.15),Math.max(8,Math.round(rw*.24)),Math.max(8,Math.round(rh*.18)));return c.toDataURL('image/png').split(',')[1];},index);
    files.push({name:`frame-${index}.png`,mimeType:'image/png',buffer:Buffer.from(b64,'base64')});
  }
  await page.locator('.sab-loose-file').setInputFiles(files);
  await page.waitForFunction(async()=>{const b=(await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs')).getSpriteAbilityBuilder();return Boolean(b?.draft?.sheet?.dataUrl)&&String(b?.draft?.sheet?.fileName||'').includes('loose-4-frames')&&b.draft.sheet.endFrame>=3;},null,{timeout:15000});
  const report=await page.evaluate(async()=>{const b=(await import('./src/creators/sprite-ability/sprite-ability-live-controller.mjs')).getSpriteAbilityBuilder();return{loose:window.__KELO_SPRITE_LOOSE_LAST__||null,sheet:{fileName:b.draft.sheet.fileName,columns:b.draft.sheet.columns,rows:b.draft.sheet.rows,startFrame:b.draft.sheet.startFrame,endFrame:b.draft.sheet.endFrame,frameWidth:b.draft.sheet.frameWidth,frameHeight:b.draft.sheet.frameHeight,autoFit:b.draft.sheet.autoFit}};});
  report.pageErrors=pageErrors;
  if(!report.loose||report.loose.input!==4||report.loose.usable!==4||report.loose.cleaned!==4)throw new Error(`LOOSE_REPORT:${JSON.stringify(report.loose)}`);
  if(report.loose.grid[0]!==4||report.loose.grid[1]!==1)throw new Error(`LOOSE_GRID:${JSON.stringify(report.loose.grid)}`);
  if(report.loose.removedPixels<=0)throw new Error('LOOSE_NO_BACKGROUND_PIXELS_REMOVED');
  if(pageErrors.length)throw new Error(`LOOSE_PAGE_ERRORS:${pageErrors.join(' | ')}`);
  await page.screenshot({path:'artifacts/sprite-ability-loose/loose-import-builder.png',fullPage:true});
  fs.writeFileSync('artifacts/sprite-ability-loose/report.json',JSON.stringify(report,null,2));
  console.log('SPRITE ABILITY LOOSE IMPORT MOBILE AUDIT: PASS');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
