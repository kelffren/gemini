# ENGINE_MAP — Kelo World

> Documento canónico del engine. Si contradice `index.html` o un owner Foundation LIVE, gana el runtime y este archivo debe actualizarse.

**Sincronizado:** 2026-09-16  
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
9. `abilityRuntime` es interno (`userToggle:false`) y **first-use**. Su orden físico es `abilityData.js → stone-system.js → kelo-ability-boot.js`; entra exclusivamente mediante `KELO_MODULE_LOADER.ensure('abilityRuntime')` y expone después `KeloAbilitiesLoader`/`KeloAbilities`.
10. Features first-use de usuario (`social`, `world`, `bag`, `mounts`, `market`, `titles`, `appearance`, `properties`) siguen entrando únicamente por `KELO_MODULE_LOADER.ensure(feature)`.
11. El presupuesto CI actual es **48/48 scripts externos antes de boot-ready** y **3/3 scripts externos estáticos después**. También se limita el peso fuente determinista: **422,554 / 425,000 bytes críticos** y **21,669 / 22,000 bytes post-boot estáticos**. Subir esos límites requiere evidencia y cambio explícito del contrato, no crecimiento accidental.
12. Hay **9 módulos internos diferidos after-paint**; no deben volver al parser-blocking boot.
13. `engine-i.js`, `engine-j.js` y `engine-k.js` están **RETIRED** y el audit exige cero referencias runtime/test a esos archivos.
14. `KeloAbilityAim` sustituyó la cadena J/K y posee el **lifecycle global de puntero legacy**, matemática de aim/range e indicador de render. El registry de cast legacy tiene owner separado: `KeloLegacyAbilityCast`, expuesto desde el mismo archivo para no añadir otro script al boot.
15. `engine-l.js` y `engine-m.js` registran sus middleware directamente mediante `KeloLegacyAbilityCast`. Ya no existe ningún consumidor runtime directo de `KeloAbilityAim`; el adapter `KeloAbilityAim.registerCastMiddleware` queda temporalmente sin consumidores para una retirada separada y reversible.
16. El smoke WebKit del branch verifica ambas fases de `world`: `engine-m` ausente en boot y presente tras `KELO_MODULE_LOADER.ensure('world')`.
17. `engine-g.js` **ya no posee ni construye la action bar**. Mantiene únicamente estado compatibility + dash tween legacy caracterizado. La hotbar moderna y el adapter `renderActionBar` pertenecen a `KeloAbilities` después del first-use de `abilityRuntime`.
18. La hotbar moderna usa lifecycle **local por botón**: un solo drag activo conserva `pointerId`, usa `setPointerCapture`, ignora eventos de otro pointer y `pointercancel` cancela sin castear. No instala listeners globales y no sustituye el strangler legacy `KeloAbilityAim`.
19. El smoke WebKit verifica el handoff de abilities: no hay hotbar/`KeloAbilities` al boot; tras cargar `abilityRuntime` aparecen exactamente 5 slots modernos sin restaurar `action-slot-*` de `engine-g`.
20. PvP solicita explícitamente `KeloRuntimeBootstrap.ensure() → KELO_MODULE_LOADER.ensure('abilityRuntime') → KeloAbilitiesLoader.ensure()` antes de despertar abilities y enlazar prediction. No depende de un global implícito.
21. `legacy-ability-consumer-audit.mjs` mantiene un inventario de referencias ejecutables. El baseline actual exige **0 consumidores directos de `KeloAbilityAim`** y exactamente **2 consumidores directos de `KeloLegacyAbilityCast`**: `engine-l.js` y `engine-m.js`.
22. Prohibido inyectar `<script>` desde features por fuera de `KeloModuleLoader`.

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
| Aim/range/pointer global legacy | `KeloAbilityAim` | TEMPORAL STRANGLER |
| Registry/dispatch de cast middleware legacy | `KeloLegacyAbilityCast` | TEMPORAL STRANGLER |
| Dirección de abilities legacy | `KeloAbilityDirection` | TEMPORAL STRANGLER |
| Trigger directo de stones legacy | `KeloLegacyAbilityTrigger` | TEMPORAL STRANGLER |
| Feature lifecycle first-use/after-paint | `KeloModuleLoader` | OWNER LIVE |
| Feature metadata/policies | `KELO_FEATURE_REGISTRY` | OWNER LIVE |
| User-toggleable optional packs | `KELO_ASSET_REGISTRY` | OWNER LIVE |
| Ability runtime/hotbar moderna + pointer local | `KeloAbilities` + `KeloAbilitiesLoader` | OWNER LIVE / first-use |
| Física/movimiento continuo base | `engine-a.js` | LEGACY CORE |
| UI/gameplay histórico base | `engine-b.js` | LEGACY CORE |
| Social/render/simulation bridge histórico | `engine-c.js` | LEGACY CORE |
| Dash tween legacy | `engine-g.js` | LEGACY CORE / characterized |
| `engine-i.js` | — | RETIRED |
| `engine-j.js` | — | RETIRED |
| `engine-k.js` | — | RETIRED |
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
- Posición: `KeloPlayerPosition` posee teleport/restore; movimiento por frame aún legacy. **Dash no debe pasar por este owner**: se considera movimiento/ability y usa `KeloMovement` mientras se migra.
- Plot/Farm travel: nombres legacy preservados, writes dirigidos a `KeloPlayerPosition`/`KeloCamera` por strangler temporal.
- Abilities legacy: `KeloAbilityAim` posee el pointer lifecycle global, matemática/range e indicador; `KeloLegacyAbilityCast` posee el registry/dispatcher de middleware. No se añadió un segundo engine ni un script de boot. `KeloAbilityAim.registerCastMiddleware` permanece como adapter sin consumidores, pendiente de retirada separada.
- Consumidores legacy: el audit de Foundation distingue referencias ejecutables de comentarios. Quedan **0 consumidores directos de `KeloAbilityAim`**, **2 consumidores directos de `KeloLegacyAbilityCast`** (`engine-l/m`), **3 consumidores de estado `skillAim`** (`engine-g/l/m`) y **6 consumidores de `triggerStone`**. El siguiente frente seguro es retirar el adapter no usado o reducir `skillAim` por consumidores; no tocar dash por similitud nominal.
- Presentación Plaza: `legacy-plaza-cast-presentation-parity.test.cjs` ejecuta el fragmento real de `engine-l` y congela cooldown, duración `.11+.08*(range/170)`, clamp de 24 px, consumo del dash y delegación exacta de los casts no-dash.
- Ability runtime moderno: `abilityRuntime` se carga bajo demanda por el ModuleLoader compartido; `KeloAbilities` posee hotbar + adapter `renderActionBar`. Sus cinco slots usan handlers Pointer Events locales; el VM test ejecuta el `bindSlot()` real y congela aislamiento por `pointerId`, cast único, cancel sin cast y self-cast inmediato.
- `engine-f`: dirección/trigger directos están caracterizados por un test VM contra el archivo real; conserva thresholds `0.15/0.12/12`, dash directo 150, radio PvP 60 y proyectil 450/life 2.
- `engine-g`: el dash tween está caracterizado contra el archivo real (quadratic ease-out, colisión, radio PvP `<52`, daño/fallback y finalización). El test exige que no recupere action bar, scheduler UI ni bindings de aim/pointer.
- Observabilidad: shadows nunca son autoridad y ya no pertenecen al camino crítico del primer frame.

Snapshot del debt audit actual: **9 engines legacy críticos** (`a,b,c,d,e,f,g,h,l`), **28 writes directos de posición** y **12 writes directos de cámara** en el índice estático de producción. `engine-f/g` concentran 10 de esos writes de posición y ya tienen paridad automatizada; el siguiente paso es migrar consumidores/autoridades, no borrar los archivos a ciegas.

No crear un nuevo wrapper genérico para “ordenar” legacy. Cada bridge temporal necesita owner, audit, métricas/contadores y ruta de retirada.

## 5. Mundo y render

`src/environment/world-map.js` define el mundo principal. Terrain, surface, props, decals, gardens y district assets se resuelven mediante contratos/registries, no con draw calls ad-hoc nuevos.

`src/environment/environment-layer-stack.js` mantiene las fases de dibujo. Props usan roles `props_back` / `props_front`; colliders se publican en owners/buckets y no se muta `obstacles` directamente desde sistemas nuevos.

## 6. Forest Plaza — integración actual

El atlas LIVE es `assets/world/plaza/forest-plaza-tileset-v2.png`.

La ruta completa es:

`PNG → src/creators/assets/asset-sheet-compiler.mjs → manifest irregular → src/environment/generated/forest-plaza-tileset-v2-manifest.js → KELO_ATLAS_CONTRACT → src/property/forest-plaza-asset-catalog.js → KELO_PROPERTY_CATALOG → Studio/World placement`

Estado actual: 146 frames irregulares; IDs legacy `asset-001..asset-146`; nombres `fp_*`; 7 categorías visuales; Studio consume el catálogo y no crea renderer paralelo.

## 7. Studio / World Editor

Entradas principales: `src/ui/studio-launcher.js`, `src/creators/workspaces/world-workspace.mjs`, `src/studio/integration/world-studio-bridge.mjs`, `src/studio/integration/live-studio-controller.mjs`, `src/studio/studio-entry.mjs`, `src/studio/ui/studio-live-shell.mjs`, `src/studio/ui/studio-asset-palette.mjs`.

El shell es UI; no posee mutations del mundo. Las mutations pasan por Studio Kernel/commands y la autoridad existente. En móvil, el boot se fragmenta y cede turns para evitar matar Safari al parsear/montar el grafo completo.

**Regla QA:** World en iPhone no se declara resuelto solo con headless. Requiere apertura, interacción, placement y reapertura en dispositivo real/LIVE.

## 8. Asset compiler

`asset-sheet-compiler.mjs` reutiliza `sprite-foreground-analysis.mjs` y `sprite-world-asset-compiler.mjs`. Produce frames irregulares, metadata y manifest; no redibuja el arte ni se convierte en un renderer.

## 9. Gameplay

- Abilities modernas: `KeloAbilities` + Stone/equipment/mount channels. `abilityRuntime` es first-use interno; la hotbar moderna usa pointer lifecycle local por slot. Compatibilidad aim/input legacy: `KeloAbilityAim`; compatibilidad de cast middleware legacy: `KeloLegacyAbilityCast`.
- PvP/Arena: `KeloArena`, PvP world + runtime loader; PvP garantiza el first-use del runtime de abilities antes de entrar.
- Character: `KeloCharacterCustomization`, `KeloAppearance`, `KeloAvatar`.
- Equipment: `KeloEquipment`.
- Backpack/containers: sistemas dedicados.
- Titles/stats: `KeloPlayerStats`, `KeloTitles`.
- Nobility: `KeloNobility` separado de Titles.
- Economy/logistics: `KeloRegionalEconomy`, `KeloCaravans`, `KeloFactions`.
- Property/instances: `KELO_PROPERTY_CATALOG`, `PropertySystem`, InstanceSystem.

## 10. Online boundary

El cliente puede predecir/presentar, pero progreso valioso, comercio, PvP competitivo, propiedad y cambios globales deben migrar/fallar hacia autoridad de servidor. `docs/ONLINE_FIRST.md` y los documentos de cada sistema mandan sobre implementaciones locales temporales.

## 11. Build / CI supply chain

Los workflows activos usan acciones externas fijadas por SHA exacto. `ci-supply-chain-audit.mjs` falla si reaparece una acción sin pin SHA o `permissions: write-all`.

Foundation incluye characterization de state/save, SW, transition bridge, ability aim, ability direction, dash tween, **ability runtime first-use**, **modern ability pointer lifecycle**, legacy pointer lifecycle, cast middleware, **legacy Plaza cast presentation parity** y **legacy ability consumer inventory**; además de reproducible-build, supply-chain, boot-surface, legacy-debt y architecture audits. Production build, authoritative server smoke y WebKit branch smoke completan el gate.

El head runtime `09ad6fedf18a57cf56741e59237b65f7c911106d` pasó los cuatro gates (`foundation`, `client-build`, `server-smoke`, `webkit-mobile-smoke`). El audit confirmó `directAimConsumers=[]` y `directCastConsumers=["engine-l.js","engine-m.js"]`; WebKit mantuvo verde el handoff first-use. Esto sigue siendo evidencia branch-local y **no sustituye QA físico/LIVE**.

## 12. Qué NO hacer

- No crear otro renderer de props o tiles.
- No crear otro catálogo de assets en paralelo.
- No crear otro loader para trabajo after-paint/first-use; extender `KeloModuleLoader`.
- No volver a poner control plane, updater, shadows, `engine-m` o abilities modernas como trabajo del primer frame.
- No devolver action bar/hotbar a `engine-g`.
- No crear listeners globales de pointer para la hotbar moderna; cada slot conserva su lifecycle local y el global legacy sigue en `KeloAbilityAim` mientras exista compatibilidad aim/pointer legacy.
- No registrar nuevos middleware legacy mediante `KeloAbilityAim`; el owner es `KeloLegacyAbilityCast`. El adapter de `KeloAbilityAim` tiene cero consumidores runtime y solo puede retirarse en un paso dedicado con characterization.
- No escribir directamente cámara/zoom/canvas desde features nuevas.
- No mutar `obstacles` desde features nuevas.
- No usar `KeloPlayerPosition` para dash/physics.
- No sustituir World/Studio por un editor nuevo para corregir un bug de boot.
- No publicar assets persistentes solo porque funcionan en preview local.
- No declarar un fix móvil verificado sin QA real.

## 13. Documentos relacionados

- `docs/GAME_STATE_CURRENT.md`
- `docs/ARCHITECTURE_CURRENT.md`
- `docs/KELO_FOUNDATION.md`
- `docs/KELO_STUDIO_ARCHITECTURE.md`
- `docs/ASSET_CONTRACT.md`
- `docs/CODE_INDEX.md`
- `docs/SYSTEM_DOCUMENTATION_STANDARD.md`