#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / CREATOR ASSET DELIVERY
 * owner: Kelo Creator Asset Bridge
 * keys: DELIVERY REGISTRY MANIFEST SHA256 QUALITY PROMOTION SOURCE CANDIDATE ATLAS PNG
 * purpose: aggregate verified atlas and individual PNG DELIVERY candidate artifacts into one fail-closed source→candidate registry without activating runtime promotion
 * online: N/A; deterministic build/publish-time registry only
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const args=process.argv.slice(2);
const argument=(name,fallback)=>{const token=args.find(v=>v.startsWith(`--${name}=`));return token?token.slice(name.length+3):fallback;};
const inputRoot=path.resolve(argument('input','test-results'));
const outputDir=path.resolve(argument('report','test-results/asset-delivery-registry'));

function walk(dir,name,out=[]){if(!fs.existsSync(dir))return out;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file,name,out);else if(entry.isFile()&&entry.name===name)out.push(file);}return out;}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function sha256(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
function rel(file){return path.relative(process.cwd(),file).replaceAll('\\','/');}

const candidateManifests=walk(inputRoot,'delivery-manifest.json').sort();
assert.ok(candidateManifests.length>0,`no delivery-manifest.json found under ${inputRoot}`);
const sourceMap=new Map(),candidateRecords=[];

function sourceRecordFor(source){
  assert.equal(String(source.sha256||'').length,64,'invalid source SHA');assert.ok(source.path,'source path missing');
  const sourceKey=`${source.path}:${source.sha256}`;
  if(!sourceMap.has(sourceKey))sourceMap.set(sourceKey,{source:{path:source.path,sha256:source.sha256,bytes:source.bytes,optimizedBaselineBytes:source.optimizedBaselineBytes??source.bytes,width:source.width,height:source.height},candidates:[]});
  return sourceMap.get(sourceKey);
}
function addCandidate(manifestFile,manifest,candidate){
  const record=sourceRecordFor(manifest.source);assert.ok(!record.candidates.some(c=>c.artifact.sha256===candidate.artifact.sha256),`${manifestFile}: duplicate candidate hash`);record.candidates.push(candidate);candidateRecords.push(candidate);
}

for(const manifestFile of candidateManifests){
  const manifest=readJson(manifestFile),dir=path.dirname(manifestFile),reportFile=path.join(dir,'report.json');assert.ok(fs.existsSync(reportFile),`${manifestFile}: report.json missing`);const report=readJson(reportFile);
  if(manifest.version==='kelo-atlas-delivery-manifest-v1'){
    const atlasFile=path.join(dir,'atlas.png');assert.ok(fs.existsSync(atlasFile),`${manifestFile}: atlas.png missing`);const buffer=fs.readFileSync(atlasFile),actualHash=sha256(buffer),actualBytes=buffer.length;
    assert.equal(report.status,'ASSET_ATLAS_DELIVERY_CANDIDATE_OK',`${manifestFile}: atlas candidate report not approved`);assert.equal(report.renderExactFrames,report.frameCount,`${manifestFile}: not all frames render-exact`);assert.equal(report.anchorPreserved,true,`${manifestFile}: anchor drift`);assert.equal(report.hiddenTransparentRgbChanges,0,`${manifestFile}: hidden RGB changed`);assert.equal(report.bytePromotionCandidate,true,`${manifestFile}: no measured byte win`);
    assert.equal(actualHash,manifest.delivery.sha256,`${manifestFile}: delivery SHA mismatch`);assert.equal(actualHash,report.deliverySha256,`${manifestFile}: report SHA mismatch`);assert.equal(actualBytes,manifest.delivery.bytes,`${manifestFile}: delivery byte mismatch`);assert.equal(actualBytes,report.deliveryBytes,`${manifestFile}: report byte mismatch`);
    addCandidate(manifestFile,manifest,{kind:'atlas',status:'approved-candidate',runtimeActive:false,strategy:manifest.delivery.strategy,padding:manifest.delivery.padding,artifact:{path:rel(atlasFile),sha256:actualHash,bytes:actualBytes,width:manifest.delivery.width,height:manifest.delivery.height},manifest:{path:rel(manifestFile),version:manifest.version,cropOffset:manifest.delivery.cropOffset},quality:{frameCount:report.frameCount,renderExactFrames:report.renderExactFrames,anchorPreserved:report.anchorPreserved,hiddenTransparentRgbChanges:report.hiddenTransparentRgbChanges,renderMetadataFingerprint:manifest.delivery.renderMetadataFingerprint},evidence:{areaSavingPercent:report.areaSavingPercent,byteSavingPercent:report.savedVsOptimizedBaselinePercent,byteSavingBytes:report.savedVsOptimizedBaselineBytes,pngWinner:manifest.delivery.pngWinner}});
    continue;
  }
  if(manifest.version==='kelo-png-delivery-manifest-v1'){
    const assetFile=path.join(dir,manifest.delivery.file||'asset.png');assert.ok(fs.existsSync(assetFile),`${manifestFile}: PNG candidate missing`);const buffer=fs.readFileSync(assetFile),actualHash=sha256(buffer),actualBytes=buffer.length;
    assert.equal(report.status,'ASSET_PNG_DELIVERY_CANDIDATE_OK',`${manifestFile}: PNG candidate report not approved`);assert.equal(report.exactPixels,true,`${manifestFile}: PNG pixels not exact`);assert.equal(report.hiddenTransparentRgbChanges,0,`${manifestFile}: hidden RGB changed`);assert.equal(report.renderMetadataPreserved,true,`${manifestFile}: rendering metadata changed`);assert.equal(report.bytePromotionCandidate,true,`${manifestFile}: no measured byte win`);assert.ok(report.savedBytes>0,`${manifestFile}: candidate does not save bytes`);
    assert.equal(actualHash,manifest.delivery.sha256,`${manifestFile}: delivery SHA mismatch`);assert.equal(actualHash,report.deliverySha256,`${manifestFile}: report SHA mismatch`);assert.equal(actualBytes,manifest.delivery.bytes,`${manifestFile}: delivery byte mismatch`);assert.equal(actualBytes,report.deliveryBytes,`${manifestFile}: report byte mismatch`);assert.equal(manifest.delivery.renderMetadataFingerprint,report.renderMetadataFingerprint,`${manifestFile}: metadata fingerprint mismatch`);
    addCandidate(manifestFile,manifest,{kind:'png',status:'approved-candidate',runtimeActive:false,strategy:manifest.delivery.strategy,artifact:{path:rel(assetFile),sha256:actualHash,bytes:actualBytes,width:manifest.delivery.width,height:manifest.delivery.height},manifest:{path:rel(manifestFile),version:manifest.version},quality:{exactPixels:true,hiddenTransparentRgbChanges:0,renderMetadataPreserved:true,renderMetadataFingerprint:manifest.delivery.renderMetadataFingerprint},evidence:{byteSavingPercent:report.savedPercent,byteSavingBytes:report.savedBytes,pngWinner:manifest.delivery.pngWinner}});
    continue;
  }
  assert.fail(`${manifestFile}: unsupported delivery manifest version ${manifest.version}`);
}
for(const record of sourceMap.values())record.candidates.sort((a,b)=>a.artifact.bytes-b.artifact.bytes||a.artifact.sha256.localeCompare(b.artifact.sha256));
const sources=[...sourceMap.values()].sort((a,b)=>a.source.path.localeCompare(b.source.path)||a.source.sha256.localeCompare(b.source.sha256));
const registry={version:'kelo-asset-delivery-registry-v2',policy:{runtimePromotion:'separate-explicit-step',defaultRuntimeActive:false,requiredCandidateStatus:'approved-candidate'},sourceCount:sources.length,candidateCount:candidateRecords.length,sources};
fs.mkdirSync(outputDir,{recursive:true});const outputFile=path.join(outputDir,'asset-delivery-manifest.json');fs.writeFileSync(outputFile,JSON.stringify(registry,null,2));
const summary={status:'ASSET_DELIVERY_REGISTRY_OK',version:registry.version,sourceCount:registry.sourceCount,candidateCount:registry.candidateCount,atlasCandidates:candidateRecords.filter(c=>c.kind==='atlas').length,pngCandidates:candidateRecords.filter(c=>c.kind==='png').length,runtimeActiveCandidates:candidateRecords.filter(c=>c.runtimeActive).length,totalCandidateBytes:candidateRecords.reduce((s,c)=>s+c.artifact.bytes,0),totalEvidenceSavingBytes:candidateRecords.reduce((s,c)=>s+(c.evidence.byteSavingBytes||0),0),output:rel(outputFile)};fs.writeFileSync(path.join(outputDir,'report.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
