/* KELO-INDEX
 * area: QA / CREATOR ASSET INGEST
 * owner: Kelo Creator Asset Bridge
 * keys: PNG SPACE COMPILER AUDIT LOSSLESS PALETTE QUALITY GATE
 * purpose: prove PNG space optimization reduces a representative pixel-art fixture without changing any decoded RGBA pixel
 * online: N/A; deterministic build-time audit
 */

import assert from 'node:assert/strict';
import {decodePngRgba, encodeRgbaPng, optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';
import {evaluatePixelFidelity, judgePixelFidelity} from '../src/creators/assets/png-quality-agent.mjs';

const width = 128;
const height = 128;
const rgba = Buffer.alloc(width * height * 4);
const colors = [
  [0, 0, 0, 0],
  [24, 40, 72, 255],
  [212, 172, 72, 255],
  [232, 236, 244, 255],
  [160, 54, 62, 255]
];

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const color = colors[((x >> 4) + (y >> 4)) % colors.length];
    const offset = (y * width + x) * 4;
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = color[3];
  }
}

const original = encodeRgbaPng(rgba, width, height, {level:1, filterStrategy:0});
const optimized = optimizePngLossless(original);
const decoded = decodePngRgba(optimized.buffer);
const metrics = evaluatePixelFidelity(rgba, decoded.rgba, width, height);
const verdict = judgePixelFidelity(metrics, 'strict');

assert.equal(verdict.pass, true, 'strict visual gate');
assert.equal(metrics.changedPixels, 0, 'zero changed pixels');
assert.equal(metrics.alphaChangedPixels, 0, 'zero alpha changes');
assert.ok(optimized.buffer.length < original.length, 'optimized fixture is smaller');
assert.equal(optimized.report.winner.kind, 'exact-palette', 'exact palette candidate wins for low-color pixel art');

console.log(JSON.stringify({
  status:'PNG_SPACE_COMPILER_AUDIT_OK',
  beforeBytes:original.length,
  afterBytes:optimized.buffer.length,
  savedPercent:optimized.report.savedPercent,
  qualityScore:verdict.score,
  changedPixels:metrics.changedPixels,
  winner:optimized.report.winner
}));
