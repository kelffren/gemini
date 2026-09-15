/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / V7
 * purpose: public capability surface for hardened AI-generated asset ingestion
 */
export {assertSafeAssetInput as decodeAssetSafely,inspectAssetContainer} from './asset-safe-decode.mjs';
export {fingerprintAssetBuild} from './asset-build-fingerprint.mjs';
export {migrateAssetMetadata,normalizeAssetMetadata,validateAssetMetadata} from './asset-metadata-schema.mjs';
export {createAssetJobRunner} from './asset-job-runner.mjs';
export {createAssetTransaction as commitAssetTransaction} from './asset-transaction.mjs';
export {scoreVisualRegression} from './asset-visual-regression.mjs';
export {createHardenedAssetCompiler,compileAssetHardened} from './asset-compiler-hardening.mjs';
export {canonicalizeColorSpace,canonicalizeAlphaMode,segmentAssetSemantically,extractAssetLayers,inferDepthAndOcclusion,inferSemanticAnchors} from './asset-canonicalization.mjs';
export {packAtlasDeterministically,generateMipChain,encodeGpuTextureVariants,estimateRuntimeTextureBudget} from './asset-runtime-optimization.mjs';
export {auditTemporalConsistency,detectAiAssetDefects,attachAssetProvenance,fuzzAssetCompiler} from './asset-quality-v7.mjs';
