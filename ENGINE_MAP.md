# ENGINE_MAP — Kelo World

> Documento canónico del engine. Si contradice `index.html` o un owner Foundation LIVE, gana el runtime y este archivo debe actualizarse.

**Sincronizado:** 2026-09-15  
**Runtime declarado:** Kelo World V6.69  
**Modelo:** web 2D top-down, Canvas, mobile-first, login/guest gate antes del boot pesado.

## 1. Regla de engine

Kelo World NO debe crear un segundo engine. El runtime histórico `engine-*.js` sigue existiendo, pero las responsabilidades nuevas deben pasar por owners explícitos en `src/`. Wrappers paralelos, writers directos y sistemas duplicados se consideran deuda o bug.

Estados usados aquí: `OWNER LIVE`, `SUPPORT LIVE`, `LEGACY CORE`, `DYNAMIC LIVE`, `PREPARED`, `PENDING VERIFY`, `SERVER AUTHORITY`, `TEMPORAL STRANGLER`.

## 2. Boot real (plaza-first)

Safari iOS tiene **un solo hilo**. Si `engine-b` arranca `gameLoop` mientras el HTML sigue compilando 100+ scripts, el canvas se congela o se pone negro.

Contrato LIVE/candidato (`index.html` V6.69):

1. Flag `__keloHoldGameLoop=true` antes de `engine-b`.
2. `KeloStateStore` normaliza/versiona el save legacy antes de cargar `engine-a`; un save migrado recibe backup previo y campos desconocidos se preservan.
3. Plaza only: events → input locks/profile/bootstrap → collision → state migrator → `engine-a` → player state/position → input/movement → `engine-b/c` → cámara → strangler de transiciones legacy → avatar/render/simulation → world-map/props → HUD/governor.
4. `engine-b` y `KELO_PERF` no piden rAF hasta `kelo:boot-ready`.
5. Tras el último script de plaza: `__keloBootReady=true` + evento `kelo:boot-ready`. El player ya puede caminar.
6. Nada pesado se descarga solo. Chat premium, tileset, PvP, Studio, backpack y módulos históricos tardíos entran por `KELO_MODULE_LOADER.ensure(feature)`.
7. Prohibido inyectar `<script>` desde nameplates u otros owners.

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
| Física/movimiento continuo base | `engine-a.js` | LEGACY CORE |
| UI/gameplay histórico base | `engine-b.js` | LEGACY CORE |
| Social/render/simulation bridge histórico | `engine-c.js` | LEGACY CORE |
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

## 11. Build / dependencias / CI

- Cliente: Node 22 + `package-lock.json` + instalación reproducible con `npm ci`.
- Servidor: Node 24.20.x + `server/package-lock.json` + `npm ci --omit=dev` cuando el lock esté presente.
- Netlify no instala `esbuild` ad-hoc: consume el lock del repositorio.
- `.github/workflows/evergreen-foundation.yml` protege migraciones Foundation.
- `.github/workflows/dependency-lock.yml` regenera locks en entorno declarado y publica solo cambios reproducibles.
- `.github/dependabot.yml` propone actualizaciones semanales por PR; nunca auto-merge por novedad.

## 12. PWA / cache

`sw.js` usa caches content-addressed. En `activate` solo puede borrar caches de namespace Kelo que no estén en el keep-list. Está prohibido `caches.keys() → delete(all)`.

`skipWaiting()` y `clients.claim()` permanecen temporalmente por compatibilidad con el updater. Su retirada/cambio exige prueba end-to-end de staged build, health y activación sin mezclar builds.

## 13. Qué NO hacer

- No crear otro renderer de props o tiles.
- No crear otro catálogo de assets en paralelo.
- No escribir directamente cámara/zoom/canvas desde features nuevas.
- No crear teleports nuevos escribiendo `localPlayer.x/y` directamente.
- No mutar `obstacles` desde features nuevas.
- No sustituir World/Studio por un editor nuevo para corregir un bug de boot.
- No publicar assets persistentes solo porque funcionan en preview local.
- No declarar un fix móvil verificado sin QA real.
- No borrar legacy hasta tener consumidores migrados + tests + QA LIVE + rollback.

## 14. Documentos relacionados

- `docs/GAME_STATE_CURRENT.md`
- `docs/ARCHITECTURE_CURRENT.md`
- `docs/KELO_FOUNDATION.md`
- `docs/KELO_STUDIO_ARCHITECTURE.md`
- `docs/ASSET_CONTRACT.md`
- `docs/CODE_INDEX.md`
- `docs/SYSTEM_DOCUMENTATION_STANDARD.md`
