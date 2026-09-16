# Exact Reconstruction Lab V1

## Purpose

Build-time laboratory under `Kelo Creator Asset Bridge` that searches for repeated pixel structure that can be represented as unique RGBA blocks plus an index map and then reconstructs the original image byte-exactly.

This explores a route beyond repeated PNG recompression: store repeated information once and reconstruct deterministically.

## Owner and state

- owner: `Kelo Creator Asset Bridge`
- runtime state: none
- gameplay authority: none
- SOURCE mutation: forbidden
- runtime format promotion: forbidden without a separate device/runtime proof

## Sources

- `src/creators/assets/exact-tile-reconstruction.mjs`
- `scripts/exact-tile-reconstruction-audit.mjs`
- `scripts/exact-reconstruction-lab.mjs`

## Model

For a candidate tile size that exactly divides the image:

```text
RGBA image
  -> fixed-size RGBA blocks
  -> exact block identity
  -> unique block dictionary
  + index stream
  -> reconstruct
  -> SHA-256(original RGBA) == SHA-256(reconstructed RGBA)
```

Hash identity is collision-defended by byte comparison before a block is reused.

## Public API

### `buildExactTilePlan(rgba, width, height, tileSize)`

Builds a reversible dictionary/index representation.

### `reconstructExactTilePlan(plan)`

Rebuilds the full RGBA buffer.

### `searchExactTilePlans(rgba, width, height, options)`

Tests candidate tile sizes and only exposes plans whose reconstructed RGBA hash matches the source.

## Metrics

The lab records:

- tile count;
- unique tile count;
- bits needed per index;
- raw dictionary bytes;
- index bytes;
- raw RGBA baseline;
- theoretical structural saving against raw RGBA;
- exact reconstruction proof.

The theoretical structural saving is deliberately **not** presented as a saving against PNG stored bytes. PNG already compresses redundancy, so a custom representation must later beat the real PNG/codec candidate plus its runtime decoding cost before promotion.

## Invariants

1. Reconstruction must be byte-exact RGBA.
2. No perceptual approximation is allowed in the exact track.
3. SOURCE remains unchanged.
4. No runtime decoder is introduced by the lab.
5. No plan wins merely because raw structural bytes are lower.
6. Promotion requires real encoded size, decode/draw cost, memory and iPhone Safari proof.

## CI

`Kelo Weightless Stack` runs the deterministic audit and scans a bounded real-asset sample for structural opportunities. The result is informational; it does not mutate production art.

## Online-first

N/A for gameplay authority. If a reconstruction format is eventually promoted, immutable content hashes and logical asset IDs must remain independent so CDN/server storage can deduplicate physical payloads without changing gameplay identity.

## Extension points

- variable block sizes / quadtree partitioning;
- palette dictionary factoring;
- cross-asset block dictionaries;
- animation-frame delta dictionaries;
- exact procedural parameterization for known generated textures;
- GPU-friendly dictionary decode only after measured device proof.

## Anti-patterns

- Do not claim raw-RGBA theoretical savings equal network savings.
- Do not add a custom runtime decoder before proving it beats current PNG/WebP/AVIF delivery on iPhone.
- Do not use approximate blocks in the exact track.
- Do not delete SOURCE after deriving a reconstruction candidate.
