/* KELO-INDEX
 * area: CREATORS / ASSET BUILD CACHE
 * owner: Kelo Creator Asset Bridge
 * keys: CONTENT ADDRESSED CACHE SHA256 OPTIMIZER TOOLCHAIN FINGERPRINT DETERMINISTIC INFINITY
 * purpose: reuse deterministic results only when source bytes, engine code, toolchain and configuration are identical
 * public-api: buildOptimizationCacheKey(), readOptimizationCache(), writeOptimizationCache(), fingerprintFiles(), buildToolchainFingerprint()
 * state-owned: local cache directory only; never canonical content
 * online: N/A; build-time performance capability
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CACHE_SCHEMA='kelo-asset-optimization-cache-v2';
const POS_INF='__KELO_NUMBER_POSITIVE_INFINITY__',NEG_INF='__KELO_NUMBER_NEGATIVE_INFINITY__';
const sha256=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
function stringify(value){return JSON.stringify(value,(_key,item)=>item===Infinity?POS_INF:item===-Infinity?NEG_INF:item);}
function parse(value){return JSON.parse(value,(_key,item)=>item===POS_INF?Infinity:item===NEG_INF?-Infinity:item);}

export function fingerprintFiles(files=[],options={}){
  const hash=crypto.createHash('sha256'),root=path.resolve(options.root||process.cwd());
  for(const file of [...files].sort()){
    const absolute=path.resolve(file),logical=path.relative(root,absolute).replaceAll('\\','/');
    hash.update(logical);hash.update('\0');
    if(fs.existsSync(absolute))hash.update(fs.readFileSync(absolute));else hash.update('<missing>');
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function buildToolchainFingerprint(extra={}){
  const normalized={
    node:process.version,
    platform:process.platform,
    arch:process.arch,
    versions:{zlib:process.versions.zlib||null,uv:process.versions.uv||null,openssl:process.versions.openssl||null,v8:process.versions.v8||null},
    ...extra
  };
  return {descriptor:normalized,sha256:sha256(Buffer.from(stringify(normalized)))};
}

export function buildOptimizationCacheKey(sourceBuffer,config={}){
  const sourceSha256=sha256(sourceBuffer),normalized={schema:CACHE_SCHEMA,engineFingerprint:String(config.engineFingerprint||''),toolchainFingerprint:String(config.toolchainFingerprint||''),mode:String(config.mode||'strict'),effort:String(config.effort||'fast'),profileKind:String(config.profileKind||''),qualityPolicy:String(config.qualityPolicy||''),extra:config.extra||null},configJson=stringify(normalized),key=sha256(Buffer.from(`${sourceSha256}\n${configJson}`));
  return{key,sourceSha256,config:normalized};
}
function entryPaths(cacheDir,key){const shard=key.slice(0,2),dir=path.join(cacheDir,shard);return{dir,buffer:path.join(dir,`${key}.bin`),meta:path.join(dir,`${key}.json`)}};
export function readOptimizationCache(cacheDir,descriptor){const paths=entryPaths(cacheDir,descriptor.key);if(!fs.existsSync(paths.buffer)||!fs.existsSync(paths.meta))return null;try{const meta=parse(fs.readFileSync(paths.meta,'utf8'));if(meta.schema!==CACHE_SCHEMA||meta.key!==descriptor.key||meta.sourceSha256!==descriptor.sourceSha256)return null;if(stringify(meta.config)!==stringify(descriptor.config))return null;const buffer=fs.readFileSync(paths.buffer);if(buffer.length!==meta.outputBytes||sha256(buffer)!==meta.outputSha256)return null;return{buffer,report:meta.report,cache:{hit:true,key:descriptor.key,outputSha256:meta.outputSha256,createdAt:meta.createdAt,schema:CACHE_SCHEMA}};}catch{return null;}}
export function writeOptimizationCache(cacheDir,descriptor,result){if(!result?.buffer||!result?.report)return null;const paths=entryPaths(cacheDir,descriptor.key);fs.mkdirSync(paths.dir,{recursive:true});const outputSha256=sha256(result.buffer),meta={schema:CACHE_SCHEMA,key:descriptor.key,sourceSha256:descriptor.sourceSha256,config:descriptor.config,outputSha256,outputBytes:result.buffer.length,createdAt:new Date().toISOString(),report:result.report},tempBuffer=`${paths.buffer}.${process.pid}.tmp`,tempMeta=`${paths.meta}.${process.pid}.tmp`;fs.writeFileSync(tempBuffer,result.buffer);fs.writeFileSync(tempMeta,stringify(meta));fs.renameSync(tempBuffer,paths.buffer);fs.renameSync(tempMeta,paths.meta);return{hit:false,key:descriptor.key,outputSha256,createdAt:meta.createdAt,schema:CACHE_SCHEMA};}
