#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / CREATOR ASSET CACHE
 * owner: Kelo Creator Asset Bridge
 * keys: CACHE ABI SEMANTIC NAMESPACE SOURCE SET INVALIDATION ORCHESTRATION
 * purpose: prove batch DELIVERY cache reuse is stable across reporting-only changes and invalidates on optimizer/toolchain/source semantics
 * online: N/A; deterministic CI audit
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  BATCH_DELIVERY_CACHE_ABI,
  BATCH_DELIVERY_OPTIMIZER_ENGINE_FILES,
  batchDeliveryLosslessOptions,
  batchDeliverySourceSetFingerprint,
  buildBatchDeliveryCacheNamespace,
  collectBatchDeliveryPngs
} from '../src/creators/assets/asset-batch-delivery-cache-contract.mjs';

assert.equal(BATCH_DELIVERY_CACHE_ABI,'kelo-batch-delivery-cache-abi-v1');
for(const required of [
  'src/creators/assets/png-space-optimizer.mjs',
  'src/creators/assets/png-palette-order.mjs',
  'src/creators/assets/png-conformance-guard.mjs',
  'src/creators/assets/asset-image-profiler.mjs',
  'src/creators/assets/asset-optimization-cache.mjs',
  'src/creators/assets/asset-batch-delivery-cache-contract.mjs'
]) assert.ok(BATCH_DELIVERY_OPTIMIZER_ENGINE_FILES.includes(required),`missing semantic engine file ${required}`);
assert.ok(!BATCH_DELIVERY_OPTIMIZER_ENGINE_FILES.includes('scripts/asset-batch-delivery-compiler.mjs'),'orchestrator must not invalidate optimizer cache');
assert.ok(!BATCH_DELIVERY_OPTIMIZER_ENGINE_FILES.includes('.github/workflows/asset-space-hardening.yml'),'workflow must not invalidate optimizer cache');
assert.ok(!BATCH_DELIVERY_OPTIMIZER_ENGINE_FILES.includes('src/creators/assets/png-render-metadata.mjs'),'post-cache quality gate must revalidate, not invalidate optimizer bytes');

assert.equal(batchDeliveryLosslessOptions({metrics:{uniqueColors:64}}).disablePalette,false);
assert.equal(batchDeliveryLosslessOptions({metrics:{uniqueColors:65}}).disablePalette,true);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-batch-cache-contract-'));
try{
  const input=path.join(tmp,'assets');fs.mkdirSync(path.join(input,'nested'),{recursive:true});
  const a=path.join(input,'a.PNG'),b=path.join(input,'b.png'),c=path.join(input,'nested','c.png');
  fs.writeFileSync(a,Buffer.from('png-a-v1'));fs.writeFileSync(b,Buffer.from('png-b-v1'));fs.writeFileSync(c,Buffer.from('png-c-v1'));
  const selected1=collectBatchDeliveryPngs(input,{maxFiles:3});
  const selected2=collectBatchDeliveryPngs(input,{maxFiles:3});
  assert.deepEqual(selected1,selected2,'selection must be deterministic');
  assert.equal(selected1.length,3);
  const sourceFingerprint1=batchDeliverySourceSetFingerprint(selected1,process.cwd());
  const ns1=buildBatchDeliveryCacheNamespace({files:selected1,root:process.cwd(),maxFiles:3});
  fs.writeFileSync(path.join(tmp,'reporting-only-note.txt'),'orchestration changed but optimizer semantics did not');
  const nsReporting=buildBatchDeliveryCacheNamespace({files:selected1,root:process.cwd(),maxFiles:3});
  assert.equal(nsReporting.semanticPrefix,ns1.semanticPrefix,'reporting-only change changed semantic namespace');
  assert.equal(nsReporting.key,ns1.key,'reporting-only change changed primary cache key');
  fs.writeFileSync(b,Buffer.from('png-b-v2'));
  const sourceFingerprint2=batchDeliverySourceSetFingerprint(selected1,process.cwd());
  const nsSourceChanged=buildBatchDeliveryCacheNamespace({files:selected1,root:process.cwd(),maxFiles:3});
  assert.notEqual(sourceFingerprint2,sourceFingerprint1,'source mutation did not change source-set fingerprint');
  assert.equal(nsSourceChanged.semanticPrefix,ns1.semanticPrefix,'source mutation should preserve semantic prefix');
  assert.notEqual(nsSourceChanged.key,ns1.key,'source mutation must create a new primary cache key');
  assert.equal(nsSourceChanged.restorePrefix,ns1.restorePrefix,'compatible source generations must share restore prefix');
  assert.ok(ns1.key.startsWith(ns1.restorePrefix));
  console.log(JSON.stringify({
    status:'ASSET_BATCH_CACHE_CONTRACT_AUDIT_OK',
    abi:BATCH_DELIVERY_CACHE_ABI,
    engineFiles:BATCH_DELIVERY_OPTIMIZER_ENGINE_FILES.length,
    deterministicSelection:selected1.length,
    reportingStable:true,
    sourceInvalidated:true,
    semanticPrefix:ns1.semanticPrefix,
    sourceFingerprintBefore:sourceFingerprint1,
    sourceFingerprintAfter:sourceFingerprint2
  }));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
