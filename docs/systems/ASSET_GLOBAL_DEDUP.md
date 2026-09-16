# Asset Global Dedup V1

## Purpose

Build-time capability under `Kelo Creator Asset Bridge` that finds identical stored payloads and exact decoded-RGBA equivalence across the asset library without changing SOURCE or runtime references.

## Owner and authority

- owner: `Kelo Creator Asset Bridge`
- gameplay authority: none
- runtime state: none
- persistence: CI report/artifact only
- source mutation: forbidden
- automatic semantic aliasing: forbidden

## Sources

- `src/creators/assets/asset-global-dedup.mjs`
- `scripts/asset-global-dedup.mjs`
- `scripts/asset-global-dedup-audit.mjs`
- input: `asset-space-budget` report

## Contract

The planner creates two different classes and deliberately does not mix them.

### Byte-exact

Same SHA-256 over the stored file bytes. These files are physically identical payloads and can safely share one future content-addressed blob while retaining multiple logical IDs/paths at a higher manifest layer.

### RGBA-exact convergence candidate

Same dimensions and same SHA-256 over decoded RGBA, but different stored-byte SHA-256. The smallest representation is selected as an advisory champion only. Promotion still requires metadata, format, sourceRect, manifest and consumer proof because equal pixels do not prove equal non-pixel semantics.

## API

`buildAssetGlobalDedupPlan(report)` returns:

- logical stored bytes;
- safe byte-exact physical saving opportunity;
- byte-exact groups and canonical blob candidate;
- RGBA-exact convergence groups;
- smallest representation in each RGBA group;
- potential convergence savings;
- hard invariants preventing SOURCE mutation.

## Flow

```text
asset library
  -> asset-space-budget
  -> byte SHA-256 + dimension + RGBA SHA-256
  -> Asset Global Dedup
       -> byte-exact groups -> safe shared-blob opportunity
       -> dimension+RGBA exact -> smallest encoding champion candidate
       -> report only
```

## Invariants

1. Byte-exact identity is the only automatic physical-dedup class.
2. RGBA identity alone never rewrites files or references.
3. Width and height are part of the RGBA identity key.
4. Logical asset IDs remain independent from physical blob identity.
5. SOURCE remains canonical evidence.
6. Existing quality, provenance, atlas and iPhone promotion gates remain authoritative.

## Online / CDN path

A future object store or CDN can materialize blobs by content hash and let multiple logical asset records reference the same immutable object. This matches long-lived immutable caching: a changed payload receives a new hash identity while unchanged payloads can be reused.

## Tests

`node scripts/asset-global-dedup-audit.mjs`

The deterministic audit proves byte-exact savings, dimension-aware RGBA grouping and smallest-representation champion selection.

## Observability

CI publishes:

- logical stored bytes;
- byte-exact physical bytes after theoretical sharing;
- guaranteed byte-exact saving opportunity;
- RGBA convergence candidate saving opportunity;
- exact duplicate groups and champion candidates.

## Anti-patterns

- Do not replace two assets merely because they look similar.
- Do not collapse different dimensions on an RGBA hash alone.
- Do not infer semantic equivalence from file names.
- Do not delete duplicate SOURCE automatically.
- Do not make the dedup planner a runtime loader.
