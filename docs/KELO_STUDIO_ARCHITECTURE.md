# KELO STUDIO — Foundation Architecture v1

**Status:** integration-ready foundation; not wired into LIVE automatically.

## Purpose
Kelo Studio is the authoring layer for parcels, world maps, dungeons and future game modes. It must reuse Kelo World runtime contracts rather than create a second game engine.

## Architectural laws
1. Studio describes gameplay; it does not reimplement gameplay.
2. Every persistent authoring mutation goes through a Command.
3. The readable source of truth is `WorldDocument`; runtime may consume compiled projections.
4. World content is spatially indexed by the same 512px chunk concept already used by the world renderer.
5. A local edit invalidates only affected chunks.
6. Gameplay systems are reached through adapters (`KELO_WORLD_EDIT`, Property, Forge, Inventory, TileRegistry, Environment Layers).
7. Studio code is lazy. Normal gameplay must not require Studio modules.
8. No player-authored arbitrary JavaScript. Creator power comes from approved Components/Devices/Actions later.
9. No new `*-hotfix.js` architecture. Fix ownership at the responsible module.
10. Public APIs stay small and files declare what they own and do not own.

## Foundation modules
```text
src/studio/
  studio-entry.mjs                lazy boot
  core/
    studio-kernel.mjs             composition root
    command-bus.mjs               mutation boundary
    history-manager.mjs           undo/redo by memory budget
    input-router.mjs              context routing
    tool-registry.mjs             extensible tools
  document/
    world-document.mjs            authoring schema v1
    document-commands.mjs         reusable entity commands
  spatial/
    spatial-chunk-index.mjs       chunk lookup
    dirty-chunk-manager.mjs       incremental invalidation
  compiler/
    world-compiler.mjs            deterministic runtime projection
  adapters/
    kelo-runtime-adapter.mjs      only legacy/current-global boundary
```

## Existing contracts we deliberately reuse
- `KELO_PROPERTY_CATALOG`: existing asset/prefab/tile templates.
- `KELO_PROPERTY_SYSTEM`: existing parcel placement and replaceable local/remote authority.
- `KELO_WORLD_EDIT`: single public world mutation/authority facade.
- `KELO_WORLD_REVISIONS`: stable IDs and immutable revision model.
- `KELO_WORLD_RENDERER`: existing 512px chunk renderer.
- `KELO_ENVIRONMENT_LAYERS`: current render phase ownership.
- `KELO_TILE_REGISTRY` / Atlas Contract: asset ownership.
- Existing Forge/Inventory/Farming systems: gameplay authority; Studio components will point to them through adapters.

## Integration rule
Do **not** add `<script src="src/studio/...">` tags to `index.html`.

When the creator explicitly opens Studio, load only the entry module:
```js
const { bootKeloStudio } = await import('./src/studio/studio-entry.mjs');
const studio = await bootKeloStudio({ mode: 'world' });
```
Parcel Builder will use the same call with `mode: 'parcel'` and a different UX shell.

## Migration from current Builder
The current Builder remains LIVE during migration. Move behavior in this order:
1. selection/drag preview -> `InputRouter` + tool;
2. create/move/rotate/remove -> reusable document Commands;
3. old 20-item undo -> `HistoryManager`;
4. full placement scans -> `SpatialChunkIndex`;
5. full collider rebuild -> incremental runtime adapter updates;
6. terrain painting -> commands + dirty chunks;
7. only after parity tests, remove wrapper/hotfix files.

## Performance contract
- Studio downloaded by normal player: 0 bytes until explicit import.
- No complete world scan on an animation frame.
- Pointer move updates preview only; commit on pointer-up.
- No server mutation stream during a drag.
- Heavy terrain/autotile/nav/validation work belongs in a Worker when introduced.
- Large Asset Browser/Outliner lists must be virtualized.
- Large drafts/autosaves move to IndexedDB; server remains canonical online.
- Runtime bundles may use compact arrays/handles while `WorldDocument` remains readable.

## Next integration slices
1. `StudioOverlayCanvas` + Select/Transform/Placement tools.
2. Adapter that projects existing published Property placements into `WorldDocument`.
3. Incremental collider adapter (replace `syncColliders()` rebuild behavior).
4. IndexedDB draft/checkpoint journal.
5. Worker compiler + dirty chunk renderer bridge.
6. Generated Inspector from ComponentRegistry.
7. PrefabRegistry + overrides/variants.
8. Terrain smart brush/autotile.
9. Visual logic/devices and debugger.
10. Dungeon/Game Mode creator UX.

## Definition of done for each slice
- no new runtime dependency;
- no duplicate gameplay system;
- unit/audit test;
- Playwright LIVE regression where visual/input behavior changes;
- mobile test before removal of legacy behavior;
- ENGINE_MAP ownership updated only when the new path actually becomes OWNER LIVE.
