# KELO STUDIO — Foundation Architecture v1.3

**Status:** integration-ready foundation; intentionally not wired into LIVE automatically.

## Core laws
- Studio describes gameplay; runtime systems own gameplay.
- Mutations are Commands; pointer dragging is preview-only until release.
- `WorldDocument` is readable authoring state; runtime uses deterministic compiled bundles/diffs.
- Space is indexed by the same 512px chunk concept as the current world renderer.
- Only dirty chunks are invalidated.
- Studio stays out of normal `index.html` and has no runtime dependency.
- Existing Property/WorldEdit/Tile/Atlas/Layer/Forge/Inventory contracts are reused through adapters.
- New creator behavior is Components/Prefabs/Devices, never asset-specific editor branches or hotfix files.

## Implemented foundation
```text
src/studio/
  studio-entry.mjs
  core/        kernel, command bus, history, input, selection, tool registry
  document/    versioned WorldDocument + reversible entity commands
  entities/    ComponentRegistry + PrefabRegistry inheritance/overrides
  components/  Kelo component metadata (container, forge, farming, door, spawner...)
  spatial/     512px SpatialChunkIndex + DirtyChunkManager
  compiler/    deterministic WorldCompiler + Worker + RuntimeDiff
  adapters/    current Kelo runtime, catalog prefabs, current-world importer
  storage/     IndexedDB checkpoints + command journal
  performance/ profiler + Long Task telemetry
  tools/       Select + Placement + Transform (preview then one commit)
  input/       optional PointerEvent adapter with pointer capture + rAF move coalescing
  render/      independent Studio overlay renderer/canvas
  ui/          virtual-list math + schema-driven Inspector model
```

## Reuse
Existing PropertyCatalog assets seed directly into Studio PrefabRegistry. Existing published Property/WorldEdit data can be imported read-only to `WorldDocument`. A Forge/Chest/Garden in Studio is metadata that points to runtime capabilities; Studio never embeds a second forge, inventory or farming engine.

## Lazy boot
```js
const { bootKeloStudio } = await import('./src/studio/studio-entry.mjs');
const studio = await bootKeloStudio({mode:'world'});
await studio.importCurrent();
```
Nothing under `src/studio/` is referenced by normal `index.html` yet.

## Interaction contract
```text
pointermove -> rAF-coalesced local preview -> overlay only
pointerup   -> exactly one Command -> document/history/spatial/dirty
                                  -> compiler worker
                                  -> RuntimeDiff
                                  -> authority/runtime adapters (integration slice)
```
This avoids 60 server writes/saves/collider rebuilds during a drag.

## Persistence/performance
IndexedDB stores local checkpoints + serialized command journal; server remains canonical online. Asset Browser/Outliner UI must use virtualization (the foundation includes range math). Studio profiler can track timing and Long Tasks. Static cached chunks/ImageBitmap remain an integration optimization to apply only after measuring the live renderer.

## Current LIVE migration order
1. attach separate Studio Overlay Canvas without changing the world renderer;
2. route Studio pointer input through InputRouter/Pointer adapter while gameplay is disabled by context;
3. import current snapshot and test Select/Placement/Transform parity;
4. translate committed Commands to existing `KELO_WORLD_EDIT` authority;
5. apply RuntimeDiff incrementally to render/collision instead of Property `syncColliders()` full rebuild;
6. move terrain brush/autotile to command + worker pipeline;
7. build actual visual Asset Browser/Outliner/Inspector shell using virtualization/schema model;
8. after Playwright + mobile parity, retire legacy builder wrappers/hotfixes.

## Definition of done per slice
No duplicated gameplay owner, no new runtime dependency, functional audit, Playwright regression for LIVE changes, mobile validation before legacy removal, and `ENGINE_MAP` ownership only changes when the new path truly becomes OWNER LIVE.
