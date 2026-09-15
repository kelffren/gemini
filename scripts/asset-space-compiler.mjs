/* KELO-INDEX
 * area: BUILD / CREATOR ASSET INGEST
 * owner: Kelo Creator Asset Bridge
 * keys: PNG SPACE COMPILER CLI REPORT CAPTURE ATOMIC WRITE
 * purpose: recursively optimize PNG assets, capture before/after evidence, and emit machine-readable quality reports
 * public-api: CLI only
 * state-owned: no runtime state; filesystem writes happen only with --write
 * online: N/A; creator/build-time pipeline
 * consumes: png-space-optimizer.mjs, png-adaptive-optimizer.mjs
 * do-not: rewrite non-PNG files, mutate dimensions, or replace a file before quality approval
 */

import fs from 'node:fs';
import path from 'node:path';
import {optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';
import {optimizePngAdaptive} from '../src/creators/assets/png-adaptive-optimizer.mjs';

const args = process.argv.slice(2);

function argument(name, fallback = null) {
  const prefix = `--${name}=`;
  const token = args.find(value => value.startsWith(prefix));
  return token ? token.slice(prefix.length) : fallback;
}

function has(name) {
  return args.includes(`--${name}`);
}

const inputPath = path.resolve(argument('input', 'assets'));
const mode = argument('mode', 'strict');
const reportPath = path.resolve(argument('report', 'dist/asset-space-report'));
const write = has('write');
const capture = has('capture');
const maxFiles = Math.max(1, Number(argument('max-files', '10000')) || 10000);

if (!['strict', 'adaptive'].includes(mode)) {
  console.error('PNG_SPACE_COMPILER_INVALID_MODE — use --mode=strict or --mode=adaptive');
  process.exit(2);
}
if (!fs.existsSync(inputPath)) {
  console.error(`PNG_SPACE_COMPILER_INPUT_NOT_FOUND — ${inputPath}`);
  process.exit(2);
}

function walkPngs(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return /\.png$/i.test(target) ? [target] : [];
  const found = [];
  const stack = [target];
  while (stack.length && found.length < maxFiles) {
    const directory = stack.pop();
    for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'dist'].includes(entry.name)) stack.push(full);
      } else if (entry.isFile() && /\.png$/i.test(entry.name)) {
        found.push(full);
        if (found.length >= maxFiles) break;
      }
    }
  }
  return found.sort();
}

function safeRelative(file) {
  return path.relative(process.cwd(), file).replaceAll('\\', '/');
}

function fileKey(file) {
  return safeRelative(file).replace(/[^a-z0-9._-]+/gi, '__');
}

function humanBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

function atomicReplace(file, buffer) {
  const temporary = `${file}.kelo-png-space-${process.pid}.tmp`;
  fs.writeFileSync(temporary, buffer);
  fs.renameSync(temporary, file);
}

function htmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function writeHtmlReport(summary) {
  const rows = summary.files.map(item => {
    const captures = capture && item.capture
      ? `<div class="compare">
          <figure><figcaption>ANTES</figcaption><img src="${htmlEscape(item.capture.before)}"></figure>
          <figure><figcaption>DESPUÉS</figcaption><img src="${htmlEscape(item.capture.after)}"></figure>
        </div>`
      : '';
    const score = item.qualityScore == null ? '—' : Number(item.qualityScore).toFixed(4);
    return `<article class="${item.status}">
      <h2>${htmlEscape(item.file)}</h2>
      <div class="stats">
        <span>${humanBytes(item.beforeBytes)} → ${humanBytes(item.afterBytes)}</span>
        <strong>-${item.savedPercent.toFixed(2)}%</strong>
        <span>quality ${score}</span>
        <span>${htmlEscape(item.mode || mode)}</span>
      </div>
      ${captures}
    </article>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="es"><meta charset="utf-8">
<title>Kelo PNG Space Compiler Audit</title>
<style>
body{font:14px system-ui;background:#101216;color:#f5f7fb;margin:0;padding:24px}main{max-width:1200px;margin:auto}
header{position:sticky;top:0;background:#101216e8;backdrop-filter:blur(12px);padding:12px 0 18px;z-index:2}
article{border:1px solid #303744;border-radius:14px;padding:16px;margin:14px 0;background:#171b22}
.stats{display:flex;gap:14px;flex-wrap:wrap}.compare{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
figure{margin:0;background:#0b0d10;padding:10px;border-radius:10px;overflow:auto}img{max-width:100%;image-rendering:pixelated}
figcaption{font-weight:700;margin-bottom:8px}.optimized strong{color:#73e6a4}.skipped strong{color:#ffcb6b}
@media(max-width:700px){.compare{grid-template-columns:1fr}}
</style>
<main><header><h1>Kelo PNG Space Compiler</h1>
<p>${summary.files.length} PNG · ${humanBytes(summary.beforeBytes)} → ${humanBytes(summary.afterBytes)} · ahorro ${summary.savedPercent.toFixed(2)}%</p>
<p>Gate: strict exige igualdad RGBA exacta. Adaptive usa el Quality Agent y vuelve a strict si ningún candidato pasa.</p></header>
${rows}</main></html>`;
  fs.writeFileSync(path.join(reportPath, 'index.html'), html);
}

fs.mkdirSync(reportPath, {recursive:true});
const captureDirectory = path.join(reportPath, 'captures');
if (capture) fs.mkdirSync(captureDirectory, {recursive:true});

const files = walkPngs(inputPath);
const results = [];
let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const original = fs.readFileSync(file);
  let optimized;
  try {
    optimized = mode === 'adaptive'
      ? await optimizePngAdaptive(original)
      : optimizePngLossless(original);
  } catch (error) {
    const message = String(error?.message || error);
    results.push({
      file:safeRelative(file),
      status:'skipped',
      mode,
      beforeBytes:original.length,
      afterBytes:original.length,
      savedBytes:0,
      savedPercent:0,
      qualityScore:null,
      error:message,
      hint:error?.hint || null
    });
    totalBefore += original.length;
    totalAfter += original.length;
    console.warn(`SKIP ${safeRelative(file)} — ${message}`);
    continue;
  }

  const report = optimized.report;
  const after = optimized.buffer;
  const shouldWrite = write && after.length < original.length;
  let captureRecord = null;

  if (capture) {
    const key = fileKey(file);
    const beforeName = `${key}--before.png`;
    const afterName = `${key}--after.png`;
    fs.writeFileSync(path.join(captureDirectory, beforeName), original);
    fs.writeFileSync(path.join(captureDirectory, afterName), after);
    captureRecord = {
      before:`captures/${beforeName}`,
      after:`captures/${afterName}`
    };
  }

  if (shouldWrite) atomicReplace(file, after);

  const entry = {
    file:safeRelative(file),
    status:report.status,
    mode:report.mode || 'strict',
    wrote:shouldWrite,
    beforeBytes:original.length,
    afterBytes:after.length,
    savedBytes:Math.max(0, original.length - after.length),
    savedPercent:original.length ? ((original.length - after.length) / original.length) * 100 : 0,
    qualityScore:report.qualityScore ?? report.winner?.qualityScore ?? (report.exactPixels ? 1 : null),
    exactPixels:report.exactPixels ?? report.winner?.metrics?.exactPixels ?? null,
    winner:report.winner || null,
    capture:captureRecord,
    detail:report
  };
  results.push(entry);
  totalBefore += original.length;
  totalAfter += after.length;
  console.log(`${entry.status.toUpperCase()} ${entry.file} ${humanBytes(entry.beforeBytes)} → ${humanBytes(entry.afterBytes)} (-${entry.savedPercent.toFixed(2)}%)`);
}

const summary = {
  compiler:'kelo-png-space-compiler-v1',
  generatedAt:new Date().toISOString(),
  input:safeRelative(inputPath),
  mode,
  write,
  capture,
  fileCount:results.length,
  beforeBytes:totalBefore,
  afterBytes:totalAfter,
  savedBytes:Math.max(0, totalBefore - totalAfter),
  savedPercent:totalBefore ? ((totalBefore - totalAfter) / totalBefore) * 100 : 0,
  files:results
};

fs.writeFileSync(path.join(reportPath, 'report.json'), JSON.stringify(summary, null, 2));
writeHtmlReport(summary);
console.log(`PNG_SPACE_COMPILER_DONE files=${summary.fileCount} saved=${humanBytes(summary.savedBytes)} (${summary.savedPercent.toFixed(2)}%) write=${write} mode=${mode}`);
