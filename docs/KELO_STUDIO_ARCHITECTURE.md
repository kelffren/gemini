# KELO STUDIO — Foundation Architecture v1.1

**Status:** integration-ready foundation; intentionally not wired into LIVE automatically.

## Purpose
Kelo Studio is the authoring layer for parcels, world maps, dungeons and future game modes. It reuses Kelo World runtime contracts instead of creating a second game engine.

## Architectural laws
1. Studio describes gameplay; it does not reimplement gameplay.
2. Every persistent authoring mutation goes through a Command.
3. The readable source of truth is `WorldDocument`; runtime may consume compiled projections.
4. World content is spatially indexed by the same 512px chunk concept already used by the world renderer.
5. A local edit invalidates only affected chunks.
6. Gameplay systems are reached through adapters (`KELO_WORLD_EDIT`, Property, Forge, Inventory, TileRegistry, Environment Layers).
7. Studio code is lazy. Normal gameplay must not require Studio modules.
8. No player-authored arbitrary JavaScript. Creator power comes from approved Components/Devices/Actions.
9. No new `*-hotfix.js` architecture. Fix ownership at the responsible module.
10. Public APIs stay small and files declare what they own and do not own.

## Foundation
```text
src/studio/
  studio-entry.mjs
  core/
    studio-kernel.mjs
    command-bus.mjs
    history-manager.mjs
    input-router.mjs
    selection-manager.mjs
    tool-registry.mjs
  document/
    world-document.mjs
    document-commands.mjs
  entities/
    component-registry.mjs
    prefab-registry.mjs
  spatial/
    spatial-chunk-index.mjs
    dirty-chunk-manager.mjs
  compiler/
    world-compiler.mjs
    worker-client.mjs
    studio-worker.mjs
  adapters/
    kelo-runtime-adapter.mjs
```

## Existing contracts deliberately reused
- `KELO_PROPERTY_CATALOG`: existing assets/prefabs/tiles.
- `KELO_PROPERTY_SYSTEM`: existing parcel placement/local-remote authority.
- `KELO_WORLD_EDIT`: single public world editing authority facade.
- `KELO_WORLD_REVISIONS`: stable IDs and immutable published revisions.
- `KELO_WORLD_RENDERER`: existing 512px chunk renderer.
- `KELO_ENVIRONMENT_LAYERS`: current render phase ownership.
- `KELO_TILE_REGISTRY` / Atlas Contract: existing asset ownership.
- Forge/Inventory/Farming runtime systems: remain gameplay authorities; Studio Components reference them through adapters.

## Lazy integration
Do **not** add Studio script tags to `index.html`.
```js
const { bootKeloStudio } = await import('./src/studio/studio-entry.mjs');
const studio = await bootKeloStudio({ mode: 'world' });
```
Parcel Builder uses the same entry with `mode: 'parcel'` and a simpler UX shell.

## Authoring flow
```text
UI -> Tool -> CommandBus -> WorldDocument
                     |-> History
                     |-> SpatialChunkIndex
                     |-> DirtyChunkManager
                     `-> Compiler / Worker -> Runtime patch
```
Dragging is preview-only. A mutation commits on pointer-up. Online authority is called at the persistence/command adapter boundary, not on every pointermove.

## Component / Prefab rule
A Chest, Forge, Garden or Dungeon Spawner is not a special Studio engine. It is a prefab composed from registered components. Prefab instances store only IDs + transform + meaningful overrides. New creator behavior is added by registering reusable capabilities, never by adding `if (asset === ...)` logic to the editor.

## Migration from current Builder
The current Builder remains LIVE during migration:
1. selection/drag preview -> `InputRouter` + Tool;
2. create/move/rotate/remove -> document Commands;
3. old 20-item undo -> `HistoryManager`;
4. full placement scans -> `SpatialChunkIndex`;
5. full collider rebuild -> incremental runtime adapter;
6. terrain painting -> Commands + DirtyChunkManager;
7. only after parity tests, remove wrapper/hotfix files.

## Performance contract
- Studio JS is absent from normal `index.html` boot.
- No whole-world scan during an animation frame.
- No full snapshot or server writes during drag.
- Only dirty chunks are recompiled/re-rendered.
- Compiler has a Worker client with deterministic synchronous fallback.
- Large Asset Browser/Outliner collections must be virtualized.
- Large drafts/checkpoints belong in IndexedDB; server remains canonical online.
- Runtime representation may be compact while `WorldDocument` remains readable.

## Next integration slices
1. Studio Overlay Canvas + Select/Transform/Placement tools.
2. Import existing published Property placements into `WorldDocument`.
3. Incremental collider adapter replacing Property `syncColliders()` rebuild.
4. IndexedDB command journal/checkpoints and recovery.
5. Dirty-chunk renderer bridge / ImageBitmap cache where measurement justifies it.
6. Inspector generated from `ComponentRegistry` schemas.
7. Prefab overrides/variants + asset browser virtualization.
8. Smart terrain/autotile/path tools in Worker.
9. Visual Devices/Logic Graph + debugger.
10. Dungeon/Game Mode creator UX and publish validation.

## Definition of done per slice
- no new runtime dependency;
- no duplicated gameplay system;
- functional audit;
- Playwright LIVE regression for visual/input changes;
- mobile validation before legacy removal;
- `ENGINE_MAP` ownership changes only once the new path is actually OWNER LIVE.
