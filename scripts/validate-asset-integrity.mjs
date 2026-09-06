/* KELO-INDEX
 * area: BUILD
 * keys: ASSET INTEGRITY PNG CASE MISSING REFERENCES CI
 * hace: valida que assets/ solo contenga .PNG y que runtime use rutas existentes con case exacto
 * online: N/A; gate estatico de CI
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ASSETS_DIR = path.join(ROOT, 'assets');
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.css']);
const ASSET_REF = /assets\/[A-Za-z0-9_.\/-]+\.(?:PNG|png|svg|webp|jpg|jpeg)/g;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function repoPath(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

const assetFiles = walk(ASSETS_DIR).map(repoPath).sort();
const invalidAssetFiles = assetFiles.filter((file) => !file.endsWith('.PNG'));

const runtimeFiles = [
  path.join(ROOT, 'index.html'),
  ...fs.readdirSync(ROOT)
    .filter((name) => /^engine(?:-[a-z0-9]+)?\.js$/i.test(name))
    .map((name) => path.join(ROOT, name)),
  ...walk(path.join(ROOT, 'src')).filter((file) => TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()))
].filter((file) => fs.existsSync(file));

const disk = new Set(assetFiles);
const refs = new Map();
for (const file of runtimeFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const ref of text.match(ASSET_REF) || []) {
    if (!refs.has(ref)) refs.set(ref, new Set());
    refs.get(ref).add(repoPath(file));
  }
}

const lowercasePngRefs = [];
const missingRefs = [];
for (const [ref, owners] of refs) {
  if (/\.png$/.test(ref) && !ref.endsWith('.PNG')) {
    lowercasePngRefs.push({ ref, owners: [...owners].sort() });
  }
  if (!disk.has(ref)) missingRefs.push({ ref, owners: [...owners].sort() });
}

const duplicateOwners = [];
for (const [ref, owners] of refs) {
  if (owners.size > 1) duplicateOwners.push({ ref, ownerCount: owners.size });
}

console.log(`ASSET_INTEGRITY assets=${assetFiles.length} runtimeRefs=${refs.size} sharedRefs=${duplicateOwners.length}`);
for (const file of assetFiles) console.log('ASSET_DISK', file);

if (invalidAssetFiles.length) {
  console.error('ASSET_INTEGRITY_FAIL non-.PNG files exist under assets/:');
  invalidAssetFiles.forEach((file) => console.error(' ', file));
}
if (lowercasePngRefs.length) {
  console.error('ASSET_INTEGRITY_FAIL lowercase/noncanonical PNG runtime references:');
  lowercasePngRefs.forEach(({ ref, owners }) => console.error(' ', ref, 'owners=', owners.join(',')));
}
if (missingRefs.length) {
  console.error('ASSET_INTEGRITY_FAIL missing runtime asset references:');
  missingRefs.forEach(({ ref, owners }) => console.error(' ', ref, 'owners=', owners.join(',')));
}

if (invalidAssetFiles.length || lowercasePngRefs.length || missingRefs.length) process.exit(1);
console.log('ASSET_INTEGRITY_PASS exact .PNG files and zero missing runtime asset references');
