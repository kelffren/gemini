# Boot Footprint Ratchet V3 — Static Closure + Observed Stable Transfer

## Purpose

Build/CI capability under `Kelo Boot Footprint QA` that prevents the first-playable path from silently getting heavier.

The system uses two independent views of boot weight:

1. **V2 static closure** — conservative repository analysis of pre-ready JS/CSS and local payload literals those files can reference.
2. **V3 observed stable transfer** — repeated iPhone-sized Chromium boots record local requests that actually begin before `window.__keloBootReady=true`; only resources present before the marker in every run enter the hard-gated stable core.

V2 catches hidden dependency risk before code runs. V3 distinguishes “declared/referenced”, “consistently transferred before first playable”, and “timing-boundary traffic”. Neither changes runtime behavior.

## Owner and state

- owner: `Kelo Boot Footprint QA`
- scope: build/CI only
- runtime state owned: none
- gameplay authority: none
- source mutation: none
- player visible: no

This extends the existing owner. It does not create a loader, scheduler, renderer, service worker or runtime watchdog.

## Sources

### Static V2

- `src/build/boot-footprint-ratchet.mjs`
- `scripts/boot-footprint.mjs`
- `scripts/boot-footprint-ratchet.mjs`
- `scripts/boot-footprint-ratchet-audit.mjs`

### Observed V3

- `src/build/observed-boot-transfer-ratchet.mjs`
- `scripts/observed-boot-transfer.mjs`
- `scripts/observed-boot-transfer-ratchet.mjs`
- `scripts/observed-boot-transfer-ratchet-audit.mjs`

### CI

- `.github/workflows/asset-bit-ratchet.yml`

## V2 — static measurement contract

The static snapshot reads `index.html` up to the literal first-playable marker:

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

Unresolved dependency-looking literals are advisory `unresolvedDependencyCandidates`; unlike a missing direct script/stylesheet, they do not fail publication because they can represent optional/fallback literals.

Query/hash suffixes are stripped before lookup so cache-busting versions do not create fake resources.

### V2 snapshot fields

- `directResourceCount`
- `directExternalStoredBytes`
- `dependencyResourceCount`
- `dependencyStoredBytes`
- `resourceCount`
- `externalStoredBytes`
- `htmlPrefixBytes`
- `totalMeasuredCriticalBytes`
- `resources[]` with `via: direct|dependency` and `referencedBy[]`
- `missing[]`
- `unresolvedDependencyCandidates[]`

Schema: `kelo-boot-footprint-v2-static-closure`.

## V3 — repeated observed browser transfer

The V3 probe launches Chromium with the same mobile geometry used by the mandatory phone smoke:

- viewport `390×844`;
- DPR 2;
- touch enabled;
- iPhone Safari user-agent string;
- fresh isolated browser context per run;
- service workers blocked so a previous cache cannot hide local requests.

Before each navigation, a test-only configurable setter records the browser epoch when `window.__keloBootReady` first becomes `true`. A run keeps only same-origin `GET` requests whose request event started at or before that epoch.

For deterministic local CI servers, payload bytes come from HTTP `Content-Length`. External origins are recorded for observability but are not included in the local byte ratchet. A local pre-ready response with unknown byte length fails closed rather than being silently counted as zero.

### Stable-core rule

One browser boot is not sufficiently deterministic at a millisecond boundary. A resource can legitimately start just before the marker in one run and just after it in another without any code change.

Therefore the default probe performs **3 fresh runs per revision**:

- `stableResources`: observed before `boot-ready` in **3/3 runs**;
- `unstableResources`: observed before the marker in only a subset of runs;
- stable per-resource payload/request values use the worst observed value across runs;
- raw request/resource/payload totals and `bootReadyMs` use the median run for diagnostics.

Only the stable core is a hard monotonic byte/request gate. Boundary resources remain visible in the report and can become stable in a later revision, but they do not create a false pass/fail merely because scheduling moved them across the marker in one run.

The base commit and PR head are served from separate local ports and measured with the **same head probe, same run count and same Chromium installation**.

### V3 snapshot fields

- `runCount`
- `stableRequestCount`
- `stableResourceCount`
- `stablePayloadBytes`
- `unstableResourceCount`
- `stableResources[]`
- `unstableResources[]`
- raw median `requestCount`, `resourceCount`, `totalPayloadBytes`
- median `bootReadyMs` — advisory timing, not a hard latency gate
- `unknownLocalByteResponses`
- `resources[]` with `presenceCount`
- `runs[]` raw evidence
- `externalOrigins[]` advisory
- `pageErrors[]`

Schema: `kelo-observed-boot-transfer-v2-stable-core`.

## Ratchet rules

### Static V2 fails when

1. an existing direct critical resource grows;
2. an existing critical static dependency grows;
3. a new direct critical resource appears;
4. a new static payload dependency appears;
5. aggregate static closure bytes grow;
6. unique static closure resource count grows;
7. a direct critical resource is missing;
8. pre-ready HTML grows above the explicit CI tolerance.

### Observed V3 stable core fails when

1. a new local resource is consistently requested before `boot-ready` in every head run;
2. an existing stable pre-ready resource transfers more payload bytes;
3. an existing stable resource is requested more times;
4. aggregate stable local payload bytes grow;
5. aggregate stable local request count grows;
6. any run has a local pre-ready response with unknown byte length;
7. the observer records a page error.

A resource that appears pre-ready in only 1/3 or 2/3 runs is classified as boundary evidence, not as a hard regression or improvement.

Boot-ready elapsed time is captured but remains advisory because shared CI latency is noisy. A future real-device historical latency champion can become a separate hard gate only after enough device evidence exists.

## Public API

### `measureBootFootprint(rootDir, options)`

Returns the V2 static direct + dependency byte snapshot without executing the game.

### `compareBootFootprints(base, head, options)`

Pure V2 comparison.

### `compareObservedBootTransfers(base, head, options)`

Pure V3 comparison over normalized stable-core reports.

## Invariants

- Never mutates runtime resources.
- Never replaces `KeloModuleLoader` or `KELO_ATLAS_CONTRACT`.
- V2 never follows post-ready scripts.
- V3 records only requests that really start before the marker in each isolated browser run.
- V3 hard-gates only the repeated stable core, not one-run scheduling races.
- External-provider traffic is not treated as deterministic local payload.
- Query strings do not create fake logical resource identities in the observed report.
- V2 static closure is conservative and must not be presented as actual network traffic.
- V3 Chromium observation is stronger evidence of request timing but is still not a substitute for real Safari/iPhone decode, draw, memory or cellular transfer proof.
- Smaller bytes never justify lowering existing visual-quality, conformance or provenance gates.

## Flow

```text
V2 static:
index prefix
  -> direct JS/CSS
       -> literal local payload references
       -> CSS url()/@import closure
  -> static direct/dependency snapshot

V3 observed:
base server :4174 -> 3 fresh mobile boots -> stable base core + boundary evidence
head server :4173 -> 3 fresh mobile boots -> stable head core + boundary evidence

stable base + stable head
  -> per-resource byte/request ratchet
  -> aggregate stable payload/request ratchet
  -> PASS / FAIL + raw evidence
```

## Tests

### Static

`node scripts/boot-footprint-ratchet-audit.mjs`

Proves post-ready exclusion, direct and indirect dependency detection, direct growth rejection, new dependency rejection and dependency byte-growth rejection.

### Observed comparison

`node scripts/observed-boot-transfer-ratchet-audit.mjs`

Proves:

- a smaller stable payload passes;
- stable resource byte growth fails;
- a new stable pre-ready resource fails;
- stable duplicated request growth fails;
- unknown local byte length fails closed;
- a one-run boundary-only resource remains advisory and does not false-fail.

### Browser CI

`observed-boot-transfer` in `Kelo Weightless Stack` installs Chromium, serves head/base separately, measures each revision repeatedly with `scripts/observed-boot-transfer.mjs`, then applies the V3 stable-core ratchet.

## Observability

CI reports static direct/dependency totals and observed stable/raw totals separately. This gives five useful answers:

- how much code/style is directly in boot;
- how much local payload is statically reachable from that path;
- how much local payload is consistently requested before first playable;
- which resources sit on the timing boundary;
- whether a PR made the stable boot transfer worse.

## Online-first

N/A for gameplay authority. Future CDN/content-addressed delivery can change transport without changing the logical local resource comparison contract. A CDN transfer proof can later add compressed wire bytes without replacing this owner.

## Next extensions

- capture encoded transfer size from real Pages/CDN responses;
- attach real iPhone Safari request/decode/draw timing;
- track decoded/GPU working set at first playable;
- create a historical champion for real-device first-playable latency;
- add zone/feature first-use observed-transfer budgets;
- connect observed identities to immutable content-addressed delivery manifests.

## Anti-patterns

- Do not move a required file after `boot-ready` merely to cheat a metric.
- Do not preload optional Studio/PvP/creator systems into boot.
- Do not create a second module loader or runtime watchdog.
- Do not equate V2 static closure with observed requests.
- Do not hard-gate a resource that is only intermittently on the pre-ready side of the timing boundary.
- Do not equate local Chromium payload bytes with real Safari cellular transfer bytes.
