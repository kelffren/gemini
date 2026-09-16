#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / CREATOR ASSET ATLAS
 * owner: Kelo Creator Asset Bridge
 * keys: SMART ATLAS TOPOLOGY CROP PNG BYTES LOSSLESS METADATA PROMOTION
 * purpose: compare final lossless PNG bytes for the original atlas versus the topology-preserving crop selected by Smart Atlas
 * online: N/A; deterministic build-time evidence only
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {decodePngRgba,encodeRgbaPng,optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';
import {evaluatePixelFidelity,judgePixelFidelity} from '../src/creators/assets/png-quality-agent.mjs';
import {pngRenderMetadataFingerprint} from '../src/creators/assets/png-render-metadata.mjs';
import {planSmartAtlas} from '../src/creators/assets/smart-atlas-planner.mjs';

const args=process.argv.slice(2);
const argument=(name,fallback)=>{const token=args.find(v=>v.startsWith(`--${name}=`));return token?token.slice(name.length+3):fallback;};
const manifestPath=path.resolve(argument('manifest','src/environment/generated/forest-plaza-tileset-v2-manifest.js'));
const reportDir=path.resolve(argument('report','test-results/asset-atlas-final-bytes'));
const padding=Math.max(0,Math.round(Number(argument('padding','2'))||0));

function parseManifest(file){const raw=fs.readFileSync(file,'utf8').trim();if(raw.startsWith('{'))return JSON.parse(raw);const equals=raw.indexOf('=');if(equals<0)throw new Error('ATLAS_BYTES_MANIFEST_ASSIGNMENT_NOT_FOUND');let json=raw.slice(equals+1).trim();if(json.endsWith(';'))json=json.slice(0,-1);return JSON.parse(json);}
function extract(rgba,width,rect){const out=Buffer.alloc(rect.w*rect.h*4);for(let y=0;y<rect.h;y+=1){const from=((rect.y+y)*width+rect.x)*4;rgba.copy(out,y*rect.w*4,from,from+rect.w*4);}return out;}
function pct(saved,base){return base?Number((saved/base*100).toFixed(3)):0;}

assert.ok(fs.existsSync(manifestPath),`manifest missing: ${manifestPath}`);
const manifest=parseManifest(manifestPath),atlas=manifest.atlas||{},sourcePath=path.resolve(manifest.source?.path||atlas.sourcePath||'');
assert.ok(fs.existsSync(sourcePath),`source missing: ${sourcePath}`);
const sourceBuffer=fs.readFileSync(sourcePath),decoded=decodePngRgba(sourceBuffer),width=decoded.ihdr.width,height=decoded.ihdr.height;
const renderMetadataFingerprint=pngRenderMetadataFingerprint(decoded);
assert.equal(renderMetadataFingerprint,'','topology-crop byte audit refuses to drop rendering metadata');
const plan=planSmartAtlas(atlas.frames,{originalWidth:width,originalHeight:height,padding,minAreaSavingPercent:0,rgba:decoded.rgba,atlasWidth:width});
assert.equal(plan.selection.strategy,'topology-crop',`expected topology-crop selector, got ${plan.selection.strategy}`);
assert.ok(plan.topologyCrop,'topology crop missing');
const crop=plan.topologyCrop,croppedRgba=extract(decoded.rgba,width,{x:crop.x,y:crop.y,w:crop.width,h:crop.height});
const encodedCrop=encodeRgbaPng(croppedRgba,crop.width,crop.height,{level:6,filterStrategy:0});
const optimizedCrop=optimizePngLossless(encodedCrop),optimizedOriginal=optimizePngLossless(sourceBuffer);
const cropDecoded=decodePngRgba(optimizedCrop.buffer),quality=evaluatePixelFidelity(croppedRgba,cropDecoded.rgba,crop.width,crop.height),verdict=judgePixelFidelity(quality,'strict');
assert.equal(verdict.pass,true,'optimized topology crop changed pixels');
assert.equal(cropDecoded.ihdr.width,crop.width,'crop width drift');assert.equal(cropDecoded.ihdr.height,crop.height,'crop height drift');
const sourceBytes=sourceBuffer.length,baselineBytes=optimizedOriginal.buffer.length,cropBytes=optimizedCrop.buffer.length,savedVsSource=sourceBytes-cropBytes,savedVsBaseline=baselineBytes-cropBytes;
const report={status:'ASSET_ATLAS_FINAL_BYTES_OK',version:'kelo-atlas-final-bytes-v1',manifest:path.relative(process.cwd(),manifestPath).replaceAll('\\','/'),source:path.relative(process.cwd(),sourcePath).replaceAll('\\','/'),padding,selection:plan.selection.strategy,dimensions:{original:`${width}x${height}`,crop:`${crop.width}x${crop.height}`},areaSavingPercent:plan.selection.estimatedAreaSavingPercent,renderMetadataFingerprint,sourceBytes,baselineOptimizedBytes:baselineBytes,cropEncodedBytes:encodedCrop.length,cropOptimizedBytes:cropBytes,savedVsSourceBytes:savedVsSource,savedVsSourcePercent:pct(savedVsSource,sourceBytes),savedVsOptimizedBaselineBytes:savedVsBaseline,savedVsOptimizedBaselinePercent:pct(savedVsBaseline,baselineBytes),bytePromotionCandidate:savedVsBaseline>0,strictPixels:quality.exactPixels,baselineWinner:optimizedOriginal.report.winner,cropWinner:optimizedCrop.report.winner};
fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify(report,null,2));
console.log(`ATLAS_FINAL_BYTES source=${sourceBytes} baseline=${baselineBytes} crop=${cropBytes} savedVsBaseline=${savedVsBaseline} (${report.savedVsOptimizedBaselinePercent}%) area=${report.areaSavingPercent}% strategy=${report.selection}`);
console.log(JSON.stringify(report));
