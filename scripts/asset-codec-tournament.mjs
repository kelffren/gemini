/* KELO-INDEX
 * area: BUILD / CREATOR ASSET DELIVERY
 * owner: Kelo Creator Asset Bridge
 * keys: CODEC TOURNAMENT PNG OXIPNG ZOPFLI WEBP AVIF REPORT VARIANTS
 * purpose: run the deep authoring/runtime codec tournament over real assets without modifying canonical sources
 * public-api: CLI
 * state-owned: report/variant output directory only
 * online: N/A; build/publish-time research and production candidate generator
 * do-not: overwrite source assets; promotion to runtime is a separate reviewed step
 */

import fs from 'node:fs';
import path from 'node:path';
import {optimizePngTournament} from '../src/creators/assets/png-codec-tournament.mjs';
import {buildRuntimeImageVariants} from '../src/creators/assets/runtime-image-variants.mjs';

const args = process.argv.slice(2);
const argument = (name, fallback = null) => {
  const token = args.find(value => value.startsWith(`--${name}=`));
  return token ? token.slice(name.length + 3) : fallback;
};
const has = name => args.includes(`--${name}`);

const input = path.resolve(argument('input', 'assets'));
const reportDir = path.resolve(argument('report', 'dist/asset-codec-tournament'));
const maxFiles = Math.max(1, Number(argument('max-files', '6')) || 6);
const emitVariants = has('emit-variants');

if (!fs.existsSync(input)) {
  console.error(`ASSET_CODEC_TOURNAMENT_INPUT_NOT_FOUND — ${input}`);
  process.exit(2);
}

function walk(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return /\.png$/i.test(target) ? [target] : [];
  const found = [];
  const stack = [target];
  while (stack.length && found.length < maxFiles) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      const full = path.join(dir, entry.name);
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

function rel(file) {
  return path.relative(process.cwd(), file).replaceAll('\\', '/');
}

function key(file) {
  return rel(file).replace(/[^a-z0-9._-]+/gi, '__').replace(/\.png$/i, '');
}

function human(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

fs.mkdirSync(reportDir, {recursive:true});
const variantDir = path.join(reportDir, 'variants');
if (emitVariants) fs.mkdirSync(variantDir, {recursive:true});

const results = [];
for (const file of walk(input)) {
  const source = fs.readFileSync(file);
  console.log(`TOURNAMENT ${rel(file)} (${human(source.length)})`);
  try {
    const authoring = optimizePngTournament(source, {effort:'deep'});
    const runtime = await buildRuntimeImageVariants(source, {sourceName:rel(file)});
    const runtimeWinner = runtime.report.runtimeWinner;
    const authoringSavings = source.length ? ((source.length - authoring.buffer.length) / source.length) * 100 : 0;
    const runtimeSavings = runtimeWinner?.bytes != null && source.length
      ? ((source.length - runtimeWinner.bytes) / source.length) * 100
      : 0;
    const outputs = {};

    if (emitVariants) {
      const base = key(file);
      const authoringName = `${base}--authoring.png`;
      fs.writeFileSync(path.join(variantDir, authoringName), authoring.buffer);
      outputs.authoring = `variants/${authoringName}`;
      if (runtimeWinner) {
        const runtimeBuffer = runtime.buffers[runtimeWinner.label];
        if (runtimeBuffer) {
          const runtimeName = `${base}--runtime.${runtimeWinner.format}`;
          fs.writeFileSync(path.join(variantDir, runtimeName), runtimeBuffer);
          outputs.runtime = `variants/${runtimeName}`;
        }
      }
    }

    results.push({
      file:rel(file),
      sourceBytes:source.length,
      profile:runtime.report.profile,
      authoring:{...authoring.report, savingsPercent:Number(authoringSavings.toFixed(3))},
      runtime:{...runtime.report, savingsPercent:Number(runtimeSavings.toFixed(3))},
      outputs
    });
  } catch (error) {
    results.push({file:rel(file), sourceBytes:source.length, error:String(error?.message || error)});
    console.warn(`TOURNAMENT_SKIP ${rel(file)} — ${String(error?.message || error)}`);
  }
}

const totals = results.reduce((state, item) => {
  state.source += item.sourceBytes || 0;
  state.authoring += item.authoring?.optimizedBytes ?? item.sourceBytes ?? 0;
  state.runtime += item.runtime?.runtimeWinner?.bytes ?? item.sourceBytes ?? 0;
  return state;
}, {source:0, authoring:0, runtime:0});

const report = {
  version:'kelo-asset-codec-tournament-v1',
  generatedAt:new Date().toISOString(),
  input:rel(input),
  fileCount:results.length,
  totals:{
    ...totals,
    authoringSavedPercent:totals.source ? Number((((totals.source - totals.authoring) / totals.source) * 100).toFixed(3)) : 0,
    runtimeSavedPercent:totals.source ? Number((((totals.source - totals.runtime) / totals.source) * 100).toFixed(3)) : 0
  },
  files:results
};

fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2));
const rows = results.map(item => {
  if (item.error) return `<tr><td>${item.file}</td><td colspan="5">${item.error}</td></tr>`;
  return `<tr><td>${item.file}</td><td>${item.profile.kind}</td><td>${human(item.sourceBytes)}</td><td>${human(item.authoring.optimizedBytes)} (${item.authoring.savingsPercent.toFixed(2)}%)</td><td>${item.runtime.runtimeWinner?.label || '—'}</td><td>${item.runtime.runtimeWinner ? `${human(item.runtime.runtimeWinner.bytes)} (${item.runtime.savingsPercent.toFixed(2)}%)` : '—'}</td></tr>`;
}).join('\n');
const html = `<!doctype html><meta charset="utf-8"><title>Kelo Codec Tournament</title><style>body{font:14px system-ui;background:#0f1115;color:#f5f7fb;padding:24px}table{border-collapse:collapse;width:100%}th,td{padding:10px;border-bottom:1px solid #303744;text-align:left}code{color:#9fd}</style><h1>Kelo Asset Codec Tournament</h1><p>Canonical source stays untouched. Authoring track = verified PNG. Runtime track = smallest quality-approved delivery candidate.</p><p>Total ${human(totals.source)} → authoring ${human(totals.authoring)} (${report.totals.authoringSavedPercent.toFixed(2)}%) → runtime ${human(totals.runtime)} (${report.totals.runtimeSavedPercent.toFixed(2)}%).</p><table><thead><tr><th>Asset</th><th>Profile</th><th>Source</th><th>PNG winner</th><th>Runtime winner</th><th>Runtime bytes</th></tr></thead><tbody>${rows}</tbody></table>`;
fs.writeFileSync(path.join(reportDir, 'index.html'), html);
console.log(`ASSET_CODEC_TOURNAMENT_DONE files=${report.fileCount} authoring=-${report.totals.authoringSavedPercent}% runtime=-${report.totals.runtimeSavedPercent}%`);
