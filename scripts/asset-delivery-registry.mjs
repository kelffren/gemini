#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / CREATOR ASSET DELIVERY
 * owner: Kelo Creator Asset Bridge
 * keys: DELIVERY REGISTRY MANIFEST SHA256 QUALITY PROMOTION SOURCE CANDIDATE
 * purpose: aggregate verified DELIVERY candidate artifacts into one fail-closed source→candidate registry without activating runtime promotion
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
for(const manifestFile of candidateManifests){
  const manifest=readJson(manifestFile);assert.equal(manifest.version,'kelo-atlas-delivery-manifest-v1',`${manifestFile}: unsupported delivery manifest version`);
  const dir=path.dirname(manifestFile),atlasFile=path.join(dir,'atlas.png'),reportFile=path.join(dir,'report.json');
  assert.ok(fs.existsSync(atlasFile),`${manifestFile}: atlas.png missing`);assert.ok(fs.existsSync(reportFile),`${manifestFile}: report.json missing`);
  const report=readJson(reportFile),atlasBuffer=fs.readFileSync(atlasFile),actualHash=sha256(atlasBuffer),actualBytes=atlasBuffer.length;
  assert.equal(report.status,'ASSET_ATLAS_DELIVERY_CANDIDATE_OK',`${manifestFile}: candidate report not approved`);
  assert.equal(report.renderExactFrames,report.frameCount,`${manifestFile}: not all frames render-exact`);assert.equal(report.anchorPreserved,true,`${manifestFile}: anchor drift`);assert.equal(report.hiddenTransparentRgbChanges,0,`${manifestFile}: hidden RGB changed`);assert.equal(report.bytePromotionCandidate,true,`${manifestFile}: no measured byte win`);
  assert.equal(actualHash,manifest.delivery.sha256,`${manifestFile}: delivery SHA mismatch`);assert.equal(actualHash,report.deliverySha256,`${manifestFile}: report SHA mismatch`);assert.equal(actualBytes,manifest.delivery.bytes,`${manifestFile}: delivery byte mismatch`);assert.equal(actualBytes,report.deliveryBytes,`${manifestFile}: report byte mismatch`);
  assert.equal(manifest.source.sha256.length,64,`${manifestFile}: invalid source SHA`);assert.ok(manifest.source.path,`${manifestFile}: source path missing`);
  const candidate={
    kind:'atlas',
    status:'approved-candidate',
    runtimeActive:false,
    strategy:manifest.delivery.strategy,
    padding:manifest.delivery.padding,
    artifact:{path:rel(atlasFile),sha256:actualHash,bytes:actualBytes,width:manifest.delivery.width,height:manifest.delivery.height},
    manifest:{path:rel(manifestFile),version:manifest.version,cropOffset:manifest.delivery.cropOffset},
    quality:{frameCount:report.frameCount,renderExactFrames:report.renderExactFrames,anchorPreserved:report.anchorPreserved,hiddenTransparentRgbChanges:report.hiddenTransparentRgbChanges,renderMetadataFingerprint:manifest.delivery.renderMetadataFingerprint},
    evidence:{areaSavingPercent:report.areaSavingPercent,byteSavingPercent:report.savedVsOptimizedBaselinePercent,byteSavingBytes:report.savedVsOptimizedBaselineBytes,pngWinner:manifest.delivery.pngWinner}
  };
  const sourceKey=`${manifest.source.path}:${manifest.source.sha256}`;
  if(!sourceMap.has(sourceKey))sourceMap.set(sourceKey,{source:{path:manifest.source.path,sha256:manifest.source.sha256,bytes:manifest.source.bytes,optimizedBaselineBytes:manifest.source.optimizedBaselineBytes,width:manifest.source.width,height:manifest.source.height},candidates:[]});
  const record=sourceMap.get(sourceKey);assert.ok(!record.candidates.some(c=>c.artifact.sha256===actualHash),`${manifestFile}: duplicate candidate hash`);record.candidates.push(candidate);candidateRecords.push(candidate);
}
for(const record of sourceMap.values())record.candidates.sort((a,b)=>a.artifact.bytes-b.artifact.bytes||a.artifact.sha256.localeCompare(b.artifact.sha256));
const sources=[...sourceMap.values()].sort((a,b)=>a.source.path.localeCompare(b.source.path)||a.source.sha256.localeCompare(b.source.sha256));
const registry={version:'kelo-asset-delivery-registry-v1',policy:{runtimePromotion:'separate-explicit-step',defaultRuntimeActive:false,requiredCandidateStatus:'approved-candidate'},sourceCount:sources.length,candidateCount:candidateRecords.length,sources};
fs.mkdirSync(outputDir,{recursive:true});const outputFile=path.join(outputDir,'asset-delivery-manifest.json');fs.writeFileSync(outputFile,JSON.stringify(registry,null,2));
const summary={status:'ASSET_DELIVERY_REGISTRY_OK',version:registry.version,sourceCount:registry.sourceCount,candidateCount:registry.candidateCount,runtimeActiveCandidates:candidateRecords.filter(c=>c.runtimeActive).length,totalCandidateBytes:candidateRecords.reduce((s,c)=>s+c.artifact.bytes,0),output:rel(outputFile)};fs.writeFileSync(path.join(outputDir,'report.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
