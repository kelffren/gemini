# Asset Bit Ratchet V1

## Purpose

Asset Bit Ratchet is a build/publish-time capability under `Kelo Creator Asset Bridge`. It makes byte efficiency monotonic when the underlying decoded image information has not changed.

The core rule is:

> Same repository path + same decoded RGBA SHA-256 => stored bytes may stay equal or decrease, never increase.

This is deliberately narrower than "the whole game must always get smaller". New art contains new information and may require more bytes. The ratchet prevents accidental encoding regressions for information that is already equivalent.

## Owner and state

- owner: `Kelo Creator Asset Bridge`
- runtime state owned: none
- gameplay authority: none
- persistence: CI reports/artifacts only
- source mutation: forbidden
- player visible: no

The capability extends the existing Space Gate. It is not a second compressor, renderer, asset loader, or runtime engine.

## Sources

- `src/creators/assets/asset-bit-ratchet.mjs`
- `scripts/asset-bit-ratchet.mjs`
- `scripts/asset-bit-ratchet-audit.mjs`
- `.github/workflows/asset-bit-ratchet.yml`
- input reports produced by `scripts/asset-space-budget.mjs`

## Flow

```text
main/base assets
  -> asset-space-budget
  -> base snapshot (stored bytes + decoded RGBA hash)

PR/head assets
  -> asset-space-budget
  -> head snapshot (stored bytes + decoded RGBA hash)

base + head
  -> Asset Bit Ratchet
     -> same RGBA: compare bytes
     -> changed RGBA: classify as changed information, do not pretend it is a compression regression
     -> new/removed asset: classify separately
     -> duplicate opportunities remain visible
     -> CI PASS/FAIL + report
```

## Public API

### `compareAssetBitSnapshots(baseReport, headReport, options)`

Pure comparison. It does not touch files.

Options:

- `toleranceBytes` — default `0`; intended only for explicitly justified environments where byte-exact build reproducibility is unavailable.

Output includes:

- `pass`
- `regressions`
- `improvements`
- `unchanged`
- `informationChanged`
- `added`
- `removed`
- aggregate stored/decode/duplicate opportunity metrics

## Invariants

1. A PNG with unchanged decoded RGBA information cannot silently become larger.
2. Pixel changes are not mislabeled as compression regressions.
3. The gate never rewrites or deletes SOURCE.
4. Exact information proof uses SHA-256 over decoded RGBA, not filenames or visual guesses.
5. Render-exact hashes remain diagnostic only; hidden RGB under alpha=0 is still information and therefore does not qualify as "unchanged information" for the hard ratchet.
6. New content remains governed by existing asset budgets and quality gates.
7. Smaller is never enough by itself; all existing PNG conformance/quality/provenance rules remain authoritative.

## Why this can become progressively lighter

The existing Space Gate already runs increasingly capable encoders and exact quality verification. The ratchet adds memory across repository history through the merge chain: once an unchanged asset reaches a smaller valid representation, a later PR cannot replace it with a larger representation while claiming equivalence.

This creates a one-way pressure toward lower stored bytes for unchanged information.

It does not violate information theory. Lossless data cannot be compressed indefinitely; eventually an asset reaches a practical entropy/codec floor. At that point the ratchet holds the best known representation until a better codec, structure, deduplication strategy, or content model is proven.

## Relationship to other owners

- `png-space-optimizer.mjs` and codec tournament: search for smaller valid representations.
- `asset-space-budget.mjs`: measures bytes, decoded RGBA and duplicates.
- `asset-budget-policy.mjs`: limits growth of declared groups.
- `asset-delivery-manifest.mjs`: content-addressed delivery candidates.
- `smart-atlas-planner.mjs`: can reduce redundant atlas area only after recomposition proof.
- `KeloUpdateDelta`: avoids retransmitting cached blobs during updates.
- `Turbo production compiler`: code minification/code splitting is separate; a future code-byte ratchet should extend build QA rather than this asset owner.

## Online-first / server boundary

N/A for gameplay authority. The gate runs before publishing. Future CDN/object-store delivery can consume immutable content-addressed outputs without changing the comparison contract.

## CI

`.github/workflows/asset-bit-ratchet.yml` runs on relevant pull requests:

1. deterministic ratchet self-test;
2. head asset budget snapshot;
3. base commit asset budget snapshot in a detached worktree;
4. hard comparison for unchanged RGBA information;
5. report artifact and GitHub summary.

A regression exits non-zero.

## Observability

The report exposes:

- comparable files;
- improved/regressed file counts;
- bytes saved/regressed among comparable files;
- total repository asset-byte delta (including changed/new information);
- decoded RGBA dimensional delta;
- exact RGBA/render duplicate saving opportunity.

## Extension points

Safe next steps:

- content-addressed shared blob store so multiple logical asset IDs can point to one identical payload;
- boot-route byte ratchet for JS/CSS/assets actually needed before first playable frame;
- per-zone working-set budgets rather than repository-size guesses;
- device-measured decode/draw memory ratchet after iPhone proof;
- procedural/palette/parameterized representations where reconstruction is exact and reversible.

## Anti-patterns

- Do not delete SOURCE because a smaller delivery representation exists.
- Do not use perceptual similarity as the hard "same information" key.
- Do not force total asset bytes to shrink when genuinely new art is added.
- Do not lower quality gates just to satisfy the ratchet.
- Do not create a runtime watchdog or second loader for this feature.

## Validation status

V1 is build-time and non-player-visible. It requires its deterministic audit plus the pull-request comparison workflow. It does not alter boot, Canvas rendering, sourceRects, IDs, gameplay state, or online authority.
