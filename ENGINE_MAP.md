# ENGINE_MAP — Kelo World

> Documento canónico del engine. Si contradice `index.html` o un owner Foundation LIVE, gana el runtime y este archivo debe actualizarse.

**Sincronizado:** 2026-09-15  
**Runtime declarado:** Kelo World V6.69  
**Modelo:** web 2D top-down, Canvas, mobile-first, login/guest gate antes del boot pesado.

## 1. Regla de engine

Kelo World NO debe crear un segundo engine. El runtime histórico `engine-*.js` sigue existiendo, pero las responsabilidades nuevas deben pasar por owners explícitos en `src/`. Wrappers paralelos, writers directos y sistemas duplicados se consideran deuda o bug.

Estados usados aquí: `OWNER LIVE`, `SUPPORT LIVE`, `LEGACY CORE`, `DYNAMIC LIVE`, `PREPARED`, `PENDING VERIFY`, `SERVER AUTHORITY`, `TEMPORAL STRANGLER`, `RETIRED`.

## 2. Boot real (plaza-first)

Safari iOS tiene **un solo hilo**. Si el HTML parsea trabajo no necesario antes del primer frame, el canvas puede congelarse aunque ese trabajo no tenga bugs.

Contrato LIVE/candidato (`index.html` V6.69):

1. Flag `__keloHoldGameLoop=true` antes de `engine-b`.
2. `KeloStateStore` normaliza/versiona el save legacy antes de cargar `engine-a`; un save migrado recibe backup previo y campos desconocidos se preservan.
3. Plaza crítica: events → input locks/profile/bootstrap → collision → state migrator → `engine-a` → player state/position → input/movement → `engine-b/c` → cámara → strangler de transiciones legacy → avatar/render/simulation → world-map/props → HUD/governor.
4. `engine-b` y `KELO_PERF` no piden rAF hasta `kelo:boot-ready`.
5. Tras el último owner necesario para ver/caminar: `__keloBootReady=true` + evento `kelo:boot-ready`.
6. `KELO_FEATURE_REGISTRY` + `KELO_ASSET_REGISTRY` + `KELO_MODULE_LOADER` son los únicos tres scripts estáticos permitidos después de boot-ready.
7. `controlPlane` y `observability` usan policy `after-paint`: cruzan dos `requestAnimationFrame` antes de cargar para no retrasar el primer paint.
8. `controlPlane` contiene asset library launcher, settings gate, updater, admin/account gates y creators gate. `observability` contiene farm/player-position shadows. Son internos (`userToggle:false`) y no aparecen como packs apagables en Asset Library.
9. Features first-use (`social`, `world`, `bag`, `mounts`, `market`, `titles`, `appearance`, `properties`) siguen entrando únicamente por `KELO_MODULE_LOADER.ensure(feature)`.
10. El presupuesto CI actual es **≤49 scripts externos antes de boot-ready** y **≤3 scripts externos estáticos después**. Subir esos números requiere evidencia y cambio explícito del contrato, no crecimiento accidental.
11. `engine-i.js` fue retirado: estaba vacío y no tenía consumidores válidos.
12. Prohibido inyectar `<script>` desde features por fuera de `KeloModuleLoader`.

El listado histórico de boot completo NO es el boot móvil. Restaurar tags pesados en `index.html` es un bug.

## 3. Owners de Foundation

| Capacidad | Owner | Estado |
|---|---|---|
| Persistencia legacy pre-boot | `KeloStateStore` | OWNER LIVE / transitional |
| Input locks | `KeloInputLocks` | OWNER LIVE |
| Input pipeline | `KeloInput` | OWNER LIVE / transitional |
| Movement extensions | `KeloMovement` | OWNER LIVE / transitional |
| Posición discontinua | `KeloPlayerPosition` | OWNER LIVE / transitional |
| Viajes legacy plot/farm | `KeloLegacyTransitionBridge` | TEMPORAL STRANGLER |
| Feature lifecycle first-use/after-paint | `KeloModuleLoader` | OWNER LIVE |
| Feature metadata/policies | `KELO_FEATURE_REGISTRY` | OWNER LIVE |
| User-toggleable optional packs | `KELO_ASSET_REGISTRY` | OWNER LIVE |
| Física/movimiento continuo base | `engine-a.js` | LEGACY CORE |
| UI/gameplay histórico base | `engine-b.js` | LEGACY CORE |
| Social/render/simulation bridge histórico | `engine-c.js` | LEGACY CORE |
| `engine-i.js` | — | RETIRED |
| Colisiones | `KELO_COLLISION` | OWNER LIVE |
| Cámara/viewport/zoom | `KeloCamera` | OWNER LIVE |
| Avatar composition | `KeloAvatar` | OWNER LIVE |
| Render extensions | `KeloRender` | OWNER LIVE |
| Simulation extensions | `KeloSimulation` | OWNER LIVE |
| Eventos | `KeloEvents` | OWNER LIVE |
| Menú principal | `KELO_LUXE` | OWNER LIVE |
| Assets/atlas | `KELO_ATLAS_CONTRACT` | OWNER LIVE |
| Templates placeables | `KELO_PROPERTY_CATALOG` | OWNER LIVE |
| Prop definitions | `KELO_PROP_CONTRACT` | OWNER LIVE |
| World editing authority | `KELO_WORLD_EDIT` | OWNER LIVE |
| Studio document/commands | `Studio Kernel` | OWNER LIVE creator |
| Map generation | `KeloMapForge` | OWNER LIVE creator |
| Update/PWA | `KeloUpdater` | OWNER LIVE client |

## 4. Política de migración legacy

La migración se hace por responsabilidad, no por archivo completo:

`IDENTIFICAR → CARACTERIZAR/SHADOW → ADAPTER/OWNER → MIGRAR CONSUMIDORES → TEST → LIVE → 0 USO LEGACY → DEAD → RETIRAR`

Ejemplos actuales:

- HP/maxHP: `KeloPlayerState` intercepta compatibilidad legacy mediante accessors.
- Colisión: `KELO_COLLISION` posee buckets y `obstacles` es vista legacy.
- Movimiento: `KeloMovement` posee un único wrapper autorizado con hooks.
- Posición: `KeloPlayerPosition` posee teleport/restore; movimiento por frame aún legacy.
- Plot/Farm travel: nombres legacy preservados, writes dirigidos a `KeloPlayerPosition`/`KeloCamera` por strangler temporal.
- Observabilidad: shadows nunca son autoridad y ya no pertenecen al camino crítico del primer frame.

No crear un nuevo wrapper genérico para “ordenar” legacy. Cada bridge temporal necesita owner, audit, métricas/contadores y ruta de retirada.

## 5. Mundo y render

`src/environment/world-map.js` define el mundo principal. Terrain, surface, props, decals, gardens y district assets se resuelven mediante contratos/registries, no con draw calls ad-hoc nuevos.

`src/environment/environment-layer-stack.js` mantiene las fases de dibujo. Props usan roles `props_back` / `props_front`; colliders se publican en owners/buckets y no se muta `obstacles` directamente desde sistemas nuevos.

## 6. Forest Plaza — integración actual

El atlas LIVE es:

`assets/world/plaza/forest-plaza-tileset-v2.png`

La ruta completa es:

`PNG → src/creators/assets/asset-sheet-compiler.mjs → manifest irregular → src/environment/generated/forest-plaza-tileset-v2-manifest.js → KELO_ATLAS_CONTRACT → src/property/forest-plaza-asset-catalog.js → KELO_PROPERTY_CATALOG → Studio/World placement`

Estado actual:

- 146 frames irregulares detectados/registrados.
- IDs legacy `asset-001..asset-146` preservados para compatibilidad.
- nombres semánticos `fp_*` añadidos al catálogo.
- 7 categorías: `plaza_core`, `architecture`, `garden_decor`, `water_features`, `terrain_paths`, `market_props`, `nature_trees_rocks`.
- Studio muestra carpetas visuales para Plaza, Arquitectura, Jardines, Agua, Caminos, Mercado y Bosque.
- props de demostración pueden aparecer en mapa central mediante `KELO_PROP_CONTRACT` sin crear renderer paralelo.

## 7. Studio / World Editor

Entradas principales:

- `src/ui/studio-launcher.js`
- `src/creators/workspaces/world-workspace.mjs`
- `src/studio/integration/world-studio-bridge.mjs`
- `src/studio/integration/live-studio-controller.mjs`
- `src/studio/studio-entry.mjs`
- `src/studio/ui/studio-live-shell.mjs`
- `src/studio/ui/studio-asset-palette.mjs`

El shell es UI; no posee mutations del mundo. Las mutations pasan por Studio Kernel/commands y la autoridad existente. En móvil, el boot se fragmenta y cede turns para evitar matar Safari al parsear/montar el grafo completo.

**Regla QA:** World en iPhone no se declara resuelto solo con headless. Requiere apertura, interacción, placement y reapertura en dispositivo real/LIVE.

## 8. Asset compiler

`asset-sheet-compiler.mjs` reutiliza `sprite-foreground-analysis.mjs` y `sprite-world-asset-compiler.mjs`. Produce frames irregulares, metadata y manifest; no redibuja el arte ni se convierte en un renderer.

El Asset Compiler puede sugerir semántica, pero nombres/categorías revisados deben conservar geometría sourceRect estable para no romper placements.

## 9. Gameplay

- Abilities: `KeloAbilities` + Stone/equipment/mount channels.
- PvP/Arena: `KeloArena`, PvP world + runtime loader.
- Character: `KeloCharacterCustomization`, `KeloAppearance`, `KeloAvatar`.
- Equipment: `KeloEquipment`.
- Backpack/containers: sistemas dedicados.
- Titles/stats: `KeloPlayerStats`, `KeloTitles`.
- Nobility: `KeloNobility` separado de Titles.
- Economy/logistics: `KeloRegionalEconomy`, `KeloCaravans`, `KeloFactions`.
- Property/instances: `KELO_PROPERTY_CATALOG`, `PropertySystem`, InstanceSystem.

## 10. Online boundary

El cliente puede predecir/presentar, pero progreso valioso, comercio, PvP competitivo, propiedad y cambios globales deben migrar/fallar hacia autoridad de servidor. `docs/ONLINE_FIRST.md` y los documentos de cada sistema mandan sobre implementaciones locales temporales.

## 11. Qué NO hacer

- No crear otro renderer de props o tiles.
- No crear otro catálogo de assets en paralelo.
- No crear otro loader para trabajo after-paint/first-use; extender `KeloModuleLoader`.
- No volver a poner control plane, updater o shadows como tags estáticos en `index.html`.
- No escribir directamente cámara/zoom/canvas desde features nuevas.
- No mutar `obstacles` desde features nuevas.
- No sustituir World/Studio por un editor nuevo para corregir un bug de boot.
- No publicar assets persistentes solo porque funcionan en preview local.
- No declarar un fix móvil verificado sin QA real.

## 12. Documentos relacionados

- `docs/GAME_STATE_CURRENT.md`
- `docs/ARCHITECTURE_CURRENT.md`
- `docs/KELO_FOUNDATION.md`
- `docs/KELO_STUDIO_ARCHITECTURE.md`
- `docs/ASSET_CONTRACT.md`
- `docs/CODE_INDEX.md`
- `docs/SYSTEM_DOCUMENTATION_STANDARD.md`
