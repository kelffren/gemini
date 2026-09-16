/* KELO-INDEX
 * area: BUILD / CREATOR ASSET INGEST
 * owner: Kelo Creator Asset Bridge
 * keys: PNG SPACE COMPILER CLI REPORT CAPTURE DIFF PROFILE QUALITY PERCEPTUAL FAST DEEP ATOMIC WRITE
 * purpose: recursively optimize PNG assets with fast-ingest/deep-publish effort, capture evidence and emit quality reports
 * public-api: CLI only
 * state-owned: no runtime state; filesystem writes happen only with --write
 * online: N/A; creator/build-time pipeline
 * consumes: png-space-optimizer.mjs, png-adaptive-optimizer.mjs, asset-image-profiler.mjs, perceptual-quality-bridge.mjs
 * do-not: rewrite non-PNG files, mutate dimensions, or replace a file before quality approval
 */

import fs from 'node:fs';
import path from 'node:path';
import {decodePngRgba, encodeRgbaPng, optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';
import {optimizePngAdaptive} from '../src/creators/assets/png-adaptive-optimizer.mjs';
import {profileAssetImage} from '../src/creators/assets/asset-image-profiler.mjs';
import {inspectPerceptualQuality} from '../src/creators/assets/perceptual-quality-bridge.mjs';

const args = process.argv.slice(2);
const argument = (name, fallback = null) => {
  const prefix = `--${name}=`;
  const token = args.find(value => value.startsWith(prefix));
  return token ? token.slice(prefix.length) : fallback;
};
const has = name => args.includes(`--${name}`);

const inputPath = path.resolve(argument('input', 'assets'));
const mode = argument('mode', 'strict');
const reportPath = path.resolve(argument('report', 'dist/asset-space-report'));
const write = has('write');
const capture = has('capture');
const perceptual = has('perceptual');
const effort = argument('effort', write ? 'deep' : 'fast');
const maxFiles = Math.max(1, Number(argument('max-files', '10000')) || 10000);

if (!['strict', 'adaptive'].includes(mode)) {
  console.error('PNG_SPACE_COMPILER_INVALID_MODE — use --mode=strict or --mode=adaptive');
  process.exit(2);
}
if (!['fast', 'balanced', 'deep'].includes(effort)) {
  console.error('PNG_SPACE_COMPILER_INVALID_EFFORT — use --effort=fast, balanced or deep');
  process.exit(2);
}
if (!fs.existsSync(inputPath)) {
  console.error(`PNG_SPACE_COMPILER_INPUT_NOT_FOUND — ${inputPath}`);
  process.exit(2);
}

function walkPngs(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return /\.png$/i.test(target) ? [target] : [];
  const found = [], stack = [target];
  while (stack.length && found.length < maxFiles) {
    const directory = stack.pop();
    for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'test-results'].includes(entry.name)) stack.push(full);
      } else if (entry.isFile() && /\.png$/i.test(entry.name)) {
        found.push(full);
        if (found.length >= maxFiles) break;
      }
    }
  }
  return found.sort();
}

const safeRelative = file => path.relative(process.cwd(), file).replaceAll('\\', '/');
const fileKey = file => safeRelative(file).replace(/[^a-z0-9._-]+/gi, '__');
const humanBytes = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(2)} MB`;

function losslessOptionsFor(profile) {
  if (effort === 'deep') return {};
  if (effort === 'balanced') return {filterStrategies:['adaptive', 0, 4]};
  return {
    filterStrategies:['adaptive'],
    disablePalette:(profile?.metrics?.uniqueColors || 4097) > 64
  };
}

function atomicReplace(file, buffer) {
  const temporary = `${file}.kelo-png-space-${process.pid}.tmp`;
  fs.writeFileSync(temporary, buffer);
  fs.renameSync(temporary, file);
}

function htmlEscape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function makeDiffPng(beforeBuffer, afterBuffer) {
  const before = decodePngRgba(beforeBuffer), after = decodePngRgba(afterBuffer);
  if (before.ihdr.width !== after.ihdr.width || before.ihdr.height !== after.ihdr.height) throw new Error('PNG_SPACE_DIFF_DIMENSION_CHANGE');
  const rgba = Buffer.alloc(before.rgba.length);
  let changedPixels = 0, maxDelta = 0;
  for (let pixel = 0; pixel < before.ihdr.width * before.ihdr.height; pixel += 1) {
    const offset = pixel * 4;
    let delta = 0;
    for (let channel = 0; channel < 4; channel += 1) delta = Math.max(delta, Math.abs(before.rgba[offset + channel] - after.rgba[offset + channel]));
    if (!delta) continue;
    changedPixels += 1; maxDelta = Math.max(maxDelta, delta);
    rgba[offset] = 255; rgba[offset + 1] = delta > 24 ? 44 : 170; rgba[offset + 2] = 35; rgba[offset + 3] = Math.max(64, Math.min(255, 48 + delta * 8));
  }
  return {buffer:encodeRgbaPng(rgba, before.ihdr.width, before.ihdr.height, {level:9, filterStrategy:'adaptive'}), changedPixels, maxDelta};
}

function writeHtmlReport(summary) {
  const rows = summary.files.map(item => {
    const captures = capture && item.capture ? `<div class="compare">
      <figure><figcaption>ANTES</figcaption><img src="${htmlEscape(item.capture.before)}"></figure>
      <figure><figcaption>DESPUÉS</figcaption><img src="${htmlEscape(item.capture.after)}"></figure>
      ${item.capture.diff ? `<figure><figcaption>DIFERENCIA ×8</figcaption><img class="diff" src="${htmlEscape(item.capture.diff)}"><small>${item.capture.changedPixels} píxeles · delta máx. ${item.capture.maxDelta}</small></figure>` : ''}</div>` : '';
    const score = item.qualityScore == null ? '—' : Number(item.qualityScore).toFixed(4);
    const profile = item.profile ? `${item.profile.kind} · ${item.profile.adaptivePolicy}` : 'perfil no disponible';
    const exact = item.exactPixels === true ? 'PIXEL EXACT' : item.exactPixels === false ? 'CAMBIOS APROBADOS' : 'N/A';
    const perceptualLine = item.perceptual?.interpretations?.length ? `<p class="perceptual">Perceptual advisory: ${htmlEscape(item.perceptual.interpretations.join(' · '))}</p>` : '';
    return `<article class="${item.status}"><h2>${htmlEscape(item.file)}</h2><div class="stats">
      <span>${humanBytes(item.beforeBytes)} → ${humanBytes(item.afterBytes)}</span><strong>-${item.savedPercent.toFixed(2)}%</strong>
      <span>quality ${score}</span><span>${htmlEscape(item.mode || mode)}</span><span>${htmlEscape(exact)}</span></div>
      <p class="profile">${htmlEscape(profile)} · effort ${htmlEscape(effort)}${item.profile?.invariants?.preserveBorder ? ' · BORDER LOCK' : ''}${item.profile?.invariants?.preserveAlpha ? ' · ALPHA LOCK' : ''}</p>${perceptualLine}${captures}</article>`;
  }).join('\n');
  const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kelo PNG Space Compiler Audit</title><style>
body{font:14px system-ui;background:#101216;color:#f5f7fb;margin:0;padding:24px}main{max-width:1400px;margin:auto}header{position:sticky;top:0;background:#101216e8;backdrop-filter:blur(12px);padding:12px 0 18px;z-index:2}article{border:1px solid #303744;border-radius:14px;padding:16px;margin:14px 0;background:#171b22}.stats{display:flex;gap:14px;flex-wrap:wrap}.profile,.perceptual{color:#aeb9ca}.compare{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:14px}figure{margin:0;background:#0b0d10;padding:10px;border-radius:10px;overflow:auto}img{max-width:100%;image-rendering:pixelated}.diff{background:repeating-conic-gradient(#1b1d22 0 25%,#262930 0 50%) 0/18px 18px}figcaption{font-weight:700;margin-bottom:8px}.optimized strong{color:#73e6a4}.skipped strong{color:#ffcb6b}small{display:block;color:#98a4b5;margin-top:6px}@media(max-width:800px){.compare{grid-template-columns:1fr}body{padding:12px}}</style><main><header><h1>Kelo PNG Space Compiler</h1><p>${summary.files.length} PNG · ${humanBytes(summary.beforeBytes)} → ${humanBytes(summary.afterBytes)} · ahorro ${summary.savedPercent.toFixed(2)}% · effort ${htmlEscape(summary.effort)}</p><p>STRICT = RGBA exacto. ADAPTIVE = perfil automático + Quality Agent. DIFERENCIA vacía = ningún píxel cambió.</p></header>${rows}</main></html>`;
  fs.writeFileSync(path.join(reportPath, 'index.html'), html);
}

fs.mkdirSync(reportPath, {recursive:true});
const captureDirectory = path.join(reportPath, 'captures');
if (capture) fs.mkdirSync(captureDirectory, {recursive:true});

const files = walkPngs(inputPath), results = [];
let totalBefore = 0, totalAfter = 0;
for (const file of files) {
  const original = fs.readFileSync(file), relative = safeRelative(file);
  let optimized, profile = null;
  try {
    const decoded = decodePngRgba(original);
    profile = profileAssetImage(decoded.rgba, decoded.ihdr.width, decoded.ihdr.height, {sourceName:relative});
    const losslessOptions = losslessOptionsFor(profile);
    optimized = mode === 'adaptive'
      ? await optimizePngAdaptive(original, {sourceName:relative, assetProfile:profile, losslessOptions})
      : optimizePngLossless(original, losslessOptions);
  } catch (error) {
    const message = String(error?.message || error);
    results.push({file:relative,status:'skipped',mode,effort,beforeBytes:original.length,afterBytes:original.length,savedBytes:0,savedPercent:0,qualityScore:null,profile,error:message,hint:error?.hint || null});
    totalBefore += original.length; totalAfter += original.length; console.warn(`SKIP ${relative} — ${message}`); continue;
  }

  const report = optimized.report, after = optimized.buffer;
  const shouldWrite = write && after.length < original.length;
  let captureRecord = null, perceptualReport = null;
  if (capture) {
    const key=fileKey(file), beforeName=`${key}--before.png`, afterName=`${key}--after.png`;
    const beforePath=path.join(captureDirectory,beforeName), afterPath=path.join(captureDirectory,afterName);
    fs.writeFileSync(beforePath,original); fs.writeFileSync(afterPath,after);
    captureRecord={before:`captures/${beforeName}`,after:`captures/${afterName}`};
    try {
      const diff=makeDiffPng(original,after), diffName=`${key}--diff.png`;
      fs.writeFileSync(path.join(captureDirectory,diffName),diff.buffer);
      Object.assign(captureRecord,{diff:`captures/${diffName}`,changedPixels:diff.changedPixels,maxDelta:diff.maxDelta});
    } catch (error) { captureRecord.diffError=String(error?.message||error); }
    if (perceptual) perceptualReport=inspectPerceptualQuality(beforePath,afterPath);
  }
  if (shouldWrite) atomicReplace(file,after);

  const entry={file:relative,status:report.status,mode:report.mode||'strict',effort,wrote:shouldWrite,beforeBytes:original.length,afterBytes:after.length,
    savedBytes:Math.max(0,original.length-after.length),savedPercent:original.length?((original.length-after.length)/original.length)*100:0,
    qualityScore:report.qualityScore??report.winner?.qualityScore??(report.exactPixels?1:null),exactPixels:report.exactPixels??report.winner?.metrics?.exactPixels??null,
    profile:report.assetProfile||profile,winner:report.winner||null,capture:captureRecord,perceptual:perceptualReport,detail:report};
  results.push(entry); totalBefore+=original.length; totalAfter+=after.length;
  console.log(`${entry.status.toUpperCase()} ${entry.file} ${humanBytes(entry.beforeBytes)} → ${humanBytes(entry.afterBytes)} (-${entry.savedPercent.toFixed(2)}%) ${entry.profile?.kind||''} effort=${effort}`);
}

const summary={compiler:'kelo-png-space-compiler-v1.3',generatedAt:new Date().toISOString(),input:safeRelative(inputPath),mode,effort,write,capture,perceptual,
  fileCount:results.length,beforeBytes:totalBefore,afterBytes:totalAfter,savedBytes:Math.max(0,totalBefore-totalAfter),savedPercent:totalBefore?((totalBefore-totalAfter)/totalBefore)*100:0,files:results};
fs.writeFileSync(path.join(reportPath,'report.json'),JSON.stringify(summary,null,2));
writeHtmlReport(summary);
console.log(`PNG_SPACE_COMPILER_DONE files=${summary.fileCount} saved=${humanBytes(summary.savedBytes)} (${summary.savedPercent.toFixed(2)}%) write=${write} mode=${mode} effort=${effort}`);
