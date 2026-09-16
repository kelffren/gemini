# Boot Footprint Ratchet V1

## Purpose

Build/CI capability that measures the static JS/CSS path required before `window.__keloBootReady=true` and prevents silent first-playable weight growth.

Kelo World is mobile-first and Safari iOS runs the game and script parsing on one main thread. The critical path should therefore stay small while optional systems continue to enter through `KeloModuleLoader` after the plaza becomes playable.

## Owner and state

- owner: `Kelo Boot Footprint QA`
- scope: build/CI only
- runtime state owned: none
- gameplay authority: none
- source mutation: none
- player visible: no

No current runtime owner measures historical pre-ready bytes, so this is a new QA capability rather than a second loader or scheduler.

## Sources

- `src/build/boot-footprint-ratchet.mjs`
- `scripts/boot-footprint.mjs`
- `scripts/boot-footprint-ratchet.mjs`
- `scripts/boot-footprint-ratchet-audit.mjs`
- `.github/workflows/asset-bit-ratchet.yml`

## Measurement contract

The snapshot reads `index.html` up to the literal first-playable marker:

`window.__keloBootReady=true`

Within that prefix it measures unique local:

- `<script src>` resources;
- stylesheet `<link rel="stylesheet">` resources;
- HTML prefix bytes;
- missing critical resources.

Query/hash suffixes are stripped before file lookup so version bumps do not create fake new resources.

Files referenced after the marker are intentionally excluded because they are not part of the static first-playable path.

## Ratchet rules

A head revision fails when:

1. an existing critical resource grows in stored bytes;
2. a new critical JS/CSS resource is added before boot-ready;
3. aggregate critical external bytes grow;
4. unique critical resource count grows;
5. a referenced critical resource is missing;
6. pre-ready HTML grows beyond the explicit small tolerance used by CI.

Removed or smaller critical resources are improvements.

## Public API

### `measureBootFootprint(rootDir, options)`

Returns the critical resource list and byte snapshot.

### `compareBootFootprints(base, head, options)`

Pure comparison returning pass/fail, regressions, improvements, added/removed resources and aggregate deltas.

## Invariants

- The ratchet never loads or changes runtime resources.
- It does not replace `KeloModuleLoader`.
- Lazy modules remain outside the first-playable measurement.
- New player-facing systems should normally be lazy rather than increasing boot.
- A necessary exception must be explicit architecture work, not an unnoticed byte increase.
- Runtime iPhone behavior remains the ultimate performance proof; this gate measures repository-stored critical bytes, not parse/execute time or network compression.

## Flow

```text
base index + files -> boot snapshot
head index + files -> boot snapshot
        base + head -> footprint ratchet
                     -> per-resource byte comparison
                     -> aggregate byte/count comparison
                     -> PASS / FAIL + artifact
```

## Online-first

N/A for authority. Future CDN or content-addressed delivery can change how a critical resource is fetched without changing the conceptual first-playable budget.

## Tests

`node scripts/boot-footprint-ratchet-audit.mjs`

The deterministic corpus proves that:

- resources after boot-ready are excluded;
- a smaller critical script passes;
- a larger critical script fails;
- adding a new critical script fails.

## Observability

CI reports:

- base/head critical external bytes;
- base/head critical resource count;
- per-resource savings;
- HTML-prefix delta;
- exact regression reasons.

## Extension points

- add measured transfer bytes from real Pages responses;
- attach iPhone parse/compile/execute timing;
- include critical image fetches proven to occur before first playable;
- zone-specific first-use budgets;
- historical champion records for device-measured first-playable latency.

## Anti-patterns

- Do not move a required runtime file after the marker just to cheat the metric if gameplay needs it before ready.
- Do not preload optional Studio/PvP/creator systems into boot.
- Do not create a second module loader.
- Do not claim this static byte gate alone proves mobile performance.
