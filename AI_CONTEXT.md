# AI_CONTEXT.md — Kelo World Fast Context

> **Purpose:** this is the smallest reliable entry point for a fresh AI session. Read this file first, then open only the owner/docs listed for the task. It is a navigation index, not a second source of truth.

## 30-second model

Kelo World is a mobile-first 2D top-down MMORPG/social RPG. The current browser runtime is modular and lazy-loaded. **Do not infer LIVE status from a file existing.** `index.html` + current Foundation owners are runtime truth.

Non-negotiables:
- ONLINE-FIRST.
- One responsibility = one owner.
- Extend owners; do not create parallel engines/managers/renderers.
- Heavy creator/gameplay modules stay out of plaza boot and load on demand.
- Kelo operates from iPhone; changes must preserve mobile operation.
- For boot/UI/runtime changes, obey the Playwright iPhone gate in `AGENTS.md`.
- If this file disagrees with LIVE code, fix this file in the same pass.

## Read order

1. `AI_CONTEXT.md` (this file)
2. `AGENTS.md` — repository laws + mandatory QA
3. `ENGINE_MAP.md` — runtime owners and boot
4. Task-specific owner/doc from the table below
5. Only then search implementation files

Canonical deeper docs:
- `docs/KELO_FOUNDATION.md`
- `docs/ONLINE_FIRST.md`
- `docs/CODE_INDEX.md`
- `docs/GAME_STATE_CURRENT.md`
- `docs/ARCHITECTURE_CURRENT.md`
- `docs/FEATURE_MATRIX.md`
- `docs/DOCUMENTATION_INDEX.md`

## Task → owner → first files

| Intent / search words | Owner | Start here |
|---|---|---|
| boot, loading, 4G, freeze, black screen, preload | module loader / performance owners | `ENGINE_MAP.md`, `index.html`, search `KELO_MODULE_LOADER`, `KELO_PERF` |
| input, joystick, movement lock | KeloInput / KeloInputLocks / KeloMovement | `src/core/`, then exact owner symbol |
| camera, viewport, zoom | KeloCamera | search `KeloCamera`; never write camera ad-hoc |
| collision | KELO_COLLISION | search exact owner; never mutate `obstacles` from a feature |
| avatar/render | KeloAvatar / KeloRender | `ENGINE_MAP.md`, exact owner |
| world/map/props | world-map + contracts | `src/environment/world-map.js`, `KELO_PROP_CONTRACT` |
| asset, atlas, tileset | KELO_ATLAS_CONTRACT / KELO_PROPERTY_CATALOG | `docs/ASSET_CONTRACT.md`, `src/creators/assets/`, `src/property/` |
| asset library, external providers | Kelo Universal Content | `src/creators/assets/`, search `external-asset-providers` |
| complete scene, prefab, Tiled, LDtk | Universal Content → Studio prefabStamp | `src/creators/assets/content-integration-router.mjs`, `src/creators/assets/personal-content-runtime-bridge.mjs`, `src/studio/integration/library-build-bridge.mjs` |
| Studio, World Editor, placement | Studio Kernel / KELO_WORLD_EDIT | `src/studio/`, `src/creators/workspaces/world-workspace.mjs` |
| map generation | KeloMapForge | search `KeloMapForge` |
| sprite compiler | Asset Sheet Compiler | `src/creators/assets/asset-sheet-compiler.mjs` |
| PvP, arena, hitstop, adaptive quality | KeloArena / KeloPvPAutoReducer | search exact symbols; preserve competitive truth |
| abilities | KeloAbilities | `src/creators/ability/`, gameplay ability owner |
| backpack/inventory | dedicated inventory owners | read `docs/BACKPACK_SYSTEM_MEMORY.md` first |
| visual/world art | visual owners | read `docs/VISUAL_DIRECTION_MEMORY.md` first |
| PWA/update/cache | KeloUpdater | search `KeloUpdater` |
| Supabase/server authority | authority boundary | `docs/ONLINE_FIRST.md`; server owns valuable truth |

## Current critical runtime facts

- Plaza-first boot is intentionally small.
- `__keloHoldGameLoop` gates the loop until `kelo:boot-ready`.
- Chat/PvP/Studio/backpack/heavy modules are lazy.
- Forest Plaza atlas flows: PNG → Asset Sheet Compiler → manifest → Atlas Contract → Property Catalog → Studio/World.
- Studio UI does not own world mutations; commands/authority do.
- Personal scene content already hands off through `KELO_PERSONAL_SCENES` to Studio `prefabStamp`.
- Never add a feature to normal boot merely to make it easier to access.

## Fast search protocol for an AI

When a request arrives, do not scan the whole repository.

1. Map user language to the table above.
2. Search the exact owner symbol and `KELO-INDEX` keys.
3. Read the owner file plus direct consumers only.
4. Check `index.html` / loader before claiming code is LIVE.
5. Check relevant tests.
6. Make the smallest owner-compatible change.
7. Update canonical docs when ownership/runtime truth changes.

Useful search anchors:
`KELO-INDEX`, `public-api:`, `owns:`, `does-not-own:`, `online:`, `KELO_MODULE_LOADER`, `KELO_WORLD_EDIT`, `KELO_ATLAS_CONTRACT`, `KELO_PROPERTY_CATALOG`, `KELO_PERSONAL_SCENES`.

## Fresh-session response contract

Before changing code, a fresh agent should be able to state:
- **Owner:** who owns this responsibility.
- **LIVE path:** how the feature reaches the runtime.
- **Mutation path:** command/API used to change state.
- **Online boundary:** what later becomes server-authoritative.
- **QA gate:** exact test needed before calling it fixed.

If any of these are unknown, search them before implementation.

## Maintenance rule

Keep this file compact. Do not paste implementation history here. When a new major system becomes LIVE, add one row to the routing table and, only if necessary, one current runtime fact. Historical detail belongs in system docs/git history.
