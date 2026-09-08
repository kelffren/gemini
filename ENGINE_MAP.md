# ENGINE_MAP — Kelo World

> **ANTES DE CREAR O MODIFICAR UN SISTEMA:** lee `docs/KELO_FOUNDATION.md` y `AGENTS.md`. Toda feature nueva debe reutilizar un OWNER existente o justificar una CAPACIDAD nueva.

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
- **PREPARED**: existe en repo pero no está demostrado LIVE.
- **DEAD**: no forma parte del runtime.
- **EXPERIMENTAL**: prototipo no consolidado.
- **SERVER-AUTHORITATIVE**: decisión final online vive en server.
- **CLIENT/FALLBACK**: implementación local/offline/prototipo.
- **NEEDS_AUDIT**: ownership todavía compartido o ambiguo.

---

# ESTADO DEL PROYECTO EN 60 SEGUNDOS

Kelo World es un juego web 2D top-down móvil-first sobre Canvas. El runtime todavía carga una cadena extensa de `engine-*.js`, pero los dominios modernos ya se están moviendo a `src/` con contratos explícitos: physics, environment, abilities, visuals, property, instances, systems y UI.

La Foundation NO crea un segundo engine. El objetivo es reducir progresivamente los engines históricos hasta que el contenido nuevo entre por owners y contratos estables.

La existencia de un archivo en `src/` NO significa que esté LIVE. `index.html` manda sobre la carga cliente. Por ejemplo, `src/core/kelo-runtime-bootstrap.js` y los foundations de combat/effects/melee existen actualmente, pero en este baseline no están cargados directamente por `index.html`; por tanto se clasifican **PREPARED** hasta demostrar activación runtime.

---

# ORDEN DE CARGA — BLOQUES REALES DE V6.53

`index.html` carga conceptualmente en este orden:

```text
1. collision-utils + engine-a..k
2. environment contracts / atlases / world-map + engine-l
3. engine-m..aj + character appearance + pvp-world
4. Visual System / manifests / asset registry / animation / FX / sequence
5. modern abilities + stone bridge + sword swap visuals/runtime
6. engine-net
7. Luxe/UI + mobile orientation + plaza depth
8. gameplay systems (nobility/equipment/backpack/container/emote/market)
9. property + instances + world builder
10. UI panels
11. forge/aura/illumination/performance
12. profile/self interaction/PvP guards/visual integration
13. force-unlock-move HOTFIX
```

El script cargado más tarde puede envolver o modificar globals anteriores. Por eso Foundation prohíbe nuevos wrappers core cuando exista hook/API.

---

# OWNERS ACTUALES Y DEUDA

| Responsabilidad | Owner / API | Estado | Nota Foundation |
|---|---|---|---|
| Core state / game loop base | `engine-a.js` | OWNER LIVE / NEEDS_AUDIT | Demasiadas responsabilidades; extracción incremental, no rewrite |
| Input base | `engine-a.js` | NEEDS_AUDIT | Debe terminar produciendo intención únicamente |
| Movement | `engine-a.js` + soporte tardío | NEEDS_AUDIT | Conflicto de locks aún evidenciado por HOTFIX |
| Collision primitives | `src/physics/collision-utils.js` / `KELO_COLLISION` | OWNER LIVE | No duplicar geometría |
| Camera/zoom | core + engines tardíos + mobile orientation | NEEDS_AUDIT | Consolidar ownership con tests móviles |
| Render orchestration | `engine-c.js` | OWNER LIVE | Preferir hooks oficiales a wrappers |
| World renderer | `src/environment/world-map.js` / `KELO_WORLD_RENDERER` | OWNER LIVE | World content entra por contracts/renderer |
| Environment assets/contracts | `src/environment/*` | OWNER/SUPPORT | Registry/contracts antes de hardcode |
| Visual/VFX | `src/visuals/*` / `KeloVisualSystem` | OWNER LIVE | Presentación no decide gameplay |
| Ability runtime moderno | `src/abilities/kelo-ability-boot.js` / `KeloAbilities` | OWNER LIVE | Nueva ability = data + primitives |
| Stone/loadout moderno | `src/abilities/stone-system.js` / `KeloStones` | OWNER LIVE | Legacy stones no recibe features |
| Sword Swap | ability/runtime + visuals dedicados | OWNER LIVE feature | Debe consumir owners de ability/visual/collision |
| PvP world | `src/systems/pvp-world.js` + networking/authority según modo | NEEDS_AUDIT | Separar reglas, transporte y presentación |
| Networking client | `engine-net.js` | OWNER LIVE transporte | Transporte no equivale a autoridad |
| Server authority | `server/*` | SERVER-AUTHORITATIVE donde aplique | Economía/combate online no confían en cliente final |
| Equipment | `src/systems/equipment-system.js` | OWNER LIVE client | Reutilizar API; no escribir internals |
| Backpack/inventory | `src/systems/backpack-system.js` | OWNER LIVE moderno / migración | Consolidar STATE/inventory legacy antes de retirar |
| Containers | `src/systems/container-system.js` | OWNER LIVE | Inventory ownership debe permanecer explícito |
| Market escrow | `src/systems/market-escrow-system.js` | OWNER client/fallback | Online debe pasar por authority |
| Property | `src/property/property-system.js` | OWNER LIVE | Una placement debe tener un owner físico |
| Instances | `src/instances/*` | OWNER LIVE | Reutilizar runtime/bridges existentes |
| World Builder runtime | `src/environment/world-builder-system.js` | OWNER/SUPPORT | No debe duplicar collider ownership de Property |
| UI | `src/ui/*` | CONSUMER | UI consume APIs; no gobierna gameplay state ajeno |
| `force-unlock-move.js` | ninguno: parche | HOTFIX | Retirar solo al arreglar lock ownership |
| Combat/effects/melee foundation (`src/core/kelo-runtime-bootstrap.js`) | candidate APIs | PREPARED | No declarar LIVE hasta carga/runtime/test |

---

# CORE EXTENSION POINTS PREFERIDOS

Antes de envolver core, buscar y reutilizar:

```text
KELO_COLLISION
KELO_WORLD_RENDERER.draw
drawPreActors
drawPostActors
KeloVisualSystem layers/update
KeloAbilities
KeloStones
Property/Instance APIs
system-owned event buses
```

Prohibición Foundation: no introducir wrappers nuevos directos de `render`, `renderAvatar`, `updateSimulation` o `processInput` cuando exista un punto de extensión apropiado.

---

# LEGACY / DUPLICACIÓN A CONSOLIDAR

Deuda prioritaria, sin borrar a ciegas:

1. Input/movement locks y `force-unlock-move`.
2. Abilities/stones legacy en engines vs `src/abilities/*`.
3. Inventory/equipment legacy state vs sistemas modernos.
4. Render/avatar wrapper chain.
5. Camera/zoom ownership compartido.
6. Collision ownership Property/World Builder.
7. World Edit authoring/runtime boundaries.

Toda retirada:

`IDENTIFICAR → MIGRAR CONSUMIDORES → TEST → LIVE → MARCAR DEAD → RETIRAR`

---

# DATA-DRIVEN — CAMINO OFICIAL

```text
Ability → abilityData → delivery/effects → KeloAbilities → VisualSystem
Prop → contract/catalog → Property/World → renderer/collision owner
VFX → manifest/primitive → KeloVisualSystem
Item → definition → backpack/equipment/container APIs
UI → system public API → render result
```

Contenido nuevo no debe crear una arquitectura paralela.

---

# ONLINE-FIRST

Leer `docs/ONLINE_FIRST.md`.

Regla: UI/cliente solicita operaciones; autoridad crítica puede migrar al server sin rediseñar IDs, ownership, contratos o flujo de jugador.

---

# FOUNDATION STATUS

| Criterio | Estado baseline |
|---|---|
| Constitución técnica | ✅ `docs/KELO_FOUNDATION.md` |
| Entrada obligatoria para agentes/humanos | ✅ `AGENTS.md` |
| ENGINE_MAP sincronizado a V6.53 baseline | ✅ este documento |
| Owner único para todos los dominios críticos | ⚠️ en progreso |
| Cero hotfix watchdogs | ❌ `force-unlock-move.js` todavía requerido |
| Cero nuevos wrappers core | política Foundation activa; CI por añadir/validar |
| Legacy totalmente clasificado/migrado | ⚠️ en progreso |
| APIs públicas completas documentadas | ⚠️ en progreso |
| CI arquitectónico | ⚠️ Foundation pass |
| `main` protegido | ❌ baseline GitHub indica branch sin protección |
| Móvil/desktop/LIVE post-migración | pendiente por cada cambio conductual |

---

# REGLA FINAL

Antes de escribir código:

> **¿ESTOY CREANDO CONTENIDO O UNA CAPACIDAD?**

- CONTENIDO → REUTILIZA.
- CAPACIDAD → EXTIENDE EL OWNER.
- NUNCA → DUPLICA.

Para las reglas completas, ver `docs/KELO_FOUNDATION.md`.
