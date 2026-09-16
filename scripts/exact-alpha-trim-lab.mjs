/* KELO-INDEX
 * area: CREATORS / ASSET DELIVERY LAB
 * owner: Kelo Creator Asset Bridge
 * keys: PNG ALPHA BOUNDS CROP EXACT LOSSLESS FOUNTAIN ROUND TREE WEIGHTLESS
 * purpose: measure exact alpha-bound PNG crop opportunities without touching runtime or canonical SOURCE
 * public-api: CLI lab
 * state-owned: report files only
 * online: N/A; build-time measurement
 * do-not: resize, resample, promote automatically, or alter SOURCE
 */
import fs from 'node:fs';
import path from 'node:path';
import {decodePngRgba,encodeRgbaPng,optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';

const targets=[
  {id:'plazaFountainKelo',source:'assets/justicia_fountain_v2.PNG',declared:{width:1254,height:1254}},
  {id:'plazaRoundTree',source:'assets/world/imperial-plaza/arbol-redondo.png',declared:{width:1254,height:1254}},
];
const outArg=process.argv.find(arg=>arg.startsWith('--report='));
const reportPath=path.resolve(outArg?outArg.slice('--report='.length):'test-results/exact-alpha-trim/report.json');
const eq=(a,b)=>a.length===b.length&&a.equals(b);

function alphaBounds(rgba,width,height){
  let minX=width,minY=height,maxX=-1,maxY=-1,opaqueOrPartial=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const alpha=rgba[(y*width+x)*4+3];
    if(alpha===0)continue;
    opaqueOrPartial++;
    if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
  }
  if(maxX<0)return{x:0,y:0,w:1,h:1,nonTransparentPixels:0};
  return{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,nonTransparentPixels:opaqueOrPartial};
}
function cropRgba(rgba,width,b){
  const out=Buffer.alloc(b.w*b.h*4);
  for(let y=0;y<b.h;y++){
    const from=((b.y+y)*width+b.x)*4,to=y*b.w*4;
    rgba.copy(out,to,from,from+b.w*4);
  }
  return out;
}

const assets=[];
for(const target of targets){
  const source=fs.readFileSync(target.source),decoded=decodePngRgba(source),width=decoded.ihdr.width,height=decoded.ihdr.height,bounds=alphaBounds(decoded.rgba,width,height),crop=cropRgba(decoded.rgba,width,bounds);
  const cropPng=encodeRgbaPng(crop,bounds.w,bounds.h,{level:9,filterStrategy:'adaptive'}),optimizedCrop=optimizePngLossless(cropPng),verified=decodePngRgba(optimizedCrop.buffer);
  if(verified.ihdr.width!==bounds.w||verified.ihdr.height!==bounds.h||!eq(verified.rgba,crop))throw new Error(`EXACT_ALPHA_TRIM_VERIFY_FAILED:${target.id}`);
  const fullOptimized=optimizePngLossless(source),right=width-(bounds.x+bounds.w),bottom=height-(bounds.y+bounds.h),sourcePixels=width*height,cropPixels=bounds.w*bounds.h;
  const item={
    id:target.id,source:target.source,sourceBytes:source.length,
    actual:{width,height},declared:target.declared,declaredMatchesActual:target.declared.width===width&&target.declared.height===height,
    alphaBounds:bounds,padding:{left:bounds.x,top:bounds.y,right,bottom},nonTransparentFraction:Number((bounds.nonTransparentPixels/sourcePixels).toFixed(6)),cropAreaFraction:Number((cropPixels/sourcePixels).toFixed(6)),
    fullLosslessPng:{bytes:fullOptimized.buffer.length,savedBytes:source.length-fullOptimized.buffer.length},
    exactTrimPng:{bytes:optimizedCrop.buffer.length,savedBytes:source.length-optimizedCrop.buffer.length,savedPercent:Number(((source.length-optimizedCrop.buffer.length)/source.length*100).toFixed(3)),exactPixels:true,width:bounds.w,height:bounds.h},
    geometry:{sourceScaleX:Number((bounds.w/width).toFixed(9)),sourceScaleY:Number((bounds.h/height).toFixed(9)),offsetX:Number((bounds.x/width).toFixed(9)),offsetY:Number((bounds.y/height).toFixed(9))}
  };
  assets.push(item);
  console.log(`EXACT_ALPHA_TRIM id=${item.id} source=${item.sourceBytes} actual=${width}x${height} declared=${target.declared.width}x${target.declared.height} bbox=${bounds.x},${bounds.y},${bounds.w},${bounds.h} crop=${item.exactTrimPng.bytes} saved=${item.exactTrimPng.savedBytes} percent=${item.exactTrimPng.savedPercent}`);
}
const totals={sourceBytes:assets.reduce((s,a)=>s+a.sourceBytes,0),candidateBytes:assets.reduce((s,a)=>s+a.exactTrimPng.bytes,0)};totals.savedBytes=totals.sourceBytes-totals.candidateBytes;totals.savedPercent=Number((totals.savedBytes/totals.sourceBytes*100).toFixed(3));
const report={schema:'kelo-exact-alpha-trim-lab-v1',promotion:'blocked-lab-only',assets,totals};
fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
console.log(`EXACT_ALPHA_TRIM_DONE source=${totals.sourceBytes} candidate=${totals.candidateBytes} saved=${totals.savedBytes} percent=${totals.savedPercent}`);
