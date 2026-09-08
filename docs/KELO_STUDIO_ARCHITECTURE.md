# KELO STUDIO — Foundation Architecture v1.2

**Status:** integration-ready foundation; intentionally not wired into LIVE automatically.

## Purpose
Kelo Studio is the authoring layer for parcels, world maps, dungeons and future game modes. It reuses Kelo World runtime contracts instead of creating a second game engine.

## Laws
1. Studio describes gameplay; it never reimplements gameplay systems.
2. Persistent authoring mutations go through Commands.
3. `WorldDocument` is readable source-of-truth; runtime receives compiled projections.
4. Spatial work uses the existing 512px chunk concept and dirty-chunk invalidation.
5. Existing world/property/forge/inventory/tile/atlas/layer contracts are reached through adapters.
6. Studio stays absent from normal `index.html`; creator tooling is lazy-loaded.
7. Players never supply arbitrary JS; creator power is registered Components/Prefabs/Devices/Actions.
8. New capabilities go through registries, not building-specific `if/else` or hotfix files.

## Modules
```text
src/studio/
  studio-entry.mjs
  core/        kernel, commands, history, input, selection, tools
  document/    WorldDocument + reusable entity commands
  entities/    ComponentRegistry + PrefabRegistry
  components/  Kelo creator-facing component definitions
  spatial/     512px SpatialChunkIndex + DirtyChunkManager
  compiler/    deterministic compiler + worker + runtime diff
  adapters/    current Kelo contracts, catalog seeding, current-world import
  storage/     IndexedDB checkpoints + command journal
  performance/ lightweight timing + long-task observer
```

## Reuse of current code
`KELO_PROPERTY_CATALOG`, `KELO_PROPERTY_SYSTEM`, `KELO_WORLD_EDIT`, `KELO_WORLD_REVISIONS`, `KELO_WORLD_RENDERER`, `KELO_ENVIRONMENT_LAYERS`, `KELO_TILE_REGISTRY`, Atlas Contract and gameplay systems remain authorities. Studio's `KeloRuntimeAdapter` is the only compatibility boundary.

Existing PropertyCatalog assets are seeded into `PrefabRegistry`; the Studio does not create duplicate images or duplicate asset definitions. The current published world/property snapshot can be imported into `WorldDocument` without mutating LIVE.

## Lazy integration
Do not add Studio scripts to `index.html`.
```js
const { bootKeloStudio } = await import('./src/studio/studio-entry.mjs');
const studio = await bootKeloStudio({ mode: 'world' });
await studio.importCurrent();
```
Parcel Builder uses `mode:'parcel'` with the same Kernel and a simpler UX shell.

## Edit flow
```text
pointermove -> local overlay preview only
pointerup   -> Tool -> CommandBus -> WorldDocument
                                 |-> History journal
                                 |-> SpatialChunkIndex
                                 |-> DirtyChunkManager
                                 `-> Compiler Worker -> RuntimeDiff -> adapters
```
No full snapshot or network write is required during dragging.

## Persistence
IndexedDB is local crash-recovery only: checkpoints + serialized command journal. Online/server state remains canonical. The store has an in-memory fallback for tests/unsupported environments. Checkpoints use structured clone rather than large localStorage JSON blobs.

## Components
Built-in creator metadata now includes Visual, Collider, Interaction, Container, CraftingStation, GrowZone, Door, Lockable, Spawner, Permission, Persistent, AnalyticsMarker and AudioEmitter. These define editor properties only; runtime behavior remains owned by existing/future gameplay systems.

## Performance contract
- 0 Studio JS in normal `index.html` boot.
- no whole-world scan in animation-frame paths;
- 512px chunk spatial lookup;
- incremental dirty chunks and runtime bundle diffs;
- compiler Worker with deterministic synchronous fallback;
- large Asset Browser/Outliner must be virtualized when UI lands;
- static chunk caching/ImageBitmap only after measured integration tests;
- profiler exposes Studio timing and Long Task telemetry.

## Safe migration from current Builder
1. Overlay Canvas + Select/Transform/Placement tools.
2. Import current published snapshot to WorldDocument.
3. Commit placement commands back through existing authority.
4. Replace full collider rebuild with incremental runtime-diff adapter.
5. Move terrain brush/autotile to commands + worker.
6. Build generated Inspector on ComponentRegistry and virtualized Asset Browser/Outliner.
7. Only after Playwright/mobile parity, retire old builder wrappers/hotfixes.

## Definition of done for each integration slice
- no new runtime dependency;
- no duplicated gameplay owner;
- functional audit + syntax checks;
- Playwright regression for any LIVE visual/input change;
- mobile validation before legacy removal;
- `ENGINE_MAP` ownership changes only when a new path becomes OWNER LIVE.
