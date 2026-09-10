/* KELO-INDEX
 * area: CREATORS / AVATAR QA
 * keys: AVATAR AUTODETECT MOBILE NORMALIZE BACKGROUND GRID
 * purpose: prueba en navegador móvil detección irregular 4x4 + transparente 3x4, preview y USE
 * online: N/A; el servicio de red se stubbea, la prueba valida el cliente real
 */
import { chromium } from 'playwright';
import zlib from 'node:zlib';

const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:4173/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
function makeSheet({width=1254,height=1254,columns=4,rows=4,transparent=false}={}){
  const stride=width*4,raw=Buffer.alloc((stride+1)*height),bg=transparent?[0,0,0,0]:[255,255,255,255];
  for(let y=0;y<height;y++){const row=y*(stride+1);raw[row]=0;for(let x=0;x<width;x++){const i=row+1+x*4;raw[i]=bg[0];raw[i+1]=bg[1];raw[i+2]=bg[2];raw[i+3]=bg[3];}}
  const px=(x,y,r,g,b,a=255)=>{if(x<0||y<0||x>=width||y>=height)return;const i=y*(stride+1)+1+x*4;raw[i]=r;raw[i+1]=g;raw[i+2]=b;raw[i+3]=a;},rect=(x0,y0,x1,y1,c)=>{for(let y=Math.max(0,Math.floor(y0));y<Math.min(height,Math.ceil(y1));y++)for(let x=Math.max(0,Math.floor(x0));x<Math.min(width,Math.ceil(x1));x++)px(x,y,...c);};
  const xCenters=columns===4?[249,503,755,1009]:Array.from({length:columns},(_,i)=>Math.round((i+.5)*width/columns)),yCenters=rows===4?[172,486,791,1091]:Array.from({length:rows},(_,i)=>Math.round((i+.5)*height/rows));
  for(let ry=0;ry<rows;ry++)for(let cx=0;cx<columns;cx++){
    const x=xCenters[cx],y=yCenters[ry],side=ry===1?-1:ry===2?1:0,bodyW=(ry===1||ry===2)?116:102,bodyTop=y-72,bodyBottom=y+91,skin=[198,118,72],gold=[190,127,28],dark=[45,36,31],headX=x+side*14;
    rect(x-bodyW/2,bodyTop,x+bodyW/2,bodyBottom,skin);rect(headX-29,y-132,headX+29,y-66,skin);rect(x-14,y-78,x+14,y-58,skin);
    rect(x-bodyW/2-22,y-48,x-bodyW/2+8,y+44,skin);rect(x+bodyW/2-8,y-48,x+bodyW/2+22,y+44,skin);
    rect(x-44,y+82,x-8,y+145,skin);rect(x+8,y+82,x+44,y+145,skin);
    rect(x-bodyW/2+8,y-32,x+bodyW/2-8,y+46,[255,255,255]);rect(x-bodyW/2+3,y+38,x+bodyW/2-3,y+54,gold);
    if(ry===0)rect(headX-18,y-111,headX+18,y-91,dark);if(ry===1)rect(headX-29,y-108,headX-18,y-92,dark);if(ry===2)rect(headX+18,y-108,headX+29,y-92,dark);
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
await page.evaluate(async()=>{const mod=await import(`/src/creators/ui/avatar-workspace.mjs?v2-live=${Date.now()}`);window.__avatarV2Use=null;await mod.openAvatarQuickImport({root:window,avatarQuick:{hydrateActive:async()=>null,importAndUse:async(file,config)=>{window.__avatarV2Use={name:file.name,columns:config.columns,rows:config.rows,removeBackground:config.removeBackground,detectionMode:config.detectionMode,confidenceScore:config.confidenceScore,autoCrop:config.autoCrop,sourceRects:config.sourceRects?.length||0,rowMap:config.rowMap};return{manifest:{displayName:'QA Auto Avatar'}};}}});});
await page.waitForSelector('#kelo-avatar-quick',{state:'visible',timeout:10000});
const input=page.locator('#kelo-avatar-quick input[type="file"]');
await input.setInputFiles({name:'kelo-irregular-1254.png',mimeType:'image/png',buffer:makeSheet()});
await page.waitForFunction(()=>{const s=document.querySelector('#kelo-avatar-quick .kaq-status')?.textContent||'',b=document.querySelector('#kelo-avatar-quick .kaq-use');return s.includes('Avatar detectado')&&s.includes('4×4')&&b&&!b.disabled;},null,{timeout:18000});
const uiState=await page.evaluate(()=>({status:document.querySelector('.kaq-status')?.textContent||'',chips:[...document.querySelectorAll('.kaq-chip')].map(x=>x.textContent),advancedOpen:document.querySelector('.kaq-advanced')?.open,firstFrame:document.querySelector('.kaq-preview canvas')?.toDataURL()}));
if(!uiState.chips.some(x=>x==='AUTO-CROP'))throw new Error(`AVATAR_V2_AUTOCROP_CHIP_MISSING:${uiState.chips.join(',')}`);
if(uiState.advancedOpen)throw new Error('AVATAR_V2_HIGH_CONFIDENCE_OPENED_ADVANCED');
await page.waitForTimeout(190);const secondFrame=await page.locator('.kaq-preview canvas').evaluate(c=>c.toDataURL());if(secondFrame===uiState.firstFrame)throw new Error('AVATAR_V2_PREVIEW_NOT_ANIMATING');

const proof=await page.evaluate(async()=>{
  const file=document.querySelector('#kelo-avatar-quick input[type="file"]').files[0],mod=await import(`/src/creators/avatar/avatar-spritesheet-analyzer.mjs?v2-proof=${Date.now()}`),analysis=await mod.analyzeAvatarSpriteSheet(file,{root:window}),compiled=await mod.compileAvatarRuntime(file,analysis,{root:window}),bmp=await createImageBitmap(compiled.blob),c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bmp,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let transparent=0,opaqueWhite=0;for(let i=0;i<data.length;i+=4){if(data[i+3]<8)transparent++;if(data[i+3]>240&&data[i]>245&&data[i+1]>245&&data[i+2]>245)opaqueWhite++;}bmp.close();return{analysis:{version:analysis.version,columns:analysis.columns,rows:analysis.rows,mode:analysis.detectionMode,confidence:analysis.confidenceScore,directionConfidence:analysis.directionConfidence,rowMap:analysis.rowMap,rects:analysis.sourceRects?.length||0,autoCrop:analysis.autoCrop,backgroundKind:analysis.backgroundKind},compiled:{width:compiled.width,height:compiled.height,type:compiled.type,normalized:compiled.normalized},transparent,opaqueWhite};
});
if(proof.analysis.columns!==4||proof.analysis.rows!==4||proof.analysis.mode!=='components'||proof.analysis.rects!==16||!proof.analysis.autoCrop)throw new Error(`AVATAR_V2_IRREGULAR_GRID_FAILED:${JSON.stringify(proof.analysis)}`);
if(proof.analysis.confidence<.82)throw new Error(`AVATAR_V2_CONFIDENCE_TOO_LOW:${proof.analysis.confidence}`);
const rm=proof.analysis.rowMap;if(rm.down!==0||rm.left!==1||rm.right!==2||rm.up!==3)throw new Error(`AVATAR_V2_DIRECTION_INFERENCE_FAILED:${JSON.stringify(rm)}`);
if(!proof.compiled.normalized||proof.compiled.width>1024||proof.compiled.height>1024)throw new Error(`AVATAR_V2_NORMALIZE_FAILED:${JSON.stringify(proof.compiled)}`);
if(proof.transparent<1000)throw new Error(`AVATAR_V2_BACKGROUND_NOT_REMOVED:${proof.transparent}`);
if(proof.opaqueWhite<1000)throw new Error(`AVATAR_V2_INTERIOR_WHITE_NOT_PRESERVED:${proof.opaqueWhite}`);

const transparentProof=await page.evaluate(async bytes=>{
  const file=new File([new Uint8Array(bytes)],'transparent-3x4.png',{type:'image/png'}),mod=await import(`/src/creators/avatar/avatar-spritesheet-analyzer.mjs?v2-transparent=${Date.now()}`),a=await mod.analyzeAvatarSpriteSheet(file,{root:window}),c=await mod.compileAvatarRuntime(file,a,{root:window});return{columns:a.columns,rows:a.rows,mode:a.detectionMode,confidence:a.confidenceScore,backgroundKind:a.backgroundKind,removeBackground:a.removeBackground,rects:a.sourceRects?.length||0,normalized:c.normalized};
},[...makeSheet({width:930,height:1240,columns:3,rows:4,transparent:true})]);
if(transparentProof.columns!==3||transparentProof.rows!==4||transparentProof.mode!=='components'||transparentProof.rects!==12||transparentProof.backgroundKind!=='transparent'||transparentProof.removeBackground!==false||!transparentProof.normalized)throw new Error(`AVATAR_V2_TRANSPARENT_3X4_FAILED:${JSON.stringify(transparentProof)}`);

for(const face of ['left','down','up','right']){await page.locator(`.kaq-directions button[data-face="${face}"]`).click();if(!await page.locator(`.kaq-directions button[data-face="${face}"]`).evaluate(b=>b.classList.contains('on')))throw new Error(`AVATAR_V2_DIRECTION_PREVIEW_FAILED:${face}`);}
await page.getByRole('button',{name:'USAR COMO AVATAR'}).click();await page.waitForFunction(()=>document.querySelector('.kaq-use')?.textContent?.includes('AVATAR ACTIVO'),null,{timeout:5000});
const used=await page.evaluate(()=>window.__avatarV2Use);if(!used||used.columns!==4||used.rows!==4||used.detectionMode!=='components'||used.sourceRects!==16||!used.autoCrop)throw new Error(`AVATAR_V2_USE_PIPELINE_FAILED:${JSON.stringify(used)}`);
if(pageErrors.length)throw new Error(`AVATAR_V2_PAGE_ERRORS:${pageErrors.join(' | ')}`);
console.log(JSON.stringify({ok:true,ui:uiState.status,irregular4x4:proof,transparent3x4:transparentProof,activated:used},null,2));
await browser.close();
