# Terrain rebuild loop on desktop

BUG: BUG-0005
FECHA: 2026-09-15
VERSION / BUILD: V6.69 / 307850e1, local cache candidate
ESTADO: vigente

## Reproduction and observations

Run Chromium at 1440x900, start a new guest, leave the camera stationary, sample `KELO_WORLD_AUDIT` five seconds apart. Repeat after `KeloCamera.setBaseZoom(.7)`. Inspect `KELO_SURFACE_GROUND_AUDIT.lastDrawnTiles` too.

Before the candidate, the legacy world built/evicted 972 chunks in five seconds at default zoom and 1323 at zoom .7 in the second measured run. Surface ground drew 7680 individual tiles per frame with a full 16-chunk cache. This is repeatable cache thrashing, not a speculative explanation inferred from a slow screenshot.

Two ground paths were doing work. The initial reset flag skips acquisition of the legacy terrain atlases; the environment layer stack then clears the flag. The legacy renderer still built transparent chunks and acquired Gardens underneath the opaque surface ground. Surface ground independently used a fixed 16-slot FIFO and `window.CONFIG` / `window.camera` fallbacks, although these globals are lexical and KeloCamera owns the real view. The legacy renderer also converted the mobile cull margin 0 into 1 through `|| 1`.

## Candidate and evidence

Reuse existing owners: world-map skips legacy terrain work when its terrain atlases were not initialized; surface-ground uses KeloCamera.worldView, no offscreen margin, true LRU, and the device performance contract. The contract keeps mobile at 24 slots and sets a bounded desktop cap of 64: the current 3600x3200 world has at most 8x7=56 chunks. This does not allocate 64 canvases at boot; only requested visible chunks allocate.

| Device / zoom | World builds / evictions during 5s idle | Surface builds during 5s idle | Resident surface chunks |
|---|---|---|---|
| Desktop default | 0 / 0 | 0 | 20 |
| Desktop .7 | 0 / 0 | 0 | 30 |
| iPhone Chromium default | 0 / 0 | 0 | 4 |
| iPhone Chromium .7 | 0 / 0 | 0 | 8 |

Surface tiles drawn per steady frame: 0 in all four cases. Mobile margin is now 0. Playwright boot + move8s/rest10s/resume4s passes on desktop Chromium, iPhone Chromium and iPhone WebKit, including unchanged cache counters during the last eight seconds of the rest. Local Windows runs: 23.9s, 24.5s and 25.3s respectively; these are whole-test durations, not load times.

Regression coverage is in `tests/freeze-stability.spec.js` (including zoom) and `scripts/validate-mobile-performance-contract.mjs` (mobile, low-memory mobile, desktop budget behavior).

Pending: full feature matrix, visual comparison at all zooms/orientations, long-session resource measurements, deployed build and physical iPhone verification. A repeatable desktop performance defect is established; this alone does not close the original physical iPhone/World Editor report BUG-0003.

The expanded matrix subsequently passed all 30 cases (13.9 minutes): zoom, Mounts, Bag, Market, Titles readiness, Appearance, Properties, Nobility, Abilities and actual PvP entry/exit across desktop Chromium / iPhone Chromium / iPhone WebKit. Together with the three earlier boot cases, 33 local cycles passed before restoring the chat UI. Titles' panel interactions and deeper gameplay operations are not covered by that result.
