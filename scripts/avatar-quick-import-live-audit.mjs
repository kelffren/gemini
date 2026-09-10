/* KELO-INDEX
 * area: CREATORS / AVATAR QA
 * keys: AVATAR UNIVERSAL-COMPILER MOBILE CANONICAL-RIG SELF-HEAL STRIP
 * purpose: browser proof for irregular grid, transparent grid, strip adaptation, preview and USE through Universal Compiler V5
 * online: N/A; network service is stubbed, test validates the real browser compiler/UI
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
await page.evaluate(async()=>{const mod=await import(`/src/creators/ui/avatar-workspace.mjs?v5-live=${Date.now()}`);window.__avatarV5Use=null;await mod.openAvatarQuickImport({root:window,avatarQuick:{hydrateActive:async()=>null,importAndUse:async(file,config)=>{window.__avatarV5Use={name:file.name,columns:config.columns,rows:config.rows,removeBackground:config.removeBackground,detectionMode:config.detectionMode,confidenceScore:config.confidenceScore,autoCrop:config.autoCrop,sourceRects:config.sourceRects?.length||0,rowMap:config.rowMap,compilerVersion:config.compilerVersion,universalAuto:config.universalAuto};return{manifest:{displayName:'QA Universal Avatar'}};}}});});
await page.waitForSelector('#kelo-avatar-quick',{state:'visible',timeout:10000});
const input=page.locator('#kelo-avatar-quick input[type="file"]');
await input.setInputFiles({name:'kelo-irregular-1254.png',mimeType:'image/png',buffer:makeSheet()});
await page.waitForFunction(()=>{const s=document.querySelector('#kelo-avatar-quick .kaq-status')?.textContent||'',b=document.querySelector('#kelo-avatar-quick .kaq-use');return s.includes('listo para usar')&&s.includes('4 direcciones')&&b&&!b.disabled;},null,{timeout:45000});
const uiState=await page.evaluate(()=>({status:document.querySelector('.kaq-status')?.textContent||'',chips:[...document.querySelectorAll('.kaq-chip')].map(x=>x.textContent),advancedOpen:document.querySelector('.kaq-advanced')?.open,firstFrame:document.querySelector('.kaq-preview canvas')?.toDataURL()}));
if(!uiState.chips.some(x=>x==='AUTO-CROP'))throw new Error(`AVATAR_V5_AUTOCROP_CHIP_MISSING:${uiState.chips.join(',')}`);
if(!uiState.chips.some(x=>x==='RIG KELO 4D'))throw new Error(`AVATAR_V5_CANONICAL_RIG_CHIP_MISSING:${uiState.chips.join(',')}`);
if(!uiState.chips.some(x=>x.startsWith('SALUD ')))throw new Error(`AVATAR_V5_HEALTH_CHIP_MISSING:${uiState.chips.join(',')}`);
await page.waitForTimeout(190);const secondFrame=await page.locator('.kaq-preview canvas').evaluate(c=>c.toDataURL());if(secondFrame===uiState.firstFrame)throw new Error('AVATAR_V5_PREVIEW_NOT_ANIMATING');

const proof=await page.evaluate(async()=>{
  const file=document.querySelector('#kelo-avatar-quick input[type="file"]').files[0],mod=await import(`/src/creators/avatar/kelo-universal-asset-compiler.mjs?v5-proof=${Date.now()}`),analysis=await mod.analyzeUniversalAvatarAsset(file,{root:window}),compiled=await mod.compileUniversalAvatarRuntime(file,analysis,{root:window}),bmp=await createImageBitmap(compiled.blob),c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bmp,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let transparent=0,opaqueWhite=0;for(let i=0;i<data.length;i+=4){if(data[i+3]<8)transparent++;if(data[i+3]>240&&data[i]>245&&data[i+1]>245&&data[i+2]>245)opaqueWhite++;}bmp.close();return{analysis:{version:analysis.version,compilerVersion:analysis.compilerVersion,columns:analysis.columns,rows:analysis.rows,confidence:analysis.confidenceScore,directionConfidence:analysis.directionConfidence,rowMap:analysis.rowMap,rects:analysis.sourceRects?.length||0,autoCrop:analysis.autoCrop,backgroundKind:analysis.backgroundKind,hypotheses:analysis.hypotheses?.length||0},compiled:{columns:compiled.columns,rows:compiled.rows,rowMap:compiled.rowMap,width:compiled.width,height:compiled.height,type:compiled.type,normalized:compiled.normalized,canonicalRig:compiled.canonicalRig,strategy:compiled.strategy,confidence:compiled.confidenceScore,health:compiled.validation?.health,selfHealed:compiled.selfHealed},transparent,opaqueWhite};
});
if(proof.analysis.compilerVersion!=='5.0.0'||proof.analysis.columns!==4||proof.analysis.rows!==4||proof.analysis.rects!==16||!proof.analysis.autoCrop||proof.analysis.hypotheses<2)throw new Error(`AVATAR_V5_ANALYSIS_FAILED:${JSON.stringify(proof.analysis)}`);
if(!proof.compiled.canonicalRig||proof.compiled.rows!==4||proof.compiled.rowMap.down!==0||proof.compiled.rowMap.left!==1||proof.compiled.rowMap.right!==2||proof.compiled.rowMap.up!==3)throw new Error(`AVATAR_V5_CANONICAL_RIG_FAILED:${JSON.stringify(proof.compiled)}`);
if(!proof.compiled.normalized||proof.compiled.width>1024||proof.compiled.height>1024||proof.compiled.health<.65)throw new Error(`AVATAR_V5_VALIDATION_FAILED:${JSON.stringify(proof.compiled)}`);
if(proof.transparent<1000)throw new Error(`AVATAR_V5_BACKGROUND_NOT_REMOVED:${proof.transparent}`);
if(proof.opaqueWhite<1000)throw new Error(`AVATAR_V5_INTERIOR_WHITE_NOT_PRESERVED:${proof.opaqueWhite}`);

const transparentProof=await page.evaluate(async bytes=>{const file=new File([new Uint8Array(bytes)],'transparent-3x4.png',{type:'image/png'}),mod=await import(`/src/creators/avatar/kelo-universal-asset-compiler.mjs?v5-transparent=${Date.now()}`),a=await mod.analyzeUniversalAvatarAsset(file,{root:window}),c=await mod.compileUniversalAvatarRuntime(file,a,{root:window});return{columns:a.columns,rows:a.rows,backgroundKind:a.backgroundKind,removeBackground:a.removeBackground,rects:a.sourceRects?.length||0,compiledColumns:c.columns,compiledRows:c.rows,canonicalRig:c.canonicalRig,health:c.validation?.health};},[...makeSheet({width:930,height:1240,columns:3,rows:4,transparent:true})]);
if(transparentProof.columns!==3||transparentProof.rows!==4||transparentProof.rects!==12||transparentProof.backgroundKind!=='transparent'||transparentProof.removeBackground!==false||transparentProof.compiledRows!==4||!transparentProof.canonicalRig||transparentProof.health<.6)throw new Error(`AVATAR_V5_TRANSPARENT_3X4_FAILED:${JSON.stringify(transparentProof)}`);

const stripProof=await page.evaluate(async bytes=>{const file=new File([new Uint8Array(bytes)],'walk-strip-6x1.png',{type:'image/png'}),mod=await import(`/src/creators/avatar/kelo-universal-asset-compiler.mjs?v5-strip=${Date.now()}`),a=await mod.analyzeUniversalAvatarAsset(file,{root:window}),c=await mod.compileUniversalAvatarRuntime(file,a,{root:window});return{source:[a.columns,a.rows],hypotheses:a.hypotheses?.map(x=>x.mode),compiled:[c.columns,c.rows],strategy:c.strategy,canonicalRig:c.canonicalRig,health:c.validation?.health};},[...makeSheet({width:960,height:160,columns:6,rows:1,transparent:true})]);
if(!stripProof.hypotheses?.includes('horizontal-strip')||stripProof.compiled[1]!==4||!stripProof.canonicalRig||stripProof.health<.55)throw new Error(`AVATAR_V5_HORIZONTAL_STRIP_FAILED:${JSON.stringify(stripProof)}`);

for(const face of ['left','down','up','right']){await page.locator(`.kaq-directions button[data-face="${face}"]`).click();if(!await page.locator(`.kaq-directions button[data-face="${face}"]`).evaluate(b=>b.classList.contains('on')))throw new Error(`AVATAR_V5_DIRECTION_PREVIEW_FAILED:${face}`);}
await page.getByRole('button',{name:'USAR COMO AVATAR'}).click();await page.waitForFunction(()=>document.querySelector('.kaq-use')?.textContent?.includes('AVATAR ACTIVO'),null,{timeout:5000});
const used=await page.evaluate(()=>window.__avatarV5Use);if(!used||used.columns!==4||used.rows!==4||used.sourceRects!==16||!used.autoCrop||used.compilerVersion!=='5.0.0'||used.universalAuto!==true)throw new Error(`AVATAR_V5_USE_PIPELINE_FAILED:${JSON.stringify(used)}`);
if(pageErrors.length)throw new Error(`AVATAR_V5_PAGE_ERRORS:${pageErrors.join(' | ')}`);
console.log(JSON.stringify({ok:true,ui:uiState.status,irregular4x4:proof,transparent3x4:transparentProof,horizontalStrip:stripProof,activated:used},null,2));
await browser.close();
