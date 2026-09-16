/* KELO-INDEX
 * area: CREATORS / ASSET BUILD CACHE
 * owner: Kelo Creator Asset Bridge
 * keys: BATCH DELIVERY CACHE ABI SEMANTIC NAMESPACE SOURCE SET TOOLCHAIN
 * purpose: define exactly which code, toolchain and selected SOURCE bytes are allowed to reuse strict batch DELIVERY optimizer outputs
 * public-api: BATCH_DELIVERY_CACHE_ABI, BATCH_DELIVERY_OPTIMIZER_ENGINE_FILES, collectBatchDeliveryPngs(), batchDeliveryLosslessOptions(), buildBatchDeliveryCacheNamespace()
 * state-owned: none; pure build-time cache contract
 * online: N/A; build/publish-time only
 */

import fs from 'node:fs';
import path from 'node:path';
import {PALETTE_ORDER_FAST} from './png-palette-order.mjs';
import {buildToolchainFingerprint,fingerprintFiles} from './asset-optimization-cache.mjs';

export const BATCH_DELIVERY_CACHE_ABI='kelo-batch-delivery-cache-abi-v1';

// Only files capable of changing the optimizer output bytes, profile-driven
// optimizer choices, cache serialization/key semantics, or this ABI belong
// here. Reporting/orchestration and post-cache quality gates intentionally do
// not: every cache hit is independently decoded and revalidated afterwards.
export const BATCH_DELIVERY_OPTIMIZER_ENGINE_FILES=Object.freeze([
  'src/creators/assets/png-space-optimizer.mjs',
  'src/creators/assets/png-palette-order.mjs',
  'src/creators/assets/png-conformance-guard.mjs',
  'src/creators/assets/asset-image-profiler.mjs',
  'src/creators/assets/asset-optimization-cache.mjs',
  'src/creators/assets/asset-batch-delivery-cache-contract.mjs'
]);

const EXCLUDED_DIRS=new Set(['node_modules','.git','dist','test-results','.cache']);

export function collectBatchDeliveryPngs(target,options={}){
  const maxFiles=Math.max(1,Number(options.maxFiles??80)||80),resolved=path.resolve(target);
  if(!fs.existsSync(resolved))return[];
  const stat=fs.statSync(resolved);
  if(stat.isFile())return /\.png$/i.test(resolved)?[resolved]:[];
  const found=[],stack=[resolved];
  while(stack.length&&found.length<maxFiles){
    const dir=stack.pop(),entries=fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name));
    for(const entry of entries){
      const full=path.join(dir,entry.name);
      if(entry.isDirectory()){
        if(!EXCLUDED_DIRS.has(entry.name))stack.push(full);
      }else if(entry.isFile()&&/\.png$/i.test(entry.name)){
        found.push(full);
        if(found.length>=maxFiles)break;
      }
    }
  }
  return found.sort();
}

export function batchDeliveryLosslessOptions(profile){
  return {
    filterStrategies:['adaptive'],
    paletteOrderStrategies:PALETTE_ORDER_FAST,
    disablePalette:(profile?.metrics?.uniqueColors||4097)>64
  };
}

export function batchDeliverySourceSetFingerprint(files,root=process.cwd()){
  return fingerprintFiles(files,{root});
}

export function buildBatchDeliveryCacheNamespace(options={}){
  const root=path.resolve(options.root||process.cwd());
  const inputRoot=path.resolve(root,options.inputRoot||'assets');
  const maxFiles=Math.max(1,Number(options.maxFiles??80)||80);
  const files=options.files?[...options.files].map(file=>path.resolve(file)):collectBatchDeliveryPngs(inputRoot,{maxFiles});
  const engineFingerprint=fingerprintFiles(BATCH_DELIVERY_OPTIMIZER_ENGINE_FILES.map(file=>path.resolve(root,file)),{root});
  const toolchain=buildToolchainFingerprint({pipeline:BATCH_DELIVERY_CACHE_ABI});
  const sourceSetFingerprint=batchDeliverySourceSetFingerprint(files,root);
  const semanticPrefix=`asset-batch-delivery-v2-${BATCH_DELIVERY_CACHE_ABI}-${process.platform}-${process.arch}-${engineFingerprint}-${toolchain.sha256}`;
  return {
    abi:BATCH_DELIVERY_CACHE_ABI,
    engineFingerprint,
    toolchain,
    sourceSetFingerprint,
    semanticPrefix,
    key:`${semanticPrefix}-${sourceSetFingerprint}`,
    restorePrefix:`${semanticPrefix}-`,
    files
  };
}
