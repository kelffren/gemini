#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / CREATOR ASSET ATLAS
 * owner: Kelo Creator Asset Bridge
 * keys: SMART ATLAS DELIVERY CANDIDATE TOPOLOGY CROP MANIFEST RECOMPOSITION PNG
 * purpose: compile a real DELIVERY-only atlas candidate from the selected Smart Atlas strategy and prove every manifest frame reconstructs render-exact before any runtime promotion
 * online: N/A; deterministic build/publish-time candidate only
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {decodePngRgba,encodeRgbaPng,optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';
import {evaluatePixelFidelity,judgePixelFidelity} from '../src/creators/assets/png-quality-agent.mjs';
import {pngRenderMetadataFingerprint} from '../src/creators/assets/png-render-metadata.mjs';
import {planSmartAtlas} from '../src/creators/assets/smart-atlas-planner.mjs';

const args=process.argv.slice(2);
const argument=(name,fallback)=>{const token=args.find(v=>v.startsWith(`--${name}=`));return token?token.slice(name.length+3):fallback;};
const manifestPath=path.resolve(argument('manifest','src/environment/generated/forest-plaza-tileset-v2-manifest.js'));
const reportDir=path.resolve(argument('report','test-results/asset-atlas-delivery-candidate'));
const padding=Math.max(0,Math.round(Number(argument('padding','2'))||0));

function parseManifest(file){const raw=fs.readFileSync(file,'utf8').trim();if(raw.startsWith('{'))return JSON.parse(raw);const equals=raw.indexOf('=');if(equals<0)throw new Error('ATLAS_DELIVERY_MANIFEST_ASSIGNMENT_NOT_FOUND');let json=raw.slice(equals+1).trim();if(json.endsWith(';'))json=json.slice(0,-1);return JSON.parse(json);}
function extract(rgba,width,rect){const out=Buffer.alloc(rect.w*rect.h*4);for(let y=0;y<rect.h;y+=1){const from=((rect.y+y)*width+rect.x)*4;rgba.copy(out,y*rect.w*4,from,from+rect.w*4);}return out;}
function copyRect(source,sourceWidth,sourceRect,target,targetWidth,tx,ty){for(let y=0;y<sourceRect.h;y+=1){const from=((sourceRect.y+y)*sourceWidth+sourceRect.x)*4,to=((ty+y)*targetWidth+tx)*4;source.copy(target,to,from,from+sourceRect.w*4);}}
function sha256(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
function pct(saved,base){return base?Number((saved/base*100).toFixed(3)):0;}

assert.ok(fs.existsSync(manifestPath),`manifest missing: ${manifestPath}`);
const manifest=parseManifest(manifestPath),atlas=manifest.atlas||{},sourcePath=path.resolve(manifest.source?.path||atlas.sourcePath||'');
assert.ok(fs.existsSync(sourcePath),`source missing: ${sourcePath}`);
const sourceBuffer=fs.readFileSync(sourcePath),decoded=decodePngRgba(sourceBuffer),width=decoded.ihdr.width,height=decoded.ihdr.height;
const sourceRenderMetadata=pngRenderMetadataFingerprint(decoded);assert.equal(sourceRenderMetadata,'','delivery candidate refuses to drop rendering metadata');
const plan=planSmartAtlas(atlas.frames,{originalWidth:width,originalHeight:height,padding,minAreaSavingPercent:0,rgba:decoded.rgba,atlasWidth:width});
assert.equal(plan.selection.strategy,'topology-crop',`delivery compiler currently expects topology-crop, got ${plan.selection.strategy}`);assert.ok(plan.topologyCrop,'topology crop missing');
const crop=plan.topologyCrop,croppedRgba=extract(decoded.rgba,width,{x:crop.x,y:crop.y,w:crop.width,h:crop.height}),encoded=encodeRgbaPng(croppedRgba,crop.width,crop.height,{level:6,filterStrategy:0}),optimized=optimizePngLossless(encoded),deliveryBuffer=optimized.buffer,deliveryDecoded=decodePngRgba(deliveryBuffer);
assert.equal(pngRenderMetadataFingerprint(deliveryDecoded),sourceRenderMetadata,'delivery rendering metadata drift');
assert.equal(deliveryDecoded.ihdr.width,crop.width,'delivery width drift');assert.equal(deliveryDecoded.ihdr.height,crop.height,'delivery height drift');
const baseline=optimizePngLossless(sourceBuffer),deliveryFrames={},frameReports=[];
for(const frame of plan.frames){
  const placement=crop.placements[frame.id];assert.ok(placement,`${frame.id}: topology placement missing`);
  const original=extract(decoded.rgba,width,frame.sourceRect),trimmed=extract(deliveryDecoded.rgba,crop.width,placement),reconstructed=Buffer.alloc(frame.orig.w*frame.orig.h*4);
  copyRect(trimmed,placement.w,{x:0,y:0,w:placement.w,h:placement.h},reconstructed,frame.orig.w,frame.trim.x,frame.trim.y);
  const metrics=evaluatePixelFidelity(original,reconstructed,frame.orig.w,frame.orig.h),verdict=judgePixelFidelity(metrics,'render-exact');assert.equal(verdict.pass,true,`${frame.id}: delivery reconstruction changed visible pixels/alpha`);
  const anchorPreserved=!frame.originalAnchor||(frame.anchor.x+frame.trim.x===frame.originalAnchor.x&&frame.anchor.y+frame.trim.y===frame.originalAnchor.y);assert.equal(anchorPreserved,true,`${frame.id}: delivery anchor drift`);
  deliveryFrames[frame.id]={sourceRect:{x:placement.x,y:placement.y,w:placement.w,h:placement.h},orig:{...frame.orig},trim:{x:frame.trim.x,y:frame.trim.y,w:frame.trim.w,h:frame.trim.h},anchor:frame.anchor?{...frame.anchor}:null,originalAnchor:frame.originalAnchor?{...frame.originalAnchor}:null};
  frameReports.push({id:frame.id,renderExact:metrics.renderExactPixels,hiddenTransparentRgbChanges:metrics.hiddenTransparentRgbChangedPixels,anchorPreserved});
}
const sourceBytes=sourceBuffer.length,baselineBytes=baseline.buffer.length,deliveryBytes=deliveryBuffer.length,savedVsBaseline=baselineBytes-deliveryBytes;
const deliveryManifest={version:'kelo-atlas-delivery-manifest-v1',source:{path:path.relative(process.cwd(),sourcePath).replaceAll('\\','/'),sha256:sha256(sourceBuffer),width,height,bytes:sourceBytes,optimizedBaselineBytes:baselineBytes},delivery:{strategy:'topology-crop',padding,cropOffset:{x:crop.x,y:crop.y},width:crop.width,height:crop.height,bytes:deliveryBytes,sha256:sha256(deliveryBuffer),renderMetadataFingerprint:sourceRenderMetadata,pngWinner:optimized.report.winner},frames:deliveryFrames};
const report={status:'ASSET_ATLAS_DELIVERY_CANDIDATE_OK',version:'kelo-atlas-delivery-candidate-v1',selection:plan.selection.strategy,frameCount:frameReports.length,renderExactFrames:frameReports.filter(f=>f.renderExact).length,anchorPreserved:frameReports.every(f=>f.anchorPreserved),hiddenTransparentRgbChanges:frameReports.reduce((s,f)=>s+f.hiddenTransparentRgbChanges,0),dimensions:{source:`${width}x${height}`,delivery:`${crop.width}x${crop.height}`},areaSavingPercent:plan.selection.estimatedAreaSavingPercent,sourceBytes,optimizedBaselineBytes:baselineBytes,deliveryBytes,savedVsOptimizedBaselineBytes:savedVsBaseline,savedVsOptimizedBaselinePercent:pct(savedVsBaseline,baselineBytes),bytePromotionCandidate:savedVsBaseline>0,deliverySha256:deliveryManifest.delivery.sha256};
fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(path.join(reportDir,'atlas.png'),deliveryBuffer);fs.writeFileSync(path.join(reportDir,'delivery-manifest.json'),JSON.stringify(deliveryManifest,null,2));fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify(report,null,2));
console.log(`ATLAS_DELIVERY_CANDIDATE strategy=${report.selection} frames=${report.renderExactFrames}/${report.frameCount} ${report.dimensions.source}->${report.dimensions.delivery} bytes=${baselineBytes}->${deliveryBytes} saved=${savedVsBaseline} (${report.savedVsOptimizedBaselinePercent}%)`);
console.log(JSON.stringify(report));
