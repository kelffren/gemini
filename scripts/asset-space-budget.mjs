/* KELO-INDEX
 * area: BUILD / CREATOR ASSET BUDGET
 * owner: Kelo Creator Asset Bridge
 * keys: ASSET BUDGET TRANSFER DECODE RGBA TRANSPARENT TRIM DUPLICATE HASH
 * purpose: find space problems compression alone cannot solve: decoded memory, transparent canvas waste and exact duplicate assets
 * public-api: CLI report
 * state-owned: report files only
 * online: N/A; build-time observability
 * do-not: trim, delete or rewrite assets automatically
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

const rel = file => path.relative(process.cwd(), file).replaceAll('\\','/');
const human = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1024**2 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1024**2).toFixed(2)} MB`;

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

const files = [];
const hashes = new Map();
let transferBytes=0, decodedRgbaBytes=0, potentialTrimRgbaBytes=0;

for (const file of walk(input)) {
  const buffer = fs.readFileSync(file);
  transferBytes += buffer.length;
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (!hashes.has(hash)) hashes.set(hash, []);
  hashes.get(hash).push(rel(file));
  try {
    const decoded = decodePngRgba(buffer);
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
    const profile = profileAssetImage(decoded.rgba,width,height,{sourceName:rel(file)});
    const flags=[];
    if (trimWasteRatio >= 0.5 && !profile.invariants.preserveBorder) flags.push('high-transparent-border-waste');
    if (rgbaBytes >= 8*1024*1024) flags.push('high-decoded-memory');
    if (buffer.length >= 2*1024*1024) flags.push('high-transfer-bytes');
    if (profile.invariants.preserveBorder) flags.push('do-not-trim-seam-critical');
    files.push({
      file:rel(file),sha256:hash,storedBytes:buffer.length,width,height,decodedRgbaBytes:rgbaBytes,
      storedToDecodedRatio:Number((buffer.length/Math.max(1,rgbaBytes)).toFixed(6)),
      transparentRatio:Number((transparentPixels/canvasPixels).toFixed(6)),
      contentBounds:bounds,
      trimWasteRatio:Number(trimWasteRatio.toFixed(6)),
      estimatedTrimmedRgbaBytes:trimRgbaBytes,
      profile:{kind:profile.kind,policy:profile.adaptivePolicy,invariants:profile.invariants},
      flags
    });
  } catch (error) {
    files.push({file:rel(file),sha256:hash,storedBytes:buffer.length,error:String(error?.message||error),flags:['decode-unsupported']});
  }
}

const duplicateGroups = [...hashes.entries()]
  .filter(([,paths]) => paths.length>1)
  .map(([sha256,paths]) => ({sha256,count:paths.length,files:paths}));

const successful = files.filter(item => !item.error);
const largestTransfer = successful.slice().sort((a,b)=>b.storedBytes-a.storedBytes).slice(0,20).map(item=>item.file);
const largestDecoded = successful.slice().sort((a,b)=>b.decodedRgbaBytes-a.decodedRgbaBytes).slice(0,20).map(item=>item.file);
const largestTrimWaste = successful.slice().filter(item=>!item.profile.invariants.preserveBorder).sort((a,b)=>b.trimWasteRatio-a.trimWasteRatio).slice(0,20).map(item=>item.file);

const report = {
  version:'kelo-asset-space-budget-v1',generatedAt:new Date().toISOString(),input:rel(input),alphaThreshold,fileCount:files.length,
  totals:{
    storedBytes:transferBytes,
    decodedRgbaBytes,
    decodedExpansion:transferBytes ? Number((decodedRgbaBytes/transferBytes).toFixed(3)) : 0,
    theoreticalTrimmedRgbaBytes:potentialTrimRgbaBytes,
    theoreticalTrimRgbaSavingPercent:decodedRgbaBytes ? Number((((decodedRgbaBytes-potentialTrimRgbaBytes)/decodedRgbaBytes)*100).toFixed(3)) : 0,
    duplicateGroups:duplicateGroups.length
  },
  rankings:{largestTransfer,largestDecoded,largestTrimWaste},duplicateGroups,files
};

fs.mkdirSync(reportDir,{recursive:true});
fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify(report,null,2));
const rows=successful.slice().sort((a,b)=>b.decodedRgbaBytes-a.decodedRgbaBytes).map(item=>`<tr><td>${item.file}</td><td>${item.profile.kind}</td><td>${human(item.storedBytes)}</td><td>${human(item.decodedRgbaBytes)}</td><td>${(item.transparentRatio*100).toFixed(1)}%</td><td>${(item.trimWasteRatio*100).toFixed(1)}%</td><td>${item.flags.join(', ')}</td></tr>`).join('\n');
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kelo Asset Space Budget</title><style>body{font:14px system-ui;background:#101216;color:#f5f7fb;padding:20px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #303744;text-align:left}strong{color:#76e3a3}@media(max-width:800px){table{font-size:11px}}</style><h1>Kelo Asset Space Budget</h1><p>Stored <strong>${human(transferBytes)}</strong> · decoded RGBA baseline <strong>${human(decodedRgbaBytes)}</strong> · expansion ${report.totals.decodedExpansion}× · exact duplicate groups ${duplicateGroups.length}</p><p>Trim numbers are diagnostic only. No file is cropped or deleted by this audit.</p><table><thead><tr><th>Asset</th><th>Profile</th><th>Stored</th><th>RGBA baseline</th><th>Transparent</th><th>Border trim waste</th><th>Flags</th></tr></thead><tbody>${rows}</tbody></table>`;
fs.writeFileSync(path.join(reportDir,'index.html'),html);
console.log(`ASSET_SPACE_BUDGET_DONE files=${files.length} stored=${human(transferBytes)} decoded=${human(decodedRgbaBytes)} expansion=${report.totals.decodedExpansion}x duplicates=${duplicateGroups.length}`);
