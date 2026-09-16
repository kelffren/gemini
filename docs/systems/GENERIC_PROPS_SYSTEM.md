# Generic Props System — Viewport-Scoped Asset Residency

## Purpose

`KELO_GENERIC_PROPS` renders data-driven world props from `KELO_PROP_CONTRACT` without owning image creation. Its asset residency is viewport-scoped so a logical library can be large without forcing every prop atlas into first-playable transfer or mobile memory.

## Owner

- runtime owner: `KELO_GENERIC_PROPS`
- prop definitions: `KELO_PROP_CONTRACT`
- image lifecycle authority: `KELO_ATLAS_CONTRACT`
- camera/view authority: `KeloCamera`
- collision lifecycle: `KELO_COLLISION`
- draw phase authority: `KELO_ENVIRONMENT_LAYERS`

This system does not create a second loader, renderer, camera, cache, collision owner or image factory.

## Sources

- `src/environment/generic-props.js`
- `src/environment/prop-contract.js`
- `src/environment/atlas-contract.js`
- `src/core/camera-system.js`

## State owned

`KELO_GENERIC_PROPS` owns only local references required to draw currently wanted prop assets:

- wanted asset IDs;
- held atlas references;
- loading promises;
- ready image references;
- failed asset IDs;
- residency counters/observability.

It does **not** own image objects globally. `KELO_ATLAS_CONTRACT` owns creation, refcounts and eviction.

## Public API

`window.KELO_GENERIC_PROPS` exposes:

- `drawInstances(ctx, props, track, allowDuringReset)`;
- `isAssetReady(id)`;
- `syncResidency()` — force a viewport residency reconciliation;
- `residencySnapshot()` — immutable diagnostic snapshot;
- `ready` — initial visible-residency readiness.

## Residency policy

Every prop asset is registered with `KELO_ATLAS_CONTRACT`, but registration does not imply network fetch.

The runtime computes the current world viewport through `KeloCamera.worldView()` and expands it by a 128 world-pixel prefetch margin. Only assets referenced by props whose visual bounds overlap that region are wanted.

Wanted assets are acquired through `KELO_ATLAS_CONTRACT.acquire(id)`. When an asset leaves the wanted set, the local image reference is dropped and `KELO_ATLAS_CONTRACT.release(id)` is called. Atlas Contract then applies its existing role-specific warm cache and eviction policy.

If camera geometry is unavailable, the safe fallback is to want all registered prop assets rather than risk hiding required content.

## First-playable behavior

At boot:

1. all logical prop assets are registered;
2. the initial viewport is measured;
3. only assets needed by the initial viewport plus prefetch margin are acquired;
4. `audit.ready` becomes true after those initial requests settle;
5. offscreen assets do not block first-playable readiness.

This preserves visual completeness for the initial view while eliminating speculative fetches for distant props.

## Drawing

Rendering remains data-driven. `drawBack` and `drawFront` filter prop instances against the current viewport with a small draw margin before issuing Canvas draw calls. Occlusion and actor redraw behavior remain unchanged for visible props.

## Events

Residency is reconciled on normal drawing and also when:

- `kelo:viewportchange` fires;
- `kelo:camerazoomchange` fires.

There is no polling timer or watchdog.

## Authority and persistence

This is local presentation only. It has no gameplay/server authority and persists no player data.

## Invariants

- Never instantiate `Image` directly here.
- Never acquire every prop asset merely because it exists in the contract.
- Never change source pixels, source rectangles, prop IDs or placement geometry to reduce boot weight.
- Never mutate collision state outside `KELO_COLLISION`.
- Never write camera state; only read `KeloCamera.worldView()`.
- Never replace Atlas Contract warm eviction with a second cache.
- Offscreen asset eviction must not delete canonical SOURCE or authoring assets.

## Observability

`window.KELO_GENERIC_PROP_AUDIT` reports:

- `wantedAssetCount`;
- `residentAssetCount`;
- `heldAssetCount`;
- `loadingAssetCount`;
- `failedAssetCount`;
- `initialWantedAssetCount`;
- `acquireCount` / `releaseCount`;
- asset ID lists for wanted/resident/loading/failed;
- prefetch and resync policy values.

`Kelo Weightless Stack` independently measures actual browser transfer before `kelo:boot-ready`; the runtime audit is not allowed to claim byte savings by itself.

## Tests / CI

- Main Stability Gate exercises the exact PR build on a mobile Chromium viewport.
- Kelo Weightless V3 performs repeated observed-transfer measurement against the exact merge base.
- Static Weightless V2 still provides the conservative dependency closure.

A residency change is successful only when gameplay/visual smoke remains green and observed first-playable transfer does not regress.

## Extension points

Future work may add district-aware priority, first-use budgets or content-addressed delivery identities, but those must extend `KELO_ATLAS_CONTRACT` / existing owners rather than add another image loader.

If the initial viewport genuinely needs a very large multi-frame atlas, the next optimization should be an exact DELIVERY subset/micro-atlas with proven sourceRect remapping and pixel equivalence; do not downscale SOURCE as a shortcut.

## Anti-patterns

- eager `for every asset -> acquire()` at module boot;
- hidden `new Image()` in a prop renderer;
- removing required initial props merely to improve a boot metric;
- lossy downscaling presented as lossless optimization;
- timer-based camera polling;
- keeping offscreen optional atlases permanently referenced.

## Checklist for changes

1. Keep `KELO_PROP_CONTRACT` definitions stable unless content itself changes.
2. Use `KeloCamera.worldView()` for spatial demand.
3. Use Atlas Contract `register/acquire/release` only.
4. Preserve collision/layer ownership.
5. Run Weightless observed-transfer CI.
6. Run Main Stability mobile smoke.
7. Inspect residency audit for leaks or unbounded resident growth.
