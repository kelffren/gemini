/* KELO-INDEX
 * area: CREATORS / AVATAR
 * owner: Kelo Universal Asset Compiler V5
 * keys: AVATAR UNIVERSAL COMPILER HYPOTHESES STRIP-PROJECTION SELF-HEAL VALIDATE CANONICAL-RIG SCALE-LOCK FOOT-ANCHOR
 * purpose: accept heterogeneous avatar sprite sheets, generate competing interpretations, repair/normalize them, validate the result and emit one canonical Kelo runtime sheet
 * public-api: analyzeUniversalAvatarAsset(file), compileUniversalAvatarRuntime(file,config)
 * consumes: avatar-spritesheet-analyzer V4 + browser Canvas/ImageBitmap
 * state-owned: none; pure file -> analysis/runtime derivative
 * extension-points: strategy generators, validators, semantic direction adapters, optional AI fallback
 * online: N/A; persistence stays in Avatar Quick Import service
 * do-not: render gameplay, persist content, bypass ownership or auth
 */
import {analyzeAvatarSpriteSheet,compileAvatarRuntime} from './avatar-spritesheet-analyzer.mjs';

const F=Object.freeze;
const FACE_ROWS=F({down:0,left:1,right:2,up:3});
const MAX_TRIALS=10;
const VALIDATION_MAX=512;
const STRIP_PROBE_MAX=420;
const MAX_RUNTIME_BYTES=2*1024*1024;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
const mean=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:0;
const median=a=>{const b=[...a].sort((x,y)=>x-y);if(!b.length)return 0;const m=(b.length-1)/2;return(b[Math.floor(m)]+b[Math.ceil(m)])/2;};
const cv=a=>{if(a.length<2)return 0;const m=mean(a);if(!m)return 1;return Math.sqrt(mean(a.map(x=>(x-m)**2)))/m;};

function canvasFor(root,w,h){const c=root.document?.createElement?.('canvas');if(!c)throw new Error('UNIVERSAL_CANVAS_UNAVAILABLE');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;}
async function bitmapFor(file,root){if(root.createImageBitmap)return root.createImageBitmap(file);if(!root.document||!root.URL?.createObjectURL)throw new Error('UNIVERSAL_IMAGE_DECODE_UNAVAILABLE');const url=root.URL.createObjectURL(file);try{return await new Promise((resolve,reject)=>{const img=new root.Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('UNIVERSAL_IMAGE_INVALID'));img.src=url;});}finally{root.URL.revokeObjectURL(url);}}
function canvasBlob(canvas,type='image/png',quality=.92){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('UNIVERSAL_RUNTIME_ENCODE_FAILED')),type,quality));}
function equalRects(columns,rows,width,height){const out=[];for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const x0=x*width/columns,y0=y*height/rows,x1=(x+1)*width/columns,y1=(y+1)*height/rows;out.push({x:x0,y:y0,w:x1-x0,h:y1-y0,fallback:true});}return out;}
function verticalRects(frames,width,height){const out=[];for(let y=0;y<frames;y++){const y0=y*height/frames,y1=(y+1)*height/frames;out.push({x:0,y:y0,w:width,h:y1-y0,fallback:true});}return out;}
function rowMapFor(rows,base={}){const max=Math.max(0,rows-1),src=base.rowMap||{};return{down:clamp(Math.round(src.down??0),0,max),left:clamp(Math.round(src.left??Math.min(1,max)),0,max),right:clamp(Math.round(src.right??Math.min(2,max)),0,max),up:clamp(Math.round(src.up??Math.min(3,max)),0,max)};}
function candidateKey(c){return `${c.columns}x${c.rows}:${c.mode}`;}

function foregroundAt(data,i,base){const a=data[i+3];if(a<24)return false;if(base.backgroundKind==='transparent')return true;if(base.backgroundUniform===false)return false;const bg=Array.isArray(base.backgroundRgb)?base.backgroundRgb:[255,255,255],d=Math.hypot(data[i]-bg[0],data[i+1]-bg[1],data[i+2]-bg[2]),t=Math.max(26,(Number(base.backgroundThreshold)||72)*.68);return d>t;}
function mergeTinyProjectionGaps(active,maxGap){const out=active.slice();let i=0;while(i<out.length){while(i<out.length&&out[i])i++;const start=i;while(i<out.length&&!out[i])i++;const end=i-1;if(start>0&&i<out.length&&end-start+1<=maxGap)for(let p=start;p<=end;p++)out[p]=1;}return out;}
function runsFromProjection(density,minDensity,maxGap){const active=mergeTinyProjectionGaps(Array.from(density,v=>v>=minDensity?1:0),maxGap),runs=[];let i=0;while(i<active.length){while(i<active.length&&!active[i])i++;if(i>=active.length)break;const start=i;while(i<active.length&&active[i])i++;runs.push({start,end:i});}return runs;}
function rectsFromRuns(runs,axis,probeW,probeH,sourceW,sourceH){const out=[],scaleX=sourceW/probeW,scaleY=sourceH/probeH;for(let i=0;i<runs.length;i++){const prev=runs[i-1],r=runs[i],next=runs[i+1];if(axis==='x'){const x0=i?Math.floor((prev.end+r.start)/2):0,x1=next?Math.ceil((r.end+next.start)/2):probeW;out.push({x:x0*scaleX,y:0,w:Math.max(1,(x1-x0)*scaleX),h:sourceH,fallback:false});}else{const y0=i?Math.floor((prev.end+r.start)/2):0,y1=next?Math.ceil((r.end+next.start)/2):probeH;out.push({x:0,y:y0*scaleY,w:sourceW,h:Math.max(1,(y1-y0)*scaleY),fallback:false});}}return out;}
async function probeStripLayout(file,base,root){
  const sourceW=Number(base.width)||1,sourceH=Number(base.height)||1,ratio=sourceW/sourceH,axis=ratio>=1.55?'x':ratio<=.65?'y':null;if(!axis)return null;
  const bitmap=await bitmapFor(file,root),scale=Math.min(1,STRIP_PROBE_MAX/Math.max(sourceW,sourceH)),w=Math.max(1,Math.round(sourceW*scale)),h=Math.max(1,Math.round(sourceH*scale)),canvas=canvasFor(root,w,h),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.drawImage(bitmap,0,0,w,h);bitmap.close?.();const image=ctx.getImageData(0,0,w,h),len=axis==='x'?w:h,density=new Float32Array(len);
  if(axis==='x')for(let x=0;x<w;x++){let n=0;for(let y=0;y<h;y++)if(foregroundAt(image.data,(y*w+x)*4,base))n++;density[x]=n/Math.max(1,h);}else for(let y=0;y<h;y++){let n=0;for(let x=0;x<w;x++)if(foregroundAt(image.data,(y*w+x)*4,base))n++;density[y]=n/Math.max(1,w);}
  const minDensity=Math.max(.006,2/(axis==='x'?h:w)),runs=runsFromProjection(density,minDensity,Math.max(1,Math.round(len*.009)));if(runs.length<2||runs.length>16)return null;
  const widths=runs.map(r=>r.end-r.start),gaps=runs.slice(1).map((r,i)=>Math.max(1,r.start-runs[i].end)),regularity=clamp(1-cv(widths)*.8-cv(gaps)*.2),score=clamp(.84+.14*regularity),sourceRects=rectsFromRuns(runs,axis,w,h,sourceW,sourceH);
  return F({axis,frames:runs.length,columns:runs.length,rows:1,sourceRects:F(sourceRects.map(r=>F(r))),score,mode:axis==='x'?'projection-strip-horizontal':'projection-strip-vertical'});
}

function buildHypotheses(base){
  const width=Number(base.width)||1,height=Number(base.height)||1,out=[],seen=new Set();
  const push=(columns,rows,mode,prior,sourceRects=null,why='')=>{columns=Math.max(1,Math.round(columns));rows=Math.max(1,Math.round(rows));if(columns>16||rows>12||columns*rows>64)return;const key=candidateKey({columns,rows,mode});if(seen.has(key))return;seen.add(key);out.push(F({columns,rows,mode,prior:clamp(prior),sourceRects,why,rowMap:rowMapFor(rows,base)}));};
  if(base.stripHint?.sourceRects?.length)push(base.stripHint.columns,1,base.stripHint.mode,base.stripHint.score,base.stripHint.sourceRects,'foreground projection found separated strip frames');
  push(base.columns,base.rows,String(base.detectionMode||'adaptive-v4'),Math.max(.58,Number(base.confidenceScore)||.58),Array.isArray(base.sourceRects)?base.sourceRects:null,'V4 adaptive component/grid analysis');
  for(const c of Array.isArray(base.gridCandidates)?base.gridCandidates:[])push(c.columns,c.rows,'grid-candidate',.45+.42*clamp(c.score),null,'alternate V4 grid candidate');
  const ratio=width/height;
  if(ratio>=1.45){for(let columns=2;columns<=12;columns++){const aspect=(width/columns)/height;if(aspect>=.42&&aspect<=2.2)push(columns,1,'horizontal-strip',.57-Math.abs(aspect-.9)*.07,null,'horizontal animation strip');}}
  if(ratio<=.70){for(let frames=2;frames<=12;frames++){const aspect=width/(height/frames);if(aspect>=.42&&aspect<=2.2)push(frames,1,'vertical-strip',.55-Math.abs(aspect-.9)*.07,verticalRects(frames,width,height),'vertical strip repacked horizontally');}}
  if(base.rows>4)push(base.columns,4,'four-direction-projection',.56,null,'project oversized direction sheet into four runtime rows');
  push(1,1,'single-character',.38,null,'static avatar fallback');
  return out.sort((a,b)=>b.prior-a.prior).slice(0,MAX_TRIALS);
}

function alphaStats(data,w,h){let area=0,minX=w,minY=h,maxX=-1,maxY=-1,border=0,opaque=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=data[(y*w+x)*4+3];if(a<=18)continue;area++;if(a>180)opaque++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);if(x<=1||y<=1||x>=w-2||y>=h-2)border++;}if(!area)return{area:0,w:0,h:0,bottom:0,borderRatio:1,opaqueRatio:0};return{area,w:maxX-minX+1,h:maxY-minY+1,bottom:(maxY+1)/h,borderRatio:border/area,opaqueRatio:opaque/area};}
async function validateCompiled(compiled,{root=globalThis}={}){
  const bitmap=await bitmapFor(compiled.blob,root),sourceW=bitmap.width||bitmap.naturalWidth,sourceH=bitmap.height||bitmap.naturalHeight,scale=Math.min(1,VALIDATION_MAX/Math.max(sourceW,sourceH)),width=Math.max(1,Math.round(sourceW*scale)),height=Math.max(1,Math.round(sourceH*scale)),columns=Math.max(1,compiled.columns||1),rows=Math.max(1,compiled.rows||1),canvas=canvasFor(root,width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=true;ctx.drawImage(bitmap,0,0,width,height);bitmap.close?.();
  const fw=width/columns,fh=height/rows,stats=[];for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){const x0=Math.floor(col*fw),y0=Math.floor(row*fh),x1=Math.ceil((col+1)*fw),y1=Math.ceil((row+1)*fh),im=ctx.getImageData(x0,y0,Math.max(1,x1-x0),Math.max(1,y1-y0));stats.push(alphaStats(im.data,im.width,im.height));}
  const alive=stats.filter(s=>s.area>0),occupancy=alive.length/Math.max(1,stats.length),sizeConsistency=alive.length?clamp(1-(cv(alive.map(s=>s.h))*.55+cv(alive.map(s=>s.w))*.45)):0,bottomConsistency=alive.length?clamp(1-cv(alive.map(s=>s.bottom))*1.45):0,edgeSafety=alive.length?clamp(1-mean(alive.map(s=>Math.min(1,s.borderRatio*12)))):0,alphaQuality=alive.length?clamp(mean(alive.map(s=>s.opaqueRatio))*1.15):0,health=clamp(.32*occupancy+.24*sizeConsistency+.16*bottomConsistency+.16*edgeSafety+.12*alphaQuality),suspicious=stats.filter(s=>!s.area||s.borderRatio>.09).length;
  return F({health,occupancy,sizeConsistency,bottomConsistency,edgeSafety,alphaQuality,suspicious,total:stats.length,probeScale:scale});
}

function hypothesisConfig(base,h,thresholdScale=1){const keepAdaptive=Array.isArray(h.sourceRects)&&h.sourceRects.length===h.columns*h.rows;return{...base,columns:h.columns,rows:h.rows,rowMap:h.rowMap,sourceRects:keepAdaptive?h.sourceRects:equalRects(h.columns,h.rows,Number(base.width)||1,Number(base.height)||1),detectionMode:`universal:${h.mode}`,backgroundThreshold:(Number(base.backgroundThreshold)||72)*thresholdScale,universalAuto:true};}
async function runTrial(file,base,h,{root,onProgress,index,total,thresholdScale=1}={}){const cfg=hypothesisConfig(base,h,thresholdScale);onProgress?.({stage:'trial',message:`Probando ${h.mode} ${h.columns}×${h.rows} · ${index}/${total}`});const compiled=await compileAvatarRuntime(file,cfg,{root}),validation=await validateCompiled(compiled,{root}),confidence=clamp(.58*validation.health+.30*h.prior+.12*(Number(base.confidenceScore)||.5));return F({h,cfg,compiled,validation,confidence,thresholdScale});}

function sourceRectScaleLock(sourceRects,columns,rows){
  if(!Array.isArray(sourceRects)||sourceRects.length!==columns*rows)return null;const widths=sourceRects.map(r=>Number(r?.w)||0).filter(Boolean),heights=sourceRects.map(r=>Number(r?.h)||0).filter(Boolean);if(widths.length!==sourceRects.length||heights.length!==sourceRects.length)return null;const medW=median(widths),medH=median(heights);if(!medW||!medH)return null;return F({medW,medH,forFrame(row,col){const r=sourceRects[row*columns+col];return F({x:clamp((Number(r?.w)||medW)/medW,.72,1.28),y:clamp((Number(r?.h)||medH)/medH,.72,1.28)});}});
}

async function canonicalize(compiled,{root=globalThis,sourceRects=null}={}){
  const bitmap=await bitmapFor(compiled.blob,root),sourceW=bitmap.width||bitmap.naturalWidth,sourceH=bitmap.height||bitmap.naturalHeight,columns=Math.max(1,compiled.columns||1),rows=Math.max(1,compiled.rows||1),fw=sourceW/columns,fh=sourceH/rows,out=canvasFor(root,Math.round(fw*columns),Math.round(fh*4)),ctx=out.getContext('2d');ctx.clearRect(0,0,out.width,out.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const map=rowMapFor(rows,{rowMap:compiled.rowMap||{}}),faces=['down','left','right','up'],scaleLock=sourceRectScaleLock(sourceRects,columns,rows);for(let destRow=0;destRow<4;destRow++){const face=faces[destRow],srcRow=clamp(Math.round(map[face]??0),0,rows-1),mirror=(face==='left'&&map.left===map.right&&rows<3);for(let col=0;col<columns;col++){const sx=col*fw,sy=srcRow*fh,cellX=col*fw,cellY=destRow*fh,correction=scaleLock?.forFrame(srcRow,col)||{x:1,y:1},dw=fw*correction.x,dh=fh*correction.y,dx=cellX+(fw-dw)/2,dy=cellY+fh-dh;if(mirror){ctx.save();ctx.translate(dx+dw,dy);ctx.scale(-1,1);ctx.drawImage(bitmap,sx,sy,fw,fh,0,0,dw,dh);ctx.restore();}else ctx.drawImage(bitmap,sx,sy,fw,fh,dx,dy,dw,dh);}}
  bitmap.close?.();let blob=await canvasBlob(out,'image/png'),type='image/png';if(blob.size>MAX_RUNTIME_BYTES){blob=await canvasBlob(out,'image/webp',.92);type='image/webp';}return F({...compiled,blob,type,width:out.width,height:out.height,rows:4,rowMap:FACE_ROWS,normalized:true,canonicalRig:true,scaleLocked:!!scaleLock,footAnchor:'bottom-center'});
}

export async function analyzeUniversalAvatarAsset(file,{root=globalThis}={}){
  const base=await analyzeAvatarSpriteSheet(file,{root}),stripHint=await probeStripLayout(file,base,root),enriched=stripHint?{...base,stripHint}:base,hypotheses=buildHypotheses(enriched);return F({...enriched,version:'kelo-universal-asset-compiler-v5.2.0',compilerVersion:'5.2.0',universalAuto:true,strategy:String(hypotheses[0]?.mode||base.detectionMode||'adaptive-v4'),hypotheses:F(hypotheses.map(h=>F({columns:h.columns,rows:h.rows,mode:h.mode,prior:h.prior,why:h.why}))),selfHealing:true,canonicalRig:true,scaleLock:true});
}

export async function compileUniversalAvatarRuntime(file,config,{root=globalThis,onProgress=null}={}){
  if(!file)throw new Error('UNIVERSAL_FILE_REQUIRED');if(config?.detectionMode==='manual'||config?.universalAuto===false){const direct=await compileAvatarRuntime(file,config,{root}),canonical=await canonicalize(direct,{root,sourceRects:config?.sourceRects}),validation=await validateCompiled(canonical,{root});return F({...canonical,compilerVersion:'5.2.0',strategy:'manual',validation,confidenceScore:validation.health,selfHealed:false});}
  const base=config?.compilerVersion?config:await analyzeUniversalAvatarAsset(file,{root}),hypotheses=buildHypotheses(base),trials=[],total=Math.min(MAX_TRIALS,hypotheses.length);if(!total)throw new Error('UNIVERSAL_NO_HYPOTHESES');try{trials.push(await runTrial(file,base,hypotheses[0],{root,onProgress,index:1,total}));}catch(error){trials.push(F({h:hypotheses[0],error:String(error?.message||error),confidence:0}));}
  const first=trials[0],earlyAccept=!!first?.compiled&&first.validation.health>=.84&&first.h.prior>=.82&&first.confidence>=.80;if(earlyAccept)onProgress?.({stage:'early-accept',message:'Interpretación principal validada · no hacen falta más pruebas'});else for(let i=1;i<total;i++){const h=hypotheses[i];try{trials.push(await runTrial(file,base,h,{root,onProgress,index:i+1,total}));}catch(error){trials.push(F({h,error:String(error?.message||error),confidence:0}));}}
  const viable=trials.filter(t=>t.compiled).sort((a,b)=>b.confidence-a.confidence);if(!viable.length)throw new Error('UNIVERSAL_NO_VALID_INTERPRETATION');let best=viable[0],selfHealed=false;if(best.validation.health<.82&&base.removeBackground&&base.backgroundKind==='color'){const repairs=[];for(const scale of [.72,1.22]){try{repairs.push(await runTrial(file,base,best.h,{root,onProgress,index:1,total:2,thresholdScale:scale}));}catch{}}const repaired=repairs.sort((a,b)=>b.confidence-a.confidence)[0];if(repaired&&repaired.confidence>best.confidence+.015){best=repaired;selfHealed=true;}}
  onProgress?.({stage:'canonicalize',message:'Bloqueando escala corporal y alineando pies…'});const canonical=await canonicalize(best.compiled,{root,sourceRects:best.cfg?.sourceRects}),validation=await validateCompiled(canonical,{root}),confidenceScore=clamp(.72*validation.health+.28*best.confidence),audit=F({selected:F({mode:best.h.mode,columns:best.h.columns,rows:best.h.rows,thresholdScale:best.thresholdScale||1}),tested:F(trials.map(t=>F({mode:t.h.mode,columns:t.h.columns,rows:t.h.rows,confidence:Number(t.confidence)||0,health:Number(t.validation?.health)||0,error:t.error||null}))),earlyAccept,selfHealed,scaleLocked:canonical.scaleLocked,stripHint:base.stripHint?F({mode:base.stripHint.mode,frames:base.stripHint.frames,score:base.stripHint.score}):null,finalHealth:validation.health});return F({...canonical,compilerVersion:'5.2.0',strategy:best.h.mode,detectionMode:`universal:${best.h.mode}`,confidenceScore,validation,audit,selfHealed,canonicalRig:true});
}

export const __universalAssetCompilerV5=F({buildHypotheses,validateCompiled,equalRects,verticalRects,rowMapFor,sourceRectScaleLock,probeStripLayout});
