import { chromium } from 'playwright';
import zlib from 'node:zlib';

const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:4173/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;

function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
function makeTestPng(width=1254,height=1254){
  const stride=width*4,raw=Buffer.alloc((stride+1)*height);const colors=[[66,120,220],[220,96,80],[82,176,118],[184,104,210]];
  for(let y=0;y<height;y++){const row=y*(stride+1);raw[row]=0;for(let x=0;x<width;x++){const i=row+1+x*4;raw[i]=255;raw[i+1]=255;raw[i+2]=255;raw[i+3]=255;}}
  const px=(x,y,r,g,b,a=255)=>{const i=y*(stride+1)+1+x*4;raw[i]=r;raw[i+1]=g;raw[i+2]=b;raw[i+3]=a;};
  for(let ry=0;ry<4;ry++)for(let cx=0;cx<4;cx++){
    const x0=Math.floor(cx*width/4),x1=Math.floor((cx+1)*width/4),y0=Math.floor(ry*height/4),y1=Math.floor((ry+1)*height/4),base=colors[(cx+ry)%colors.length];
    for(let y=y0+42;y<y1-42;y++)for(let x=x0+52;x<x1-52;x++)px(x,y,base[0],base[1],base[2]);
    for(let y=y0+112;y<Math.min(y1-112,y0+180);y++)for(let x=x0+122;x<Math.min(x1-122,x0+186);x++)px(x,y,255,255,255);
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
await page.evaluate(async()=>{
  const mod=await import(`/src/creators/ui/avatar-workspace.mjs?avatar-live=${Date.now()}`);
  window.__avatarLiveUse=null;
  await mod.openAvatarQuickImport({root:window,avatarQuick:{
    hydrateActive:async()=>null,
    importAndUse:async(file,config)=>{window.__avatarLiveUse={name:file.name,columns:config.columns,rows:config.rows,removeBackground:config.removeBackground};return{manifest:{displayName:'QA Avatar'}};}
  }});
});
await page.waitForSelector('#kelo-avatar-quick',{state:'visible',timeout:10000});
const input=page.locator('#kelo-avatar-quick input[type="file"]');
await input.setInputFiles({name:'kelo-avatar-1254.png',mimeType:'image/png',buffer:makeTestPng()});
await page.waitForFunction(()=>{const s=document.querySelector('#kelo-avatar-quick .kaq-status')?.textContent||'',b=document.querySelector('#kelo-avatar-quick .kaq-use');return s.includes('4×4')&&s.includes('1254×1254px')&&b&&!b.disabled;},null,{timeout:15000});
const initial=await page.evaluate(()=>({
  status:document.querySelector('#kelo-avatar-quick .kaq-status')?.textContent||'',
  cols:document.querySelector('#kelo-avatar-quick .kaq-grid input:nth-of-type(1)')?.value||document.querySelectorAll('#kelo-avatar-quick .kaq-grid input')[0]?.value,
  rows:document.querySelectorAll('#kelo-avatar-quick .kaq-grid input')[1]?.value,
  remove:document.querySelector('#kelo-avatar-quick .kaq-check input')?.checked,
  advancedOpen:document.querySelector('#kelo-avatar-quick details')?.open,
  firstFrame:document.querySelector('#kelo-avatar-quick canvas')?.toDataURL()
}));
if(initial.cols!=='4'||initial.rows!=='4')throw new Error(`AVATAR_GRID_NOT_4X4:${initial.cols}x${initial.rows}`);
if(initial.remove!==true)throw new Error('AVATAR_LIGHT_BACKGROUND_NOT_DETECTED');
if(initial.advancedOpen!==false)throw new Error('AVATAR_ADVANCED_NOT_COLLAPSED');
await page.waitForTimeout(190);
const secondFrame=await page.locator('#kelo-avatar-quick canvas').evaluate(c=>c.toDataURL());
if(secondFrame===initial.firstFrame)throw new Error('AVATAR_PREVIEW_NOT_ANIMATING');
const alpha=await page.evaluate(async()=>{
  const file=document.querySelector('#kelo-avatar-quick input[type="file"]').files[0];
  const mod=await import(`/src/creators/avatar/avatar-spritesheet-analyzer.mjs?alpha=${Date.now()}`);
  const analysis=await mod.analyzeAvatarSpriteSheet(file,{root:window});
  const compiled=await mod.compileAvatarRuntime(file,analysis,{root:window});
  const bmp=await createImageBitmap(compiled.blob),c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bmp,0,0);const edge=ctx.getImageData(4,4,1,1).data[3],scale=bmp.width/1254,inner=ctx.getImageData(Math.round(150*scale),Math.round(145*scale),1,1).data[3];bmp.close();return{edge,inner,type:compiled.type,width:compiled.width,height:compiled.height};
});
if(alpha.edge>8)throw new Error(`AVATAR_EDGE_BACKGROUND_NOT_REMOVED:${alpha.edge}`);
if(alpha.inner<220)throw new Error(`AVATAR_INTERIOR_WHITE_WAS_REMOVED:${alpha.inner}`);
for(const face of ['left','down','up','right']){await page.locator(`#kelo-avatar-quick .kaq-directions button[data-face="${face}"]`).click();const on=await page.locator(`#kelo-avatar-quick .kaq-directions button[data-face="${face}"]`).evaluate(b=>b.classList.contains('on'));if(!on)throw new Error(`AVATAR_DIRECTION_PREVIEW_FAILED:${face}`);}
await page.getByRole('button',{name:'USAR COMO AVATAR'}).click();
await page.waitForFunction(()=>document.querySelector('#kelo-avatar-quick .kaq-use')?.textContent?.includes('AVATAR ACTIVO'),null,{timeout:5000});
const used=await page.evaluate(()=>window.__avatarLiveUse);
if(!used||used.name!=='kelo-avatar-1254.png'||used.columns!==4||used.rows!==4||used.removeBackground!==true)throw new Error(`AVATAR_USE_PIPELINE_NOT_CALLED:${JSON.stringify(used)}`);
if(pageErrors.length)throw new Error(`AVATAR_PAGE_ERRORS:${pageErrors.join(' | ')}`);
console.log(JSON.stringify({ok:true,status:initial.status,grid:'4x4',source:'1254x1254',compiled:`${alpha.width}x${alpha.height} ${alpha.type}`,edgeAlpha:alpha.edge,interiorWhiteAlpha:alpha.inner,activated:used},null,2));
await browser.close();
