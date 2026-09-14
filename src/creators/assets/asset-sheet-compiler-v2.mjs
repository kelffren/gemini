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
  enrichAssetSheetAnalysis
} from './asset-sheet-semantic-compiler.mjs';

export {ASSET_SEMANTIC_COMPILER_VERSION} from './asset-sheet-semantic-compiler.mjs';
export * from './asset-sheet-semantic-compiler.mjs';

export const ASSET_SHEET_COMPILER_VERSION = `${BASE_COMPILER_VERSION}+semantic-v2`;

export function analyzeAssetSheetPixels(rgba, width, height, inputOptions = {}) {
  const baseOptions = inputOptions?.base || inputOptions;
  const semanticOptions = inputOptions?.semantic || inputOptions;
  const base = analyzeBaseAssetSheetPixels(rgba, width, height, baseOptions);
  return enrichAssetSheetAnalysis(base, rgba, semanticOptions);
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
      terrainRepeat: 'periodicity diagnostics + deterministic variant hooks',
      atlasBleed: 'edge extrusion helper available before packing',
      advancedRoads: 'macro-segment and spline-plan hooks available'
    }
  };
}
