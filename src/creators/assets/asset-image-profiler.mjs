/* KELO-INDEX
 * area: CREATORS / ASSET BYTES
 * owner: Kelo Creator Asset Bridge
 * keys: IMAGE PROFILE PIXEL ART TILE SPRITE ALPHA COLOR COMPLEXITY POLICY
 * purpose: classify decoded assets so compression search uses the right quality policy instead of one global preset
 * public-api: profileAssetImage()
 * state-owned: none; pure analysis
 * online: N/A; creator/build-time capability
 * reuse: PNG space compiler, codec tournament, future publish pipeline
 * do-not: mutate pixels or decide runtime rendering
 */

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

function pathHints(sourceName = '') {
  const normalized = String(sourceName)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
  const tokenList = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  const tokens = new Set(tokenList);
  const hasAny = (...values) => values.some(value => tokens.has(value));
  const hasSafePrefix = (...values) => tokenList.some(token => values.some(value => token.startsWith(value)));
  const atlas = hasAny('atlas', 'sheet', 'spritesheet', 'tileset');
  return {
    // Exact tokens avoid collisions such as "broad" → "road". A small allowlist
    // of semantic prefixes covers real compound names such as "cespedsindivisiones".
    // Atlas tokens remain separate: `tileset` is not automatically a repeatable tile.
    tile:!atlas && (
      hasAny('tile', 'terrain', 'ground', 'floor', 'grass', 'cesped', 'path', 'paths', 'road', 'roads', 'wall', 'walls', 'seam') ||
      hasSafePrefix('cesped', 'grass', 'terrain', 'ground', 'floor', 'road', 'path', 'wall', 'seam')
    ),
    sprite:hasAny('sprite', 'hero', 'character', 'avatar', 'npc', 'mob', 'weapon', 'item', 'prop', 'tree', 'trees', 'arbol', 'fountain', 'fuente'),
    ui:hasAny('ui', 'icon', 'hud', 'button', 'logo', 'badge', 'menu'),
    fx:hasAny('fx', 'vfx', 'effect', 'effects', 'particle', 'particles', 'glow', 'smoke', 'fire', 'magic'),
    atlas
  };
}

function colorKey(r, g, b, a) {
  return (((r << 24) >>> 0) | (g << 16) | (b << 8) | a) >>> 0;
}

export function profileAssetImage(rgba, width, height, options = {}) {
  if (!rgba || rgba.length !== width * height * 4) throw new Error('ASSET_IMAGE_PROFILE_INVALID_PIXELS');
  const pixelCount = Math.max(1, width * height);
  const hints = pathHints(options.sourceName || options.file || '');
  const colors = new Set();
  const alphaLevels = new Set();
  const histogram = new Map();
  let transparent = 0;
  let semitransparent = 0;
  let opaque = 0;
  let edgePairs = 0;
  let strongEdges = 0;
  let borderPixels = 0;
  let borderOpaque = 0;
  let borderDistinct = 0;
  const borderColors = new Set();

  const sampleStride = Math.max(1, Math.floor(pixelCount / 250000));
  for (let pixel = 0; pixel < pixelCount; pixel += sampleStride) {
    const offset = pixel * 4;
    const r = rgba[offset], g = rgba[offset + 1], b = rgba[offset + 2], a = rgba[offset + 3];
    const key = colorKey(r, g, b, a);
    if (colors.size <= 4096) colors.add(key);
    if (alphaLevels.size <= 257) alphaLevels.add(a);
    histogram.set(key, (histogram.get(key) || 0) + 1);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const r = rgba[offset], g = rgba[offset + 1], b = rgba[offset + 2], a = rgba[offset + 3];
      if (a === 0) transparent += 1;
      else if (a === 255) opaque += 1;
      else semitransparent += 1;

      const onBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (onBorder) {
        borderPixels += 1;
        if (a > 0) borderOpaque += 1;
        if (borderColors.size <= 1024) borderColors.add(colorKey(r, g, b, a));
      }

      if (x + 1 < width) {
        const n = offset + 4;
        const delta = Math.max(
          Math.abs(r - rgba[n]), Math.abs(g - rgba[n + 1]), Math.abs(b - rgba[n + 2]), Math.abs(a - rgba[n + 3])
        );
        edgePairs += 1;
        if (delta >= 24) strongEdges += 1;
      }
      if (y + 1 < height) {
        const n = offset + width * 4;
        const delta = Math.max(
          Math.abs(r - rgba[n]), Math.abs(g - rgba[n + 1]), Math.abs(b - rgba[n + 2]), Math.abs(a - rgba[n + 3])
        );
        edgePairs += 1;
        if (delta >= 24) strongEdges += 1;
      }
    }
  }
  borderDistinct = borderColors.size;

  const sampled = Math.ceil(pixelCount / sampleStride);
  const orderedCounts = [...histogram.values()].sort((a, b) => b - a);
  const top16Coverage = orderedCounts.slice(0, 16).reduce((sum, value) => sum + value, 0) / Math.max(1, sampled);
  const uniqueColors = colors.size > 4096 ? 4097 : colors.size;
  const uniqueColorRatio = uniqueColors / Math.max(1, Math.min(sampled, 4097));
  const edgeDensity = strongEdges / Math.max(1, edgePairs);
  const transparentRatio = transparent / pixelCount;
  const semitransparentRatio = semitransparent / pixelCount;
  const borderOpaqueRatio = borderOpaque / Math.max(1, borderPixels);

  const paletteLike = uniqueColors <= 512 || top16Coverage >= 0.72;
  const hardEdged = edgeDensity >= 0.13;
  const pixelArtConfidence = clamp01(
    (paletteLike ? 0.45 : 0) +
    (hardEdged ? 0.25 : 0) +
    (semitransparentRatio < 0.015 ? 0.15 : 0) +
    (uniqueColors <= 128 ? 0.15 : uniqueColors <= 512 ? 0.08 : 0)
  );

  let kind = 'illustration';
  if (hints.tile) kind = 'tile';
  else if (hints.ui) kind = 'ui';
  else if (hints.fx) kind = 'fx';
  else if (hints.atlas) kind = pixelArtConfidence >= 0.55 ? 'pixel-atlas' : 'atlas';
  else if (hints.sprite || transparentRatio > 0.08) kind = pixelArtConfidence >= 0.55 ? 'pixel-sprite' : 'sprite';
  else if (pixelArtConfidence >= 0.72) kind = 'pixel-art';

  const seamCritical = kind === 'tile' || hints.tile;
  const alphaCritical = transparentRatio > 0 || semitransparentRatio > 0;
  const pixelCritical = pixelArtConfidence >= 0.72 || kind === 'pixel-atlas' || kind === 'pixel-sprite';

  let adaptivePolicy = 'balanced';
  if (seamCritical) adaptivePolicy = 'seam-safe';
  else if (pixelCritical) adaptivePolicy = 'pixel-art';
  else if (kind === 'ui') adaptivePolicy = 'ui-crisp';
  else if (kind === 'fx') adaptivePolicy = 'fx-alpha';

  const runtimeCandidates = ['png', 'webp-lossless'];
  if (!pixelCritical && !seamCritical) runtimeCandidates.push('webp-adaptive', 'avif-adaptive');

  return {
    version:'kelo-asset-image-profile-v1.2',
    kind,
    adaptivePolicy,
    sourceName:String(options.sourceName || options.file || ''),
    dimensions:{width, height, pixels:pixelCount},
    hints,
    metrics:{
      uniqueColors,
      uniqueColorRatio:Number(uniqueColorRatio.toFixed(6)),
      alphaLevels:alphaLevels.size,
      transparentRatio:Number(transparentRatio.toFixed(6)),
      semitransparentRatio:Number(semitransparentRatio.toFixed(6)),
      opaqueRatio:Number((opaque / pixelCount).toFixed(6)),
      edgeDensity:Number(edgeDensity.toFixed(6)),
      top16Coverage:Number(top16Coverage.toFixed(6)),
      borderOpaqueRatio:Number(borderOpaqueRatio.toFixed(6)),
      borderDistinctColors:borderDistinct,
      pixelArtConfidence:Number(pixelArtConfidence.toFixed(6))
    },
    invariants:{
      preserveDimensions:true,
      preserveAlpha:alphaCritical,
      preserveBorder:seamCritical,
      preferExactPixels:pixelCritical || seamCritical
    },
    runtimeCandidates
  };
}
