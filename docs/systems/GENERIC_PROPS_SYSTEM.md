# Generic Props System — Viewport-Scoped Asset Residency

## Purpose

`KELO_GENERIC_PROPS` renders data-driven world props from `KELO_PROP_CONTRACT` without owning image creation. Asset residency is viewport-scoped so a large logical prop library does not imply a large first-playable transfer or permanent mobile working set.

## Owner

- runtime owner: `KELO_GENERIC_PROPS`
- prop definitions: `KELO_PROP_CONTRACT`
- image lifecycle authority: `KELO_ATLAS_CONTRACT`
- camera/view authority: `KeloCamera`
- collision lifecycle: `KELO_COLLISION`
- draw phase authority: `KELO_ENVIRONMENT_LAYERS`

No second loader, renderer, camera, cache, collision owner or image factory is introduced.

## Sources

- `src/environment/generic-props.js`
- `src/environment/prop-contract.js`
- `src/environment/atlas-contract.js`
- `src/core/camera-system.js`

## State owned

`KELO_GENERIC_PROPS` owns only local references needed to draw currently wanted prop assets: wanted IDs, held Atlas Contract references, in-flight acquire promises and ready images. Image creation, refcounts and warm eviction remain owned by `KELO_ATLAS_CONTRACT`.

## Public API

`window.KELO_GENERIC_PROPS` exposes:

- `drawInstances(ctx, props, track, allowDuringReset)`;
- `isAssetReady(id)`;
- `syncResidency()`;
- `residencySnapshot()`;
- `ready`.

## Residency policy

Every logical prop asset is registered with `KELO_ATLAS_CONTRACT`; registration alone does not fetch it.

Spatial demand comes only from `KeloCamera.worldView()` and each prop's visual bounds.

- **Before `window.__keloBootReady === true`: prefetch margin is 0.** Only assets intersecting the actual first viewport are wanted.
- **After boot-ready: prefetch margin is 128 world pixels.** Nearby offscreen props are acquired early enough for movement without charging speculative assets to first-playable transfer.

Wanted assets use `KELO_ATLAS_CONTRACT.acquire(id)`. Assets leaving the wanted set release their local reference through `KELO_ATLAS_CONTRACT.release(id)`, after which the existing Atlas Contract warm-cache policy decides physical eviction.

If camera geometry is unavailable, the conservative fallback remains all registered prop assets rather than silently hiding content.

## First-playable behavior

At boot:

1. register all logical prop assets;
2. read the exact initial camera viewport;
3. acquire only prop assets whose bounds intersect that viewport;
4. mark generic props ready after those initial requests settle;
5. leave non-visible prop atlases unfetched until post-boot spatial demand.

This preserves every pixel required by the initial viewport while preventing a nearby-but-offscreen atlas from entering preboot only because of speculative prefetch.

## Drawing and movement

Draw phases, occlusion and actor redraw semantics remain data-driven and unchanged. During normal draw and on `kelo:viewportchange` / `kelo:camerazoomchange`, residency is reconciled. There is no polling watchdog.

## Authority and persistence

This is local presentation only. It has no gameplay/server authority and persists no player data.

## Invariants

- Never instantiate `Image` directly here.
- Never eager-acquire all prop assets merely because they exist.
- Never alter source pixels, source rectangles, prop IDs or placement geometry to improve a byte metric.
- Never mutate collision state outside `KELO_COLLISION`.
- Never write camera state; only read `KeloCamera.worldView()`.
- Never replace Atlas Contract refcount/warm eviction with another cache.
- Offscreen eviction never deletes canonical SOURCE/authoring assets.

## Observability

`window.KELO_GENERIC_PROP_AUDIT` exposes initial/wanted/resident asset counts, acquire/release counters and wanted IDs. `residencySnapshot()` exposes wanted/resident/held IDs for runtime diagnosis.

The runtime audit is not allowed to claim byte savings by itself. `Kelo Weightless Stack` independently measures actual browser transfer before `boot-ready` over repeated mobile runs.

## Tests / CI

- Main Stability Gate exercises the exact PR build on mobile Chromium.
- Weightless V3 measures repeated observed preboot transfer against the exact merge base.
- Weightless V2 remains the conservative static closure.

A residency change is accepted only when gameplay/mobile smoke remains healthy and first-playable bytes do not regress.

## Extension points

If an asset is genuinely visible in the initial viewport but its source atlas contains many unused frames, the next optimization is an exact DELIVERY micro-atlas/subset with proven sourceRect remapping and pixel equivalence. Do not downscale SOURCE as a shortcut.

## Anti-patterns

- eager `for every asset -> acquire()` during boot;
- hidden `new Image()` in the prop renderer;
- preboot speculative margin;
- removing visible props merely to improve a metric;
- lossy downscaling presented as lossless optimization;
- timer-based camera polling;
- permanently retaining offscreen optional atlases.
