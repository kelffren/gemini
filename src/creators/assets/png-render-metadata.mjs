/* KELO-INDEX
 * area: CREATORS / ASSET QUALITY
 * owner: Kelo Creator Asset Bridge
 * keys: PNG METADATA COLOR ICC CICP HDR MDCV CLLI GAMMA FINGERPRINT
 * purpose: identify PNG chunks that can change decoded/display colour semantics so codec candidates cannot win by silently dropping them
 * public-api: pngRenderMetadataFingerprint(), pngAncillaryChunkNames()
 * state-owned: none
 * online: N/A; build/publish-time validation
 */

// PNG Third Edition colour precedence includes cICP, iCCP, sRGB, cHRM/gAMA.
// sBIT affects source precision semantics. mDCV/cLLI provide HDR mastering/
// luminance metadata that can influence tone mapping. Preserve byte-for-byte
// across transformations that claim rendering-metadata equivalence.
export const PNG_RENDER_METADATA_CHUNKS = new Set([
  'cICP','iCCP','sRGB','cHRM','gAMA','sBIT','mDCV','cLLI'
]);

const ESSENTIAL = new Set(['IHDR','PLTE','tRNS','IDAT','IEND']);

export function pngRenderMetadataFingerprint(decoded) {
  return decoded.chunks
    .filter(chunk=>PNG_RENDER_METADATA_CHUNKS.has(chunk.type))
    .map(chunk=>`${chunk.type}:${chunk.data.toString('base64')}`)
    .join('|');
}

export function pngAncillaryChunkNames(decoded) {
  return [...new Set(decoded.chunks.filter(chunk=>!ESSENTIAL.has(chunk.type)).map(chunk=>chunk.type))];
}
