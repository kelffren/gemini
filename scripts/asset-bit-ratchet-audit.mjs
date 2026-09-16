/* KELO-INDEX
 * area: BUILD / CREATOR ASSET QA
 * owner: Kelo Creator Asset Bridge
 * keys: ASSET BIT RATCHET AUDIT LOSSLESS RGBA REGRESSION
 * purpose: deterministic self-test for the monotonic byte ratchet
 * public-api: CLI audit
 * state-owned: none
 * online: N/A
 */

import { compareAssetBitSnapshots } from '../src/creators/assets/asset-bit-ratchet.mjs';

function report(files, extra = {}) {
  const normalized = files.map(item => ({
    renderSha256: item.renderSha256 || item.rgbaSha256,
    ...item
  }));
  return {
    totals: {
      storedBytes: normalized.reduce((sum, item) => sum + item.storedBytes, 0),
      decodedRgbaBytes: normalized.reduce((sum, item) => sum + (item.decodedRgbaBytes || 400), 0)
    },
    duplicates: { rgbaExact: [], renderExact: [] },
    files: normalized,
    ...extra
  };
}

const base = report([
  { file: 'assets/a.png', storedBytes: 1000, rgbaSha256: 'rgba-a' },
  { file: 'assets/b.png', storedBytes: 500, rgbaSha256: 'rgba-b' },
  { file: 'assets/c.png', storedBytes: 800, rgbaSha256: 'rgba-c' }
]);

const lighter = report([
  { file: 'assets/a.png', storedBytes: 900, rgbaSha256: 'rgba-a' },
  { file: 'assets/b.png', storedBytes: 500, rgbaSha256: 'rgba-b' },
  { file: 'assets/c.png', storedBytes: 1200, rgbaSha256: 'rgba-c2' },
  { file: 'assets/new.png', storedBytes: 200, rgbaSha256: 'rgba-new' }
]);

const pass = compareAssetBitSnapshots(base, lighter);
if (!pass.pass) throw new Error('ASSET_BIT_RATCHET_EXPECTED_PASS');
if (pass.summary.improvedFiles !== 1) throw new Error('ASSET_BIT_RATCHET_IMPROVEMENT_COUNT');
if (pass.summary.informationChangedFiles !== 1) throw new Error('ASSET_BIT_RATCHET_INFORMATION_CHANGED_COUNT');
if (pass.summary.addedFiles !== 1) throw new Error('ASSET_BIT_RATCHET_ADDED_COUNT');

const heavierSameInformation = report([
  { file: 'assets/a.png', storedBytes: 1001, rgbaSha256: 'rgba-a' },
  { file: 'assets/b.png', storedBytes: 500, rgbaSha256: 'rgba-b' },
  { file: 'assets/c.png', storedBytes: 800, rgbaSha256: 'rgba-c' }
]);

const fail = compareAssetBitSnapshots(base, heavierSameInformation);
if (fail.pass) throw new Error('ASSET_BIT_RATCHET_EXPECTED_FAIL');
if (fail.regressions.length !== 1 || fail.regressions[0].file !== 'assets/a.png') throw new Error('ASSET_BIT_RATCHET_REGRESSION_DETAIL');

const tolerated = compareAssetBitSnapshots(base, heavierSameInformation, { toleranceBytes: 1 });
if (!tolerated.pass) throw new Error('ASSET_BIT_RATCHET_TOLERANCE');

console.log('ASSET_BIT_RATCHET_AUDIT PASS');
