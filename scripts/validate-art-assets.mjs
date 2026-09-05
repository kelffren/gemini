import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'src/environment/art-asset-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function fail(message) {
  console.error(`ASSET_CONTRACT_FAIL ${message}`);
  process.exitCode = 1;
}

if (manifest.contractVersion !== 'kelo-art-asset-contract-v1') {
  fail(`unexpected contractVersion=${manifest.contractVersion}`);
}
if (manifest.worldTileSize !== 32) fail(`worldTileSize must be 32, got ${manifest.worldTileSize}`);
if (manifest.sampling !== 'nearest') fail(`sampling must be nearest, got ${manifest.sampling}`);
if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) fail('assets must be a non-empty array');

const seen = new Set();
for (const asset of manifest.assets || []) {
  if (!asset.id || !asset.path || !asset.kind) {
    fail(`asset missing id/path/kind: ${JSON.stringify(asset)}`);
    continue;
  }
  if (seen.has(asset.id)) fail(`duplicate id=${asset.id}`);
  seen.add(asset.id);

  if (!/\.png$/i.test(asset.path)) {
    fail(`${asset.id} must point to a PNG: ${asset.path}`);
    continue;
  }
  const fullPath = path.join(root, asset.path);
  if (!fs.existsSync(fullPath)) {
    fail(`${asset.id} missing file ${asset.path}`);
    continue;
  }

  const header = fs.readFileSync(fullPath).subarray(0, 26);
  const signature = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if (header.length < 26 || !header.subarray(0, 8).equals(signature)) {
    fail(`${asset.id} is not a valid PNG header`);
    continue;
  }

  const width = header.readUInt32BE(16);
  const height = header.readUInt32BE(20);
  const colorType = header[25];
  if (width !== asset.width || height !== asset.height) {
    fail(`${asset.id} dimensions ${width}x${height} != declared ${asset.width}x${asset.height}`);
  }
  if (asset.requireAlpha === true && colorType !== 4 && colorType !== 6) {
    fail(`${asset.id} requires alpha but PNG colorType=${colorType}`);
  }

  const hasGrid = asset.cellWidth !== undefined || asset.cellHeight !== undefined || asset.columns !== undefined || asset.rows !== undefined;
  if (hasGrid) {
    const { cellWidth, cellHeight, columns, rows } = asset;
    if (![cellWidth, cellHeight, columns, rows].every(Number.isInteger)) {
      fail(`${asset.id} grid requires integer cellWidth/cellHeight/columns/rows`);
    } else {
      if (cellWidth <= 0 || cellHeight <= 0 || columns <= 0 || rows <= 0) fail(`${asset.id} grid values must be positive`);
      if (cellWidth !== manifest.worldTileSize || cellHeight !== manifest.worldTileSize) {
        fail(`${asset.id} grid cell must match worldTileSize=${manifest.worldTileSize}`);
      }
      if (columns * cellWidth !== width || rows * cellHeight !== height) {
        fail(`${asset.id} declared grid ${columns}x${rows} of ${cellWidth}x${cellHeight} does not cover ${width}x${height}`);
      }
    }
  }

  console.log(`ASSET_CONTRACT_PASS ${asset.id} ${width}x${height} ${asset.kind}`);
}

if (!process.exitCode) {
  console.log(`ASSET_CONTRACT_OK version=${manifest.contractVersion} assets=${manifest.assets.length}`);
}
