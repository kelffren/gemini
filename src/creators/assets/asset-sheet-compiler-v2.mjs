/* KELO-INDEX
 * area: CREATORS / ASSET SHEET COMPILER V2
 * owner: Kelo Creator Asset Bridge
 * owns: compatibility wrapper that enriches the proven v1 sheet segmentation with semantic road/terrain metadata
 * does-not-own: storage, remote APIs, catalog registration, map authority
 * public-api: analyzeAssetSheetPixels(), buildAssetSheetManifest()
 * online: no
 */
import {
  ASSET_SHEET_COMPILER_VERSION as BASE_COMPILER_VERSION,
  analyzeAssetSheetPixels as analyzeBaseAssetSheetPixels,
  buildAssetSheetManifest as buildBaseAssetSheetManifest
} from './asset-sheet-compiler.mjs';
import {
  ASSET_SEMANTIC_COMPILER_VERSION,
  enrichAssetSheetAnalysis,
  buildRoadCompatibilityMatrix
} from './asset-sheet-semantic-compiler.mjs';

export {ASSET_SEMANTIC_COMPILER_VERSION} from './asset-sheet-semantic-compiler.mjs';
export * from './asset-sheet-semantic-compiler.mjs';

export const ASSET_SHEET_COMPILER_VERSION = `${BASE_COMPILER_VERSION}+semantic-v2`;

function roadSocketRatio(socket, rect) {
  const perpendicular = socket?.side === 'N' || socket?.side === 'S' ? rect?.w : rect?.h;
  return Number(socket?.width || 0) / Math.max(1, Number(perpendicular || 1));
}

function shouldAutoPromoteRoad(asset) {
  const semantic = asset?.semantic;
  if (!semantic?.roadLike) return false;
  // Alpha-only masks are useful as a diagnostic fallback but are deliberately
  // not trusted for automatic semantics: a tightly-cropped tree trunk, prop,
  // building or character can touch one frame edge and look like a road end.
  if (semantic.source !== 'color') return false;
  if (Number(semantic.compilerConfidence || 0) < 0.68) return false;
  if (Number(semantic.candidateRatio || 0) < 0.12 || Number(semantic.candidateRatio || 0) > 0.88) return false;

  const sockets = semantic.sockets || [];
  if (sockets.length >= 2) return true;
  if (sockets.length !== 1) return false;

  // A real cul-de-sac / road end may expose one connector. Promote it only
  // when that mouth is broad relative to the frame and the road core occupies
  // a meaningful portion of the asset. This rejects thin trunks and stems.
  const mouthRatio = roadSocketRatio(sockets[0], asset.sourceRect || semantic.visualBounds);
  return mouthRatio >= 0.28 && Number(semantic.metrics?.areaRatio || 0) >= 0.10;
}

function enforceSafeSemanticPromotion(base, enriched) {
  const baseById = new Map((base.assets || []).map(asset => [asset.assetId || asset.id, asset]));
  const assets = (enriched.assets || []).map(asset => {
    const original = baseById.get(asset.assetId || asset.id);
    const autoRoadLike = shouldAutoPromoteRoad(asset);
    const semantic = {
      ...(asset.semantic || {}),
      roadCandidate: asset.semantic?.roadLike === true,
      roadLike: autoRoadLike,
      autoPromotionPolicy: autoRoadLike ? 'safe-road-auto' : 'metadata-only'
    };
    if (autoRoadLike || !original) return {...asset, semantic};
    return {
      ...asset,
      family: original.family,
      category: original.category,
      layer: original.layer,
      classification: original.classification,
      semantic
    };
  });
  return {
    ...enriched,
    assets,
    roadCompatibility: buildRoadCompatibilityMatrix(assets.filter(asset => asset.semantic?.roadLike))
  };
}

export function analyzeAssetSheetPixels(rgba, width, height, inputOptions = {}) {
  const baseOptions = inputOptions?.base || inputOptions;
  const semanticOptions = inputOptions?.semantic || inputOptions;
  const base = analyzeBaseAssetSheetPixels(rgba, width, height, baseOptions);
  const enriched = enrichAssetSheetAnalysis(base, rgba, semanticOptions);
  return enforceSafeSemanticPromotion(base, enriched);
}

export function buildAssetSheetManifest(analysis, options = {}) {
  const manifest = buildBaseAssetSheetManifest(analysis, options);
  return {
    ...manifest,
    compiler: ASSET_SHEET_COMPILER_VERSION,
    semanticCompiler: ASSET_SEMANTIC_COMPILER_VERSION,
    terrainDiagnostics: analysis?.terrainDiagnostics || null,
    roadCompatibility: analysis?.roadCompatibility || {},
    importPolicy: {
      ...manifest.importPolicy,
      topology: 'compiler-owned deterministic N/E/S/W bitmask',
      roadJoins: 'merge-zone + bridge-underlay metadata',
      roadAutoPromotion: 'color-core + confidence + multi-socket/broad-end safety gate',
      terrainRepeat: 'periodicity diagnostics + deterministic variant hooks',
      atlasBleed: 'edge extrusion helper available before packing',
      advancedRoads: 'macro-segment and spline-plan hooks available'
    }
  };
}
