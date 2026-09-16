/* KELO-INDEX
 * area: BUILD / CREATOR ASSET QA
 * owner: Kelo Creator Asset Bridge
 * keys: ASSET BIT RATCHET CLI BASE HEAD REPORT CI LOSSLESS
 * purpose: enforce monotonic stored-byte improvement for unchanged decoded RGBA information
 * public-api: CLI only
 * state-owned: report file only
 * online: N/A; build/publish-time QA
 */

import fs from 'node:fs';
import path from 'node:path';
import { compareAssetBitSnapshots } from '../src/creators/assets/asset-bit-ratchet.mjs';

const args = process.argv.slice(2);
const argument = (name, fallback = null) => {
  const prefix = `--${name}=`;
  const token = args.find(value => value.startsWith(prefix));
  return token ? token.slice(prefix.length) : fallback;
};

const basePath = path.resolve(argument('base', 'test-results/asset-space-budget-base/report.json'));
const headPath = path.resolve(argument('head', 'test-results/asset-space-budget-head/report.json'));
const reportPath = path.resolve(argument('report', 'test-results/asset-bit-ratchet/report.json'));
const toleranceBytes = Math.max(0, Number(argument('tolerance-bytes', '0')) || 0);

function readJson(file, label) {
  if (!fs.existsSync(file)) {
    console.error(`ASSET_BIT_RATCHET_${label}_NOT_FOUND — ${file}`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const baseReport = readJson(basePath, 'BASE');
const headReport = readJson(headPath, 'HEAD');
const result = compareAssetBitSnapshots(baseReport, headReport, { toleranceBytes });

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify({
  ...result,
  generatedAt: new Date().toISOString(),
  baseReport: path.relative(process.cwd(), basePath).replaceAll('\\', '/'),
  headReport: path.relative(process.cwd(), headPath).replaceAll('\\', '/')
}, null, 2));

const s = result.summary;
console.log(`ASSET_BIT_RATCHET ${result.pass ? 'PASS' : 'FAIL'} comparable=${s.comparableFiles} improved=${s.improvedFiles} regressed=${s.regressedFiles} saved=${s.comparableSavedBytes}B`);
console.log(`ASSET_BIT_RATCHET_TOTAL stored_delta=${s.totalStoredDeltaBytes}B decoded_rgba_delta=${s.decodedRgbaDeltaBytes}B rgba_duplicate_potential=${s.rgbaDuplicatePotentialAfter}B`);

for (const item of result.regressions.slice(0, 20)) {
  console.error(`REGRESSION ${item.file}: ${item.beforeBytes} -> ${item.afterBytes} (+${item.deltaBytes}B) with identical RGBA hash`);
}

if (!result.pass) process.exitCode = 3;
