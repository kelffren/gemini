# Kelo Image Treatment Engine V1

## Owner

`src/creators/core/image-treatment-engine.mjs` is the single shared owner for deterministic pixel treatment inside Kelo Creators.

It is **not** a second editor and does not own sprite geometry, atlas grids, resizing, PNG/WebP encoding, publishing, or gameplay. Sprite Factory consumes it before the existing Sprite Compiler pipeline.

## Goal

Take browser-decodable images (PNG/WebP/JPEG), clean avoidable visual/compression noise locally, and return a treated derivative while keeping the uploaded/master source untouched.

Pipeline:

`MASTER INPUT -> IMAGE TREATMENT -> SPRITE/ASSET COMPILER -> OPTIMIZER/RUNTIME DERIVATIVE`

## Public API

- `analyzeImagePixels(data, width, height, options)` — deterministic sampling of alpha, approximate color complexity, edges and local noise.
- `resolveImageTreatmentProfile(profile, analysis, overrides)` — resolves `auto`, `sprite`, `pixel-art`, `illustration`, or `ui`.
- `treatImagePixels(data, width, height, options)` — pure RGBA treatment. Does not require DOM.
- `treatImageSource(root, imageOrCanvas, options)` — browser canvas adapter.
- `treatImageFile(root, file, options)` — browser file adapter. Returns a treated data URL plus the treatment report; it never mutates the original `File`.

## Profiles

### `sprite`

Conservative. Sanitizes hidden RGB in fully transparent pixels and repairs obvious color halos on semi-transparent edge pixels. No smoothing/denoise. Alpha is preserved.

### `pixel-art`

Strict hard-edge profile. Sanitizes hidden RGB only. No halo blending, no denoise, no interpolation, no sharpen.

### `illustration`

For AI art/backgrounds. Sanitizes transparent RGB, repairs edge halos, runs a single edge-aware color denoise pass and a bounded micro-sharpen pass. The denoise only mixes nearby colors and rejects large color jumps, so hard boundaries are protected.

### `ui`

Conservative UI/text profile. Hidden RGB + strong-threshold halo repair. No denoise.

### `auto`

Uses deterministic heuristics from alpha coverage, quantized color complexity and edge ratio. Callers with known asset semantics should prefer an explicit profile.

## Safety contracts

1. Input bytes are copied before treatment; the source array/File is never mutated.
2. V1 never changes alpha. `report.alphaPreserved` must stay true.
3. `sprite`, `pixel-art`, and `ui` never run smoothing by default.
4. Fully transparent RGB may be zeroed because it is invisible at runtime and improves deterministic cleanup/compressibility.
5. Halo repair preserves alpha and only changes RGB when a semi-transparent pixel strongly disagrees with nearby opaque interior pixels.
6. Illustration denoise is bounded to one 3x3 edge-aware pass.
7. Every treatment returns measurable counters and pixel-delta metrics.

## Sprite Factory integration

`src/creators/ui/sprite-factory-online.mjs` uses `profile: 'sprite'` in two places:

1. Uploaded reference image: local treatment is converted to PNG data URL before it is sent as AI reference. The master `File` remains untouched.
2. Generated atlas: local treatment runs before grid detection, background cleanup, geometry normalization and Frame Doctor QA.

Runtime diagnostics:

- `window.__KELO_IMAGE_TREATMENT_LAST__`
- `window.__KELO_SPRITE_COMPILER_LAST__.imageTreatment`
- `window.__KELO_SPRITE_FACTORY_ONLINE__.imageTreatment`

## Deterministic audit

Run:

```bash
node scripts/image-treatment-engine-audit.mjs
```

The audit checks:

- hidden transparent RGB cleanup;
- alpha preservation;
- halo repair;
- edge-aware denoise on noisy interior pixels;
- hard-edge protection;
- explicit profile resolution.

## Next safe extensions

- shared lossless PNG optimizer after treatment;
- Web Worker adapter for large images;
- optional WebGL2 acceleration while keeping the pure CPU implementation as reference/fallback;
- before/after split preview in an existing Creator workspace, not a parallel editor;
- image-level PSNR/SSIM gate for `illustration` derivatives.
