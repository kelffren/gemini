/* KELO-INDEX
 * area: BUILD / ASSET DELIVERY
 * owner: Kelo Creator Asset Bridge
 * keys: INSTANT DELIVERY COMPILER SPARSE PNG LOSSLESS WEBP AVIF MANIFEST CONTENT ADDRESS
 * purpose: execute an explicit delivery plan and materialize only measured candidates without mutating SOURCE
 * public-api: CLI --config --output
 * state-owned: generated output directory only
 * online: N/A; build/publish-time capability
 * do-not: edit source assets, auto-promote lossy codecs, or treat a lab candidate as runtime-live without its required proof
 */
import fs from 'node:fs';
import path from 'node:path';
import {buildSparsePngAtlas,buildLosslessDeliveryCandidates,sha256Hex} from '../src/creators/assets/instant-delivery-compiler.mjs';

const args=process.argv.slice(2);
const arg=(name,fallback)=>{const prefix=`--${name}=`;const token=args.find(value=>value.startsWith(prefix));return token?token.slice(prefix.length):fallback;};
const configPath=path.resolve(arg('config','config/instant-delivery-plaza.json'));
const outDir=path.resolve(arg('output','test-results/instant-delivery'));
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
if(config?.schema!=='kelo-instant-delivery-plan-v1'||!Array.isArray(config.assets))throw new Error('INSTANT_DELIVERY_PLAN_INVALID');
fs.rmSync(outDir,{recursive:true,force:true});fs.mkdirSync(outDir,{recursive:true});fs.mkdirSync(path.join(outDir,'assets'),{recursive:true});
const entries=[];

for(const item of config.assets){
  const sourcePath=path.resolve(String(item.source||''));
  if(!fs.existsSync(sourcePath))throw new Error(`INSTANT_DELIVERY_SOURCE_MISSING:${item.id}:${item.source}`);
  const sourceBuffer=fs.readFileSync(sourcePath),sourceSha256=sha256Hex(sourceBuffer);
  if(item.mode==='sparse-png'){
    const built=buildSparsePngAtlas(sourceBuffer,item.keepRects||[]),hash=built.report.deliverySha256,file=`${item.outputBase||item.id}--${hash.slice(0,16)}.png`,target=path.join(outDir,'assets',file);
    fs.writeFileSync(target,built.buffer);
    entries.push({id:item.id,mode:item.mode,source:item.source,sourceSha256,sourceBytes:sourceBuffer.length,file:`assets/${file}`,format:'png',deliveryBytes:built.buffer.length,deliverySha256:hash,savedBytes:built.report.savedBytes,savedPercent:built.report.savedPercent,logicalDimensionsPreserved:true,requiredPixelsExact:true,coveragePlanDeclared:true,promotionRequires:['consumer-coverage-audit','observed-boot-transfer-ratchet'],report:built.report});
    console.log(`INSTANT_DELIVERY_SPARSE id=${item.id} source=${sourceBuffer.length} delivery=${built.buffer.length} saved=${built.report.savedBytes} (${built.report.savedPercent}%)`);
    continue;
  }
  if(item.mode==='lossless-codecs'){
    const built=await buildLosslessDeliveryCandidates(sourceBuffer,{sourceName:item.source,compatibility:{png:1,webp:1,avif:1}}),winner=built.report.winner;
    let file=null,deliveryBytes=null,deliverySha256=null,savedBytes=0,savedPercent=0;
    if(winner&&built.buffer){const ext=winner.format==='jpeg'?'jpg':winner.format,hash=built.report.deliverySha256;file=`${item.outputBase||item.id}--${hash.slice(0,16)}.${ext}`;fs.writeFileSync(path.join(outDir,'assets',file),built.buffer);deliveryBytes=built.buffer.length;deliverySha256=hash;savedBytes=sourceBuffer.length-deliveryBytes;savedPercent=Number((savedBytes/Math.max(1,sourceBuffer.length)*100).toFixed(3));}
    entries.push({id:item.id,mode:item.mode,source:item.source,sourceSha256,sourceBytes:sourceBuffer.length,file:file?`assets/${file}`:null,format:winner?.format||null,deliveryBytes,deliverySha256,savedBytes,savedPercent,requiredPixelsExact:Boolean(winner?.metrics?.exactPixels),promotionEligible:Boolean(built.report.variantReport?.promotion?.eligible),promotionBlockReasons:built.report.variantReport?.promotion?.deviceProof?.reasons||built.report.variantReport?.promotion?.reason||null,report:built.report});
    console.log(`INSTANT_DELIVERY_CODEC id=${item.id} source=${sourceBuffer.length} winner=${winner?.label||'none'} delivery=${deliveryBytes??'none'} saved=${savedBytes}`);
    continue;
  }
  throw new Error(`INSTANT_DELIVERY_MODE_UNSUPPORTED:${item.mode}`);
}

const totals={sourceBytes:entries.reduce((s,e)=>s+(e.sourceBytes||0),0),candidateBytes:entries.reduce((s,e)=>s+(e.deliveryBytes??e.sourceBytes??0),0),candidateSavedBytes:entries.reduce((s,e)=>s+Math.max(0,e.savedBytes||0),0)};
totals.candidateSavedPercent=Number((totals.candidateSavedBytes/Math.max(1,totals.sourceBytes)*100).toFixed(3));
const manifest={schema:'kelo-instant-delivery-manifest-v1',planId:config.id||null,generatedAt:new Date().toISOString(),sourceCanonical:true,autoPromotion:false,entries,totals};
fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(`INSTANT_DELIVERY_DONE assets=${entries.length} source=${totals.sourceBytes} candidate=${totals.candidateBytes} saved=${totals.candidateSavedBytes} (${totals.candidateSavedPercent}%)`);
