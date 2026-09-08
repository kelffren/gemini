# KELO WORLD — FOUNDATION RULES

> **START HERE.** Antes de modificar Kelo World, lee este archivo y después `ENGINE_MAP.md`.
>
> Baseline de este pass Performance Foundation: `main` en `910debe302e22b8abbf114d02f51332f8b28b8f3` (Kelo World V6.53). Si `main` avanzó, vuelve a auditar antes de cambiar comportamiento.

## 1. Regla principal

Kelo World usa **OWNER único por responsabilidad**.

Antes de crear cualquier sistema, función, manager, renderer, collider, listener, wrapper o API nueva:

1. Busca si ya existe un OWNER de esa responsabilidad.
2. Si existe, reutilízalo.
3. Si falta una capacidad, extiende el contrato del OWNER antes de crear un sistema paralelo.
4. No dupliques comportamiento existente.
5. No añadas wrappers directos sobre funciones core si existe un hook oficial.
6. No modifiques directamente estado que pertenece a otro sistema.
7. UI no gobierna gameplay.
8. Visuales no gobiernan gameplay.
9. Contenido repetible debe ser data-driven siempre que el contrato existente lo permita.
10. Código LEGACY no recibe features nuevas.

La pregunta obligatoria antes de escribir código es:

> **¿QUÉ OWNER EXISTENTE DEBERÍA HACER ESTO?**

Solo si la respuesta demostrable es “ninguno” se evalúa una capacidad nueva.

---

## 2. Contenido vs capacidad

### CONTENIDO

Ejemplos: habilidad, item, arma, prop, NPC, VFX, edificio, material, outfit.

Debe entrar por contratos existentes.

- Ability: `definition → targeting → delivery → effects → visuals`.
- Prop: `definition → asset → layer → collision policy → interaction`.
- Item: `definition → inventory → equipment/modifiers → visuals`.
- VFX: `manifest → primitive → KeloVisualSystem`.

**Contenido nuevo NO justifica un engine nuevo.**

### CAPACIDAD

Una capacidad nueva solo existe cuando ningún primitive/owner actual puede expresar el comportamiento sin romper su contrato.

Antes de añadirla:

1. Demostrar el hueco.
2. Elegir OWNER.
3. Definir contrato reusable.
4. Implementar primitive genérico.
5. Probarlo.
6. Documentarlo.
7. Reutilizarlo en más de un contenido cuando aplique.

---

## 3. Ownership objetivo

| Responsabilidad | Owner/contrato actual o candidato | Estado Foundation | Regla |
|---|---|---|---|
| Core state / loop base | `engine-a.js` | ACTIVE / demasiado amplio | Reducir progresivamente; no reescribir |
| Input base | `engine-a.js` | NEEDS_AUDIT | Produce intención, no lógica UI |
| Movement base | `engine-a.js` + soporte legacy tardío | NEEDS_AUDIT | Un único owner final |
| Collision primitives | `src/physics/collision-utils.js` / `KELO_COLLISION` | OWNER | Reutilizar; no duplicar geometría |
| Camera | core + ajustes tardíos | NEEDS_AUDIT | Un único owner de zoom/backing rules |
| Render orchestration | `engine-c.js` + `KeloRender` extension owner | OWNER actual | Sistemas se conectan por hooks; hooks inactivos pueden dormir |
| Simulation extensions | `KeloSimulation` | OWNER Foundation | Sistemas registran una vez y pueden `setEnabled` sin otro loop |
| Performance policy/telemetry | `src/systems/performance-governor.js` / `KELO_PERF` | OWNER Foundation | Una política de distancia/calidad/visibility; no otro governor |
| Mobile budgets | `KELO_MOBILE_PERFORMANCE_CONTRACT` | OWNER Foundation | DPR/memoria/chunks/Canvas se consultan, no se duplican |
| Asset atlas lifecycle | `KELO_ATLAS_CONTRACT` | OWNER | `acquire/release`; core retain, non-core warm/evict |
| World renderer | `src/environment/world-map.js` / `KELO_WORLD_RENDERER` | OWNER | Contenido de mundo no dibuja por fuera sin contrato |
| Visual/VFX | `src/visuals/*` / `KeloVisualSystem` | OWNER | Visuales no aplican gameplay; presentación idle/hidden puede dormir |
| Ability runtime | `src/abilities/kelo-ability-boot.js` / `KeloAbilities` | OWNER para abilities modernas | Ability nueva = data + primitives existentes |
| Stone/loadout | `src/abilities/stone-system.js` / `KeloStones` | OWNER | No usar schema legacy para features nuevas |
| Equipment | `src/systems/equipment-system.js` | OWNER client | Consumidores no escriben internals directamente |
| Backpack/inventory moderno | `src/systems/backpack-system.js` | OWNER candidato | Consolidar legacy antes de retirar |
| Property | `src/property/property-system.js` | OWNER | Una placement = un owner físico |
| Instances | `src/instances/*` | OWNER | Reutilizar runtime/bridges existentes |
| Networking client | `engine-net.js` / `KeloNetAuthority` | OWNER transporte client | Culling/LOD no equivale a autoridad |
| Server authority/AOI | `server/*` room owner | OWNER online donde aplique | AOI filtra transporte; no elimina state autoritativo |
| UI | `src/ui/*` | CONSUMER | UI llama APIs; no gobierna state ajeno |
| Character Customizer entry | `KELO_PROFILE_LAUNCHER` + owners Character existentes | SUPPORT UI | Feature pesada lazy al primer uso; no bootstrap global |
| Combat/effects/melee foundation nueva | `src/core/kelo-runtime-bootstrap.js` + `src/systems/{combat,effects,melee}` | PREPARED / DORMANT salvo loader explícito | No cargar por existir; solo si una feature real lo requiere |

**Importante:** existir en el repositorio no equivale a estar LIVE. `index.html` y el runtime real mandan.

---

## 4. Dependencias permitidas

Dirección conceptual:

```text
INPUT → MOVEMENT → COLLISION
              ↓
           ACTOR STATE
              ↓
CAMERA ← SIMULATION → ABILITIES / SYSTEMS
              ↓
           RENDER
       ┌──────┼──────┐
      WORLD  ACTORS  VISUALS
                      ↓
                     VFX

UI → PUBLIC APIs
NETWORK → authority bridge / transport
SERVER → authoritative decisions online
PERFORMANCE → policy/telemetry consumida por owners, nunca gameplay authority
```

Dependencias peligrosas:

```text
UI → localPlayer.x/y
VFX → damage/hp
feature → obstacles.push directamente
feature → render = wrapper
feature → processInput = wrapper
feature → setInterval para reparar ownership
feature → segundo RAF/game loop
feature → AssetManager2 / PerformanceEngine
legacy → nuevas features
```

---

## 5. Prohibiciones Foundation

Salvo excepción auditada y documentada:

- No `engine-v2`.
- No sistemas paralelos para una responsabilidad con OWNER existente.
- No duplicar collision, inventory, abilities, movement o renderer del mismo dominio.
- No escribir directamente estado ajeno.
- No UI modificando posición/HP/economía directamente.
- No VFX decidiendo daño.
- No features nuevas en código LEGACY.
- No `setInterval`/watchdog para mantener correcto un estado roto.
- No monkey patch silencioso.
- No wrappers nuevos directos de `render`, `renderAvatar`, `updateSimulation`, `processInput` cuando exista hook oficial.
- No manager nuevo solo para “organizar”.
- No migración tecnológica masiva sin baseline y rollback.
- No cargar una feature pesada en boot solo porque existe.
- No mantener un RAF/timer/MutationObserver global de una feature cerrada si puede ser event-driven/lazy.
- No crear un segundo asset loader para saltarse `KELO_ATLAS_CONTRACT`.

---

## 6. Política de wrappers y hooks

Kelo World arrastra wrappers históricos. No se borran a ciegas.

Proceso:

`IDENTIFICAR → MAPEAR CADENA → MIGRAR A HOOK/API → TEST → LIVE → RETIRAR`

A partir de Foundation, un wrapper nuevo de core requiere una justificación explícita en el PR.

Hooks/owners existentes que deben preferirse donde apliquen:

- `KeloSimulation.before/after/setEnabled`
- `KeloRender.intercept/beforeFrame/afterFrame/setEnabled`
- `KELO_WORLD_RENDERER.draw(...)`
- `drawPreActors(...)`
- `drawPostActors(...)`
- `KeloVisualSystem` layers/update/lifecycle
- `KELO_PERF` distance/quality policy
- `KELO_ATLAS_CONTRACT.acquire/release`
- buses/eventos de sistemas propietarios, empezando por `KeloEvents` cuando el evento es genérico

---

## 7. Legacy

Estados válidos:

- `OWNER`
- `SUPPORT`
- `LEGACY`
- `HOTFIX`
- `DEAD`
- `EXPERIMENTAL`
- `SERVER-AUTHORITATIVE`
- `CLIENT/FALLBACK`
- `NEEDS_AUDIT`
- `PREPARED` (existe, pero no está demostrado LIVE)
- `DORMANT` (preparado pero no cargado/activo en flujo normal)

Regla de retirada:

`IDENTIFICAR → MIGRAR CONSUMIDORES → TEST → LIVE → MARCAR DEAD → RETIRAR`

Nunca `BORRAR → arreglar lo que rompa`.

---

## 8. Hotfix de movimiento

`src/ui/force-unlock-move.js` se conserva como referencia histórica de un patrón que no debe copiarse; el runtime Foundation actual debe demostrar por tests si ya está RETIRED.

Objetivo Foundation:

`force-unlock watchdog requerido = 0`

Locks nuevos pertenecen a `KeloInputLocks`; no introducir escrituras directas nuevas de compatibilidad.

---

## 9. Public API vs internal

Toda API estable reutilizable debe documentar:

- owner;
- propósito;
- métodos públicos;
- estado que posee;
- invariantes;
- consumidores conocidos;
- extension points.

Convención actual a respetar durante transición:

- `KELO_*`: infraestructura/contratos globales.
- `Kelo*`: API/subsistema global moderno.
- globals lowerCamel/uppercase legacy: INTERNAL/LEGACY salvo documentación expresa.

No añadir una cuarta convención.

---

## 10. KELO-INDEX

Owner files importantes deben converger a este encabezado:

```js
/* KELO-INDEX
 * area:
 * owner:
 * purpose:
 * public-api:
 * consumes:
 * state-owned:
 * extension-points:
 * reuse:
 * legacy:
 * do-not:
 */
```

No documentar cada línea. Documentar fronteras, ownership y puntos de reutilización.

---

## 11. Cómo añadir cosas

### Quiero añadir una habilidad

1. Revisar `src/abilities/abilityData.js`.
2. Reutilizar `deliveryHandlers`/effects soportados.
3. Reutilizar Visual System/manifests.
4. No tocar core salvo capacidad genuinamente nueva.
5. Si la capacidad no tiene trabajo continuo, no asumir que merece un tick permanente.

### Quiero añadir un VFX

1. Revisar Visual System/manifests/FX primitives.
2. Añadir definición/presentación.
3. Gameplay emite evento; VFX lo representa.
4. Al terminar el último visual, el owner debe poder volver a estado idle sin loop nuevo.

### Quiero añadir un prop

1. Usar contratos/registry/property/world existentes.
2. Definir collision policy explícita.
3. No hacer `obstacles.push` desde la feature.
4. Assets no-core se adquieren/liberan mediante su owner.

### Quiero añadir UI

1. Consumir API pública del sistema owner.
2. UI no modifica state gameplay directamente.
3. Input lock debe pertenecer a `KeloInputLocks`, no a watchdogs.
4. UI pesada debe ser lazy si no es necesaria para PLAYER PLAYABLE.
5. Cerrada no debe conservar trabajo global innecesario.

### Quiero añadir un comportamiento nuevo

`buscar owner → buscar primitive → extender owner → test → documentar`

No `nuevo archivo → nuevo global → nuevo wrapper`.

---

## 12. Regla de cambio

Todo cambio Foundation debe poder responder:

1. ¿Problema confirmado?
2. ¿Owner?
3. ¿Capacidad existente reutilizable?
4. ¿Gameplay cambia?
5. ¿API cambia?
6. ¿Tests?
7. ¿Métrica/criterio de éxito?
8. ¿Qué legacy/deuda queda?
9. ¿Documentación actualizada?
10. ¿Añade coste permanente a boot/frame/memoria/red aunque la feature no se use?

---

## 13. Performance — contrato permanente

Optimización siempre:

`BASELINE → CAMBIO → TEST → MÉTRICA → KEEP/REVERT`

Principio de escalabilidad:

> **MÁS CONTENIDO DISPONIBLE NO DEBE SIGNIFICAR MÁS CONTENIDO EJECUTÁNDOSE.**

Objetivo cliente:

```text
CURRENT PLAYER
+ CURRENT VIEW
+ CURRENT WORLD AREA
+ CURRENT ACTION
+ RELEVANT ONLINE PLAYERS
```

El resto debe ser, según el dominio:

- `LAZY`: código/feature no entra hasta primer uso;
- `SLEEPING`: registrado pero fuera del hot path;
- `CULLED`: existe pero no se actualiza/renderiza por irrelevancia visual;
- `WARM`: conserva recurso temporalmente sin trabajo continuo;
- `UNLOADED/EVICTED`: recurso pesado liberado cuando es seguro.

### Reglas de implementación

1. **Scheduling:** `KeloSimulation` y `KeloRender` poseen sleep/wake de hooks. No crear otro scheduler.
2. **Distancia:** `KELO_PERF.getAnimationHz/shouldUpdate/shouldRenderActor` es la política única de LOD cliente.
3. **Visibility:** `KELO_PERF` publica `CLIENT_HIDDEN/CLIENT_VISIBLE` mediante `KeloEvents`; no crear `PageLifecycleManager`.
4. **Assets:** `KELO_ATLAS_CONTRACT` posee `acquire/release`; core se retiene, non-core puede quedar WARM y expulsarse al llegar a refs=0.
5. **UI pesada:** launcher mínimo + carga bajo acción real. Studio es patrón de referencia.
6. **Network:** culling de presentación no cambia authority. AOI server filtra transporte, no state.
7. **Pose:** preferir change-driven + heartbeat a mensajes idénticos permanentes cuando preserve recovery.
8. **Hot paths:** no optimizar microdetalles sin profiler; evitar allocation/DOM/recorridos completos demostrados en loops calientes.
9. **Build tool:** code splitting/Vite se evalúa como compilador de producción después de lifecycle/baseline, no como sustituto de Foundation.
10. **CI:** contratos estructurales de rendimiento viven en `npm run audit:performance` y no dependen de benchmarks ruidosos.

Documento técnico: `docs/systems/PERFORMANCE_FOUNDATION.md`.

No conservar optimización solo porque “parece moderna”.

---

## 14. Definition of Done — KELO FOUNDATION V1

Foundation no se declara terminada hasta:

- [ ] 100% de sistemas LIVE con owner conocido.
- [ ] `ENGINE_MAP.md` sincronizado con runtime actual.
- [x] `docs/KELO_FOUNDATION.md` existe y define reglas.
- [ ] Cero owner ambiguity crítica.
- [ ] Cero watchdogs/hotfixes necesarios para mantener estado correcto.
- [ ] Cero nuevos wrappers directos de core.
- [ ] Una implementación ACTIVE por responsabilidad.
- [ ] Contenido estándar añadible sin modificar core.
- [ ] APIs públicas documentadas.
- [ ] Legacy clasificado y sin features nuevas.
- [x] CI arquitectónico activo para Performance Foundation.
- [ ] Flujo normal de `main`: branch → PR → checks → merge.
- [ ] Input/movement sin locks huérfanos.
- [ ] Smoke tests core verdes en móvil y desktop.
- [ ] LIVE validado.

### Prueba final de escalabilidad

Un desarrollador nuevo, leyendo solo `AGENTS.md`, este documento y `ENGINE_MAP.md`, debe poder:

1. localizar el owner correcto;
2. añadir una habilidad simple;
3. añadir un prop;
4. añadir un VFX;
5. conectar UI;
6. no crear sistema paralelo;
7. no tocar core para contenido ordinario;
8. añadir contenido sin añadir automáticamente otro tick/request/atlas residente permanente.

Si pregunta “¿en qué engine meto esto?”, la Foundation todavía no está suficientemente clara.

---

## 15. Prioridad permanente

`CORRECTO → COMPRENSIBLE → REUTILIZABLE → MEDIBLE → RÁPIDO`

Y antes de cada feature:

> **¿ESTOY CREANDO CONTENIDO O UNA CAPACIDAD?**
>
> CONTENIDO → REUTILIZA.
>
> CAPACIDAD → EXTIENDE EL OWNER.
>
> NUNCA → DUPLICA.

Y antes de añadir coste continuo:

> **¿ESTO TIENE TRABAJO AHORA MISMO?**
>
> SI NO → LAZY / SLEEP / CULL / WARM / UNLOAD según el owner.
