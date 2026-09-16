# Weightless Evolution Lab V1

## Purpose

Read-only build laboratory that periodically re-runs the existing Kelo asset intelligence stack against current repository content to discover new lossless byte savings and structural dedup opportunities.

It is intentionally a discovery system, not an autonomous production rewriter.

## Owner and authority

- owner: `Kelo Creator Asset Bridge + Kelo Boot Footprint QA`
- workflow: `.github/workflows/weightless-evolution-lab.yml`
- gameplay authority: none
- runtime state: none
- repository write permission: none
- production mutation: forbidden

## Cadence

The workflow supports manual dispatch and a weekly scheduled run. Scheduled workflows become active only from the default branch.

## Discovery passes

1. deterministic Weightless core audits;
2. full asset-space snapshot;
3. strict lossless PNG search with AUTO effort;
4. byte-exact global dedup planning;
5. exact reversible tile reconstruction scan;
6. first-playable boot footprint snapshot;
7. summary + artifact publication.

## Invariants

- The workflow has `contents: read` only.
- It never commits generated candidates.
- It never changes SOURCE.
- It never promotes a delivery codec or reconstruction format.
- A smaller candidate still needs the existing quality/provenance/device gates before production use.
- Scheduled discovery does not imply that a candidate is safe or beneficial on iPhone.

## Outputs

The artifact contains the measurement reports from the current revision. The Actions summary exposes lossless saving opportunity, shared-blob opportunity, exact reconstruction opportunity and current first-playable footprint.

## Relationship to other systems

- `Asset Bit Ratchet` prevents historical regression.
- `Asset Global Dedup` discovers shared physical payloads.
- `Exact Reconstruction Lab` discovers repeated reversible structure.
- `PNG Space Compiler` searches smaller exact PNG representations.
- `Boot Footprint Ratchet` protects the first-playable path.
- `KELO_ATLAS_CONTRACT` remains runtime lifecycle authority for resident atlas working set.

## Promotion path

```text
scheduled discovery
  -> candidate evidence
  -> deterministic quality/conformance proof
  -> independent validation
  -> device proof where runtime delivery changes
  -> explicit production change / PR
```

## Anti-patterns

- Do not grant write permission merely to make the lab "self improving".
- Do not auto-merge generated binary rewrites.
- Do not treat theoretical raw-RGBA savings as network savings.
- Do not bypass iPhone proof for a custom runtime format.
