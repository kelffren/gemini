/* KELO-INDEX
 * area: CREATORS / ASSET DELIVERY
 * owner: Kelo Creator Asset Bridge
 * keys: INSTANT DELIVERY SPARSE ATLAS EXACT PIXELS PNG LOSSLESS CODEC TOURNAMENT CONTENT ADDRESS
 * purpose: build smaller delivery representations while preserving canonical SOURCE and proving the pixels required by each declared runtime coverage set
 * public-api: buildSparsePngAtlas(), buildExactPngLossless(), buildLosslessDeliveryCandidates(), sha256Hex()
 * consumes: png-space-optimizer, runtime-image-variants
 * state-owned: none; pure build/publish-time transforms
 * online: N/A; generated delivery blobs are presentation assets and remain content-addressed
 * do-not: overwrite SOURCE, change logical atlas coordinates, promote lossy candidates as exact, or infer runtime coverage without an explicit plan
 */
import crypto from 'node:crypto';
import {decodePngRgba,encodeRgbaPng,optimizePngLossless} from './png-space-optimizer.mjs';
import {buildRuntimeImageVariants} from './runtime-image-variants.mjs';

const F=Object.freeze;
const n=value=>Math.max(0,Math.round(Number(value)||0));
export const sha256Hex=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');

function normalizeRect(rect,width,height){
  const x=n(rect?.x),y=n(rect?.y),w=n(rect?.w??rect?.width),h=n(rect?.h??rect?.height);
  if(!(w>0&&h>0))throw new Error('INSTANT_DELIVERY_RECT_EMPTY');
  if(x+w>width||y+h>height)throw new Error(`INSTANT_DELIVERY_RECT_OOB:${x},${y},${w},${h}:${width}x${height}`);
  return F({id:String(rect?.id||`${x}:${y}:${w}:${h}`),x,y,w,h});
}
function copyRect(source,target,width,rect){
  const stride=width*4,rowBytes=rect.w*4;
  for(let y=0;y<rect.h;y+=1){const start=((rect.y+y)*stride)+(rect.x*4);source.copy(target,start,start,start+rowBytes);}
}
function markCoverage(mask,width,rect){for(let y=rect.y;y<rect.y+rect.h;y+=1)mask.fill(1,y*width+rect.x,y*width+rect.x+rect.w);}
function assertCoverageExact(source,output,width,height,mask){
  let preservedPixels=0,clearedPixels=0;
  for(let p=0;p<width*height;p+=1){const o=p*4;if(mask[p]){preservedPixels++;if(source[o]!==output[o]||source[o+1]!==output[o+1]||source[o+2]!==output[o+2]||source[o+3]!==output[o+3])throw new Error(`INSTANT_DELIVERY_COVERAGE_PIXEL_CHANGED:${p}`);}else{clearedPixels++;if(output[o]||output[o+1]||output[o+2]||output[o+3])throw new Error(`INSTANT_DELIVERY_OUTSIDE_COVERAGE_NOT_CLEAR:${p}`);}}
  return{preservedPixels,clearedPixels};
}
function assertFullExact(source,output){
  if(source.ihdr.width!==output.ihdr.width||source.ihdr.height!==output.ihdr.height)throw new Error(`INSTANT_DELIVERY_DIMENSION_CHANGED:${source.ihdr.width}x${source.ihdr.height}:${output.ihdr.width}x${output.ihdr.height}`);
  if(source.rgba.length!==output.rgba.length||!source.rgba.equals(output.rgba))throw new Error('INSTANT_DELIVERY_FULL_RGBA_CHANGED');
  return{width:source.ihdr.width,height:source.ihdr.height,pixels:source.ihdr.width*source.ihdr.height};
}

// KELO-INDEX ASSET/DELIVERY creates a logical-coordinate-compatible PNG: same dimensions, required rects byte-identical, every undeclared pixel transparent.
export function buildSparsePngAtlas(sourceBuffer,keepRects=[],options={}){
  if(!Buffer.isBuffer(sourceBuffer))throw new Error('INSTANT_DELIVERY_SOURCE_BUFFER_REQUIRED');
  const source=decodePngRgba(sourceBuffer),{width,height}=source.ihdr;
  const rects=keepRects.map(rect=>normalizeRect(rect,width,height));
  if(!rects.length)throw new Error('INSTANT_DELIVERY_KEEP_RECTS_REQUIRED');
  const sparseRgba=Buffer.alloc(source.rgba.length),coverage=new Uint8Array(width*height);
  for(const rect of rects){copyRect(source.rgba,sparseRgba,width,rect);markCoverage(coverage,width,rect);}
  const raw=encodeRgbaPng(sparseRgba,width,height,{level:options.level??9,filterStrategy:options.filterStrategy??'adaptive'});
  const optimized=optimizePngLossless(raw,options.losslessOptions||{}),winner=optimized.buffer;
  const decoded=decodePngRgba(winner),proof=assertCoverageExact(source.rgba,decoded.rgba,width,height,coverage);
  const coverageRatio=proof.preservedPixels/(width*height),savedBytes=sourceBuffer.length-winner.length;
  return F({
    buffer:winner,
    report:F({
      version:'kelo-instant-delivery-sparse-atlas-v1',
      mode:'logical-coordinate-sparse-png',
      sourceBytes:sourceBuffer.length,deliveryBytes:winner.length,savedBytes,savedPercent:Number((savedBytes/Math.max(1,sourceBuffer.length)*100).toFixed(3)),
      sourceSha256:sha256Hex(sourceBuffer),deliverySha256:sha256Hex(winner),
      width,height,logicalDimensionsPreserved:true,requiredPixelsExact:true,outsideCoverageTransparent:true,
      coveragePixelCount:proof.preservedPixels,coverageRatio:Number(coverageRatio.toFixed(6)),
      keepRects:rects,optimizer:optimized.report
    })
  });
}

// KELO-INDEX ASSET/DELIVERY exact same-format path: preserve full PNG dimensions and every decoded RGBA byte; no browser/device codec switch is involved.
export function buildExactPngLossless(sourceBuffer,options={}){
  if(!Buffer.isBuffer(sourceBuffer))throw new Error('INSTANT_DELIVERY_SOURCE_BUFFER_REQUIRED');
  const source=decodePngRgba(sourceBuffer);
  const optimized=optimizePngLossless(sourceBuffer,{deep:true,exhaustiveExact:true,effort:'max',paletteOrderingLimit:8,paletteFilterStrategies:['adaptive',0,1],levels:[9],...(options.losslessOptions||{})});
  const winner=optimized.buffer.length<=sourceBuffer.length?optimized.buffer:sourceBuffer;
  const decoded=decodePngRgba(winner),proof=assertFullExact(source,decoded),savedBytes=sourceBuffer.length-winner.length;
  return F({buffer:winner,report:F({version:'kelo-instant-delivery-exact-png-v1',mode:'exact-png-lossless',sourceBytes:sourceBuffer.length,deliveryBytes:winner.length,savedBytes,savedPercent:Number((savedBytes/Math.max(1,sourceBuffer.length)*100).toFixed(3)),sourceSha256:sha256Hex(sourceBuffer),deliverySha256:sha256Hex(winner),format:'png',width:proof.width,height:proof.height,pixelCount:proof.pixels,logicalDimensionsPreserved:true,requiredPixelsExact:true,fullRgbaExact:true,deviceProofRequired:false,optimizer:optimized.report})});
}

// KELO-INDEX ASSET/DELIVERY exact codec lab path: profile remains available, but adaptive/lossy candidates are intentionally disabled. Codec promotion still requires real-device proof.
export async function buildLosslessDeliveryCandidates(sourceBuffer,options={}){
  if(!Buffer.isBuffer(sourceBuffer))throw new Error('INSTANT_DELIVERY_SOURCE_BUFFER_REQUIRED');
  const exactProfile={...(options.assetProfile||{}),kind:options.assetProfile?.kind||'exact-delivery',adaptivePolicy:'strict',runtimeCandidates:[]};
  const result=await buildRuntimeImageVariants(sourceBuffer,{...options,assetProfile:exactProfile,qualityPolicy:'strict'});
  const winner=result.report.losslessWinner;
  const winnerBuffer=winner?result.buffers[winner.label]||null:null;
  return F({
    buffer:winnerBuffer,
    report:F({version:'kelo-instant-delivery-lossless-codecs-v1',sourceBytes:sourceBuffer.length,sourceSha256:sha256Hex(sourceBuffer),winner:winner||null,deliverySha256:winnerBuffer?sha256Hex(winnerBuffer):null,variantReport:result.report})
  });
}