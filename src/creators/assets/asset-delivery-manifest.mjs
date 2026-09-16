/* KELO-INDEX
 * area: CREATORS / ASSET DELIVERY
 * owner: Kelo Creator Asset Bridge
 * keys: DELIVERY MANIFEST CONTENT ADDRESSED HASH IMMUTABLE ROLLBACK PROVENANCE
 * purpose: materialize approved lab variants under immutable hash names and map source identity to evidence without rewriting runtime contracts
 * public-api: materializeDeliveryVariant(), buildDeliveryManifest(), writeDeliveryManifest()
 * state-owned: generated delivery directory only
 * online: N/A; build/publish-time capability
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {buildAssetProvenance} from './asset-provenance.mjs';
const sha256=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const safe=name=>String(name||'asset').replaceAll('\\','/').replace(/[^a-z0-9._/-]+/gi,'-').replaceAll('/','__').replace(/^-+|-+$/g,'');

export function materializeDeliveryVariant({outputDir,sourceName,sourceBuffer,variantBuffer,format='png',candidate,profile,validators,deviceBenchmarks}={}){
  if(!Buffer.isBuffer(sourceBuffer)||!Buffer.isBuffer(variantBuffer))throw new Error('ASSET_DELIVERY_MANIFEST_BUFFERS_REQUIRED');
  const sourceSha256=sha256(sourceBuffer),outputSha256=sha256(variantBuffer),fileName=`${safe(sourceName).replace(/\.[^.]+$/,'')}--${outputSha256.slice(0,16)}.${format}`,filePath=path.join(outputDir,fileName);fs.mkdirSync(outputDir,{recursive:true});if(!fs.existsSync(filePath))fs.writeFileSync(filePath,variantBuffer);else if(sha256(fs.readFileSync(filePath))!==outputSha256)throw new Error('ASSET_DELIVERY_HASH_COLLISION');
  const provenance=buildAssetProvenance({sourceBuffer,outputBuffer:variantBuffer,sourceName,outputName:fileName,stage:'DELIVERY',policy:candidate?.track||'delivery',optimizer:candidate?.label||'delivery-candidate',options:candidate?.options||{},quality:{score:candidate?.score??null,metrics:candidate?.metrics||null},profile,validators,toolchainExtra:{deviceBenchmarks:deviceBenchmarks||null}});
  const provenanceName=`${fileName}.provenance.json`;fs.writeFileSync(path.join(outputDir,provenanceName),JSON.stringify(provenance,null,2));
  return{sourceName,sourceSha256,outputSha256,bytes:variantBuffer.length,format,file:fileName,provenance:provenanceName,candidate:candidate?.label||null,track:candidate?.track||null,score:candidate?.score??null,promotionEligible:Boolean(deviceBenchmarks?.iosSafari),deviceBenchmarks:deviceBenchmarks||null};
}

export function buildDeliveryManifest(entries=[],options={}){return{schema:'kelo-asset-delivery-manifest-v1',generatedAt:new Date().toISOString(),runtimeContractChanged:false,requiresDeviceProof:true,entries:[...entries].sort((a,b)=>String(a.sourceName).localeCompare(String(b.sourceName))),notes:options.notes||null};}
export function writeDeliveryManifest(file,manifest){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(manifest,null,2));return file;}
