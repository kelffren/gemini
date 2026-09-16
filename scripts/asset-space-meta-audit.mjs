/* KELO-INDEX
 * area: BUILD / CREATOR ASSET INGEST
 * owner: Kelo Creator Asset Bridge
 * keys: ASSET SPACE META AUDIT PROFILE SEAM QUALITY TOURNAMENT PATH TOKENS
 * purpose: prove asset classification, path-token safety, seam hard-gates and verified codec tournament behavior without optional native codecs
 * public-api: CLI audit
 * state-owned: none
 * online: N/A
 */

import {encodeRgbaPng} from '../src/creators/assets/png-space-optimizer.mjs';
import {profileAssetImage} from '../src/creators/assets/asset-image-profiler.mjs';
import {evaluatePixelFidelity, judgePixelFidelity} from '../src/creators/assets/png-quality-agent.mjs';
import {optimizePngTournament} from '../src/creators/assets/png-codec-tournament.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(`ASSET_SPACE_META_AUDIT_FAILED:${message}`);
}

function fixture(width = 32, height = 32) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const checker = ((x >> 2) + (y >> 2)) % 2;
      rgba[offset] = checker ? 38 : 52;
      rgba[offset + 1] = checker ? 142 : 168;
      rgba[offset + 2] = checker ? 70 : 83;
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

const width = 32, height = 32;
const source = fixture(width, height);
const tileProfile = profileAssetImage(source, width, height, {sourceName:'assets/world/grass-tile.png'});
assert(tileProfile.kind === 'tile', `tile kind=${tileProfile.kind}`);
assert(tileProfile.adaptivePolicy === 'seam-safe', `tile policy=${tileProfile.adaptivePolicy}`);
assert(tileProfile.invariants.preserveBorder === true, 'tile border invariant');

// Regression: token hints must not treat the substring "road" inside "broad" as a road/tile.
const broadTreeProfile = profileAssetImage(source, width, height, {sourceName:'assets/world/trees/tree-oak-broad-green.png'});
assert(broadTreeProfile.kind !== 'tile', `broad tree false tile=${broadTreeProfile.kind}`);
assert(broadTreeProfile.hints.tile === false, 'broad tree false road token');
assert(broadTreeProfile.invariants.preserveBorder === false, 'broad tree false seam lock');

const changedBorder = Buffer.from(source);
changedBorder[0] += 1;
const borderMetrics = evaluatePixelFidelity(source, changedBorder, width, height);
assert(borderMetrics.borderMaxRgbDelta === 1, `border delta=${borderMetrics.borderMaxRgbDelta}`);
assert(judgePixelFidelity(borderMetrics, 'seam-safe').pass === false, 'seam-safe must reject a one-step border change');

const sprite = Buffer.alloc(24 * 24 * 4);
for (let y = 5; y < 20; y += 1) {
  for (let x = 7; x < 17; x += 1) {
    const o = (y * 24 + x) * 4;
    sprite[o] = 40; sprite[o + 1] = 120; sprite[o + 2] = 210; sprite[o + 3] = 255;
  }
}
const spriteProfile = profileAssetImage(sprite, 24, 24, {sourceName:'hero-sprite.png'});
assert(spriteProfile.kind.includes('sprite'), `sprite kind=${spriteProfile.kind}`);
assert(spriteProfile.invariants.preserveAlpha === true, 'sprite alpha invariant');

const png = encodeRgbaPng(source, width, height, {level:1, filterStrategy:0});
const tournament = optimizePngTournament(png, {effort:'balanced'});
assert(tournament.report.winner.pass === true, 'tournament winner gate');
assert(tournament.report.winner.exactPixels === true, 'tournament winner exact');
assert(tournament.buffer.length <= png.length, `tournament grew ${png.length}->${tournament.buffer.length}`);

console.log(JSON.stringify({
  status:'ASSET_SPACE_META_AUDIT_OK',
  tilePolicy:tileProfile.adaptivePolicy,
  broadTreeKind:broadTreeProfile.kind,
  broadTreeTileHint:broadTreeProfile.hints.tile,
  spriteKind:spriteProfile.kind,
  borderGate:judgePixelFidelity(borderMetrics, 'seam-safe').reasons,
  sourceBytes:png.length,
  tournamentBytes:tournament.buffer.length,
  tournamentWinner:tournament.report.winner.label,
  availableTools:tournament.report.availableTools
}));
