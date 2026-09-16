/* KELO-INDEX
 * area: CREATORS / ASSET DELIVERY
 * owner: Kelo Creator Asset Bridge
 * keys: DELIVERY MANIFEST CONTENT ADDRESSED HASH IMMUTABLE DEVICE PROOF PROVENANCE
 * purpose: materialize immutable delivery candidates and make promotion eligibility depend on validated iOS Safari evidence
 * public-api: materializeDeliveryVariant(), buildDeliveryManifest(), writeDeliveryManifest()
 * state-owned: generated delivery directory only
 * online: N/A; build/publish-time capability
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {buildAssetProvenance} from './asset-provenance.mjs';
import {validateDeliveryDeviceProof} from './delivery-device-proof.mjs';
const sha256=buffer=>crypto.createHash('sha256').update(buffer).digest('hex'),safe=name=>String(name||'asset').replaceAll('\\','/').replace(/[^a-z0-9._/-]+/gi,'-').replaceAll('/','__').replace(/^-+|-+$/g,'');
export function materializeDeliveryVariant({outputDir,sourceName,sourceBuffer,variantBuffer,format='png',candidate,profile,validators,deviceBenchmarks}={}){
  if(!Buffer.isBuffer(sourceBuffer)||!Buffer.isBuffer(variantBuffer))throw new Error('ASSET_DELIVERY_MANIFEST_BUFFERS_REQUIRED');
  const deviceProof=validateDeliveryDeviceProof(deviceBenchmarks?.iosSafari||deviceBenchmarks||null),sourceSha256=sha256(sourceBuffer),outputSha256=sha256(variantBuffer),fileName=`${safe(sourceName).replace(/\.[^.]+$/,'')}--${outputSha256.slice(0,16)}.${format}`,filePath=path.join(outputDir,fileName);fs.mkdirSync(outputDir,{recursive:true});if(!fs.existsSync(filePath))fs.writeFileSync(filePath,variantBuffer);else if(sha256(fs.readFileSync(filePath))!==outputSha256)throw new Error('ASSET_DELIVERY_HASH_COLLISION');
  const provenance=buildAssetProvenance({sourceBuffer,outputBuffer:variantBuffer,sourceName,outputName:fileName,stage:'DELIVERY',policy:candidate?.track||'delivery',optimizer:candidate?.label||'delivery-candidate',options:candidate?.options||{},quality:{score:candidate?.score??null,metrics:candidate?.metrics||null},profile,validators,toolchainExtra:{deviceProof:deviceProof.normalized||null}}),provenanceName=`${fileName}.provenance.json`;fs.writeFileSync(path.join(outputDir,provenanceName),JSON.stringify(provenance,null,2));
  return{sourceName,sourceSha256,outputSha256,bytes:variantBuffer.length,format,file:fileName,provenance:provenanceName,candidate:candidate?.label||null,track:candidate?.track||null,score:candidate?.score??null,promotionEligible:deviceProof.pass,promotionBlockReasons:deviceProof.reasons,deviceProof:deviceProof.normalized};
}
export function buildDeliveryManifest(entries=[],options={}){return{schema:'kelo-asset-delivery-manifest-v2',generatedAt:new Date().toISOString(),runtimeContractChanged:false,requiresDeviceProof:true,promotionEligible:entries.length>0&&entries.every(entry=>entry.promotionEligible===true),entries:[...entries].sort((a,b)=>String(a.sourceName).localeCompare(String(b.sourceName))),notes:options.notes||null};}
export function writeDeliveryManifest(file,manifest){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(manifest,null,2));return file;}
