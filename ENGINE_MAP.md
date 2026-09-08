# ENGINE_MAP — Kelo World

> **ANTES DE CREAR O MODIFICAR UN SISTEMA:** lee `docs/KELO_FOUNDATION.md`, `docs/SYSTEM_DOCUMENTATION_STANDARD.md` y `AGENTS.md`. Toda feature nueva debe reutilizar un OWNER existente o justificar una CAPACIDAD nueva.

**Estado:** índice maestro operativo del runtime actual.  
**Foundation baseline:** 2026-09-08 · `main` `ef6bdd087b851d36768e7f3a31ca767974d3d21e`.  
**Versión declarada en `index.html`:** Kelo World V6.53.  
**Regla de autoridad documental:** si este mapa contradice `index.html` o comportamiento LIVE verificado, gana el runtime y este archivo debe corregirse en el mismo pass.  
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

Kelo World es un juego web 2D top-down móvil-first sobre Canvas. El runtime todavía carga una cadena extensa de `engine-*.js`, pero los dominios modernos ya se están moviendo a `src/` con contratos explícitos: core/events, input locks, movement extensions, physics, environment, abilities, visuals, combat/effects/melee, property, instances, systems y UI.

La Foundation NO crea un segundo engine. El objetivo es reducir progresivamente los engines históricos hasta que el contenido nuevo entre por owners y contratos estables.

La existencia de un archivo en `src/` NO demuestra por sí sola que esté LIVE. La carga real puede ser directa desde `index.html` o dinámica desde un bootstrap LIVE. En V6.53, `profile-panel-close.js` carga `src/core/kelo-runtime-bootstrap.js`, y éste instala Event Bus + combat/effects/melee; por tanto ese foundation es **DYNAMIC LIVE**, aunque no aparezca como `<script>` directo en `index.html`.

---

# ORDEN DE CARGA — BLOQUES REALES DE V6.53 FOUNDATION

`index.html` carga conceptualmente en este orden:

```text
0. Foundation primitives: KeloEvents + KeloInputLocks
1. collision-utils + engine-a + KeloMovement + engine-b..k
2. environment contracts / atlases / world-map + engine-l
3. engine-m..aj + character appearance + pvp-world
4. KeloInput gate sobre processInput legacy final
5. Visual System / manifests / asset registry / animation / FX / sequence
6. modern abilities + stone bridge + sword swap visuals/runtime
7. engine-net
8. Luxe/UI + mobile orientation + plaza depth
9. gameplay systems (nobility/equipment/backpack/container/emote/market)
10. property + instances + world builder
11. UI panels
12. forge/aura/illumination/performance
13. profile-panel-close → dynamic runtime bootstrap → Event Bus + combat/effects/melee
14. self interaction/PvP guards/visual integration
```

`force-unlock-move.js` está **RETIRED** y ya no se carga en runtime Foundation.

El script cargado más tarde puede envolver o modificar globals anteriores. Por eso Foundation prohíbe nuevos wrappers core cuando exista hook/API.

---

# OWNERS ACTUALES Y DEUDA

| Responsabilidad | Owner / API | Estado | Nota Foundation |
|---|---|---|---|
| Core state / game loop base | `engine-a.js` | OWNER LIVE / NEEDS_AUDIT | Demasiadas responsabilidades; extracción incremental, no rewrite |
| Input lock claims | `src/core/input-lock-system.js` / `KeloInputLocks` | OWNER LIVE FOUNDATION | Token claims; `KELO_MODAL_INPUT_LOCK` queda como adapter legacy temporal |
| Input base | `engine-a.js` + `src/core/input-gate.js` bridge | NEEDS_AUDIT / FOUNDATION BRIDGE | Input gate consulta `KeloInputLocks`; física/input base aún legacy |
| Movement extension ownership | `src/core/movement-system.js` / `KeloMovement` | OWNER LIVE FOUNDATION / TRANSITIONAL | Único wrapper autorizado de `updateMovement`; hooks before/after deterministas |
| Movement physics | `engine-a.js` | OWNER LIVE LEGACY CORE | Desplazamiento + colisión actual; extraer más adelante sin cambiar feel |
| Gait/speed/stride | `engine-ac.js` vía `KeloMovement` | SUPPORT LIVE | Ya no envuelve `updateMovement` |
| Release brake | `engine-ah.js` vía `KeloMovement` | SUPPORT LIVE | Ya no envuelve `updateMovement` |
| Collision primitives | `src/physics/collision-utils.js` / `KELO_COLLISION` | OWNER LIVE | No duplicar geometría |
| Camera/zoom | core + engines tardíos + mobile orientation | NEEDS_AUDIT | Consolidar ownership con tests móviles |
| Render orchestration | `engine-c.js` | OWNER LIVE | Preferir hooks oficiales a wrappers |
| World renderer | `src/environment/world-map.js` / `KELO_WORLD_RENDERER` | OWNER LIVE | World content entra por contracts/renderer |
| Environment assets/contracts | `src/environment/*` | OWNER/SUPPORT | Registry/contracts antes de hardcode |
| Visual/VFX | `src/visuals/*` / `KeloVisualSystem` | OWNER LIVE | Presentación no decide gameplay |
| Event bus | `src/core/events/event-bus.js` / `KeloEvents` | DYNAMIC LIVE + early Foundation load | Primitive genérico; reutilizar, no crear otro bus global |
| Combat foundation | `KeloCombatEngine` + Hit/Damage resolvers | DYNAMIC LIVE | Gameplay/presentation separados; server adapter puede reemplazar authority |
| Effects foundation | `KeloEffectEngine` | DYNAMIC LIVE | Registry data-driven de efectos |
| Melee foundation | `KeloMeleeEngine` | DYNAMIC LIVE | Perfil → CombatEngine; no HP/render directo |
| Ability runtime moderno | `src/abilities/kelo-ability-boot.js` / `KeloAbilities` | OWNER LIVE | Nueva ability = data + primitives |
| Stone/loadout moderno | `src/abilities/stone-system.js` / `KeloStones` | OWNER LIVE | Legacy stones no recibe features |
| Sword Swap | ability/runtime + PvP integration + visuals | OWNER LIVE feature / NEEDS_AUDIT | Debe converger hacia owners genéricos sin alterar gameplay |
| PvP world | `src/systems/pvp-world.js` + networking/authority según modo | NEEDS_AUDIT | Ya usa Combat/Melee; aún mezcla transiciones y casos especiales |
| Networking client | `engine-net.js` | OWNER LIVE transporte | Transporte no equivale a autoridad |
| Server authority | `server/*` | SERVER-AUTHORITATIVE donde aplique | Economía/combate online no confían en cliente final |
| Equipment | `src/systems/equipment-system.js` | OWNER LIVE client | Reutilizar API; no escribir internals |
| Backpack/inventory | `src/systems/backpack-system.js` | OWNER LIVE moderno / migración | Consolidar STATE/inventory legacy antes de retirar |
| Containers | `src/systems/container-system.js` | OWNER LIVE | Inventory ownership debe permanecer explícito |
| Market escrow | `src/systems/market-escrow-system.js` | OWNER client/fallback | Online debe pasar por authority |
| Property | `src/property/property-system.js` | OWNER LIVE | Una placement debe tener un owner físico |
| Instances | `src/instances/*` | OWNER LIVE | Reutilizar runtime/bridges existentes |
| World Builder runtime | `src/environment/world-builder-system.js` | OWNER/SUPPORT / NEEDS_AUDIT | Runtime bien separado de authority; collider/render sync aún tiene deuda |
| UI | `src/ui/*` | CONSUMER | UI consume APIs; no gobierna gameplay state ajeno |
| Legacy modal lock writers | varias UIs escribiendo `KELO_MODAL_INPUT_LOCK` | LEGACY / MIGRATION | El adapter ya evita clobber; código nuevo debe usar tokens y writers viejos se migran progresivamente |
| `src/ui/modal-input-lock.js` | compatibilidad antigua | RETIRED COMPAT | Ya no envuelve `processInput`; conserva loader histórico si algún consumidor lo solicita |
| `force-unlock-move.js` | ninguno | RETIRED HOTFIX / NOT LOADED | 0 timers, 0 wrappers, 0 clear de locks/build mode |
| Runtime bootstrap | `src/core/kelo-runtime-bootstrap.js` | DYNAMIC LIVE | Actualmente lanzado desde `profile-panel-close.js`; boot ownership debe limpiarse después |

---

# CORE EXTENSION POINTS PREFERIDOS

Antes de envolver core, buscar y reutilizar:

```text
KeloEvents
KeloInputLocks
KeloMovement.before / after
KELO_COLLISION
KELO_WORLD_RENDERER.draw
drawPreActors
drawPostActors
KeloVisualSystem layers/update
KeloCombatEngine / KeloEffectEngine / KeloMeleeEngine
KeloAbilities
KeloStones
Property/Instance APIs
system-owned event buses
```

Prohibición Foundation: no introducir wrappers nuevos directos de `render`, `renderAvatar`, `updateSimulation`, `processInput` o `updateMovement` cuando exista un punto de extensión apropiado.

---

# LEGACY / DUPLICACIÓN A CONSOLIDAR

Deuda prioritaria, sin borrar a ciegas:

1. Migrar writers legacy de modal input a `KeloInputLocks`; `force-unlock-move` ya está retirado y fuera del runtime.
2. Extraer en el futuro la física base de `engine-a` detrás de `KeloMovement`; wrapper chain `engine-ac/engine-ah` ya eliminado.
3. Abilities/stones legacy en engines vs `src/abilities/*`.
4. Inventory/equipment legacy state vs sistemas modernos.
5. Render/avatar wrapper chain.
6. Camera/zoom ownership compartido.
7. Collision ownership Property/World Builder.
8. World Edit authoring/runtime boundaries.
9. Core bootstrap disparado desde un archivo de UI.

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
| Catálogo documental + guía pública | ✅ `docs/system-catalog.json` + `guide.html` |
| Input lock owner único | ✅ `KeloInputLocks` |
| Movement extension owner único | ✅ `KeloMovement` |
| `engine-ac`/`engine-ah` wrappers de movement | ✅ eliminados; ahora hooks |
| Hotfix watchdog `force-unlock` activo | ✅ retirado y fuera del runtime |
| Owner único para todos los demás dominios críticos | ⚠️ en progreso |
| Cero nuevos wrappers core | ✅ política + Foundation audit para deuda nueva |
| Legacy totalmente clasificado/migrado | ⚠️ en progreso |
| APIs públicas completas documentadas | ⚠️ en progreso |
| CI arquitectónico/documental | ✅ workflow Foundation; validar cada HEAD de PR |
| `main` protegido | ❌ baseline GitHub indica branch sin protección |
| Móvil/desktop/LIVE post-migración | pendiente por cada cambio conductual antes de merge |

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