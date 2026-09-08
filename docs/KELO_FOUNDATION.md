# KELO WORLD — FOUNDATION RULES

> **START HERE.** Antes de modificar Kelo World, lee este archivo y después `ENGINE_MAP.md`.
>
> Baseline de esta Foundation: `main` en `ef6bdd087b851d36768e7f3a31ca767974d3d21e` (Kelo World V6.53). Si `main` avanzó, vuelve a auditar antes de cambiar comportamiento.

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
| Render orchestration | `engine-c.js` | OWNER actual | Sistemas se conectan por hooks, no wrappers nuevos |
| World renderer | `src/environment/world-map.js` / `KELO_WORLD_RENDERER` | OWNER | Contenido de mundo no dibuja por fuera sin contrato |
| Visual/VFX | `src/visuals/*` / `KeloVisualSystem` | OWNER | Visuales no aplican gameplay |
| Ability runtime | `src/abilities/kelo-ability-boot.js` / `KeloAbilities` | OWNER para abilities modernas | Ability nueva = data + primitives existentes |
| Stone/loadout | `src/abilities/stone-system.js` / `KeloStones` | OWNER | No usar schema legacy para features nuevas |
| Equipment | `src/systems/equipment-system.js` | OWNER client | Consumidores no escriben internals directamente |
| Backpack/inventory moderno | `src/systems/backpack-system.js` | OWNER candidato | Consolidar legacy antes de retirar |
| Property | `src/property/property-system.js` | OWNER | Una placement = un owner físico |
| Instances | `src/instances/*` | OWNER | Reutilizar runtime/bridges existentes |
| Networking client | `engine-net.js` | OWNER transporte client | No confundir transporte con autoridad |
| Server authority | `server/*` | OWNER online donde aplique | Cliente no se declara autoridad online |
| UI | `src/ui/*` | CONSUMER | UI llama APIs; no gobierna state ajeno |
| Combat/effects/melee foundation nueva | `src/core/kelo-runtime-bootstrap.js` + `src/systems/{combat,effects,melee}` | PREPARED / NO asumir LIVE | Solo es LIVE si `index.html`/runtime lo carga y tests lo prueban |

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
```

Dependencias peligrosas:

```text
UI → localPlayer.x/y
VFX → damage/hp
feature → obstacles.push directamente
feature → render = wrapper
feature → processInput = wrapper
feature → setInterval para reparar ownership
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

---

## 6. Política de wrappers y hooks

Kelo World arrastra wrappers históricos. No se borran a ciegas.

Proceso:

`IDENTIFICAR → MAPEAR CADENA → MIGRAR A HOOK/API → TEST → LIVE → RETIRAR`

A partir de Foundation, un wrapper nuevo de core requiere una justificación explícita en el PR.

Hooks existentes que deben preferirse donde apliquen:

- `KELO_WORLD_RENDERER.draw(...)`
- `drawPreActors(...)`
- `drawPostActors(...)`
- `KeloVisualSystem` layers/update
- buses/eventos de sistemas propietarios

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

Regla de retirada:

`IDENTIFICAR → MIGRAR CONSUMIDORES → TEST → LIVE → MARCAR DEAD → RETIRAR`

Nunca `BORRAR → arreglar lo que rompa`.

---

## 8. Hotfix de movimiento

`src/ui/force-unlock-move.js` se clasifica como **HOTFIX TEMPORAL**.

No copiar su patrón. Su existencia indica ownership incompleto alrededor de `KELO_MODAL_INPUT_LOCK`, `isBuildMode` y `processInput`.

Objetivo Foundation:

`force-unlock watchdog requerido = 0`

No se retira hasta demostrar que todos los locks tienen owner, acquire/release equilibrados y smoke tests de menú/PvP/touch/movement pasan.

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

### Quiero añadir un VFX

1. Revisar Visual System/manifests/FX primitives.
2. Añadir definición/presentación.
3. Gameplay emite evento; VFX lo representa.

### Quiero añadir un prop

1. Usar contratos/registry/property/world existentes.
2. Definir collision policy explícita.
3. No hacer `obstacles.push` desde la feature.

### Quiero añadir UI

1. Consumir API pública del sistema owner.
2. UI no modifica state gameplay directamente.
3. Input lock debe pertenecer al contrato de input/movement, no al panel individual.

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

---

## 13. Performance

Optimización siempre:

`BASELINE → CAMBIO → TEST → MÉTRICA → KEEP/REVERT`

Prioridades acumuladas ya investigadas incluyen collider sync, viewport culling, visual hot paths, DPR móvil, memory accounting, lazy loading, World Edit boot/clones/storage y networking snapshots.

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
- [ ] CI arquitectónico activo.
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
7. no tocar core para contenido ordinario.

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
