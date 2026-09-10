# Kelo Map Forge Lab — Persistent State

## Resume point

- Current cycle: **01 — PAVING_BLOB hard rejection**.
- Phase: **implemented locally; LIVE verification pending**.
- Baseline commit verified in LIVE: `05cb1e2b8f78a83d44fa794a984167c17f9f7eb8`.
- LIVE URL: `https://kelffren.github.io/gemini/?mapEditor=1&offline=1`.
- LIVE title at baseline: `Kelo World — V6.54`.
- Generator baseline: `1.0.0`; candidate version under test: `1.1.0`.
- Baseline screenshot: `map-forge-cycle-01-before-seed-68-desktop.jpg` (external test artifact; not stored in Git).

## Active result

Random stone fill (`72%` per terrain cell in plaza/royal/commerce) has been replaced by connected semantic paving plans. Every planned stone cell identifies its plan, district and purpose. Validation now rejects `paving_intent_missing` and `paving_blob_excessive`; therefore `generateBestOf()` cannot select those candidates.

Across seeds `1..100` for each current recipe:

| Recipe | Baseline largest component | Candidate largest component | Change |
|---|---:|---:|---:|
| Royal Capital | 22.36% average; 35.71% max | 2.42% average; 4.17% max | -89.2% average |
| Village | 20.29% average; 31.94% max | 6.03% average; 8.33% max | -70.3% average |
| Forest | 0% | 0% | unchanged |

Canary Royal Capital seed `68` moves from `60/168` connected stone cells (`35.71%`) to `4/168` (`2.38%`).

## Owners confirmed

- Generation: `src/world/map-forge/map-forge-core.mjs` + builder/recipes/quality.
- Preview/import projection: `src/studio/adapters/map-forge-draft-importer.mjs`.
- Preview renderer: `KELO_WORLD_BUILDER.renderSnapshotPreview()`.
- Real asset templates: `KELO_PROPERTY_CATALOG`.
- Ground/tiles: `KELO_TILE_REGISTRY` + `KELO_ATLAS_CONTRACT`.
- Exterior draft authority: `KELO_WORLD_EDIT`.
- Camera: `KeloCamera`.

## Known defects and next hypothesis

1. `PROP_REPETITION` / `ASSET_SCALE_WRONG`: semantic `market_prop` currently resolves to the first market rule, `imperial:kiosco` (160×160), so ordinary decoration becomes repeated architecture. This is the next highest-impact hypothesis.
2. `ASSET_UNUSED`: Map Forge emits `rock`, `crate` and `barrel`, plus castle/barn landmarks, but the current semantic resolver has no reliable active catalog match for them.
3. `ASSET_VARIETY_LOW`: tree/lamp/fountain rules list variants but deterministic resolution always chooses the first available ID.
4. `BAD_TRANSITION`: no approved active marble/path atlas equivalent to `surfaceGround`; World Builder owns the centralized fallback.
5. Settlemaker: no request, endpoint or provenance enum exists in the current repository path. Current generation is local; it must not be labelled `REMOTE_SETTLEMAKER`.

## Objective blockers

- Candidate commit, GitHub Pages deployment and exact 390×844 / 1440×900 after-captures are still pending for cycle 01.
- Do not mark cycle 01 `ACCEPTED` until the deployed generator reports `1.1.0` and seed `68` is inspected in preview and exterior.
- Pre-existing regression at the baseline commit: `scripts/map-forge-block-overlap-audit.mjs` reports 70 Royal Capital near-touching pairs because its 24 px effective separation rule is stricter than the builder's 14 px rejection pad. The cycle-01 terrain change does not alter this count; track it separately instead of attributing it to semantic paving.

## Performance and holdout

- Alternating benchmark, 1,000 seeds per recipe: p95 generation changed `+1.6%` Royal Capital, `+0.5%` Village and `-2.0%` Forest, all within the 5% budget.
- Holdout generation 1: 30/30 valid, zero paving hard gates; maximum connected paving ratio `2.38%` Royal, `8.33%` Village and `0%` Forest.

## Next execution

1. Read this file and the three JSON ledgers in this directory.
2. Confirm the deployed commit/version before generating anything.
3. Finish cycle 01 LIVE comparison and update its status.
4. Start cycle 02 with the fixed canary/development sets and isolate the `market_prop → imperial:kiosco` repetition/scale defect.
