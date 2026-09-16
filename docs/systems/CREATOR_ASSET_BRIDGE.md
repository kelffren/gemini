# Creator Asset Bridge V2.2 — Asset Intelligence Compiler

## Status

- owner: `Kelo Creator Asset Bridge`
- stage: creator/build/publish-time; no gameplay authority
- SOURCE remains canonical and immutable
- AUTHORING may use verified strict PNG reductions
- DELIVERY may emit immutable PNG/WebP/AVIF candidates but is not runtime-authoritative without validated iOS Safari device proof
- current Canvas 2D runtime contract remains unchanged by this system

## Pipeline

```text
SOURCE
  → PNG Conformance + resource-budget guard
  → static/APNG/Adam7/16-bit classifier
  → profile + confidence + explicit contracts
  → strict representation search / codec tournament
  → deterministic Quality Agent
  → independent libvips/pngcheck consensus
  → AUTHORING PNG

SOURCE/AUTHORING
  → DELIVERY codec search
  → canonical sRGB decode/compare
  → hard quality gates + composited-alpha metrics
  → optional/required perceptual proof according to publish policy
  → multidimensional Pareto (bytes/quality/encode/decode/memory/compatibility)
  → immutable content-addressed variant + provenance
  → iOS Safari device-proof gate
  → DELIVERY promotion candidate
```

Atlas work is a separate planning branch under the same owner:

```text
atlas + manifest
  → alpha-derived safe frame trim (`orig`, `trim`, adjusted anchor)
  → manifest visualBounds comparison
  → exact subframe duplicate detection
  → MaxRects planning
  → frame recomposition proof
  → measured promotion decision
```

Animated assets can add a temporal evidence branch:

```text
frame sequence
  → silhouette / alpha mass / centroid / palette metrics
  → anchor drift measurement
  → robust temporal-outlier detection
  → manifest-specific limits
  → animation consistency verdict
```

Repository asset groups can add declarative size guardrails:

```text
explicit paths/prefixes
  → PNG conformance metadata
  → stored bytes + RGBA dimensional baseline
  → file-count / largest-file limits
  → CI budget verdict
```

No Smart Atlas plan, animation analyzer or asset budget mutates LIVE pixels, sourceRects or runtime manifests automatically.

## Core modules

- `png-conformance-guard.mjs` — structure, chunk semantics, APNG detection, safe-to-copy and memory/decompression budgets.
- `png-space-optimizer.mjs` — strict refilter/DEFLATE, exact palette, redundant-alpha removal, exact grayscale and safe binary-alpha `tRNS` reductions.
- `png-independent-validator.mjs` — Sharp/libvips + pngcheck independent consensus.
- `png-quality-agent.mjs` — strict/render-exact gates plus RGB, alpha, edge, border, premultiplied and composited render metrics.
- `asset-image-profiler.mjs` — explicit contract > path hints > pixel evidence; emits confidence/sourceOfTruth/reasons; low-confidence assets remain conservative.
- `asset-animation-consistency.mjs` — temporal silhouette/alpha/centroid/palette/anchor analysis with explicit policy limits.
- `png-adaptive-optimizer.mjs` — libimagequant/Sharp adaptive candidate generation with strict fallback.
- `quality-boundary-search.mjs` — measured non-monotonic-aware quality search; explores failed plateaus for hidden pass islands and never infers an unmeasured pass.
- `quality-pareto.mjs` — authoring and delivery Pareto frontiers.
- `asset-effort-controller.mjs` — FAST first; BALANCED/DEEP only when measured marginal byte value justifies CPU.
- `asset-optimization-cache.mjs` — content-addressed cache keyed by source, engine, toolchain and policy.
- `asset-provenance.mjs` — source/output SHA-256, toolchain, quality, profile and validation evidence.
- `runtime-image-variants.mjs` — canonical-sRGB PNG/WebP/AVIF lab with encode/decode/memory measurements.
- `delivery-device-proof.mjs` — formal iOS Safari real-device evidence schema.
- `asset-delivery-manifest.mjs` — immutable hash-named DELIVERY variants and rollback-friendly manifest.
- `smart-atlas-planner.mjs` — alpha-safe trim, MaxRects plan and subframe dedup evidence.
- `asset-budget-policy.mjs` — explicit per-group transfer/decode/file-count/largest-file budgets.

## PNG conformance and failure policy

The local optimizer deliberately supports a strict subset for transformations. It does not pretend to be a full libpng replacement.

Before local decode/transform it validates:

- PNG signature and chunk framing;
- legal chunk names/reserved bit;
- required/unique `IHDR`/`IEND` and presence of `IDAT`;
- contiguous `IDAT` sequence;
- no bytes after `IEND`;
- legal color-type/bit-depth combinations;
- compression/filter/interlace method;
- maximum file/chunk/ancillary/pixel/decoded-byte budgets;
- unknown critical chunks;
- APNG (`acTL`/`fcTL`/`fdAT`).

Local structural transformations currently fail closed for:

- APNG;
- Adam7 interlacing;
- 16-bit samples;
- unsupported/corrupt structures.

These files are preserved unchanged rather than partially transformed. External tools may only become authoritative after independent validation appropriate to their contract.

Critical rewrites obey PNG safe-to-copy semantics. Unknown unsafe ancillary chunks are never blindly retained across a critical representation change.

## Exact PNG representation search

`optimizePngLossless()` keeps the original as a baseline and validates every possible winner after decoding. Candidates can include:

- filters 0–4 + adaptive per-row filter;
- multiple zlib strategies;
- exact indexed palette, including 1/2/4/8-bit indices;
- exact removal of an all-opaque alpha channel;
- exact RGB/RGBA → grayscale/grayscale-alpha when `R=G=B` for every pixel;
- 1/2/4-bit grayscale only when every value is mathematically representable;
- exact binary-alpha → `tRNS` only when one transparent RGB/gray key exists and that key is never visible/opaque.

Color-sensitive metadata blocks unsafe color-model reductions. Strict output must decode to the same RGBA pixels.

## Independent authority

Kelo's encoder and Kelo's decoder must not be the only proof of correctness.

CI includes:

- local strict equality;
- `pngcheck` structural validation;
- independent Sharp/libvips decode in canonical sRGB;
- representative real-asset source/output equality;
- parser torture/mutation corpus.

If the independent decoder disagrees, publication fails. A known Ubuntu `pngcheck` compile/runtime zlib-version warning may be classified as environmental only when it is the sole diagnostic; any additional structural error remains blocking.

## Quality Agent V2

Hard metrics include:

- exact and render-exact pixels;
- changed-pixel ratios;
- RGB MAE/RMSE/PSNR and max delta;
- alpha changed pixels/max delta;
- edge error and large-delta ratio;
- outer-border exactness/error;
- premultiplied RGB error;
- composited render error over black, white, 50% gray and checker backgrounds in linearized sRGB.

`strict` requires exact RGBA. `render-exact` allows RGB changes only where both source and candidate are fully transparent; alpha and every visible pixel remain exact. `seam-safe` retains a locked exterior border.

The Golden Corpus pins expected behavior for exact pixels, hidden transparent RGB, visible RGB changes, alpha changes and seam-border mutations.

## Animation Consistency Gate

`asset-animation-consistency.mjs` is temporal QA, not an animation engine. It accepts already-decoded frames and measures adjacent-frame and sequence-level evidence:

- alpha-mask intersection-over-union;
- alpha coverage and alpha-mass deltas;
- alpha-weighted centroid movement;
- bounding-box area change;
- visible palette Jaccard similarity;
- anchor drift when anchors are supplied;
- robust alpha coverage/mass outliers using median absolute deviation.

There are deliberately no universal gameplay thresholds. `judgeAnimationConsistency()` only enforces limits supplied by a caller/manifest. This prevents a walk cycle, attack smear or VFX from being rejected merely because its silhouette legitimately changes.

The CI corpus proves three invariants: stable synthetic motion passes its declared contract; a 5 px anchor jump fails; a one-frame full-alpha flash fails. A future sprite compiler can attach animation-specific limits without creating a second animation owner.

## Perceptual evidence

`perceptual-quality-bridge.mjs` records tool versions and parses named SSIMULACRA2/Butteraugli metrics. Perceptual tools never override a failed deterministic gate.

Adaptive `--write` is fail-closed: by default it requires SSIMULACRA2 evidence at the configured publish threshold (default 90). Missing perceptual tooling blocks the adaptive rewrite rather than silently weakening policy.

## Profiling authority

Profiler decisions are evidence, not gameplay truth.

Authority order:

1. explicit asset/manifest contract;
2. strong path semantics;
3. pixel evidence.

The profile contains `confidence`, `sourceOfTruth`, and `reasons`. Low-confidence classifications cannot enable adaptive WebP/AVIF automatically.

## Non-monotonic quality search

Codec quality knobs are not treated as mathematical monotonic functions. The search:

1. spreads coarse probes across the full requested range;
2. refines every observed pass/fail transition using only real encodes;
3. searches same-state FAIL plateaus before spending spare budget on redundant PASS plateaus, because a hidden low-quality pass island can unlock a materially smaller candidate;
4. probes local neighbours and remaining largest gaps while budget remains;
5. never labels an unmeasured quality as pass/fail.

The regression corpus includes both a monotonic boundary and an intentionally non-monotonic pass island.

## FAST / AUTO / BALANCED / DEEP

The previous assumption that DEEP should always run at publish was rejected by measurement. A real benchmark over representative assets produced identical bytes for FAST/BALANCED/DEEP while DEEP consumed materially more CPU.

`AUTO` therefore runs FAST first and only escalates when measured opportunity and marginal bytes/second justify more work. DEEP remains available explicitly and in the final external tournament.

## DELIVERY lab and promotion boundary

The DELIVERY lab currently measures candidates in a canonical sRGB decode path and records:

- bytes;
- deterministic quality score;
- encode time;
- decode time;
- decoded RGBA dimensional baseline;
- compatibility weight;
- two-dimensional and multidimensional Pareto frontiers.

`byteWinner` is a laboratory observation, not permission to alter runtime.

Promotion requires a validated `kelo-delivery-device-proof-v1` record with real iOS + Safari evidence, including device, OS/browser versions, minimum repeated runs, decode P50/P95, draw P50/P95 and measurement time. Until that proof exists, `promotion.eligible=false` and `KELO_ATLAS_CONTRACT`/boot stay unchanged.

KTX2/Basis remains a future DELIVERY track only after Kelo has a WebGL/WebGPU texture consumer. Adding it to the current Canvas 2D path would create a second graphics architecture for no proven runtime benefit.

## Immutable delivery and provenance

Lab variants can be materialized under names containing their output SHA-256. Existing content is never overwritten under a reused semantic filename.

Each candidate can carry provenance containing:

- SOURCE name/bytes/SHA-256;
- output name/bytes/SHA-256;
- stage and policy;
- optimizer/options;
- profile and confidence;
- quality/validator evidence;
- Node/platform/architecture/zlib/toolchain fingerprint.

The content-addressed design makes rollback natural: old variants can coexist and a manifest chooses an identity without destroying the source.

## Smart Atlas V1

`smart-atlas-planner.mjs` does not repack production blindly. It calculates:

- `orig` dimensions;
- alpha-derived trim rectangle;
- adjusted + original anchor;
- whether manifest `visualBounds` would have clipped real alpha;
- transparent area recovered per frame;
- MaxRects placements across candidate widths;
- exact RGBA subframe duplicate groups.

`asset-atlas-recomposition-audit.mjs` packs the trimmed frames in memory and reconstructs every original frame. Promotion is impossible unless visible pixels/alpha are render-exact and anchors recompose to their original coordinates.

For Forest Plaza the proof found 129/146 manifest `visualBounds` too small to be trusted as trim authority. Alpha-derived trim reconstructed 146/146 frames render-exact with anchors preserved, but the measured MaxRects plan was 22.532% worse in area than the current atlas. Therefore the current evidence says `NO REPACK`.

## Declarative asset-group budgets

`asset-budget-policy.mjs` and `scripts/asset-route-budget-audit.mjs` prevent repository asset growth from bypassing individual-image quality gates. Membership is explicit (`paths` / `prefixes`); the tool never guesses gameplay loading from filenames.

A group can cap:

- file count;
- total stored bytes;
- total `width × height × 4` RGBA dimensional baseline;
- largest individual stored asset.

`docs/asset-space-budgets.json` contains the current policy. The first enforced group, `plaza-authoring-library`, allows at most 2 PNG files, 7,000,000 stored bytes total, 20,000,000 RGBA-baseline bytes, and 4,000,000 bytes for the largest individual file. These are build-time repository guardrails, not a claim about exact browser memory or exact network-route loading.

## Security / robustness audits

`asset-png-torture-audit.mjs` covers, at minimum:

- trailing data;
- APNG control chunks;
- unknown critical chunks;
- Adam7 safe-skip;
- oversized dimensions/pixel budget;
- exact grayscale reduction;
- exact `tRNS` reduction;
- deterministic corrupt/mutation inputs that must never crash the optimizer.

Additional parser fuzz seeds can be added without changing the production API.

## CI and supply-chain policy

Asset CI uses Node 24 and pins GitHub Actions by immutable commit SHA. Sharp, OxiPNG and ECT versions are fixed in the relevant labs. External optimizer exit status is never proof of image correctness: its output still passes validation.

Current required creator gates include:

- PNG torture/conformance;
- independent libvips/pngcheck consensus;
- strict compiler self-test;
- Golden Quality Corpus;
- profile/seam/non-monotonic-search regressions;
- animation temporal consistency regression corpus;
- declarative asset-group byte/RGBA budgets;
- cache integrity;
- existing Asset Sheet compatibility;
- technical documentation audit;
- transfer/decode/duplicate budget;
- Smart Atlas plan + recomposition proof;
- representative real PNG dry-run.

## Ownership invariants

- byte optimization does not become a renderer;
- animation QA does not become an animation engine or gameplay timing owner;
- budget policy does not infer runtime route ownership;
- SOURCE never becomes disposable;
- no candidate wins solely because it is smaller;
- no LLM/visual reviewer can override a failed hard metric;
- sourceRects/IDs/gameplay metadata do not depend on delivery codec;
- Asset Forge remains the drawing/template owner and may feed SOURCE assets into this bridge; this compiler does not duplicate Asset Forge;
- current Canvas runtime remains authoritative until a separately validated DELIVERY promotion changes it.
