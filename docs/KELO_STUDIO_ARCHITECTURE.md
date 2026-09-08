# KELO STUDIO — Foundation Architecture v1.4

**Status:** LIVE vertical slice ready for integration on Kelo Foundation V1. Studio remains lazy-loaded: normal gameplay boots only the tiny `src/ui/studio-launcher.js`; `src/studio/**` loads after an authorized `CREATE` action.

## Core laws
- Studio describes gameplay; runtime systems own gameplay.
- Persistent world edits continue through `KELO_WORLD_EDIT`; Studio never becomes a second authority.
- Mutations are Commands; pointer dragging is preview-only until release.
- `WorldDocument` is readable authoring state; runtime uses deterministic compiled bundles/diffs.
- Space is indexed by the same 512px chunk concept as the current world renderer.
- Only dirty chunks are invalidated.
- Gameplay input locking is owned by Foundation `KeloInputLocks`; Studio only acquires/releases a named token.
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
  input/       PointerEvent adapter with pointer capture + rAF move coalescing
  render/      independent Studio overlay renderer/canvas
  integration/ transactional authority mirror + LIVE controller
  ui/          virtualized creator shell + schema-driven Inspector model
```

## Reuse
Existing `KELO_PROPERTY_CATALOG` assets seed directly into Studio `PrefabRegistry`. Existing mutable Draft data is imported into `WorldDocument`. A Forge/Chest/Garden in Studio is metadata that points to runtime capabilities; Studio never embeds a second forge, inventory or farming engine.

## LIVE lazy boot
Normal `index.html` loads only:
```html
<script src="src/ui/studio-launcher.js?v=2"></script>
```
The launcher adds `CREATE` to the existing Luxe menu only when `world.edit` is allowed. On click it dynamically imports:
```js
import('./../studio/integration/live-studio-controller.mjs')
```
No module under `src/studio/` is eagerly referenced by `index.html`.

## Input ownership
Opening Studio acquires one semantic Foundation lock:
```text
KeloInputLocks.acquire('kelo-studio', ...)
```
Foundation `KeloInput` then suppresses normal movement/input intent while Studio routes creator pointer events through its internal `InputRouter`. Closing or failed startup releases the same token. Studio does not wrap `processInput`, mutate the legacy modal-lock global, or install repair/watchdog timers.

## Interaction and authority contract
```text
pointermove -> rAF-coalesced local preview -> overlay only
pointerup   -> exactly one Command
            -> local document/spatial/dirty state
            -> transactional authority mirror
            -> KELO_WORLD_EDIT request on the current Draft
```
History is committed only after authority success. If authority rejects an execute/undo/redo operation, the local document is reverted so editor state and authoritative Draft cannot silently diverge.

## Stable identity
Studio entity IDs remain stable authoring IDs. The integration mirror separately tracks the current authority `placementId`, so remove/move/undo/redo remain valid even when an authority recreates a placement with a different runtime ID.

## Persistence/performance
IndexedDB stores local checkpoints + serialized command journal for crash recovery; the authority remains canonical online. Asset Browser/Outliner range math is virtualized for large catalogs. Studio compilation can run in a Worker and spatial work is chunk-indexed.

## Migration order after this slice
1. validate CREATE/open/select/place/move/undo/redo/close on LIVE desktop + mobile;
2. apply `RuntimeDiff` incrementally to render/collision paths where measurements show value;
3. move terrain brush/autotile to command + worker pipeline;
4. expand schema-driven Inspector and creator devices;
5. only after behavioral parity, mark legacy builder wrappers DEAD and retire them individually.

## Definition of done per slice
No duplicated gameplay owner, no new core wrapper, authority remains replaceable, Foundation input ownership is reused, functional audit passes, mobile/runtime regression is checked before legacy removal, and `ENGINE_MAP` ownership changes only when a new path truly becomes OWNER LIVE.
