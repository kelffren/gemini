/* KELO-INDEX
 * area: BUILD / CREATOR ASSET INGEST
 * owner: Kelo Creator Asset Bridge
 * keys: ASSET SPACE META AUDIT PROFILE SEAM RENDER EXACT QUALITY TOURNAMENT PATH TOKENS
 * purpose: prove asset classification, path-token safety, compound terrain names, seam/render-exact hard-gates and verified codec tournament behavior
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
assert(!tileProfile.runtimeCandidates.includes('webp-render-exact'), 'seam tile must not get hidden-RGB delivery relaxation');

const compoundTerrainProfile = profileAssetImage(source, width, height, {sourceName:'assets/cespedsindivisiones.PNG'});
assert(compoundTerrainProfile.kind === 'tile', `compound terrain kind=${compoundTerrainProfile.kind}`);
assert(compoundTerrainProfile.adaptivePolicy === 'seam-safe', `compound terrain policy=${compoundTerrainProfile.adaptivePolicy}`);

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
for (let pixel = 0; pixel < 24 * 24; pixel += 1) {
  const o = pixel * 4;
  // Deliberately non-zero hidden RGB to model AI/exporter transparent padding.
  sprite[o] = 21; sprite[o + 1] = 44; sprite[o + 2] = 77; sprite[o + 3] = 0;
}
for (let y = 5; y < 20; y += 1) {
  for (let x = 7; x < 17; x += 1) {
    const o = (y * 24 + x) * 4;
    sprite[o] = 40; sprite[o + 1] = 120; sprite[o + 2] = 210; sprite[o + 3] = 255;
  }
}
const spriteProfile = profileAssetImage(sprite, 24, 24, {sourceName:'hero-sprite.png'});
assert(spriteProfile.kind.includes('sprite'), `sprite kind=${spriteProfile.kind}`);
assert(spriteProfile.invariants.preserveAlpha === true, 'sprite alpha invariant');
assert(spriteProfile.runtimeCandidates.includes('webp-render-exact'), 'transparent sprite render-exact candidate');

// DELIVERY render-exact may alter only RGB hidden under alpha=0.
const hiddenRgbChanged = Buffer.from(sprite);
hiddenRgbChanged[0] = 0; hiddenRgbChanged[1] = 0; hiddenRgbChanged[2] = 0;
const hiddenMetrics = evaluatePixelFidelity(sprite, hiddenRgbChanged, 24, 24);
assert(hiddenMetrics.exactPixels === false, 'hidden RGB change is not strict exact');
assert(hiddenMetrics.renderExactPixels === true, 'hidden RGB change remains render exact');
assert(hiddenMetrics.hiddenTransparentRgbChangedPixels === 1, `hidden changed=${hiddenMetrics.hiddenTransparentRgbChangedPixels}`);
assert(judgePixelFidelity(hiddenMetrics, 'strict').pass === false, 'strict rejects hidden RGB change');
assert(judgePixelFidelity(hiddenMetrics, 'render-exact').pass === true, 'render-exact accepts hidden RGB only');

const visibleRgbChanged = Buffer.from(sprite);
const visibleOffset = (10 * 24 + 10) * 4;
visibleRgbChanged[visibleOffset] += 1;
const visibleMetrics = evaluatePixelFidelity(sprite, visibleRgbChanged, 24, 24);
assert(judgePixelFidelity(visibleMetrics, 'render-exact').pass === false, 'render-exact rejects visible RGB change');

const alphaChanged = Buffer.from(sprite);
alphaChanged[3] = 1;
const alphaMetrics = evaluatePixelFidelity(sprite, alphaChanged, 24, 24);
assert(judgePixelFidelity(alphaMetrics, 'render-exact').pass === false, 'render-exact rejects alpha change');

const png = encodeRgbaPng(source, width, height, {level:1, filterStrategy:0});
const tournament = optimizePngTournament(png, {effort:'balanced'});
assert(tournament.report.winner.pass === true, 'tournament winner gate');
assert(tournament.report.winner.exactPixels === true, 'tournament winner exact');
assert(tournament.buffer.length <= png.length, `tournament grew ${png.length}->${tournament.buffer.length}`);

console.log(JSON.stringify({
  status:'ASSET_SPACE_META_AUDIT_OK',
  tilePolicy:tileProfile.adaptivePolicy,
  compoundTerrainKind:compoundTerrainProfile.kind,
  compoundTerrainPolicy:compoundTerrainProfile.adaptivePolicy,
  broadTreeKind:broadTreeProfile.kind,
  broadTreeTileHint:broadTreeProfile.hints.tile,
  spriteKind:spriteProfile.kind,
  spriteRuntimeCandidates:spriteProfile.runtimeCandidates,
  renderExactHiddenChanges:hiddenMetrics.hiddenTransparentRgbChangedPixels,
  renderExactGate:judgePixelFidelity(hiddenMetrics, 'render-exact').pass,
  borderGate:judgePixelFidelity(borderMetrics, 'seam-safe').reasons,
  sourceBytes:png.length,
  tournamentBytes:tournament.buffer.length,
  tournamentWinner:tournament.report.winner.label,
  availableTools:tournament.report.availableTools
}));
