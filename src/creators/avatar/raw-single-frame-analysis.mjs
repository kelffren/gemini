/* KELO-INDEX
 * area: CREATORS / AVATAR / RAW SINGLE FRAME
 * owner: deterministic fallback analysis for arbitrary AI images
 * keys: RAW IMAGE SINGLE FRAME FALLBACK FOREGROUND MANUAL LAYOUT
 * purpose: produce a V6-compatible 1x1 analysis even when automatic spritesheet interpretation fails
 * public-api: analyzeRawSingleFrameAsset
 * do-not: infer animation, invent pixels, mutate source image or bypass final review
 */
import{analyzeSpriteForeground}from'../sprite-compiler/sprite-foreground-analysis.mjs';
import{buildManualSpriteLayout}from'../sprite-compiler/sprite-layout-interpreter.mjs';
import{interpretSpriteRig}from'../sprite-compiler/sprite-rig-interpreter.mjs';
const F=Object.freeze,MAX_BYTES=12*1024*1024,MAX_DIMENSION=4096;
function canvasFor(root,w,h){const c=root.document?.createElement?.('canvas');if(!c)throw new Error('RAW_IMAGE_CANVAS_UNAVAILABLE');c.width=w;c.height=h;return c}
async function bitmapFor(file,root){if(root.createImageBitmap)return root.createImageBitmap(file);const url=root.URL?.createObjectURL?.(file);if(!url)throw new Error('RAW_IMAGE_DECODE_UNAVAILABLE');try{return await new Promise((resolve,reject)=>{const image=new root.Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('RAW_IMAGE_INVALID'));image.src=url})}finally{root.URL.revokeObjectURL(url)}}
export async function analyzeRawSingleFrameAsset(file,{root=globalThis,onProgress=null}={}){
 if(!file)throw new Error('RAW_IMAGE_FILE_REQUIRED');if(Number(file.size)>MAX_BYTES)throw new Error('RAW_IMAGE_FILE_TOO_LARGE');if(file.type&&!/^image\/(png|webp|jpeg)$/.test(file.type))throw new Error('RAW_IMAGE_TYPE_UNSUPPORTED');
 onProgress?.({stage:'raw-decode',message:'RAW 1 FRAME · leyendo imagen completa…'});const bitmap=await bitmapFor(file,root),width=bitmap.width||bitmap.naturalWidth,height=bitmap.height||bitmap.naturalHeight;if(!width||!height)throw new Error('RAW_IMAGE_INVALID');if(width>MAX_DIMENSION||height>MAX_DIMENSION){bitmap.close?.();throw new Error(`RAW_IMAGE_DIMENSIONS_TOO_LARGE:${width}x${height}`)}
 const canvas=canvasFor(root,width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,width,height);ctx.drawImage(bitmap,0,0);bitmap.close?.();const data=ctx.getImageData(0,0,width,height).data;
 onProgress?.({stage:'raw-foreground',message:'RAW 1 FRAME · preparando píxeles sin inferir spritesheet…'});const foreground=analyzeSpriteForeground(data,width,height),layout=buildManualSpriteLayout(foreground,{columns:1,rows:1,sourceRects:[{x:0,y:0,w:width,h:height}]}),layoutReport=F({version:'raw-single-frame-layout-v1',foreground,best:layout,hypotheses:F([layout]),alternatives:F([]),confidence:1,margin:1,reviewRequired:false,reviewReasons:F([]),rawIntent:true}),rigReport=interpretSpriteRig(layout,{rigHint:1,sourceDirectionOrder:['s']});
 return F({version:'kelo-raw-single-frame-analysis-v1.0.0',compilerVersion:'6.1.0',width,height,columns:1,rows:1,sourceColumns:1,sourceRows:1,frameCounts:F([1]),detectedFrames:1,directionKeys:F(['s']),directions:1,rigProfileId:rigReport.best?.profile||'sprite-rig-1d',rowMap:rigReport.best?.rowMap||F({s:0}),directionConfidence:1,directionMode:'raw-single-frame',detectionMode:'manual:raw-single-frame',strategy:'manual-layout',confidenceScore:1,autoCrop:false,removeBackground:false,backgroundKind:foreground.background.kind,backgroundRgb:foreground.background.rgb,backgroundThreshold:foreground.background.coreThreshold,backgroundUniform:foreground.background.uniform,contentBounds:F({x:0,y:0,w:width,h:height}),sourceRects:F([{x:0,y:0,w:width,h:height}]),hypotheses:F([]),rigHypotheses:F([]),reviewRequired:true,reviewReasons:F(['RAW_IMAGE_REVIEW_REQUIRED']),status:'REVIEW_REQUIRED',frameMs:140,universalAuto:false,canonicalRig:true,scaleLock:false,deterministicOnly:true,intentionalRawFrame:true,_foreground:foreground,_layoutReport:layoutReport,_rigReport:rigReport,_fileName:String(file.name||'')});
}
