# ENGINE_MAP — Kelo World

> **ANTES DE CREAR O MODIFICAR UN SISTEMA:** lee `docs/KELO_FOUNDATION.md`, `docs/SYSTEM_DOCUMENTATION_STANDARD.md` y `AGENTS.md`. Toda feature nueva debe reutilizar un OWNER existente o justificar una CAPACIDAD nueva.

**Estado:** índice maestro operativo del runtime Foundation actual.  
**Runtime declarado en `index.html`:** Kelo World V6.53.  
**Foundation verificada:** 2026-09-08 · rama `foundation/kelo-foundation-v1-2` · CI Foundation #106 verde sobre `02945dcc1470b638cfee31cac54a97c862f79935`.  
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

A fecha de la verificación Foundation #106, el inventario LIVE demuestra:

```text
processInput wrappers   = 1 → KeloInput
updateMovement wrappers = 1 → KeloMovement
render wrappers         = 2 → engine-c + KeloRender
updateSimulation        = 2 → engine-c + KeloSimulation
renderAvatar            = 2 → engine-c + KeloAvatar
```

Para Render, Simulation y Avatar, `engine-c` define/orquesta el entrypoint legacy y un único owner Foundation lo envuelve. No quedan wrappers feature-level LIVE de esos tres globals.

La existencia de un archivo en `src/` NO demuestra por sí sola que esté LIVE. La carga real puede ser directa desde `index.html` o dinámica desde un bootstrap LIVE. `profile-panel-close.js` sigue siendo un bootstrap tardío para foundations adicionales de combat/effects/melee; esa frontera todavía debe limpiarse sin crear un segundo boot system.

---

# ORDEN DE CARGA — BLOQUES REALES DE V6.53 FOUNDATION

`index.html` carga conceptualmente en este orden:

```text
0.  KeloEvents + KeloInputLocks
1.  collision-utils + engine-a
2.  KeloInput + KeloMovement + engine-b + engine-c
3.  KeloRender + KeloSimulation + KeloAvatar
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

El orden importa: `KeloAvatar` se instala inmediatamente después de `engine-c`, de modo que los renderers históricos posteriores registran base/middleware en el owner en vez de sustituir el global por su cuenta.

---

# OWNERS ACTUALES Y DEUDA

| Responsabilidad | Owner / API | Estado | Nota Foundation |
|---|---|---|---|
| Core state / parsers legacy | `engine-a.js` | OWNER LIVE LEGACY CORE / NEEDS_AUDIT | Aún concentra estado, input físico y física base; extracción incremental, no rewrite |
| Input lock claims | `src/core/input-lock-system.js` / `KeloInputLocks` | OWNER LIVE FOUNDATION | Token claims; `KELO_MODAL_INPUT_LOCK` queda como adapter legacy temporal |
| Input pipeline | `src/core/input-system.js` / `KeloInput` | OWNER LIVE FOUNDATION / TRANSITIONAL | Único wrapper de `processInput`; `engine-a` conserva parser legacy consumido por el owner |
| Movement extension ownership | `src/core/movement-system.js` / `KeloMovement` | OWNER LIVE FOUNDATION / TRANSITIONAL | Único wrapper de `updateMovement`; hooks before/after deterministas |
| Movement physics | `engine-a.js` | OWNER LIVE LEGACY CORE | Desplazamiento + colisión actual; extraer más adelante sin cambiar feel |
| Gait/speed/stride | `engine-ac.js` vía `KeloMovement` | SUPPORT LIVE | Ya no envuelve `updateMovement` |
| Release brake | `engine-ah.js` vía `KeloMovement` | SUPPORT LIVE | Ya no envuelve `updateMovement` |
| Collision primitives | `src/physics/collision-utils.js` / `KELO_COLLISION` | OWNER LIVE | No duplicar geometría |
| Camera/zoom | core + engines tardíos + mobile orientation | NEEDS_AUDIT | Ownership todavía compartido; consolidar con tests móviles |
| Render base/orchestration | `engine-c.js` | OWNER LIVE LEGACY CORE | Orquesta frame/mundo/actores/UI Canvas |
| Render extensions | `src/core/render-extension-system.js` / `KeloRender` | OWNER LIVE FOUNDATION / TRANSITIONAL | Único wrapper Foundation de `render`; intercept + before/afterFrame |
| Simulation extensions | `src/core/simulation-extension-system.js` / `KeloSimulation` | OWNER LIVE FOUNDATION / TRANSITIONAL | Único wrapper Foundation de `updateSimulation`; features usan before/after |
| Avatar render composition | `src/core/avatar-render-system.js` / `KeloAvatar` | OWNER LIVE FOUNDATION / TRANSITIONAL | Único wrapper Foundation de `renderAvatar`; `setBase` preserva reemplazos y `use` fallbacks/middleware |
| Avatar base actual | `engine-w.js` registrado en `KeloAvatar` | SUPPORT LIVE | Base final histórico; `engine-d/e` ya no reemplazan el global |
| Hero sprite | `engine-ab.js` vía `KeloAvatar.use(...,100)` | SUPPORT LIVE | Fallback condicional hero.PNG |
| Character appearance | `src/characters/character-appearance.js` vía `KeloAvatar.use(...,200)` | SUPPORT LIVE | Middleware externo; cadena verificada appearance → hero → base |
| World renderer | `src/environment/world-map.js` / `KELO_WORLD_RENDERER` | OWNER LIVE | World content entra por contracts/renderer |
| Environment assets/contracts | `src/environment/*` | OWNER/SUPPORT | Registry/contracts antes de hardcode |
| Visual/VFX | `src/visuals/*` / `KeloVisualSystem` | OWNER LIVE | Presentación no decide gameplay |
| Event bus | `src/core/events/event-bus.js` / `KeloEvents` | OWNER LIVE FOUNDATION | Carga directa temprana; primitive genérico, no crear otro bus global |
| Combat foundation | `KeloCombatEngine` + Hit/Damage resolvers | DYNAMIC LIVE | Gameplay/presentation separados; server adapter puede reemplazar authority |
| Effects foundation | `KeloEffectEngine` | DYNAMIC LIVE | Registry data-driven de efectos |
| Melee foundation | `KeloMeleeEngine` | DYNAMIC LIVE | Perfil → CombatEngine; no HP/render directo |
| Ability runtime moderno | `src/abilities/kelo-ability-boot.js` / `KeloAbilities` | OWNER LIVE | Nueva ability = data + primitives |
| Stone/loadout moderno | `src/abilities/stone-system.js` / `KeloStones` | OWNER LIVE | Legacy stones no recibe features |
| Sword Swap runtime | ability/runtime + PvP visuals | OWNER LIVE feature / SUPPORT Foundation | Tick usa `KeloSimulation`; ya no envuelve simulation. Gameplay especial aún debe converger a contracts genéricos cuando sea seguro |
| PvP world | `src/systems/pvp-world.js` | OWNER LIVE feature / NEEDS_AUDIT authority | Render exclusivo usa `KeloRender`; tick usa `KeloSimulation`; autoridad local sigue siendo prototipo |
| Networking client | `engine-net.js` / `KeloNetAuthority` | OWNER LIVE transporte | Pose/interpolación usan owners Foundation; transporte no equivale a autoridad |
| Server authority | `server/*` | SERVER-AUTHORITATIVE donde aplique | Economía/combate online final no confían en cliente |
| Equipment | `src/systems/equipment-system.js` | OWNER LIVE client | Reutilizar API; no escribir internals |
| Backpack/inventory | `src/systems/backpack-system.js` | OWNER LIVE moderno / migración | Consolidar STATE/inventory legacy antes de retirar |
| Containers | `src/systems/container-system.js` | OWNER LIVE | Inventory ownership debe permanecer explícito |
| Market escrow | `src/systems/market-escrow-system.js` | OWNER client/fallback | Online debe pasar por authority |
| Property | `src/property/property-system.js` | OWNER LIVE | Una placement debe tener un owner físico |
| Instances | `src/instances/*` | OWNER LIVE | Reutilizar runtime/bridges existentes |
| World Builder runtime | `src/environment/world-builder-system.js` | OWNER/SUPPORT / NEEDS_AUDIT | Collider/render sync y authoring boundaries mantienen deuda |
| UI | `src/ui/*` | CONSUMER | UI consume APIs; no gobierna gameplay state ajeno |
| Legacy modal lock writers | varias UIs escribiendo `KELO_MODAL_INPUT_LOCK` | LEGACY / MIGRATION | Código nuevo debe usar `KeloInputLocks`; writers viejos se migran progresivamente |
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

El CI Foundation ya contiene contratos específicos para Input, Movement, Render, Simulation y Avatar, además del inventario de deuda LIVE.

---

# LEGACY / DUPLICACIÓN A CONSOLIDAR

Deuda prioritaria, sin borrar a ciegas:

1. Migrar writers legacy de modal input a `KeloInputLocks`; `force-unlock-move` ya está retirado.
2. Extraer en el futuro parser/física base de `engine-a` detrás de `KeloInput`/`KeloMovement` sin cambiar gameplay.
3. Consolidar camera/zoom ownership, especialmente orientación/DPR móvil.
4. Abilities/stones legacy en engines vs `src/abilities/*`.
5. Inventory/equipment legacy state vs sistemas modernos.
6. Collision ownership Property/World Builder y lifecycle de colliders.
7. World Edit authoring/runtime boundaries, persistencia y snapshots.
8. Core bootstrap disparado desde un archivo de UI.
9. Timers/MutationObservers/global writers restantes según inventario Foundation, priorizados por impacto medido.

**Resuelto en esta fase:** las cadenas feature-level de wrappers de Render, Simulation y Avatar. No reintroducirlas.

Toda retirada:

`IDENTIFICAR → MIGRAR CONSUMIDORES → TEST → LIVE → MARCAR DEAD → RETIRAR`

---

# DATA-DRIVEN — CAMINO OFICIAL

```text
Ability → abilityData → delivery/effects → KeloAbilities → VisualSystem
Melee → profile → KeloMeleeEngine → KeloCombatEngine → events → presentation
Effect → definition/type → KeloEffectEngine
Prop → contract/catalog → Property/World → renderer/collision owner
VFX → manifest/primitive → KeloVisualSystem
Avatar → KeloAvatar base/middleware → appearance/hero presentation
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
| Input pipeline owner único | ✅ `KeloInput` |
| Movement extension owner único | ✅ `KeloMovement` |
| Render extension owner único | ✅ `KeloRender`; LIVE inventory 2 = `engine-c` + owner |
| Simulation extension owner único | ✅ `KeloSimulation`; LIVE inventory 2 = `engine-c` + owner |
| Avatar render owner único | ✅ `KeloAvatar`; LIVE inventory 2 = `engine-c` + owner |
| Avatar fallback contract | ✅ `AVATAR_RENDER_OK`: appearance → hero → base |
| `engine-ac`/`engine-ah` wrappers de movement | ✅ eliminados; ahora hooks |
| Hotfix watchdog `force-unlock` activo | ✅ retirado y fuera del runtime |
| Cero nuevos wrappers core feature-level | ✅ política + contratos + Foundation audit |
| Legacy totalmente clasificado/migrado | ⚠️ en progreso |
| APIs públicas completas documentadas | ⚠️ en progreso |
| CI arquitectónico/documental | ✅ Foundation #106 probado; validar cada HEAD de PR |
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
