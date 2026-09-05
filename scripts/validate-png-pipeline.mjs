import fs from 'node:fs';
import path from 'node:path';
import {inspectPng, walkFiles} from './png-validation-core.mjs';

const root = process.cwd();
const assetsRoot = path.join(root, 'assets');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/environment/art-asset-manifest.json'), 'utf8'));
const policy = JSON.parse(fs.readFileSync(path.join(root, 'src/environment/png-validation-policy.json'), 'utf8'));

const failures = [];
const pass = message => console.log(`PNG_PIPELINE_PASS ${message}`);
const fail = message => failures.push(message);
const rel = full => path.relative(root, full).split(path.sep).join('/');

if (policy.version !== 'kelo-png-validation-policy-v1') fail(`unexpected policy version=${policy.version}`);
if (!Array.isArray(policy.excludedFromWorldContract)) fail('excludedFromWorldContract must be an array');

const manifestByPath = new Map();
for (const asset of manifest.assets || []) {
  if (manifestByPath.has(asset.path)) fail(`duplicate manifest path=${asset.path}`);
  manifestByPath.set(asset.path, asset);
}

const exclusions = new Map();
for (const item of policy.excludedFromWorldContract || []) {
  if (!item || typeof item.path !== 'string' || !/\.png$/i.test(item.path)) {
    fail(`invalid exclusion path=${JSON.stringify(item?.path)}`);
    continue;
  }
  if (exclusions.has(item.path)) fail(`duplicate exclusion path=${item.path}`);
  if (manifestByPath.has(item.path)) fail(`path cannot be both registered and excluded: ${item.path}`);
  if (!['non-world-ui','superseded-archive','unadopted-archive'].includes(item.scope)) fail(`invalid exclusion scope=${item.scope} path=${item.path}`);
  if (typeof item.reason !== 'string' || item.reason.trim().length < 12) fail(`exclusion requires concrete reason: ${item.path}`);
  exclusions.set(item.path, item);
}

const pngFiles = walkFiles(assetsRoot, file => /\.png$/i.test(file)).map(rel).sort();
const diskSet = new Set(pngFiles);
const diskCaseMap = new Map();
for (const file of pngFiles) {
  const key = file.toLowerCase();
  if (diskCaseMap.has(key)) fail(`case-colliding PNG paths: ${diskCaseMap.get(key)} and ${file}`);
  diskCaseMap.set(key, file);
}

for (const file of pngFiles) {
  const registered = manifestByPath.has(file);
  const excluded = exclusions.has(file);
  if (registered === excluded) fail(`${file} must be exactly one of registered or explicitly excluded`);
}
for (const file of manifestByPath.keys()) if (!diskSet.has(file)) fail(`manifest PNG missing from disk: ${file}`);
for (const file of exclusions.keys()) if (!diskSet.has(file)) fail(`excluded PNG missing from disk: ${file}`);

for (const [file, asset] of manifestByPath) {
  if (!diskSet.has(file)) continue;
  try {
    const info = inspectPng(fs.readFileSync(path.join(root, file)), file);
    if (info.width !== asset.width || info.height !== asset.height) {
      fail(`${file} binary dimensions ${info.width}x${info.height} != manifest ${asset.width}x${asset.height}`);
    }
    if (asset.requireAlpha === true && !info.hasTransparency) fail(`${file} requires alpha/tRNS but binary has none`);
    pass(`${file} binary=${info.width}x${info.height} bitDepth=${info.bitDepth} colorType=${info.colorType} chunks=${info.chunks.length}`);
  } catch (error) {
    fail(error.message);
  }
}

const runtimeRoots = [
  'index.html',
  'src'
].map(item => path.join(root, item)).filter(fs.existsSync);
const textFiles = [];
for (const item of runtimeRoots) {
  const stat = fs.statSync(item);
  if (stat.isFile()) textFiles.push(item);
  else textFiles.push(...walkFiles(item, file => /\.(?:js|mjs|html|css|json)$/i.test(file)));
}
const excludedScanFiles = new Set([
  'src/environment/art-asset-manifest.json',
  'src/environment/png-validation-policy.json'
]);
const runtimeRefs = new Map();
const refPattern = /assets\/[A-Za-z0-9_./-]+\.png/gi;
for (const file of textFiles) {
  const sourceFile = rel(file);
  if (excludedScanFiles.has(sourceFile)) continue;
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(refPattern)) {
    const ref = match[0];
    if (!runtimeRefs.has(ref)) runtimeRefs.set(ref, new Set());
    runtimeRefs.get(ref).add(sourceFile);
  }
}

for (const [ref, owners] of [...runtimeRefs.entries()].sort()) {
  const exactDiskPath = diskCaseMap.get(ref.toLowerCase());
  if (!exactDiskPath) {
    fail(`runtime PNG reference missing from disk: ${ref} owners=${[...owners].join(',')}`);
    continue;
  }
  if (exactDiskPath !== ref) fail(`runtime PNG path case mismatch: ref=${ref} disk=${exactDiskPath}`);
  if (manifestByPath.has(exactDiskPath)) {
    pass(`runtime-ref ${exactDiskPath} owners=${[...owners].join(',')}`);
    continue;
  }
  const exclusion = exclusions.get(exactDiskPath);
  if (!exclusion) {
    fail(`runtime PNG reference is outside manifest/policy: ${exactDiskPath} owners=${[...owners].join(',')}`);
  } else if (exclusion.scope !== 'non-world-ui') {
    fail(`archived PNG is still runtime-referenced: ${exactDiskPath} scope=${exclusion.scope} owners=${[...owners].join(',')}`);
  } else {
    pass(`non-world runtime-ref ${exactDiskPath} owners=${[...owners].join(',')}`);
  }
}

for (const [file, exclusion] of exclusions) {
  if (!runtimeRefs.has(file) && exclusion.scope === 'non-world-ui') {
    pass(`explicit non-world PNG ${file} is retained but currently unreferenced`);
  }
}

if (failures.length) {
  for (const message of failures) console.error(`PNG_PIPELINE_FAIL ${message}`);
  console.error(`PNG_PIPELINE_NOT_OK failures=${failures.length} disk=${pngFiles.length} registered=${manifestByPath.size} excluded=${exclusions.size} runtimeRefs=${runtimeRefs.size}`);
  process.exit(1);
}
console.log(`PNG_PIPELINE_OK policy=${policy.version} disk=${pngFiles.length} registered=${manifestByPath.size} excluded=${exclusions.size} runtimeRefs=${runtimeRefs.size}`);
