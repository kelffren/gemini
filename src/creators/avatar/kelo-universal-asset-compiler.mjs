/* KELO-INDEX
 * area: CREATORS / AVATAR
 * owner: Kelo Universal Asset Compiler V5
 * keys: AVATAR UNIVERSAL COMPILER HYPOTHESES SELF-HEAL VALIDATE CANONICAL-RIG
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
const MAX_RUNTIME_BYTES=2*1024*1024;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
const mean=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:0;
const median=a=>{const b=[...a].sort((x,y)=>x-y);if(!b.length)return 0;const m=(b.length-1)/2;return(b[Math.floor(m)]+b[Math.ceil(m)])/2;};
const cv=a=>{if(a.length<2)return 0;const m=mean(a);if(!m)return 1;return Math.sqrt(mean(a.map(x=>(x-m)**2)))/m;};

function canvasFor(root,w,h){const c=root.document?.createElement?.('canvas');if(!c)throw new Error('UNIVERSAL_CANVAS_UNAVAILABLE');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;}
async function bitmapFor(file,root){if(root.createImageBitmap)return root.createImageBitmap(file);if(!root.document||!root.URL?.createObjectURL)throw new Error('UNIVERSAL_IMAGE_DECODE_UNAVAILABLE');const url=root.URL.createObjectURL(file);try{return await new Promise((resolve,reject)=>{const img=new root.Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('UNIVERSAL_IMAGE_INVALID'));img.src=url;});}finally{root.URL.revokeObjectURL(url);}}
function canvasBlob(canvas,type='image/png',quality=.92){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('UNIVERSAL_RUNTIME_ENCODE_FAILED')),type,quality));}
function equalRects(columns,rows,width,height){const out=[];for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const x0=x*width/columns,y0=y*height/rows,x1=(x+1)*width/columns,y1=(y+1)*height/rows;out.push({x:x0,y:y0,w:x1-x0,h:y1-y0,fallback:true});}return out;}
function rowMapFor(rows,base={}){const max=Math.max(0,rows-1),src=base.rowMap||{};return{down:clamp(Math.round(src.down??0),0,max),left:clamp(Math.round(src.left??Math.min(1,max)),0,max),right:clamp(Math.round(src.right??Math.min(2,max)),0,max),up:clamp(Math.round(src.up??Math.min(3,max)),0,max)};}
function candidateKey(c){return `${c.columns}x${c.rows}:${c.mode}`;}

function buildHypotheses(base){
  const width=Number(base.width)||1,height=Number(base.height)||1,out=[],seen=new Set();
  const push=(columns,rows,mode,prior,sourceRects=null,why='')=>{columns=Math.max(1,Math.round(columns));rows=Math.max(1,Math.round(rows));if(columns>12||rows>12||columns*rows>64)return;const key=candidateKey({columns,rows,mode});if(seen.has(key))return;seen.add(key);out.push(F({columns,rows,mode,prior:clamp(prior),sourceRects,why,rowMap:rowMapFor(rows,base)}));};
  push(base.columns,base.rows,String(base.detectionMode||'adaptive-v4'),Math.max(.58,Number(base.confidenceScore)||.58),Array.isArray(base.sourceRects)?base.sourceRects:null,'V4 adaptive component/grid analysis');
  for(const c of Array.isArray(base.gridCandidates)?base.gridCandidates:[])push(c.columns,c.rows,'grid-candidate',.45+.42*clamp(c.score),null,'alternate V4 grid candidate');
  const ratio=width/height;
  if(ratio>=1.45){for(let columns=2;columns<=12;columns++){const aspect=(width/columns)/height;if(aspect>=.42&&aspect<=2.25)push(columns,1,'horizontal-strip',.58-Math.abs(aspect-.8)*.09,null,'horizontal animation strip');}}
  if(ratio<=.70){for(let rows=2;rows<=12;rows++){const aspect=width/(height/rows);if(aspect>=.42&&aspect<=2.25)push(1,rows,'vertical-strip',.54-Math.abs(aspect-.8)*.08,null,'vertical animation strip');}}
  if(base.rows>4)push(base.columns,4,'four-direction-projection',.56,null,'project oversized direction sheet into four runtime rows');
  push(1,1,'single-character',.38,null,'static avatar fallback');
  return out.sort((a,b)=>b.prior-a.prior).slice(0,MAX_TRIALS);
}

function alphaStats(data,w,h){
  let area=0,minX=w,minY=h,maxX=-1,maxY=-1,border=0,opaque=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=data[(y*w+x)*4+3];if(a<=18)continue;area++;if(a>180)opaque++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);if(x<=1||y<=1||x>=w-2||y>=h-2)border++;}
  if(!area)return{area:0,w:0,h:0,bottom:0,borderRatio:1,opaqueRatio:0};
  return{area,w:maxX-minX+1,h:maxY-minY+1,bottom:(maxY+1)/h,borderRatio:border/area,opaqueRatio:opaque/area};
}
async function validateCompiled(compiled,{root=globalThis}={}){
  const bitmap=await bitmapFor(compiled.blob,root),width=bitmap.width||bitmap.naturalWidth,height=bitmap.height||bitmap.naturalHeight,columns=Math.max(1,compiled.columns||1),rows=Math.max(1,compiled.rows||1),canvas=canvasFor(root,width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,width,height);ctx.drawImage(bitmap,0,0);bitmap.close?.();
  const fw=width/columns,fh=height/rows,stats=[];
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){const x0=Math.floor(col*fw),y0=Math.floor(row*fh),x1=Math.ceil((col+1)*fw),y1=Math.ceil((row+1)*fh),im=ctx.getImageData(x0,y0,Math.max(1,x1-x0),Math.max(1,y1-y0));stats.push(alphaStats(im.data,im.width,im.height));}
  const alive=stats.filter(s=>s.area>0),occupancy=alive.length/Math.max(1,stats.length),sizeConsistency=alive.length?clamp(1-(cv(alive.map(s=>s.h))*.55+cv(alive.map(s=>s.w))*.45)):0,bottomConsistency=alive.length?clamp(1-cv(alive.map(s=>s.bottom))*1.45):0,edgeSafety=alive.length?clamp(1-mean(alive.map(s=>Math.min(1,s.borderRatio*12)))):0,alphaQuality=alive.length?clamp(mean(alive.map(s=>s.opaqueRatio))*1.15):0;
  const health=clamp(.32*occupancy+.24*sizeConsistency+.16*bottomConsistency+.16*edgeSafety+.12*alphaQuality),suspicious=stats.filter(s=>!s.area||s.borderRatio>.09).length;
  return F({health,occupancy,sizeConsistency,bottomConsistency,edgeSafety,alphaQuality,suspicious,total:stats.length});
}

function hypothesisConfig(base,h,thresholdScale=1){
  const keepAdaptive=Array.isArray(h.sourceRects)&&h.sourceRects.length===h.columns*h.rows;
  return{...base,columns:h.columns,rows:h.rows,rowMap:h.rowMap,sourceRects:keepAdaptive?h.sourceRects:equalRects(h.columns,h.rows,Number(base.width)||1,Number(base.height)||1),detectionMode:`universal:${h.mode}`,backgroundThreshold:(Number(base.backgroundThreshold)||72)*thresholdScale,universalAuto:true};
}
async function runTrial(file,base,h,{root,onProgress,index,total,thresholdScale=1}={}){
  const cfg=hypothesisConfig(base,h,thresholdScale);onProgress?.({stage:'trial',message:`Probando ${h.mode} ${h.columns}×${h.rows} · ${index}/${total}`});
  const compiled=await compileAvatarRuntime(file,cfg,{root}),validation=await validateCompiled(compiled,{root});
  const confidence=clamp(.58*validation.health+.30*h.prior+.12*(Number(base.confidenceScore)||.5));
  return F({h,cfg,compiled,validation,confidence,thresholdScale});
}

async function canonicalize(compiled,{root=globalThis}={}){
  const bitmap=await bitmapFor(compiled.blob,root),sourceW=bitmap.width||bitmap.naturalWidth,sourceH=bitmap.height||bitmap.naturalHeight,columns=Math.max(1,compiled.columns||1),rows=Math.max(1,compiled.rows||1),fw=sourceW/columns,fh=sourceH/rows,out=canvasFor(root,Math.round(fw*columns),Math.round(fh*4)),ctx=out.getContext('2d');ctx.clearRect(0,0,out.width,out.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  const map=rowMapFor(rows,{rowMap:compiled.rowMap||{}}),faces=['down','left','right','up'];
  for(let destRow=0;destRow<4;destRow++){
    const face=faces[destRow],srcRow=clamp(Math.round(map[face]??0),0,rows-1),mirror=(face==='left'&&map.left===map.right&&rows<3);
    for(let col=0;col<columns;col++){
      const sx=col*fw,sy=srcRow*fh,dx=col*fw,dy=destRow*fh;
      if(mirror){ctx.save();ctx.translate(dx+fw,dy);ctx.scale(-1,1);ctx.drawImage(bitmap,sx,sy,fw,fh,0,0,fw,fh);ctx.restore();}
      else ctx.drawImage(bitmap,sx,sy,fw,fh,dx,dy,fw,fh);
    }
  }
  bitmap.close?.();let blob=await canvasBlob(out,'image/png');let type='image/png';if(blob.size>MAX_RUNTIME_BYTES){blob=await canvasBlob(out,'image/webp',.92);type='image/webp';}
  return F({...compiled,blob,type,width:out.width,height:out.height,rows:4,rowMap:FACE_ROWS,normalized:true,canonicalRig:true});
}

export async function analyzeUniversalAvatarAsset(file,{root=globalThis}={}){
  const base=await analyzeAvatarSpriteSheet(file,{root}),hypotheses=buildHypotheses(base);
  return F({...base,version:'kelo-universal-asset-compiler-v5.0.0',compilerVersion:'5.0.0',universalAuto:true,strategy:String(hypotheses[0]?.mode||base.detectionMode||'adaptive-v4'),hypotheses:F(hypotheses.map(h=>F({columns:h.columns,rows:h.rows,mode:h.mode,prior:h.prior,why:h.why}))),selfHealing:true,canonicalRig:true});
}

export async function compileUniversalAvatarRuntime(file,config,{root=globalThis,onProgress=null}={}){
  if(!file)throw new Error('UNIVERSAL_FILE_REQUIRED');
  if(config?.detectionMode==='manual'||config?.universalAuto===false){const direct=await compileAvatarRuntime(file,config,{root}),canonical=await canonicalize(direct,{root}),validation=await validateCompiled(canonical,{root});return F({...canonical,compilerVersion:'5.0.0',strategy:'manual',validation,confidenceScore:validation.health,selfHealed:false});}
  const base=config?.compilerVersion?config:await analyzeUniversalAvatarAsset(file,{root}),hypotheses=buildHypotheses(base),trials=[];
  const total=Math.min(MAX_TRIALS,hypotheses.length);for(let i=0;i<total;i++){const h=hypotheses[i];try{trials.push(await runTrial(file,base,h,{root,onProgress,index:i+1,total}));}catch(error){trials.push(F({h,error:String(error?.message||error),confidence:0}));}}
  let viable=trials.filter(t=>t.compiled).sort((a,b)=>b.confidence-a.confidence);if(!viable.length)throw new Error('UNIVERSAL_NO_VALID_INTERPRETATION');
  let best=viable[0],selfHealed=false;
  if(best.validation.health<.82&&base.removeBackground&&base.backgroundKind==='color'){
    const repairs=[];for(const scale of [.72,1.22]){try{repairs.push(await runTrial(file,base,best.h,{root,onProgress,index:1,total:2,thresholdScale:scale}));}catch{}}
    const repaired=repairs.sort((a,b)=>b.confidence-a.confidence)[0];if(repaired&&repaired.confidence>best.confidence+.015){best=repaired;selfHealed=true;}
  }
  onProgress?.({stage:'canonicalize',message:'Adaptando al rig universal de Kelo World…'});const canonical=await canonicalize(best.compiled,{root}),validation=await validateCompiled(canonical,{root}),confidenceScore=clamp(.72*validation.health+.28*best.confidence);
  const audit=F({selected:F({mode:best.h.mode,columns:best.h.columns,rows:best.h.rows,thresholdScale:best.thresholdScale||1}),tested:F(trials.map(t=>F({mode:t.h.mode,columns:t.h.columns,rows:t.h.rows,confidence:Number(t.confidence)||0,health:Number(t.validation?.health)||0,error:t.error||null}))),selfHealed,finalHealth:validation.health});
  return F({...canonical,compilerVersion:'5.0.0',strategy:best.h.mode,detectionMode:`universal:${best.h.mode}`,confidenceScore,validation,audit,selfHealed,canonicalRig:true});
}

export const __universalAssetCompilerV5=F({buildHypotheses,validateCompiled,equalRects,rowMapFor});
