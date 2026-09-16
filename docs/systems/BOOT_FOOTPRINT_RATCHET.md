# Boot Footprint Ratchet V2 — Static Dependency Closure

## Purpose

Build/CI capability under `Kelo Boot Footprint QA` that prevents the first-playable path from silently getting heavier.

V1 measured only JS/CSS named directly in `index.html` before `window.__keloBootReady=true`. V2 keeps that direct measurement and adds a deterministic static closure for local payloads referenced by those critical files: images, fonts, data, audio and binary assets, plus CSS `url(...)` and `@import` dependencies.

This matters because a 10 KB script can make mobile startup much heavier by pointing at a multi-megabyte texture without increasing the script itself.

## Owner and state

- owner: `Kelo Boot Footprint QA`
- scope: build/CI only
- runtime state owned: none
- gameplay authority: none
- source mutation: none
- player visible: no

This extends the existing owner. It does not create a loader, scheduler, renderer or runtime observer.

## Sources

- `src/build/boot-footprint-ratchet.mjs`
- `scripts/boot-footprint.mjs`
- `scripts/boot-footprint-ratchet.mjs`
- `scripts/boot-footprint-ratchet-audit.mjs`
- `.github/workflows/asset-bit-ratchet.yml`

## Measurement contract

The snapshot reads `index.html` up to the literal first-playable marker:

`window.__keloBootReady=true`

### Direct layer

It measures unique local resources declared before the marker:

- `<script src>`;
- `<link rel="stylesheet">`;
- pre-ready HTML bytes;
- missing direct resources.

### Static dependency layer

Only direct pre-ready files are scanned. The tool does not execute JavaScript.

Critical JavaScript is inspected for literal local payload paths ending in supported image/font/data/audio/binary extensions. Critical CSS is inspected for `url(...)` and follows local `@import` styles recursively. Existing local files are added once to the closure and record every direct file that referenced them.

Files reached only through scripts loaded after `boot-ready` remain outside the closure. Dynamic string construction cannot be proven statically and is intentionally not guessed.

Unresolved dependency-looking literals are recorded as advisory `unresolvedDependencyCandidates`; unlike a missing direct `<script>`/stylesheet, they do not fail publication because they can represent optional/fallback literals.

Query/hash suffixes are stripped before lookup so cache-busting versions do not create fake resources.

## Snapshot fields

- `directResourceCount`
- `directExternalStoredBytes`
- `dependencyResourceCount`
- `dependencyStoredBytes`
- `resourceCount` — unique direct + dependency closure
- `externalStoredBytes` — stored bytes of the full closure
- `htmlPrefixBytes`
- `totalMeasuredCriticalBytes`
- `resources[]` with `via: direct|dependency` and `referencedBy[]`
- `missing[]` for direct resources
- `unresolvedDependencyCandidates[]` advisory only

Schema: `kelo-boot-footprint-v2-static-closure`.

## Ratchet rules

Head fails when the comparable static closure shows any of these without an explicit architecture change:

1. an existing direct critical resource grows;
2. an existing critical dependency grows;
3. a new direct critical resource appears;
4. a new static payload dependency appears;
5. aggregate closure bytes grow;
6. unique closure resource count grows;
7. a direct critical resource is missing;
8. pre-ready HTML grows above the explicit CI tolerance.

Removed or smaller resources are improvements.

## Public API

### `measureBootFootprint(rootDir, options)`

Returns the V2 direct + dependency byte snapshot without executing the game.

### `compareBootFootprints(base, head, options)`

Pure comparison returning pass/fail, exact regression reasons, improvements, added/removed resources and direct/dependency deltas.

## Invariants

- Never loads or mutates runtime resources.
- Never replaces `KeloModuleLoader`.
- Never follows post-ready scripts.
- Does not classify a string as a real network request; the dependency layer is a conservative static closure.
- Existing mobile runtime and `KELO_ATLAS_CONTRACT` remain the owners of actual residency/loading behavior.
- New systems should normally be lazy rather than increasing first-playable weight.
- Real iPhone behavior remains the final proof; this build gate measures repository-stored bytes, not transfer compression, parse time or GPU memory.

## Flow

```text
index prefix
  -> direct JS/CSS
       -> literal local payload references
       -> CSS url()/@import closure
  -> direct bytes + dependency bytes

base snapshot + head snapshot
  -> per-resource ratchet
  -> aggregate closure ratchet
  -> PASS / FAIL + evidence
```

## Tests

`node scripts/boot-footprint-ratchet-audit.mjs`

The deterministic corpus proves that:

- post-ready scripts and their assets are excluded;
- direct CSS `url(...)` and JS image literals are included;
- a smaller critical script passes;
- a larger critical script fails;
- adding a direct pre-ready script fails;
- adding an indirect critical asset fails;
- increasing an indirect critical asset's bytes fails.

## Observability

CI reports base/head totals plus the direct/dependency split. This lets us tell whether a regression comes from code itself or from payload pulled into the first-playable surface.

## Online-first

N/A for gameplay authority. Future CDN/content-addressed delivery can change transport without changing this repository-side comparison contract.

## Next extensions

- measure real transferred bytes from Pages responses;
- attach real iPhone Safari request/decode/draw timing;
- create a historical champion for first-playable latency;
- zone/feature first-use closure budgets;
- connect closure evidence to immutable content-addressed delivery manifests.

## Anti-patterns

- Do not move a required file after `boot-ready` merely to cheat the metric.
- Do not preload optional Studio/PvP/creator systems into boot.
- Do not create a second module loader or runtime watchdog.
- Do not claim static closure equals observed network traffic.
