# ENGINE_MAP — Kelo World

> **ANTES DE CREAR O MODIFICAR UN SISTEMA:** lee `docs/KELO_FOUNDATION.md`, `docs/SYSTEM_DOCUMENTATION_STANDARD.md` y `AGENTS.md`. Toda feature nueva debe reutilizar un OWNER existente o justificar una CAPACIDAD nueva.

**Estado:** índice maestro operativo del runtime Foundation actual.  
**Runtime declarado en `index.html`:** Kelo World V6.53.  
**Ability Source-Native:** `KeloAbilities.engine.castSource/predictSource` ejecuta weapon/mount/futuras fuentes no-Stone por el mismo targeting/delivery/effects sin sustituir ningún slot del hotbar Stone; `KeloAbilitySourceCast` queda como shim de compatibilidad.  
**Identity / Prestige Foundation:** 2026-09-08 · `KeloPlayerStats` + `KeloTitles` + catálogo data-driven + `KeloActorNameplate` activos; Nobleza permanece separada en `KeloNobility`; `localPlayer.title = 'Caballero'` y su wrapper avatar legacy fueron retirados.  
**Character Creator V2:** 2026-09-08 · `KeloCharacterCustomization` + `KeloCharacterSlotSchema` + `KeloCharacterVisualStack` activos y validados en Pages sobre `035af63e3a5f7b72283659cf02454bb048ade350`.  
**Main Menu V4:** 2026-09-08 · `src/ui/luxe-shell.js` / `KELO_LUXE` conserva ownership único de la navegación principal; Apariencia, Nobleza y Burlas vuelven a ser descubribles mediante sus owners reales; Misiones/Ajustes permanecen ocultos mientras no exista owner UI válido.  
**Foundation V3 — Camera / Viewport Ownership:** 2026-09-08 · rama `foundation/kelo-foundation-v3-camera-final` · `KeloCamera` consolidado y verificado por Camera Foundation CI + Foundation Architecture CI sobre el candidato V3.  
**Foundation V2 — Collision Ownership:** 2026-09-08 · lifecycle de colliders consolidado en `KELO_COLLISION`; histórico de ese pass preservado en Git.  
**Regla de autoridad documental:** si este mapa contradice `index.html`, los contratos Foundation o comportamiento LIVE verificado, gana el runtime y este archivo debe corregirse en el mismo pass.  
**Mapa histórico V6.16 preservado:** `docs/archive/ENGINE_MAP_V6.16.md`.

## Cómo leer este mapa

Estados válidos:

- **OWNER LIVE**: dueño actual demostrado por carga/runtime.
- **SUPPORT**: participa, no posee la decisión final.
- **LEGACY**: compatibilidad; no recibe features nuevas.
- **HOTFIX**: parche temporal; no copiar como patrón.
- **DYNAMIC LIVE**: forma parte del runtime, pero entra mediante bootstrap dinámico.
- **PREPARED / DORMANT**: existe y puede tener contratos/tests, pero `index.html` no lo carga actualmente.
- **DEAD**: no forma parte del runtime.
- **EXPERIMENTAL**: prototipo no consolidado.
- **SERVER-AUTHORITATIVE**: decisión final online vive en server.
- **CLIENT/FALLBACK**: implementación local/offline/prototipo.
- **NEEDS_AUDIT**: ownership todavía compartido o ambiguo.

---

# ESTADO DEL PROYECTO EN 60 SEGUNDOS

Kelo World es un juego web 2D top-down móvil-first sobre Canvas. El runtime todavía carga una cadena extensa de `engine-*.js`, pero los puntos de extensión core que antes se encadenaban mediante wrappers ya tienen owners Foundation explícitos.

La Foundation NO crea un segundo engine. `engine-a.js` y `engine-c.js` siguen conteniendo core legacy real; Foundation coloca fronteras estables alrededor de sus globals mientras se extraen responsabilidades de forma incremental.

El inventario LIVE saneado — ignorando comentarios, strings y asignaciones locales — demuestra:

```text
processInput wrappers        = 1 → KeloInput
updateMovement wrappers      = 1 → KeloMovement
render wrappers              = 2 → engine-c + KeloRender
updateSimulation wrappers    = 2 → engine-c + KeloSimulation
renderAvatar wrappers        = 1 → KeloAvatar
KELO_MODAL_INPUT_LOCK writes = 0 LIVE
camera target direct writers = 1 → engine-b legacy adapter
CONFIG.zoom direct writers   = 1 → engine-c transitional adapter
main Canvas size writers     = engine-a legacy bootstrap + KeloCamera owner
```

Para Render y Simulation, `engine-c` define/orquesta el entrypoint legacy y un único owner Foundation lo envuelve. Para Avatar, el wrapper feature-level de `engine-c` que pintaba `Caballero` fue retirado: `KeloAvatar` es el único wrapper Foundation autorizado y compone bases/middleware explícitos. `kelo-ability-boot`, `armor-aura`, `character-customization`, `visual-integration` y el nuevo nameplate consumen owners Foundation mediante hooks/middleware.

Foundation V2 extiende el owner existente `KELO_COLLISION`: ahora posee no solo las primitivas geométricas sino también el lifecycle de colliders por bucket nombrado. `obstacles` sigue existiendo como **vista legacy de lectura** para movimiento/proyectiles; `core-static` se adopta una vez tras `engine-a`, mientras Generic Props, Property, World Builder y Ability Walls publican/retiran únicamente su propio bucket. Ninguno de esos productores LIVE hace ya `obstacles.push/splice` directamente.

Foundation V3 instala `KeloCamera` inmediatamente después de `engine-c` y concentra target/focus, restore de estado, base/effective zoom, tuning de follow, viewport/Canvas DPR, `updateCamera` y conversiones screen↔world. `engine-h`, `engine-t`, `engine-z`, mobile orientation, PvP, instancias, café y quick travel consumen el owner. `engine-z` conserva su encuadre responsive usando una referencia independiente de orientación, por lo que girar 390×844 ↔ 844×390 no altera el base zoom. `engine-l` ya no posee HiDPI ni escribe el Canvas principal. Los únicos writers directos permitidos son adapters legacy explícitos en `engine-b`/`engine-c`; código nuevo no puede imitarlos.

Character Creator V2 mantiene una única identidad visual modular: `KeloCharacterSlotSchema` define 24 slots y orden direccional; `KeloCharacterCustomization` posee estado/operaciones visuales; `KeloCharacterVisualPresets` y `KeloCharacterContentPacks` describen contenido; `KeloCharacterVisualStack` resuelve orden/front-back; y `KeloAvatar` compone las capas mediante middleware priority 250. El editor y el preview son consumidores; no poseen gameplay ni crean otro renderer. El snapshot online envía únicamente IDs, paletas y revision bajo `kelo-character-visual-v2`.

Identity / Prestige añade dos capacidades reales, no un sistema paralelo de combate: `KeloPlayerStats` posee counters reutilizables y `KeloTitles` posee unlock/equip de títulos personales. `src/systems/title-catalog.js` es data pura indexada por `requirement.stat`. El flujo offline es `combat:entity_killed → KeloPlayerStats → player:stat_changed → KeloTitles`; online, progreso valioso falla cerrado y el servidor es quien debe invocar `server/title-store.js.recordConfirmedKill(...)` después de una muerte PvP real confirmada. El cliente solo puede solicitar `titles:get/equip/unequip`. `KeloActorNameplate` es consumidor visual sobre `KeloAvatar.use(...)`, nunca autoridad gameplay. `KeloNobility` conserva íntegro su ownership de donación/rango/power.

Main Menu V4 no introduce un segundo sistema de navegación. `src/ui/luxe-shell.js` sigue siendo la única superficie principal y `KELO_LUXE` posee apertura/cierre/render del menú; cada tarjeta delega al API público del owner real (`KeloBackpackUI`, `KeloAbilities`, `KeloCharacterCustomizer`, `KeloMarketUI`, `KELO_HOUSE_UI`, `KeloNobility`, `KeloSelfInteractionUI`) o a adapters LIVE todavía válidos para Perfil/Chat. Apariencia, Nobleza y Burlas recuperan acceso directo. Misiones y Ajustes quedan owner-gated y no se renderizan mientras solo existan placeholders legacy. Creators se injerta en el mismo grid únicamente cuando su launcher autorizado está disponible. Menú y Chat reclaman input mediante tokens propios de `KeloInputLocks`.

El adapter `KELO_MODAL_INPUT_LOCK` sigue existiendo dentro de `KeloInputLocks` para compatibilidad, pero el inventario actual no encuentra ningún writer directo LIVE. Los 5 writes restantes están únicamente en archivos de repo no cargados directamente por el runtime (`self-profile-touch-hotfix` y `builder-restore-move`). El Character Creator reclama input exclusivamente mediante token de `KeloInputLocks` y su audit LIVE demostró release limpio al cerrar.

La existencia de un archivo en `src/` NO demuestra por sí sola que esté LIVE. La carga real puede ser directa desde `index.html` o dinámica desde un bootstrap LIVE. En particular, `src/environment/generic-prefabs.js` y `src/ui/property-editor.js` están **DORMANT** en V6.53: se pueden probar como unidades, pero no deben tratarse como dependencias LIVE ni reactivarse para satisfacer un test viejo. `profile-panel-close.js` sigue siendo un bootstrap tardío para combat/effects/melee y Character Customization V2; esa frontera de boot todavía debe limpiarse sin crear un segundo boot system.

---

# ORDEN DE CARGA — BLOQUES REALES DE V6.53 FOUNDATION

`index.html` carga conceptualmente en este orden:

```text
0.  KeloEvents + KeloInputLocks
1.  collision-utils + engine-a → KELO_COLLISION adopta obstacles como core-static
2.  KeloInput + KeloMovement + engine-b + engine-c
3.  KeloCamera + KeloAvatar + KeloRender + KeloSimulation
4.  engine-d..k
5.  environment contracts / atlases / world-map + prefab-contract + engine-l
6.  engine-m..aj + character appearance + pvp-world
7.  Visual System / manifests / asset registry / animation / FX / sequence
8.  modern abilities + stones + Sword Swap + TitleCatalog + KeloPlayerStats + KeloTitles
9.  engine-net
10. Luxe premium main menu/HUD + mobile orientation + plaza depth
11. gameplay systems (nobility + authority + actor nameplate/equipment/backpack/container/emote/market)
12. property + instances + world builder + house UI
13. forge/aura/illumination/performance
14. profile-panel-close → dynamic runtime bootstrap de combat/effects/melee + Character Customization V2
15. self interaction / PvP touch guard / visual lab / visual integration
16. Studio launcher mínimo; módulos Studio se cargan bajo acción explícita
```

No forman parte del boot actual:

```text
src/environment/generic-prefabs.js → DORMANT renderer compatible con prefab-contract
src/ui/property-editor.js          → DORMANT editor; PropertySystem sí está LIVE
```

`force-unlock-move.js` está **RETIRED** y ya no se carga en runtime Foundation.

El orden importa: `KeloCamera`, `KeloAvatar`, `KeloRender` y `KeloSimulation` se instalan inmediatamente después de `engine-c`, de modo que los consumidores históricos posteriores usan owners/adapters explícitos en vez de sustituir globals por su cuenta. `KELO_COLLISION.attachLegacyObstacleArray(...)` corre justo después de `engine-a`, antes de los productores modernos de colliders. `KeloTitleCatalog`, `KeloPlayerStats` y `KeloTitles` cargan antes de `engine-net`, así un snapshot de títulos recibido en `hello` nunca se pierde; Nobleza y el nameplate cargan después y consumen esos owners. Character Customization entra tarde pero se registra sobre `KeloAvatar`, `KeloInputLocks` y su propio stack compartido sin envolver globals core.

---

# OWNERS ACTUALES Y DEUDA

| Responsabilidad | Owner / API | Estado | Nota Foundation |
|---|---|---|---|
| Core state / parsers legacy | `engine-a.js` | OWNER LIVE LEGACY CORE / NEEDS_AUDIT | Aún concentra estado, input físico y física base; extracción incremental, no rewrite |
| Input lock claims | `src/core/input-lock-system.js` / `KeloInputLocks` | OWNER LIVE FOUNDATION | Token claims; `KELO_MODAL_INPUT_LOCK` queda solo como adapter legacy temporal; 0 writes directos LIVE |
| Input pipeline | `src/core/input-system.js` / `KeloInput` | OWNER LIVE FOUNDATION / TRANSITIONAL | Único wrapper de `processInput`; `engine-a` conserva parser legacy consumido por el owner |
| Movement extension ownership | `src/core/movement-system.js` / `KeloMovement` | OWNER LIVE FOUNDATION / TRANSITIONAL | Único wrapper de `updateMovement`; hooks before/after deterministas |
| Movement physics | `engine-a.js` | OWNER LIVE LEGACY CORE | Desplazamiento + colisión actual; extraer más adelante sin cambiar feel |
| Gait/speed/stride | `engine-ac.js` vía `KeloMovement` | SUPPORT LIVE | Ya no envuelve `updateMovement` |
| Release brake | `engine-ah.js` vía `KeloMovement` | SUPPORT LIVE | Ya no envuelve `updateMovement` |
| Collision geometry + lifecycle | `src/physics/collision-utils.js` / `KELO_COLLISION` | OWNER LIVE FOUNDATION V2 | `replaceOwner/upsert/remove/clearOwner`; `obstacles` es vista legacy, no API de escritura |
| Core static colliders | `engine-a.js` → owner `core-static` | LEGACY DATA / OWNED VIEW | Se adoptan una vez por `KELO_COLLISION` sin reescribir `engine-a` |
| Generic Prop colliders | `src/environment/generic-props.js` → `environment:generic-props` | SUPPORT LIVE / OWNED | Publica set completo mediante `replaceOwner`; cero writes directos a `obstacles` |
| Property colliders | `src/property/property-system.js` → `property:placements` | SUPPORT LIVE / OWNED | Rotación/visibilidad se proyectan a un único bucket físico |
| World Builder colliders | `src/environment/world-builder-system.js` → `world-builder:collisions` | SUPPORT LIVE / OWNED | Dirty/revision sync; ya no reconstruye el bucket sin cambios en cada frame |
| Ability wall colliders | `src/abilities/kelo-ability-boot.js` → `abilities:walls` | SUPPORT LIVE / OWNED | `upsert` al crear, `remove` al expirar/destruir; no depende de identidad dentro de `obstacles` |
| Camera / viewport / zoom | `src/core/camera-system.js` / `KeloCamera` | OWNER LIVE FOUNDATION V3 / TRANSITIONAL | Target/focus/restore, base+effective zoom, follow tuning, Canvas DPR/viewport, `updateCamera`, screen↔world; `engine-b` target y `engine-c` CONFIG.zoom quedan como adapters legacy explícitos |
| Responsive camera support | `engine-h.js`, `engine-t.js`, `engine-z.js`, `src/ui/mobile-orientation.js` | SUPPORT LIVE | Consumen `KeloCamera`; `engine-z` usa reference span orientation-invariant; ningún support escribe Canvas/CONFIG.zoom directo |
| Render base/orchestration | `engine-c.js` | OWNER LIVE LEGACY CORE | Orquesta frame/mundo/actores/UI Canvas |
| Render extensions | `src/core/render-extension-system.js` / `KeloRender` | OWNER LIVE FOUNDATION / TRANSITIONAL | Único wrapper Foundation de `render`; inventario LIVE = `engine-c` + owner |
| Simulation extensions | `src/core/simulation-extension-system.js` / `KeloSimulation` | OWNER LIVE FOUNDATION / TRANSITIONAL | Único wrapper Foundation de `updateSimulation`; inventario LIVE = `engine-c` + owner |
| Avatar render composition | `src/core/avatar-render-system.js` / `KeloAvatar` | OWNER LIVE FOUNDATION / TRANSITIONAL | Único wrapper LIVE permitido de `renderAvatar`; el wrapper `Caballero` de `engine-c` fue retirado |
| Avatar base actual | `engine-w.js` registrado en `KeloAvatar` | SUPPORT LIVE | Base final histórico; `engine-d/e` ya no reemplazan el global |
| Hero sprite | `engine-ab.js` vía `KeloAvatar.use(...,100)` | SUPPORT LIVE | Fallback condicional hero.PNG |
| Character appearance | `src/characters/character-appearance.js` vía `KeloAvatar.use(...,200)` | SUPPORT LIVE | Apariencia base/full-body; canvas de limpieza es offscreen y no pertenece al viewport |
| Character customization | `src/characters/character-customization.js` / `KeloCharacterCustomization` | OWNER LIVE FOUNDATION V2 | 24 slots, palettes, presets, randomizer, history, save/share y snapshot IDs-only; capas vía `KeloAvatar.use(...,250)`; UI no posee state |
| Character slot/order contract | `src/characters/character-slot-schema.js` / `KeloCharacterSlotSchema` | OWNER LIVE PURE DATA | Fuente única de slots/grupos/face order/gameplay→visual; no dibuja ni persiste |
| Character visual stack | `src/characters/character-visual-stack.js` / `KeloCharacterVisualStack` | OWNER LIVE PURE RESOLVER | Orden front/back + UP occlusion + cache por revision; preview y juego consumen el mismo resolver |
| Character content/descriptors | `src/characters/character-content-packs.js` + `character-visual-presets.js` | SUPPORT LIVE DATA-DRIVEN | Piezas/outfits/presets/paletas se registran como data; asset contract 512×768 / 4×4 |
| Character customizer UI/preview | `src/ui/character-customizer-ui.js` + `character-customizer-preview.js` | CONSUMER LIVE | Mobile-first; `KeloInputLocks` tokenizado; preview comparte VisualStack; sin gameplay authority |
| Armor aura | `src/systems/armor-aura.js` vía `KeloAvatar.use(...,300)` | SUPPORT LIVE FOUNDATION | Dibuja back/front alrededor del avatar sin envolver `renderAvatar` |
| Actor visual integration | `src/visuals/visual-integration.js` vía `KeloAvatar.use(...,400)` | SUPPORT LIVE FOUNDATION | Transform + actorBackFX/frontFX; middleware exterior actual antes del nameplate |
| Actor identity nameplate | `src/ui/player-nameplate.js` / `KeloActorNameplate` vía `KeloAvatar.use(...,500)` | CONSUMER LIVE FOUNDATION | Dibuja Nobleza/nombre/título para local y peers; solo presentación, sin estado gameplay |
| World renderer | `src/environment/world-map.js` / `KELO_WORLD_RENDERER` | OWNER LIVE | World content entra por contracts/renderer |
| Prefab data contract | `src/environment/prefab-contract.js` | OWNER/SUPPORT LIVE | Contrato data-driven cargado por `index.html` |
| Generic prefab renderer | `src/environment/generic-prefabs.js` | PREPARED / DORMANT | Se prueba como unidad; NO cargar para satisfacer CI sin decisión arquitectónica explícita |
| Environment assets/contracts | `src/environment/*` | OWNER/SUPPORT | Registry/contracts antes de hardcode |
| Visual/VFX | `src/visuals/*` / `KeloVisualSystem` | OWNER LIVE | Presentación no decide gameplay |
| Event bus | `src/core/events/event-bus.js` / `KeloEvents` | OWNER LIVE FOUNDATION | Carga directa temprana; primitive genérico, no crear otro bus global |
| Combat foundation | `KeloCombatEngine` + Hit/Damage resolvers | DYNAMIC LIVE | Emite `combat:entity_killed`; gameplay/presentation separados; server adapter puede reemplazar authority |
| Effects foundation | `KeloEffectEngine` | DYNAMIC LIVE | Registry data-driven de efectos |
| Melee foundation | `KeloMeleeEngine` | DYNAMIC LIVE | Perfil → CombatEngine; no HP/render directo |
| Player progress counters | `src/systems/player-stats.js` / `KeloPlayerStats` | OWNER LIVE FOUNDATION | Stats genéricas; offline trusted-event fallback, online read-only/fail-closed hasta snapshot; no conoce rewards |
| Unlockable title catalog | `src/systems/title-catalog.js` / `KeloTitleCatalog` | PURE DATA LIVE | IDs estables, categorías/rareza/requisitos e índice por stat; añadir título no modifica engine |
| Unlockable title state/evaluator | `src/systems/title-system.js` / `KeloTitles` | OWNER LIVE FOUNDATION | Unlocked/equippedTitleId; evalúa solo al cambiar stat/cargar; UI integrada en Nobleza; online cliente nunca desbloquea |
| Server title authority | `server/title-store.js` | SERVER-AUTHORITATIVE | Valida kill context, incrementa progreso, evalúa unlock/equip; Supabase opcional con schema; no expone client unlock/kill |
| Ability runtime moderno | `src/abilities/kelo-ability-boot.js` / `KeloAbilities` | OWNER LIVE | Tick vía `KeloSimulation`, FX vía `KeloRender`, walls vía `KELO_COLLISION`; Stone Panel filtra inventario no-piedra sin asumir que todo item tiene controles de habilidad |
| Stone/loadout moderno | `src/abilities/stone-system.js` / `KeloStones` | OWNER LIVE | Legacy stones no recibe features |
| Sword Swap runtime | ability/runtime + PvP visuals | OWNER LIVE feature / SUPPORT Foundation | Tick usa `KeloSimulation`; ya no envuelve simulation |
| PvP world | `src/systems/pvp-world.js` | OWNER LIVE feature / NEEDS_AUDIT authority | Render exclusivo usa `KeloRender`; tick usa `KeloSimulation`; cámara usa `KeloCamera`; autoridad local sigue siendo prototipo |
| Networking client | `engine-net.js` / `KeloNetAuthority` | OWNER LIVE transporte | Pose/interpolación + nobility/titles/forge transport; `equippedTitleId` se replica como ID, transporte no equivale a autoridad |
| Server authority | `server/*` | SERVER-AUTHORITATIVE donde aplique | Economía/combate/progreso online final no confían en cliente |
| Equipment | `src/systems/equipment-system.js` | OWNER LIVE client | Reutilizar API; no escribir internals |
| Backpack/inventory | `src/systems/backpack-system.js` + `KeloBackpackUI` | OWNER LIVE moderno / migración | UI usa token propio `KeloInputLocks`; estado legacy aún debe consolidarse antes de retirar |
| Containers | `src/systems/container-system.js` | OWNER LIVE | Inventory ownership debe permanecer explícito |
| Market escrow | `src/systems/market-escrow-system.js` | OWNER client/fallback | Online debe pasar por authority |
| Property | `src/property/property-system.js` | OWNER LIVE | Una placement tiene un owner lógico y su collider se proyecta al bucket `property:placements` |
| Property Editor | `src/ui/property-editor.js` | PREPARED / DORMANT | Unit contract puede ejecutarse; browser smoke solo aplica si `index.html` lo activa |
| Instances / House lifecycle | `src/instances/*` + `src/ui/house-instance-ui.js` | OWNER LIVE | House authority, persistence, crash recovery, cámara restaurada vía `KeloCamera` y panel móvil/desktop probados sin depender del editor dormant |
| World Builder runtime | `src/environment/world-builder-system.js` | OWNER/SUPPORT LIVE / NEEDS_AUDIT authoring | Collision lifecycle resuelto; persisten límites authoring/runtime, persistencia y snapshots |
| Main menu / Luxe HUD | `src/ui/luxe-shell.js` / `KELO_LUXE` | OWNER LIVE UI | Única navegación principal; grid premium mobile-first, rutas owner-backed, `KeloInputLocks` tokenizado, placeholders sin owner ocultos; no posee gameplay state |
| UI | `src/ui/*` | CONSUMER | UI consume APIs; no gobierna gameplay state ajeno |
| Legacy modal lock writes LIVE | ninguno | RESUELTO EN RUNTIME | `modalLockWrite liveDirect=0`; adapter permanece por compatibilidad |
| Legacy modal lock writes REPO | `self-profile-touch-hotfix.js`, `builder-restore-move.js` | LEGACY / NOT DIRECT LIVE | 5 writes totales; retirar/migrar solo al decidir su destino |
| `src/core/input-gate.js` | compatibilidad antigua | RETIRED COMPAT | Ya no es segundo wrapper LIVE; su función quedó absorbida por `KeloInput` |
| `src/ui/modal-input-lock.js` | compatibilidad antigua | RETIRED COMPAT | No envuelve `processInput`; conservar solo mientras exista consumidor histórico |
| `force-unlock-move.js` | ninguno | RETIRED HOTFIX / NOT LOADED | 0 timers, 0 wrappers |
| Runtime bootstrap tardío | `src/core/kelo-runtime-bootstrap.js` + Character Creator desde `profile-panel-close.js` | DYNAMIC LIVE / NEEDS_AUDIT | Boot ownership sigue disparado desde UI; moverlo solo cuando exista contrato claro, sin duplicar boot |

---

# CORE EXTENSION POINTS PREFERIDOS

Antes de envolver core, buscar y reutilizar:

```text
KeloEvents
KeloInputLocks
KeloInput.before / after
KeloMovement.before / after
KeloCamera.setTarget / focus / restoreState
KeloCamera.setBaseZoom / cycleZoom / syncViewport
KeloCamera.screenToWorld / worldToScreen
KeloRender.intercept / beforeFrame / afterFrame
KeloSimulation.before / after
KeloAvatar.setBase / use
KeloPlayerStats.get / snapshot / recordTrusted
KeloTitles.getProgress / equip / unequip / ingestServerSnapshot
KeloCharacterCustomization.select / applyPreset / randomize / networkSnapshot
KeloCharacterVisualStack.resolve
KELO_COLLISION.replaceOwner / upsert / remove / clearOwner
KELO_COLLISION.resolveCircleAABB / segmentAabbHitT
KELO_WORLD_RENDERER.draw / drawPreActors / drawPostActors
KeloVisualSystem layers/update
KeloCombatEngine / KeloEffectEngine / KeloMeleeEngine
KeloAbilities
KeloStones
KELO_LUXE.toggleMenu / closeMenu / renderMenu
Property/Instance APIs
system-owned event buses
```

Prohibición Foundation: no introducir wrappers nuevos directos de `render`, `renderAvatar`, `updateSimulation`, `processInput` o `updateMovement` cuando exista un owner/punto de extensión apropiado. Camera/viewport/zoom nuevo debe pasar por `KeloCamera`; ningún consumidor nuevo escribe `camera.targetX/Y`, `CONFIG.zoom`, `canvas.width/height`, `resize`, `cycleZoom` o `updateCamera` directamente. Para colisiones, ningún productor nuevo debe mutar `obstacles`; debe publicar su collider/set mediante `KELO_COLLISION`. Para personaje, contenido nuevo entra por ContentPacks/VisualPresets y mutaciones visuales pasan por `KeloCharacterCustomization`; no se crean schemas, stacks o renderers paralelos. Para navegación principal, extender `KELO_LUXE` y conectar owners reales; no crear otro menú ni botones fake para features sin owner. Para progreso, gameplay publica stats/eventos y consumidores como `KeloTitles` reaccionan; nunca hacer `CombatEngine → if kills >= N → título`. Títulos futuros se registran como DATA y online no aceptan counters/unlocks declarados por cliente.

El CI Foundation contiene contratos específicos para Input Locks, Input, Movement, Camera, Render, Simulation y Avatar, documentación obligatoria, inventario de deuda LIVE y syntax-check explícito de consumidores migrados. Ability Collision CI valida también aislamiento entre owners, no duplicación, vista legacy y ausencia de writes directos en Generic Props, Property, World Builder y Ability Walls. Camera Foundation CI añade contrato determinista y browser audit portrait 390×844 → landscape 844×390 → desktop 1440×900, DPR, Canvas, base/effective zoom y screen↔world. Character Customization CI valida 24 slots, compat V1, palettes/cache, presets, randomizer locks, undo/redo, saves, share/import, snapshot V2, middleware `KeloAvatar`, token input locks y browser audit portrait/landscape. Premium Main Menu CI valida ownership de rutas, locks tokenizados, ausencia de placeholders visibles, texto sin clipping, portrait/landscape, apertura real de cada owner, movimiento y PvP después de cerrar UI. Kelo Titles CI valida sintaxis, server authority, Foundation/docs, 199→200 unlock, invalid kills, equip/unequip, DEV gate y panel mobile 390×844 / 844×390.

---

# LEGACY / DUPLICACIÓN A CONSOLIDAR

Deuda prioritaria, sin borrar a ciegas:

1. Decidir destino de los writers de modal lock que quedan solo en archivos no LIVE; no hay writer directo LIVE pendiente.
2. Extraer en el futuro parser/física base de `engine-a` detrás de `KeloInput`/`KeloMovement` sin cambiar gameplay.
3. Retirar gradualmente los adapters Camera legacy (`engine-b` target y `engine-c` CONFIG.zoom) después de migrar consumidores y validar LIVE; no reintroducir writers directos nuevos.
4. Abilities/stones legacy en engines vs `src/abilities/*`.
5. Inventory/equipment legacy state vs sistemas modernos.
6. Retirar gradualmente la **lectura legacy de `obstacles`** cuando movimiento/proyectiles puedan consultar el owner sin duplicar lógica; no crear otro collider store mientras tanto.
7. World Edit authoring/runtime boundaries, persistencia y snapshots.
8. Core/Character bootstrap disparado desde un archivo de UI.
9. Completar autoridad server del ciclo HP/death de PvP Mundo Abierto y conectar su muerte confirmada al hook interno de `server/title-store.js`; no convertir el relay visual en autoridad mientras tanto.
10. Timers/MutationObservers/global writers restantes según inventario Foundation, priorizados por impacto medido.
11. Deuda de assets/CI PNG se mantiene separada: no atribuir fallos de manifest/dimensiones a Foundation ownership ni a Progression/Character Creator.

**Resuelto en Foundation V1:** cadenas feature-level de wrappers de Render, Simulation y Avatar; writers directos LIVE de `KELO_MODAL_INPUT_LOCK`; Backpack lock tokenizado; CI Prefab/House/Property alineado con activación runtime real.  
**Resuelto en Foundation V2 Collision:** lifecycle owner por bucket; `core-static` adoptado; Generic Props/Property/World Builder/Ability Walls migrados; World Builder deja de reconstruir colliders sin cambios cada frame; Generic Prop CI actualizado a contrato estructural del runtime actual. No reintroducir writes directos a `obstacles`.  
**Resuelto en Foundation V3 Camera:** `KeloCamera` es owner único de comandos de cámara, base/effective zoom, viewport/Canvas DPR, follow tuning, `updateCamera` y screen↔world; consumidores modernos migrados; `engine-l` dejó HiDPI; responsive zoom ya no cambia el base al rotar; static writer guard + browser audit verdes.  
**Resuelto en Character Creator V2:** schema compartido de 24 slots, palette swapping/cache, presets data-driven, smart randomizer, undo/redo, 5 saves, share/import KW2, snapshot online IDs-only V2, capas por middleware `KeloAvatar` priority 250, preview por VisualStack compartido y lock tokenizado. Pages LIVE verde en portrait 390×844 y landscape 844×390.  
**Resuelto en Main Menu V4:** Luxe Shell permanece como owner único; Apariencia/Nobleza/Burlas recuperan acceso mediante sus owners reales; Misiones/Ajustes no se muestran sin owner; Creators reutiliza el grid autorizado; menú/chat usan tokens `KeloInputLocks`; Stone Panel tolera inventario mixto.  
**Resuelto en Identity / Prestige Foundation:** se retira el `Caballero` hardcodeado/self-only de `engine-c`; `KeloPlayerStats` separa counters de rewards; `KeloTitles` usa catálogo indexado data-driven; Nobleza integra una pestaña sin asumir ownership; nameplate usa `KeloAvatar` para local/remote; `equippedTitleId` replica por net; server posee unlock/equip y solo expone get/equip/unequip.

Toda retirada:

`IDENTIFICAR → MIGRAR CONSUMIDORES → TEST → LIVE → MARCAR DEAD → RETIRAR`

---

# DATA-DRIVEN — CAMINO OFICIAL

```text
Ability → abilityData → delivery/effects → KeloAbilities → KeloSimulation/KeloRender → VisualSystem
Melee → profile → KeloMeleeEngine → KeloCombatEngine → events → presentation
Effect → definition/type → KeloEffectEngine
Progress stat → KeloPlayerStats → player:stat_changed → KeloTitles → reward/title state
Title content → KeloTitleCatalog (ID + requirement + rarity) → KeloTitles → KeloActorNameplate/Nobility UI
Prop → contract/catalog → Property/World → KELO_COLLISION owner → renderer
VFX → manifest/primitive → KeloVisualSystem
Character → ContentPack/VisualPresets → KeloCharacterCustomization → KeloCharacterVisualStack → KeloAvatar
Avatar → KeloAvatar middleware nameplate 500 → visual 400 → aura 300 → character customization 250 → appearance 200 → hero 100 → base
Item → definition → backpack/equipment/container APIs
UI navigation → KELO_LUXE → system public API → render result
```

Contenido nuevo no debe crear una arquitectura paralela.

---

# DOCUMENTACIÓN OBLIGATORIA

Cada sistema/capacidad nueva debe cumplir `docs/SYSTEM_DOCUMENTATION_STANDARD.md`:

```text
CODE
  ↓
docs/systems/<SYSTEM>.md        ← humanos / IA
  ↓
docs/system-catalog.json       ← fuente de verdad documental
  ↓
guide.html (si playerVisible)  ← jugadores
  ↓
system-documentation-audit.js  ← CI
```

El catálogo Foundation contiene actualmente **12 sistemas registrados**, incluyendo `KeloCamera`, `KeloAvatar`, `KeloCharacterCustomization`, `KELO_LUXE`, `KeloPlayerStats` y `KeloTitles`.

Un cambio de contrato no se considera completo si la documentación técnica o la mecánica pública queda desactualizada.

---

# ONLINE-FIRST

Leer `docs/ONLINE_FIRST.md`.

Regla: UI/cliente solicita operaciones; autoridad crítica puede migrar al server sin rediseñar IDs, ownership, contratos o flujo de jugador. Character Customization ya expone `networkSnapshot()` IDs-only; antes de producción, el server debe validar ownership/unlocks de cosméticos sin cambiar el renderer ni el flujo del editor. Títulos ya usan IDs estables (`equippedTitleId`) y snapshots `server-titles-v1`; el cliente no puede declarar kills/unlocks y falla cerrado hasta snapshot online. El menú principal solo enruta solicitudes hacia owners; no adquiere autoridad de inventario, combate, mercado, propiedad, nobleza, títulos ni cosméticos.

---

# FOUNDATION STATUS

| Criterio | Estado Foundation |
|---|---|
| Constitución técnica | ✅ `docs/KELO_FOUNDATION.md` |
| Entrada obligatoria para agentes/humanos | ✅ `AGENTS.md` |
| ENGINE_MAP sincronizado a V6.53 Foundation | ✅ este documento |
| Estándar de documentación | ✅ `docs/SYSTEM_DOCUMENTATION_STANDARD.md` |
| Catálogo documental | ✅ 12 sistemas en `docs/system-catalog.json` |
| Input lock owner único | ✅ `KeloInputLocks` |
| Writers directos `KELO_MODAL_INPUT_LOCK` LIVE | ✅ 0 |
| Input pipeline owner único | ✅ `KeloInput` |
| Movement extension owner único | ✅ `KeloMovement` |
| Camera / viewport owner único | ✅ `KeloCamera`; adapters directos legacy explícitos únicamente en `engine-b/c` |
| Responsive rotation contract | ✅ base zoom estable + effective zoom orientation-aware; browser audit V3 verde |
| Main Canvas DPR/viewport | ✅ `KeloCamera`; `engine-l` HiDPI retirado |
| Render extension owner único | ✅ `KeloRender`; LIVE = `engine-c` + owner |
| Simulation extension owner único | ✅ `KeloSimulation`; LIVE = `engine-c` + owner |
| Avatar render owner único | ✅ `KeloAvatar`; wrapper `Caballero` de `engine-c` retirado |
| Player stats owner | ✅ `KeloPlayerStats`; reward-free + online fail-closed |
| Unlockable titles owner | ✅ `KeloTitles`; catálogo data-driven/indexado, no frame polling |
| Titles online authority | ✅ get/equip/unequip por net; kill/unlock solo en server; `equippedTitleId` replicado |
| Character customization owner | ✅ `KeloCharacterCustomization` + shared SlotSchema/VisualStack; Character Creator V2 LIVE verde |
| Character modal/input safety | ✅ token `KeloInputLocks`; close audit deja 0 claims del customizer |
| Character online visual contract | ✅ `kelo-character-visual-v2`; IDs + palettes + revision, sin gameplay state |
| Main menu navigation owner | ✅ `KELO_LUXE`; una sola superficie, rutas owner-backed y placeholders sin owner ocultos |
| Main menu modal/input safety | ✅ tokens `luxe-main-menu` / `luxe-chat` sobre `KeloInputLocks` |
| Collision lifecycle owner único | ✅ `KELO_COLLISION`; buckets por owner + vista legacy `obstacles` |
| Direct collider writes migrados | ✅ 0 en Generic Props, Property, World Builder y Ability Walls |
| World Builder collider rebuild por frame | ✅ eliminado para estado sin cambios mediante dirty/revision sync |
| Ability runtime core wrappers | ✅ 0; usa `KeloSimulation` + `KeloRender` |
| Ability wall collider lifecycle | ✅ `abilities:walls` vía `KELO_COLLISION` |
| Backpack direct legacy lock writes | ✅ 0; token `KeloInputLocks` |
| Hotfix watchdog `force-unlock` activo | ✅ retirado y fuera del runtime |
| Prefab contract | ✅ LIVE; renderer genérico dormant probado como unidad |
| Generic Prop contract | ✅ contrato estructural LIVE + collision ownership |
| Property Editor | ✅ correctamente clasificado DORMANT; browser audit relacionado verde |
| House lifecycle/recovery | ✅ browser audit móvil/desktop relacionado verde |
| CI Camera Foundation V3 | ✅ verde en candidato V3 |
| CI Foundation Architecture | ✅ verde en Character Creator V2 PR |
| CI Character Customization V2 | ✅ contract + browser PR verdes; Pages LIVE audit verde post-merge |
| CI Premium Main Menu V4 | ✅ contract + browser PR verdes; Pages LIVE audit obligatorio post-merge |
| CI Kelo Titles | ⏳ dedicado en `.github/workflows/title-system-ci.yml`; validar verde en este pass antes de cierre |
| CI funcional relacionado | ✅ Character Customization, Camera, Foundation, Combat, Backpack y Prefab verdes en el pass V2; Terrain/Generic Prop/Mobile Performance/Studio/Ability Collision/House/Property conservan sus gates existentes |
| CI de assets global | ⚠️ Kelo CI / Visual System CI mantienen deuda de assets/manifest independiente y preexistente; no atribuida al Character Creator V2 ni a Titles |
| `main` protegido | ❌ no está protegido en la última lectura disponible |
| Legacy totalmente clasificado/migrado | ⚠️ en progreso; siguiente deuda prioritaria: inventory state, World Edit/storage, server PvP death authority, assets y adapters legacy restantes |

---

# REGLA FINAL

Antes de escribir código:

> **¿ESTOY CREANDO CONTENIDO O UNA CAPACIDAD?**

- CONTENIDO → REUTILIZA.
- CAPACIDAD → EXTIENDE EL OWNER.
- NUNCA → DUPLICA.

Después de cambiar un sistema:

> **¿SU DOCUMENTO TÉCNICO Y SU GUÍA DE JUGADOR SIGUEN DICIENDO LA VERDAD?**

Para las reglas completas, ver `docs/KELO_FOUNDATION.md`.


## Logistics Admin UI — QA interno

- `src/ui/logistics-admin-ui.js` / `KeloLogisticsAdminUI`: **UI OWNER LIVE (DOM/estado efímero solamente)**.
- Consume `KeloLogisticsDevtools` y nunca escribe `STATE` gameplay directamente.
- Permiso: reutiliza `KELO_ADMIN_KEYS` con scope root existente `admin.issue`; no crea otra puerta admin.
- Input: reclama/libera `KeloInputLocks` mediante token `logistics-admin-ui`.
- Runtime: carga inmediatamente después de `admin-key-system.js`, cuando economía regional/caravanas/facciones/devtools ya están disponibles.
- Online-first: `UI → KeloLogisticsDevtools → owner.request → local/server authority`; el panel nunca se convierte en autoridad.
