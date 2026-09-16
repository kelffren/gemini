/* KELO-INDEX
 * area: CREATORS / ASSET PROVENANCE
 * owner: Kelo Creator Asset Bridge
 * keys: PROVENANCE SHA256 TOOLCHAIN POLICY REPRODUCIBILITY SBOM
 * purpose: attach reproducible source/output/toolchain/quality evidence to AUTHORING and DELIVERY artifacts
 * public-api: buildAssetProvenance(), writeAssetProvenance()
 * state-owned: report files only
 * online: N/A; build/publish-time capability
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildToolchainFingerprint} from './asset-optimization-cache.mjs';

const sha256=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
function finiteOrString(value){return value===Infinity?'Infinity':value===-Infinity?'-Infinity':value;}
function clean(value){if(Array.isArray(value))return value.map(clean);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clean(v)]));return finiteOrString(value);}

export function buildAssetProvenance({sourceBuffer,outputBuffer,sourceName='',outputName='',stage='AUTHORING',policy='strict',optimizer='kelo',options={},quality=null,profile=null,validators=null,toolchainExtra={}}={}){
  if(!Buffer.isBuffer(sourceBuffer)||!Buffer.isBuffer(outputBuffer))throw new Error('ASSET_PROVENANCE_BUFFERS_REQUIRED');
  const toolchain=buildToolchainFingerprint(toolchainExtra);
  return clean({schema:'kelo-asset-provenance-v1',createdAt:new Date().toISOString(),stage,source:{name:String(sourceName),bytes:sourceBuffer.length,sha256:sha256(sourceBuffer)},output:{name:String(outputName),bytes:outputBuffer.length,sha256:sha256(outputBuffer)},optimizer:{name:optimizer,options},policy,quality,profile:profile?{version:profile.version,kind:profile.kind,confidence:profile.confidence,sourceOfTruth:profile.sourceOfTruth,adaptivePolicy:profile.adaptivePolicy}:null,validators,toolchain});
}

export function writeAssetProvenance(file,record){fs.writeFileSync(file,JSON.stringify(record,null,2));return file;}
