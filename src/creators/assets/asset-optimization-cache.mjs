/* KELO-INDEX
 * area: CREATORS / ASSET BUILD CACHE
 * owner: Kelo Creator Asset Bridge
 * keys: CONTENT ADDRESSED CACHE SHA256 OPTIMIZER FINGERPRINT DETERMINISTIC
 * purpose: reuse expensive deterministic asset optimization results only when source bytes, engine code and configuration are identical
 * public-api: buildOptimizationCacheKey(), readOptimizationCache(), writeOptimizationCache(), fingerprintFiles()
 * state-owned: local cache directory only; never canonical content
 * online: N/A; build-time performance capability
 * do-not: treat cache as source of truth or reuse an entry whose hashes/config do not match
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CACHE_SCHEMA='kelo-asset-optimization-cache-v1';
const sha256=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');

export function fingerprintFiles(files=[]) {
  const hash=crypto.createHash('sha256');
  for(const file of [...files].sort()) {
    hash.update(path.resolve(file));
    if(fs.existsSync(file)) hash.update(fs.readFileSync(file));
    else hash.update('<missing>');
  }
  return hash.digest('hex');
}

export function buildOptimizationCacheKey(sourceBuffer,config={}) {
  const sourceSha256=sha256(sourceBuffer);
  const normalized={
    schema:CACHE_SCHEMA,
    engineFingerprint:String(config.engineFingerprint||''),
    mode:String(config.mode||'strict'),
    effort:String(config.effort||'fast'),
    profileKind:String(config.profileKind||''),
    qualityPolicy:String(config.qualityPolicy||''),
    extra:config.extra||null
  };
  const configJson=JSON.stringify(normalized);
  const key=sha256(Buffer.from(`${sourceSha256}\n${configJson}`));
  return {key,sourceSha256,config:normalized};
}

function entryPaths(cacheDir,key) {
  const shard=key.slice(0,2);
  const dir=path.join(cacheDir,shard);
  return {dir,buffer:path.join(dir,`${key}.bin`),meta:path.join(dir,`${key}.json`)};
}

export function readOptimizationCache(cacheDir,descriptor) {
  const paths=entryPaths(cacheDir,descriptor.key);
  if(!fs.existsSync(paths.buffer)||!fs.existsSync(paths.meta)) return null;
  try {
    const meta=JSON.parse(fs.readFileSync(paths.meta,'utf8'));
    if(meta.schema!==CACHE_SCHEMA||meta.key!==descriptor.key||meta.sourceSha256!==descriptor.sourceSha256) return null;
    if(JSON.stringify(meta.config)!==JSON.stringify(descriptor.config)) return null;
    const buffer=fs.readFileSync(paths.buffer);
    if(buffer.length!==meta.outputBytes||sha256(buffer)!==meta.outputSha256) return null;
    return {buffer,report:meta.report,cache:{hit:true,key:descriptor.key,outputSha256:meta.outputSha256,createdAt:meta.createdAt}};
  } catch {
    return null;
  }
}

export function writeOptimizationCache(cacheDir,descriptor,result) {
  if(!result?.buffer||!result?.report) return null;
  const paths=entryPaths(cacheDir,descriptor.key);
  fs.mkdirSync(paths.dir,{recursive:true});
  const outputSha256=sha256(result.buffer);
  const meta={
    schema:CACHE_SCHEMA,
    key:descriptor.key,
    sourceSha256:descriptor.sourceSha256,
    config:descriptor.config,
    outputSha256,
    outputBytes:result.buffer.length,
    createdAt:new Date().toISOString(),
    report:result.report
  };
  const tempBuffer=`${paths.buffer}.${process.pid}.tmp`;
  const tempMeta=`${paths.meta}.${process.pid}.tmp`;
  fs.writeFileSync(tempBuffer,result.buffer);
  fs.writeFileSync(tempMeta,JSON.stringify(meta));
  fs.renameSync(tempBuffer,paths.buffer);
  fs.renameSync(tempMeta,paths.meta);
  return {hit:false,key:descriptor.key,outputSha256,createdAt:meta.createdAt};
}
