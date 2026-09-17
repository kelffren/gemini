/* KELO-INDEX
 * area: CREATORS / ASSET DELIVERY LAB
 * owner: Kelo Creator Asset Bridge
 * keys: PNG EXACT LOSSLESS ALPHA BOUNDS FOUNTAIN ROUND TREE WEIGHTLESS CONTENT ADDRESS
 * purpose: materialize exact full-size PNG delivery candidates and compare them with alpha-trim opportunities without touching runtime or canonical SOURCE
 * public-api: CLI lab
 * state-owned: report/candidate files only
 * online: N/A; build-time measurement
 * do-not: resize, resample, promote automatically, or alter SOURCE
 */
import fs from 'node:fs';
import path from 'node:path';
import {decodePngRgba,encodeRgbaPng,optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';
import {buildExactPngLossless,sha256Hex} from '../src/creators/assets/instant-delivery-compiler.mjs';

const targets=[
  {id:'plazaFountainKelo',source:'assets/justicia_fountain_v2.PNG',outputBase:'plaza-fountain-kelo',declared:{width:1254,height:1254}},
  {id:'plazaRoundTree',source:'assets/world/imperial-plaza/arbol-redondo.png',outputBase:'plaza-round-tree',declared:{width:1254,height:1254}},
];
const outArg=process.argv.find(arg=>arg.startsWith('--report='));
const reportPath=path.resolve(outArg?outArg.slice('--report='.length):'test-results/exact-alpha-trim/report.json');
const outDir=path.dirname(reportPath),assetDir=path.join(outDir,'assets');
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

fs.mkdirSync(assetDir,{recursive:true});
const assets=[];
for(const target of targets){
  const source=fs.readFileSync(target.source),decoded=decodePngRgba(source),width=decoded.ihdr.width,height=decoded.ihdr.height,bounds=alphaBounds(decoded.rgba,width,height),crop=cropRgba(decoded.rgba,width,bounds);
  const exact=buildExactPngLossless(source),exactDecoded=decodePngRgba(exact.buffer);
  if(exactDecoded.ihdr.width!==width||exactDecoded.ihdr.height!==height||!eq(exactDecoded.rgba,decoded.rgba))throw new Error(`EXACT_FULL_PNG_VERIFY_FAILED:${target.id}`);
  const deliverySha256=sha256Hex(exact.buffer),file=`${target.outputBase}--${deliverySha256.slice(0,16)}.png`;
  fs.writeFileSync(path.join(assetDir,file),exact.buffer);
  const cropPng=encodeRgbaPng(crop,bounds.w,bounds.h,{level:9,filterStrategy:'adaptive'}),optimizedCrop=optimizePngLossless(cropPng),verifiedCrop=decodePngRgba(optimizedCrop.buffer);
  if(verifiedCrop.ihdr.width!==bounds.w||verifiedCrop.ihdr.height!==bounds.h||!eq(verifiedCrop.rgba,crop))throw new Error(`EXACT_ALPHA_TRIM_VERIFY_FAILED:${target.id}`);
  const right=width-(bounds.x+bounds.w),bottom=height-(bounds.y+bounds.h),sourcePixels=width*height,cropPixels=bounds.w*bounds.h;
  const item={
    id:target.id,source:target.source,sourceBytes:source.length,sourceSha256:sha256Hex(source),
    actual:{width,height},declared:target.declared,declaredMatchesActual:target.declared.width===width&&target.declared.height===height,
    exactFullPng:{file:`assets/${file}`,bytes:exact.buffer.length,sha256:deliverySha256,savedBytes:exact.report.savedBytes,savedPercent:exact.report.savedPercent,exactPixels:true,fullRgbaExact:true,logicalDimensionsPreserved:true},
    alphaBounds:bounds,padding:{left:bounds.x,top:bounds.y,right,bottom},nonTransparentFraction:Number((bounds.nonTransparentPixels/sourcePixels).toFixed(6)),cropAreaFraction:Number((cropPixels/sourcePixels).toFixed(6)),
    exactTrimPng:{bytes:optimizedCrop.buffer.length,savedBytes:source.length-optimizedCrop.buffer.length,savedPercent:Number(((source.length-optimizedCrop.buffer.length)/source.length*100).toFixed(3)),extraSavedVsFullExact:exact.buffer.length-optimizedCrop.buffer.length,exactPixels:true,width:bounds.w,height:bounds.h}
  };
  assets.push(item);
  console.log(`EXACT_FULL_PNG id=${item.id} source=${item.sourceBytes} delivery=${item.exactFullPng.bytes} saved=${item.exactFullPng.savedBytes} percent=${item.exactFullPng.savedPercent} sha256=${deliverySha256}`);
  console.log(`EXACT_ALPHA_TRIM_REFERENCE id=${item.id} bbox=${bounds.x},${bounds.y},${bounds.w},${bounds.h} crop=${item.exactTrimPng.bytes} extra=${item.exactTrimPng.extraSavedVsFullExact}`);
}
const totals={sourceBytes:assets.reduce((s,a)=>s+a.sourceBytes,0),candidateBytes:assets.reduce((s,a)=>s+a.exactFullPng.bytes,0),cropReferenceBytes:assets.reduce((s,a)=>s+a.exactTrimPng.bytes,0)};
totals.savedBytes=totals.sourceBytes-totals.candidateBytes;totals.savedPercent=Number((totals.savedBytes/totals.sourceBytes*100).toFixed(3));totals.cropExtraSavedBytes=totals.candidateBytes-totals.cropReferenceBytes;
const report={schema:'kelo-exact-full-png-delivery-lab-v2',promotion:'blocked-until-runtime-route-and-ratchets-pass',assets,totals};
fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
console.log(`EXACT_FULL_PNG_DONE source=${totals.sourceBytes} candidate=${totals.candidateBytes} saved=${totals.savedBytes} percent=${totals.savedPercent} cropExtra=${totals.cropExtraSavedBytes}`);
