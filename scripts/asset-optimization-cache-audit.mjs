/* KELO-INDEX
 * area: QA / CREATOR ASSET CACHE
 * owner: Kelo Creator Asset Bridge
 * keys: CACHE AUDIT SHA256 INVALIDATION INFINITY DETERMINISTIC
 * purpose: prove cache hits preserve bytes/report semantics and any source/engine/config change invalidates the key
 * online: N/A
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildOptimizationCacheKey, readOptimizationCache, writeOptimizationCache} from '../src/creators/assets/asset-optimization-cache.mjs';

const cacheDir=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-asset-cache-audit-'));
try {
  const source=Buffer.from('deterministic-source-bytes');
  const config={engineFingerprint:'engine-a',mode:'strict',effort:'fast',profileKind:'pixel-sprite',qualityPolicy:'strict',extra:{filters:['adaptive']}};
  const descriptor=buildOptimizationCacheKey(source,config);
  const result={
    buffer:Buffer.from('optimized-result-bytes'),
    report:{status:'optimized',qualityScore:1,metrics:{psnrRgb:Infinity,negativeSentinel:-Infinity}}
  };
  const write=writeOptimizationCache(cacheDir,descriptor,result);
  assert.equal(write.hit,false,'write is not a cache hit');

  const hit=readOptimizationCache(cacheDir,descriptor);
  assert.ok(hit,'same content/config must hit');
  assert.equal(hit.buffer.equals(result.buffer),true,'cached bytes exact');
  assert.equal(hit.report.metrics.psnrRgb,Infinity,'positive infinity preserved');
  assert.equal(hit.report.metrics.negativeSentinel,-Infinity,'negative infinity preserved');

  const changedSource=Buffer.from(source);
  changedSource[0]^=1;
  const sourceDescriptor=buildOptimizationCacheKey(changedSource,config);
  assert.notEqual(sourceDescriptor.key,descriptor.key,'one source byte invalidates key');
  assert.equal(readOptimizationCache(cacheDir,sourceDescriptor),null,'changed source cannot hit');

  const engineDescriptor=buildOptimizationCacheKey(source,{...config,engineFingerprint:'engine-b'});
  assert.notEqual(engineDescriptor.key,descriptor.key,'engine fingerprint invalidates key');
  assert.equal(readOptimizationCache(cacheDir,engineDescriptor),null,'changed engine cannot hit');

  const effortDescriptor=buildOptimizationCacheKey(source,{...config,effort:'deep'});
  assert.notEqual(effortDescriptor.key,descriptor.key,'effort invalidates key');

  console.log(JSON.stringify({status:'ASSET_OPTIMIZATION_CACHE_AUDIT_OK',key:descriptor.key,sourceInvalidated:true,engineInvalidated:true,effortInvalidated:true,infinityPreserved:true}));
} finally {
  fs.rmSync(cacheDir,{recursive:true,force:true});
}
