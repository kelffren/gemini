# ENGINE_MAP — Kelo World

> **ANTES DE CREAR O MODIFICAR UN SISTEMA:** lee `docs/KELO_FOUNDATION.md`, `docs/SYSTEM_DOCUMENTATION_STANDARD.md` y `AGENTS.md`. Toda feature nueva debe reutilizar un OWNER existente o justificar una CAPACIDAD nueva.

**Estado:** índice maestro operativo del runtime Foundation actual.  
**Runtime declarado en `index.html`:** Kelo World V6.53.  
**Foundation verificada:** 2026-09-08 · rama `foundation/kelo-foundation-v1-2` · CI Foundation #127 verde sobre `b451500dfaf03c99435bc045a474fd44802479cd`.  
**Regla de autoridad documental:** si este mapa contradice `index.html`, los contratos Foundation o comportamiento LIVE verificado, gana el runtime y este archivo debe corregirse en el mismo pass.  
**Mapa histórico V6.16 preservado:** `docs/archive/ENGINE_MAP_V6.16.md`.

## Cómo leer este mapa

Estados válidos:

- **OWNER LIVE**: dueño actual demostrado por carga/runtime.
- **SUPPORT**: participa, no posee la decisión final.
- **LEGACY**: compatibilidad; no recibe features nuevas.
- **HOTFIX**: parche temporal; no copiar como patrón.
- **DYNAMIC LIVE**: forma parte del runtime, pero entra mediante bootstrap dinámico.
- **PREPARED**: existe en repo pero no está demostrado LIVE.
- **DEAD**: no forma parte del runtime.
- **EXPERIMENTAL**: prototipo no consolidado.
- **SERVER-AUTHORITATIVE**: decisión final online vive en server.
- **CLIENT/FALLBACK**: implementación local/offline/prototipo.
- **NEEDS_AUDIT**: ownership todavía compartido o ambiguo.

---

# ESTADO DEL PROYECTO EN 60 SEGUNDOS

Kelo World es un juego web 2D top-down móvil-first sobre Canvas. El runtime todavía carga una cadena extensa de `engine-*.js`, pero los puntos de extensión core que antes se encadenaban mediante wrappers ya tienen owners Foundation explícitos.

La Foundation NO crea un segundo engine. `engine-a.js` y `engine-c.js` siguen conteniendo core legacy real; Foundation coloca fronteras estables alrededor de sus globals mientras se extraen responsabilidades de forma incremental.

A fecha de la verificación Foundation #127, el inventario LIVE saneado — ignorando comentarios, strings y asignaciones locales — demuestra:

```text
processInput wrappers        = 1 → KeloInput
updateMovement wrappers      = 1 → KeloMovement
render wrappers              = 2 → engine-c + KeloRender
updateSimulation wrappers    = 2 → engine-c + KeloSimulation
renderAvatar wrappers        = 2 → engine-c + KeloAvatar
KELO_MODAL_INPUT_LOCK writes = 0 LIVE
```

Para Render, Simulation y Avatar, `engine-c` define/orquesta el entrypoint legacy y un único owner Foundation lo envuelve. No quedan wrappers feature-level LIVE de esos tres globals. `kelo-ability-boot`, `armor-aura` y `visual-integration` ya consumen los owners Foundation mediante hooks/middleware.

El adapter `KELO_MODAL_INPUT_LOCK` sigue existiendo dentro de `KeloInputLocks` para compatibilidad, pero el inventario actual no encuentra ningún writer directo LIVE. Los 5 writes restantes están únicamente en archivos de repo no cargados directamente por el runtime (`self-profile-touch-hotfix` y `builder-restore-move`).

La existencia de un archivo en `src/` NO demuestra por sí sola que esté LIVE. La carga real puede ser directa desde `index.html` o dinámica desde un bootstrap LIVE. `profile-panel-close.js` sigue siendo un bootstrap tardío para foundations adicionales de combat/effects/melee; esa frontera todavía debe limpiarse sin crear un segundo boot system.

---

# ORDEN DE CARGA — BLOQUES REALES DE V6.53 FOUNDATION

`index.html` carga conceptualmente en este orden:

```text
0.  KeloEvents + KeloInputLocks
1.  collision-utils + engine-a
2.  KeloInput + KeloMovement + engine-b + engine-c
3.  KeloAvatar + KeloRender + KeloSimulation
4.  engine-d..k
5.  environment contracts / atlases / world-map + engine-l
6.  engine-m..aj + character appearance + pvp-world
7.  Visual System / manifests / asset registry / animation / FX / sequence
8.  modern abilities + stones + Sword Swap runtime/visuals
9.  engine-net
10. Luxe/UI + mobile orientation + plaza depth
11. gameplay systems (nobility/equipment/backpack/container/emote/market)
12. property + instances + world builder + UI panels
13. forge/aura/illumination/performance
14. profile-panel-close → dynamic runtime bootstrap de foundations adicionales
15. self interaction / PvP touch guard / visual lab / visual integration
```

`force-unlock-move.js` está **RETIRED** y ya no se carga en runtime Foundation.

El orden importa: `KeloAvatar` se instala inmediatamente después de `engine-c`, de modo que los renderers históricos posteriores registran base/middleware en el owner en vez de sustituir el global por su cuenta. `KeloRender` y `KeloSimulation` hacen lo mismo para frame/tick.

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
| Collision primitives | `src/physics/collision-utils.js` / `KELO_COLLISION` | OWNER LIVE | No duplicar geometría |
| Camera/zoom | core + engines tardíos + mobile orientation | NEEDS_AUDIT | Ownership todavía compartido; consolidar con tests móviles |
| Render base/orchestration | `engine-c.js` | OWNER LIVE LEGACY CORE | Orquesta frame/mundo/actores/UI Canvas |
| Render extensions | `src/core/render-extension-system.js` / `KeloRender` | OWNER LIVE FOUNDATION / TRANSITIONAL | Único wrapper Foundation de `render`; intercept + before/afterFrame; inventario LIVE 2/2 esperado |
| Simulation extensions | `src/core/simulation-extension-system.js` / `KeloSimulation` | OWNER LIVE FOUNDATION / TRANSITIONAL | Único wrapper Foundation de `updateSimulation`; inventario LIVE 2/2 esperado |
| Avatar render composition | `src/core/avatar-render-system.js` / `KeloAvatar` | OWNER LIVE FOUNDATION / TRANSITIONAL | Único wrapper Foundation de `renderAvatar`; `setBase` + middleware ordenado; inventario LIVE 2/2 esperado |
| Avatar base actual | `engine-w.js` registrado en `KeloAvatar` | SUPPORT LIVE | Base final histórico; `engine-d/e` ya no reemplazan el global |
| Hero sprite | `engine-ab.js` vía `KeloAvatar.use(...,100)` | SUPPORT LIVE | Fallback condicional hero.PNG |
| Character appearance | `src/characters/character-appearance.js` vía `KeloAvatar.use(...,200)` | SUPPORT LIVE | Appearance por fuera del hero/base |
| Armor aura | `src/systems/armor-aura.js` vía `KeloAvatar.use(...,300)` | SUPPORT LIVE FOUNDATION | Dibuja back/front alrededor del avatar sin envolver `renderAvatar` |
| Actor visual integration | `src/visuals/visual-integration.js` vía `KeloAvatar.use(...,400)` | SUPPORT LIVE FOUNDATION | Transform + actorBackFX/frontFX; middleware más exterior del actor actual |
| World renderer | `src/environment/world-map.js` / `KELO_WORLD_RENDERER` | OWNER LIVE | World content entra por contracts/renderer |
| Environment assets/contracts | `src/environment/*` | OWNER/SUPPORT | Registry/contracts antes de hardcode |
| Visual/VFX | `src/visuals/*` / `KeloVisualSystem` | OWNER LIVE | Presentación no decide gameplay |
| Event bus | `src/core/events/event-bus.js` / `KeloEvents` | OWNER LIVE FOUNDATION | Carga directa temprana; primitive genérico, no crear otro bus global |
| Combat foundation | `KeloCombatEngine` + Hit/Damage resolvers | DYNAMIC LIVE | Gameplay/presentation separados; server adapter puede reemplazar authority |
| Effects foundation | `KeloEffectEngine` | DYNAMIC LIVE | Registry data-driven de efectos |
| Melee foundation | `KeloMeleeEngine` | DYNAMIC LIVE | Perfil → CombatEngine; no HP/render directo |
| Ability runtime moderno | `src/abilities/kelo-ability-boot.js` / `KeloAbilities` | OWNER LIVE | Tick vía `KeloSimulation.after(...,1000)` y FX legacy vía `KeloRender.afterFrame(...,1000)`; 0 wrappers core directos |
| Stone/loadout moderno | `src/abilities/stone-system.js` / `KeloStones` | OWNER LIVE | Legacy stones no recibe features |
| Sword Swap runtime | ability/runtime + PvP visuals | OWNER LIVE feature / SUPPORT Foundation | Tick usa `KeloSimulation`; ya no envuelve simulation. Gameplay especial aún debe converger a contracts genéricos cuando sea seguro |
| PvP world | `src/systems/pvp-world.js` | OWNER LIVE feature / NEEDS_AUDIT authority | Render exclusivo usa `KeloRender`; tick usa `KeloSimulation`; autoridad local sigue siendo prototipo |
| Networking client | `engine-net.js` / `KeloNetAuthority` | OWNER LIVE transporte | Pose/interpolación usan owners Foundation; transporte no equivale a autoridad |
| Server authority | `server/*` | SERVER-AUTHORITATIVE donde aplique | Economía/combate online final no confían en cliente |
| Equipment | `src/systems/equipment-system.js` | OWNER LIVE client | Reutilizar API; no escribir internals |
| Backpack/inventory | `src/systems/backpack-system.js` + `KeloBackpackUI` | OWNER LIVE moderno / migración | UI usa token propio `KeloInputLocks`; estado legacy aún debe consolidarse antes de retirar |
| Containers | `src/systems/container-system.js` | OWNER LIVE | Inventory ownership debe permanecer explícito |
| Market escrow | `src/systems/market-escrow-system.js` | OWNER client/fallback | Online debe pasar por authority |
| Property | `src/property/property-system.js` | OWNER LIVE | Una placement debe tener un owner físico |
| Instances | `src/instances/*` | OWNER LIVE | Reutilizar runtime/bridges existentes |
| World Builder runtime | `src/environment/world-builder-system.js` | OWNER/SUPPORT / NEEDS_AUDIT | Collider/render sync y authoring boundaries mantienen deuda |
| UI | `src/ui/*` | CONSUMER | UI consume APIs; no gobierna gameplay state ajeno |
| Legacy modal lock writes LIVE | ninguno | RESUELTO EN RUNTIME | `modalLockWrite liveDirect=0`; adapter permanece por compatibilidad |
| Legacy modal lock writes REPO | `self-profile-touch-hotfix.js`, `builder-restore-move.js` | LEGACY / NOT DIRECT LIVE | 5 writes totales; retirar/migrar solo al decidir su destino, sin confundirlos con runtime LIVE |
| `src/core/input-gate.js` | compatibilidad antigua | RETIRED COMPAT | Ya no es segundo wrapper LIVE; su función quedó absorbida por `KeloInput` |
| `src/ui/modal-input-lock.js` | compatibilidad antigua | RETIRED COMPAT | No envuelve `processInput`; conservar solo mientras exista consumidor histórico |
| `force-unlock-move.js` | ninguno | RETIRED HOTFIX / NOT LOADED | 0 timers, 0 wrappers, no reparar locks/build mode por watchdog |
| Runtime bootstrap tardío | `src/core/kelo-runtime-bootstrap.js` desde `profile-panel-close.js` | DYNAMIC LIVE / NEEDS_AUDIT | Mover boot ownership fuera de UI cuando exista contrato claro |

---

# CORE EXTENSION POINTS PREFERIDOS

Antes de envolver core, buscar y reutilizar:

```text
KeloEvents
KeloInputLocks
KeloInput.before / after
KeloMovement.before / after
KeloRender.intercept / beforeFrame / afterFrame
KeloSimulation.before / after
KeloAvatar.setBase / use
KELO_COLLISION
KELO_WORLD_RENDERER.draw / drawPreActors / drawPostActors
KeloVisualSystem layers/update
KeloCombatEngine / KeloEffectEngine / KeloMeleeEngine
KeloAbilities
KeloStones
Property/Instance APIs
system-owned event buses
```

Prohibición Foundation: no introducir wrappers nuevos directos de `render`, `renderAvatar`, `updateSimulation`, `processInput` o `updateMovement` cuando exista un owner/punto de extensión apropiado.

El CI Foundation contiene contratos específicos para Input Locks, Input, Movement, Render, Simulation y Avatar, documentación obligatoria, inventario de deuda LIVE y syntax-check explícito de los consumidores recién migrados.

---

# LEGACY / DUPLICACIÓN A CONSOLIDAR

Deuda prioritaria, sin borrar a ciegas:

1. Decidir destino de los writers de modal lock que quedan solo en archivos no LIVE; no hay writer directo LIVE pendiente.
2. Extraer en el futuro parser/física base de `engine-a` detrás de `KeloInput`/`KeloMovement` sin cambiar gameplay.
3. Consolidar camera/zoom ownership, especialmente orientación/DPR móvil.
4. Abilities/stones legacy en engines vs `src/abilities/*`.
5. Inventory/equipment legacy state vs sistemas modernos.
6. Collision ownership Property/World Builder y lifecycle de colliders.
7. World Edit authoring/runtime boundaries, persistencia y snapshots.
8. Core bootstrap disparado desde un archivo de UI.
9. Timers/MutationObservers/global writers restantes según inventario Foundation, priorizados por impacto medido.
10. Deuda de assets/CI PNG se mantiene separada: no atribuir fallos de manifest/dimensiones a Foundation ownership.

**Resuelto en esta fase:** cadenas feature-level de wrappers de Render, Simulation y Avatar; writers directos LIVE de `KELO_MODAL_INPUT_LOCK`; Backpack lock tokenizado. No reintroducirlos.

Toda retirada:

`IDENTIFICAR → MIGRAR CONSUMIDORES → TEST → LIVE → MARCAR DEAD → RETIRAR`

---

# DATA-DRIVEN — CAMINO OFICIAL

```text
Ability → abilityData → delivery/effects → KeloAbilities → KeloSimulation/KeloRender → VisualSystem
Melee → profile → KeloMeleeEngine → KeloCombatEngine → events → presentation
Effect → definition/type → KeloEffectEngine
Prop → contract/catalog → Property/World → renderer/collision owner
VFX → manifest/primitive → KeloVisualSystem
Avatar → KeloAvatar middleware 400 visual → 300 aura → 200 appearance → 100 hero → base
Item → definition → backpack/equipment/container APIs
UI → system public API → render result
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

El catálogo Foundation contiene actualmente **7 sistemas registrados**, incluyendo `KeloAvatar`.

Un cambio de contrato no se considera completo si la documentación técnica o la mecánica pública queda desactualizada.

---

# ONLINE-FIRST

Leer `docs/ONLINE_FIRST.md`.

Regla: UI/cliente solicita operaciones; autoridad crítica puede migrar al server sin rediseñar IDs, ownership, contratos o flujo de jugador.

---

# FOUNDATION STATUS

| Criterio | Estado Foundation |
|---|---|
| Constitución técnica | ✅ `docs/KELO_FOUNDATION.md` |
| Entrada obligatoria para agentes/humanos | ✅ `AGENTS.md` |
| ENGINE_MAP sincronizado a V6.53 Foundation | ✅ este documento |
| Estándar de documentación | ✅ `docs/SYSTEM_DOCUMENTATION_STANDARD.md` |
| Catálogo documental | ✅ 7 sistemas en `docs/system-catalog.json` |
| Input lock owner único | ✅ `KeloInputLocks` |
| Writers directos `KELO_MODAL_INPUT_LOCK` LIVE | ✅ 0 |
| Input pipeline owner único | ✅ `KeloInput` |
| Movement extension owner único | ✅ `KeloMovement` |
| Render extension owner único | ✅ `KeloRender`; LIVE inventory 2 = `engine-c` + owner |
| Simulation extension owner único | ✅ `KeloSimulation`; LIVE inventory 2 = `engine-c` + owner |
| Avatar render owner único | ✅ `KeloAvatar`; LIVE inventory 2 = `engine-c` + owner |
| Avatar composition contract | ✅ visual 400 → aura 300 → appearance 200 → hero 100 → base |
| Ability runtime core wrappers | ✅ 0; usa `KeloSimulation` + `KeloRender` |
| Backpack direct legacy lock writes | ✅ 0; token `KeloInputLocks` |
| `engine-ac`/`engine-ah` wrappers de movement | ✅ eliminados; ahora hooks |
| Hotfix watchdog `force-unlock` activo | ✅ retirado y fuera del runtime |
| Cero nuevos wrappers core feature-level | ✅ política + contratos + Foundation audit |
| Legacy totalmente clasificado/migrado | ⚠️ en progreso |
| APIs públicas completas documentadas | ⚠️ en progreso |
| CI arquitectónico/documental | ✅ Foundation #127 probado; validar cada HEAD de PR |
| CI funcional relacionado | ✅ Ability Collision, Combat, Character Customization, Terrain y Mobile Performance verdes en la verificación de esta fase |
| CI de assets global | ⚠️ falla por deuda PNG/manifest independiente de esta migración |
| `main` protegido | ❌ última lectura de la rama Foundation no muestra protección aplicable aquí |
| Móvil/desktop/LIVE post-migración | ⚠️ contratos verdes; smoke visual/device sigue requerido antes de merge de cambios conductuales |

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
