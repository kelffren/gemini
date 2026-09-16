/* KELO-INDEX
 * area: BUILD / CREATOR ASSET BUDGET
 * owner: Kelo Creator Asset Bridge
 * keys: ASSET BUDGET TRANSFER DECODE RGBA TRANSPARENT TRIM DUPLICATE BYTE PIXEL RENDER HASH DISPLAY-ROOT
 * purpose: find space problems compression alone cannot solve: decoded memory, transparent canvas waste and duplicate assets at byte/pixel/render levels
 * public-api: CLI report; --display-root normalizes comparable paths across detached worktrees
 * state-owned: report files only
 * online: N/A; build-time observability
 * do-not: trim, delete, alias or rewrite assets automatically
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {decodePngRgba} from '../src/creators/assets/png-space-optimizer.mjs';
import {profileAssetImage} from '../src/creators/assets/asset-image-profiler.mjs';

const args = process.argv.slice(2);
const argument = (name, fallback = null) => {
  const token = args.find(value => value.startsWith(`--${name}=`));
  return token ? token.slice(name.length + 3) : fallback;
};
const input = path.resolve(argument('input', 'assets'));
const reportDir = path.resolve(argument('report', 'dist/asset-space-budget'));
const displayRoot = path.resolve(argument('display-root', process.cwd()));
const maxFiles = Math.max(1, Number(argument('max-files', '10000')) || 10000);
const alphaThreshold = Math.max(0, Math.min(255, Number(argument('alpha-threshold', '0')) || 0));

if (!fs.existsSync(input)) {
  console.error(`ASSET_SPACE_BUDGET_INPUT_NOT_FOUND — ${input}`);
  process.exit(2);
}

function walk(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return /\.png$/i.test(target) ? [target] : [];
  const out = [], stack = [target];
  while (stack.length && out.length < maxFiles) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules','.git','dist','test-results'].includes(entry.name)) stack.push(full);
      } else if (entry.isFile() && /\.png$/i.test(entry.name)) {
        out.push(full);
        if (out.length >= maxFiles) break;
      }
    }
  }
  return out.sort();
}

const rel = file => path.relative(displayRoot, file).replaceAll('\\','/');
const human = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1024**2 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1024**2).toFixed(2)} MB`;
const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

function renderSha256(rgba) {
  // Canonical display hash: fully transparent pixels contribute 0,0,0,0.
  // Visible/semitransparent pixels remain byte-exact. This detects duplicate
  // DELIVERY appearance without declaring hidden RGB equivalent for SOURCE.
  const hash = crypto.createHash('sha256');
  const chunk = Buffer.allocUnsafe(Math.min(256 * 1024, Math.max(4, rgba.length)));
  let write = 0;
  for (let offset = 0; offset < rgba.length; offset += 4) {
    const alpha = rgba[offset + 3];
    if (alpha === 0) {
      chunk[write++] = 0; chunk[write++] = 0; chunk[write++] = 0; chunk[write++] = 0;
    } else {
      chunk[write++] = rgba[offset]; chunk[write++] = rgba[offset + 1]; chunk[write++] = rgba[offset + 2]; chunk[write++] = alpha;
    }
    if (write >= chunk.length - 3) {
      hash.update(chunk.subarray(0, write));
      write = 0;
    }
  }
  if (write) hash.update(chunk.subarray(0, write));
  return hash.digest('hex');
}

function contentBounds(rgba, width, height, threshold) {
  let minX=width, minY=height, maxX=-1, maxY=-1, visible=0;
  for (let y=0; y<height; y+=1) {
    for (let x=0; x<width; x+=1) {
      const a = rgba[(y*width+x)*4+3];
      if (a <= threshold) continue;
      visible += 1;
      if (x<minX) minX=x; if (y<minY) minY=y; if (x>maxX) maxX=x; if (y>maxY) maxY=y;
    }
  }
  if (maxX < minX || maxY < minY) return {x:0,y:0,w:0,h:0,visiblePixels:0};
  return {x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,visiblePixels:visible};
}

function addHash(map, hash, record) {
  if (!map.has(hash)) map.set(hash, []);
  map.get(hash).push(record);
}

function duplicateGroupsFrom(map, kind) {
  return [...map.entries()]
    .filter(([,records]) => records.length > 1)
    .map(([hash,records]) => {
      const sorted = records.slice().sort((a,b) => a.storedBytes - b.storedBytes || a.file.localeCompare(b.file));
      const totalBytes = sorted.reduce((sum,item) => sum + item.storedBytes, 0);
      const canonicalBytes = sorted[0].storedBytes;
      return {
        kind,
        sha256:hash,
        count:sorted.length,
        canonical:sorted[0].file,
        files:sorted.map(item => item.file),
        totalBytes,
        canonicalBytes,
        potentialStoredSavingBytes:Math.max(0,totalBytes-canonicalBytes)
      };
    })
    .sort((a,b) => b.potentialStoredSavingBytes - a.potentialStoredSavingBytes || b.count-a.count);
}

const files = [];
const byteHashes = new Map();
const rgbaHashes = new Map();
const renderHashes = new Map();
let transferBytes=0, decodedRgbaBytes=0, potentialTrimRgbaBytes=0;

for (const file of walk(input)) {
  const buffer = fs.readFileSync(file);
  const fileName = rel(file);
  transferBytes += buffer.length;
  const byteHash = sha256(buffer);
  addHash(byteHashes, byteHash, {file:fileName,storedBytes:buffer.length});
  try {
    const decoded = decodePngRgba(buffer);
    const pixelHash = sha256(decoded.rgba);
    const renderHash = renderSha256(decoded.rgba);
    addHash(rgbaHashes, pixelHash, {file:fileName,storedBytes:buffer.length});
    addHash(renderHashes, renderHash, {file:fileName,storedBytes:buffer.length});

    const {width,height} = decoded.ihdr;
    const rgbaBytes = width*height*4;
    decodedRgbaBytes += rgbaBytes;
    const bounds = contentBounds(decoded.rgba,width,height,alphaThreshold);
    const trimPixels = bounds.w*bounds.h;
    const trimRgbaBytes = trimPixels*4;
    potentialTrimRgbaBytes += trimRgbaBytes;
    const canvasPixels = Math.max(1,width*height);
    const transparentPixels = canvasPixels-bounds.visiblePixels;
    const trimWasteRatio = 1-(trimPixels/canvasPixels);
    const profile = profileAssetImage(decoded.rgba,width,height,{sourceName:fileName});
    const flags=[];
    if (trimWasteRatio >= 0.5 && !profile.invariants.preserveBorder) flags.push('high-transparent-border-waste');
    if (rgbaBytes >= 8*1024*1024) flags.push('high-decoded-memory');
    if (buffer.length >= 2*1024*1024) flags.push('high-transfer-bytes');
    if (profile.invariants.preserveBorder) flags.push('do-not-trim-seam-critical');
    files.push({
      file:fileName,sha256:byteHash,rgbaSha256:pixelHash,renderSha256:renderHash,
      storedBytes:buffer.length,width,height,decodedRgbaBytes:rgbaBytes,
      storedToDecodedRatio:Number((buffer.length/Math.max(1,rgbaBytes)).toFixed(6)),
      transparentRatio:Number((transparentPixels/canvasPixels).toFixed(6)),
      contentBounds:bounds,
      trimWasteRatio:Number(trimWasteRatio.toFixed(6)),
      estimatedTrimmedRgbaBytes:trimRgbaBytes,
      profile:{kind:profile.kind,policy:profile.adaptivePolicy,invariants:profile.invariants},
      flags
    });
  } catch (error) {
    files.push({file:fileName,sha256:byteHash,storedBytes:buffer.length,error:String(error?.message||error),flags:['decode-unsupported']});
  }
}

const byteDuplicateGroups = duplicateGroupsFrom(byteHashes,'byte-exact');
const pixelDuplicateGroups = duplicateGroupsFrom(rgbaHashes,'rgba-exact');
const renderDuplicateGroups = duplicateGroupsFrom(renderHashes,'render-exact');

const successful = files.filter(item => !item.error);
const largestTransfer = successful.slice().sort((a,b)=>b.storedBytes-a.storedBytes).slice(0,20).map(item=>item.file);
const largestDecoded = successful.slice().sort((a,b)=>b.decodedRgbaBytes-a.decodedRgbaBytes).slice(0,20).map(item=>item.file);
const largestTrimWaste = successful.slice().filter(item=>!item.profile.invariants.preserveBorder).sort((a,b)=>b.trimWasteRatio-a.trimWasteRatio).slice(0,20).map(item=>item.file);

const report = {
  version:'kelo-asset-space-budget-v1.2-display-root',generatedAt:new Date().toISOString(),input:rel(input),displayRoot:path.relative(process.cwd(),displayRoot).replaceAll('\\','/')||'.',alphaThreshold,fileCount:files.length,
  totals:{
    storedBytes:transferBytes,
    decodedRgbaBytes,
    decodedExpansion:transferBytes ? Number((decodedRgbaBytes/transferBytes).toFixed(3)) : 0,
    theoreticalTrimmedRgbaBytes:potentialTrimRgbaBytes,
    theoreticalTrimRgbaSavingPercent:decodedRgbaBytes ? Number((((decodedRgbaBytes-potentialTrimRgbaBytes)/decodedRgbaBytes)*100).toFixed(3)) : 0,
    duplicateGroups:byteDuplicateGroups.length,
    byteDuplicateGroups:byteDuplicateGroups.length,
    pixelDuplicateGroups:pixelDuplicateGroups.length,
    renderDuplicateGroups:renderDuplicateGroups.length
  },
  rankings:{largestTransfer,largestDecoded,largestTrimWaste},
  duplicateGroups:byteDuplicateGroups,
  duplicates:{byteExact:byteDuplicateGroups,rgbaExact:pixelDuplicateGroups,renderExact:renderDuplicateGroups},
  files
};

fs.mkdirSync(reportDir,{recursive:true});
fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify(report,null,2));
const rows=successful.slice().sort((a,b)=>b.decodedRgbaBytes-a.decodedRgbaBytes).map(item=>`<tr><td>${item.file}</td><td>${item.profile.kind}</td><td>${human(item.storedBytes)}</td><td>${human(item.decodedRgbaBytes)}</td><td>${(item.transparentRatio*100).toFixed(1)}%</td><td>${(item.trimWasteRatio*100).toFixed(1)}%</td><td>${item.flags.join(', ')}</td></tr>`).join('\n');
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kelo Asset Space Budget</title><style>body{font:14px system-ui;background:#101216;color:#f5f7fb;padding:20px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #303744;text-align:left}strong{color:#76e3a3}@media(max-width:800px){table{font-size:11px}}</style><h1>Kelo Asset Space Budget</h1><p>Stored <strong>${human(transferBytes)}</strong> · decoded RGBA baseline <strong>${human(decodedRgbaBytes)}</strong> · expansion ${report.totals.decodedExpansion}×</p><p>Duplicate groups: byte-exact <strong>${byteDuplicateGroups.length}</strong> · RGBA-exact <strong>${pixelDuplicateGroups.length}</strong> · render-exact <strong>${renderDuplicateGroups.length}</strong>.</p><p>Render-exact ignores RGB only where alpha=0. Trim and duplicate numbers are diagnostic; this audit never crops, aliases or deletes files.</p><table><thead><tr><th>Asset</th><th>Profile</th><th>Stored</th><th>RGBA baseline</th><th>Transparent</th><th>Border trim waste</th><th>Flags</th></tr></thead><tbody>${rows}</tbody></table>`;
fs.writeFileSync(path.join(reportDir,'index.html'),html);
console.log(`ASSET_SPACE_BUDGET_DONE files=${files.length} stored=${human(transferBytes)} decoded=${human(decodedRgbaBytes)} expansion=${report.totals.decodedExpansion}x byteDup=${byteDuplicateGroups.length} rgbaDup=${pixelDuplicateGroups.length} renderDup=${renderDuplicateGroups.length}`);
