# ENGINE_MAP — Kelo World

> **ANTES DE CREAR O MODIFICAR UN SISTEMA:** lee `docs/KELO_FOUNDATION.md`, `docs/SYSTEM_DOCUMENTATION_STANDARD.md` y `AGENTS.md`. Toda feature nueva debe reutilizar un OWNER existente o justificar una CAPACIDAD nueva.

**Estado:** índice maestro operativo del runtime Foundation actual.  
**Runtime declarado en `index.html`:** Kelo World V6.53.  
**Candidato Foundation V1:** 2026-09-08 · rama `foundation/kelo-foundation-v1-2` · paquete conductual verificado en `8019a299ef0ed995641fa29979efb628ac60ac38`; commits posteriores: documentación/estado de merge.  
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

El inventario LIVE saneado demuestra:

```text
processInput wrappers        = 1 → KeloInput
updateMovement wrappers      = 1 → KeloMovement
render wrappers              = 2 → engine-c + KeloRender
updateSimulation wrappers    = 2 → engine-c + KeloSimulation
renderAvatar wrappers        = 2 → engine-c + KeloAvatar
KELO_MODAL_INPUT_LOCK writes = 0 LIVE
```

No quedan wrappers feature-level LIVE de Render, Simulation o Avatar. El adapter `KELO_MODAL_INPUT_LOCK` permanece solo por compatibilidad; sus writers restantes están en archivos no cargados directamente por el runtime.

La existencia de un archivo en `src/` NO demuestra que esté LIVE. `src/environment/generic-prefabs.js` y `src/ui/property-editor.js` están **DORMANT** en V6.53: pueden probarse como unidades, pero no deben tratarse como dependencias LIVE ni reactivarse para satisfacer tests viejos.

---

# ORDEN DE CARGA — V6.53 FOUNDATION

```text
0.  KeloEvents + KeloInputLocks
1.  collision-utils + engine-a
2.  KeloInput + KeloMovement + engine-b + engine-c
3.  KeloAvatar + KeloRender + KeloSimulation
4.  engine-d..k
5.  environment contracts / atlases / world-map + prefab-contract + engine-l
6.  engine-m..aj + character appearance + pvp-world
7.  Visual System / manifests / asset registry / animation / FX / sequence
8.  modern abilities + stones + Sword Swap runtime/visuals
9.  engine-net
10. Luxe/UI + mobile orientation + plaza depth
11. gameplay systems (nobility/equipment/backpack/container/emote/market)
12. property + instances + world builder + house UI
13. forge/aura/illumination/performance
14. profile-panel-close → dynamic runtime bootstrap
15. self interaction / PvP touch guard / visual lab / visual integration
```

DORMANT:

```text
src/environment/generic-prefabs.js → renderer compatible con prefab-contract
src/ui/property-editor.js          → editor; PropertySystem sí está LIVE
```

`force-unlock-move.js` está **RETIRED** y no se carga.

---

# OWNERS ACTUALES

| Responsabilidad | Owner / API | Estado | Regla |
|---|---|---|---|
| Input lock claims | `KeloInputLocks` | OWNER LIVE | Tokens; 0 writes legacy directos LIVE |
| Input pipeline | `KeloInput` | OWNER LIVE | Único wrapper de `processInput` |
| Movement extensions | `KeloMovement` | OWNER LIVE | Único wrapper de `updateMovement` |
| Movement physics | `engine-a.js` | LEGACY CORE LIVE | Extraer incrementalmente, no rewrite |
| Collision primitives | `KELO_COLLISION` | OWNER LIVE | No duplicar geometría |
| Render orchestration | `engine-c.js` | LEGACY CORE LIVE | Frame base |
| Render extensions | `KeloRender` | OWNER LIVE | Único bridge de extensiones |
| Simulation extensions | `KeloSimulation` | OWNER LIVE | Único bridge de tick |
| Avatar composition | `KeloAvatar` | OWNER LIVE | Base + middleware ordenado |
| World renderer | `KELO_WORLD_RENDERER` | OWNER LIVE | World content por contracts |
| Prefab data contract | `prefab-contract.js` | LIVE | Data contract activo |
| Generic prefab renderer | `generic-prefabs.js` | DORMANT | No activar sin decisión explícita |
| Visual/VFX | `KeloVisualSystem` | OWNER LIVE | Presentación no decide gameplay |
| Event bus | `KeloEvents` | OWNER LIVE | No crear otro bus global |
| Abilities | `KeloAbilities` | OWNER LIVE | Data + primitives; usa KeloSimulation/KeloRender |
| Stones | `KeloStones` | OWNER LIVE | Legacy stones no recibe features |
| Property | `KeloPropertySystem` | OWNER LIVE | Placement con owner único |
| Property Editor | `src/ui/property-editor.js` | DORMANT | Unit audit; browser smoke solo si se activa |
| Instances / House | `src/instances/*` + House UI | OWNER LIVE | Recovery/authority/browser audit verde sin editor dormant |
| World Builder | `world-builder-system.js` | NEEDS_AUDIT | Collision/render ownership pendiente |
| Camera/zoom | varios | NEEDS_AUDIT | Consolidar después |
| Runtime bootstrap tardío | bootstrap desde profile UI | NEEDS_AUDIT | Limpiar sin segundo boot system |

---

# CORE EXTENSION POINTS

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
```

Prohibición: no introducir wrappers nuevos directos de `render`, `renderAvatar`, `updateSimulation`, `processInput` o `updateMovement` cuando exista un owner/punto de extensión apropiado.

---

# DEUDA PRIORITARIA FOUNDATION V2

1. **Collision ownership Property / World Builder / obstacles lifecycle.**
2. Camera/zoom ownership y orientación/DPR móvil.
3. Inventory/equipment legacy state vs sistemas modernos.
4. World Edit authoring/runtime boundaries, persistencia y snapshots.
5. Bootstrap core disparado desde UI.
6. Timers/MutationObservers/global writers restantes medidos.
7. Assets/PNG/manifest: deuda separada que mantiene Kelo CI / Visual System CI rojos.

Retirada obligatoria:

`IDENTIFICAR → MIGRAR CONSUMIDORES → TEST → LIVE → MARCAR DEAD → RETIRAR`

---

# DOCUMENTACIÓN OBLIGATORIA

Cada sistema/capacidad nueva cumple:

```text
CODE
  ↓
docs/systems/<SYSTEM>.md
  ↓
docs/system-catalog.json
  ↓
guide.html (si playerVisible)
  ↓
system-documentation-audit.js
```

Un cambio de contrato no está completo si su documentación técnica o guía de jugador queda desactualizada.

---

# FOUNDATION V1 — ESTADO PRE-MERGE

| Criterio | Estado |
|---|---|
| Constitución técnica | ✅ |
| Documentación obligatoria | ✅ |
| Input owner | ✅ |
| Movement owner | ✅ |
| Render owner | ✅ |
| Simulation owner | ✅ |
| Avatar owner | ✅ |
| LIVE modal lock writes | ✅ 0 |
| Backpack lock tokenizado | ✅ |
| Prefab CI alineado a LIVE/DORMANT | ✅ |
| Property Editor CI alineado a LIVE/DORMANT | ✅ |
| House recovery móvil/desktop | ✅ |
| Foundation / Backpack / Prefab / Property / House / Ability / Combat / Character / Terrain / Mobile checks | ✅ pre-merge |
| Kelo CI / Visual System CI | ⚠️ deuda separada de assets/manifest |
| `main` protegido | ❌ pendiente de configuración del repositorio |

---

# REGLA FINAL

> **¿ESTOY CREANDO CONTENIDO O UNA CAPACIDAD?**

- CONTENIDO → REUTILIZA.
- CAPACIDAD → EXTIENDE EL OWNER.
- NUNCA → DUPLICA.

Después de cambiar un sistema:

> **¿SU DOCUMENTO TÉCNICO Y SU GUÍA DE JUGADOR SIGUEN DICIENDO LA VERDAD?**
