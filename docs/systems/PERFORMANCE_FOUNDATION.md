# Kelo Performance Foundation

## Propósito

Performance Foundation no es un engine nuevo. Es un conjunto de capacidades dentro de owners ya existentes para que el coste cliente dependa del contenido **actualmente relevante**, no de todo lo que existe en Kelo World.

Principio:

```text
CONTENIDO DISPONIBLE != CONTENIDO EJECUTÁNDOSE
```

Una sesión normal debe pagar principalmente por:

```text
CURRENT PLAYER
+ CURRENT VIEW
+ CURRENT WORLD AREA
+ CURRENT ACTION
+ RELEVANT ONLINE PLAYERS
```

## Owners reutilizados

| Responsabilidad | Owner |
|---|---|
| frame telemetry, quality y distance policy | `KELO_PERF` / `KELO_PERFORMANCE_GOVERNOR` |
| simulation scheduling | `KeloSimulation` |
| render scheduling | `KeloRender` |
| assets/atlas residency | `KELO_ATLAS_CONTRACT` |
| world chunks | `KELO_WORLD_RENDERER` |
| mobile budgets | `KELO_MOBILE_PERFORMANCE_CONTRACT` |
| semantic events | `KeloEvents` |
| networking client | `KeloNetAuthority` |
| AOI/authority | `server/index.js` room owner |
| visual presentation | `KeloVisualSystem` |
| Character Creator state | `KeloCharacterCustomization` |
| Character Creator entrypoint | `KELO_PROFILE_LAUNCHER` presentation launcher |

No existe `PerformanceEngine`, `GameLoop2`, `AssetManager2`, `LazyManager` ni segundo event bus.

## 1. Hook lifecycle

`KeloSimulation` y `KeloRender` mantienen un registro estable y una lista activa cacheada.

Estados:

```text
REGISTERED + ENABLED
REGISTERED + SLEEPING
UNREGISTERED
```

API:

```js
const id = KeloSimulation.after('owner', update, priority);
KeloSimulation.setEnabled(id, false); // sleep
KeloSimulation.setEnabled(id, true);  // wake
KeloSimulation.unregister(id);
```

Mismo contrato en `KeloRender`.

Sleep no significa destruir state. Solo elimina el callback del hot path hasta que el owner consumidor lo despierte.

## 2. Culling y frecuencia espacial

`KELO_PERF` conserva la política única de distancia:

- near → frecuencia alta;
- mid → frecuencia intermedia;
- far → frecuencia baja;
- fuera de cutoff → 0 update/render de presentación cliente.

APIs reutilizadas:

```js
KELO_PERF.getAnimationHz(distance)
KELO_PERF.shouldUpdate(key, distance, now)
KELO_PERF.shouldRenderActor(distance)
```

`engine-net.js` consume esta política para interpolación y render de peers. No modifica la autoridad del actor.

## 3. Pose network

El transporte cliente ya no necesita mandar poses idénticas indefinidamente.

Contrato:

```text
cambio significativo
    -> enviar, hasta la frecuencia máxima existente

sin cambio
    -> silencio
    -> heartbeat periódico para presencia/recovery
```

El servidor sigue validando y almacenando la posición recibida. Esta optimización reduce transporte, no autoridad.

`KeloNetAuthority.performanceSnapshot()` expone contadores para diagnóstico.

## 4. Server Area Of Interest

El room server conserva todos los jugadores autoritativos en `players`, pero construye snapshots por espectador usando:

```text
zone
+ spatial grid
+ radius
+ hysteresis
```

Una entidad fuera del AOI:

- sigue existiendo en servidor;
- no se borra;
- no cambia autoridad;
- simplemente deja de viajar en snapshots de un cliente para el que no es relevante.

La hysteresis expande el radio para peers previamente relevantes y evita thrashing en bordes.

## 5. Character Creator lazy

`src/ui/profile-panel-close.js` ya no es bootstrap de combat/effects/melee ni del árbol completo del Character Creator.

Antes del primer uso:

```text
Character Creator heavy requests = 0 desde este launcher
```

Al solicitar Profile/Apariencia:

```text
KELO_PROFILE_LAUNCHER
  -> carga secuencial de módulos existentes
  -> KeloCharacterCustomizer.open()
```

La secuencia clásica se conserva para no romper dependencias legacy mientras no exista un build modular equivalente.

Studio continúa siendo la referencia más avanzada: launcher mínimo + `import()` de módulos ESM tras CREATE.

## 6. Character preview lifecycle

`KeloCharacterCustomizerPreview` no observa permanentemente `document.body`.

- abierto + cambio visual → un RAF programado;
- cerrado → ningún RAF pendiente;
- no existe loop continuo;
- no existe `MutationObserver` global permanente.

La UI conserva estado lógico en `KeloCharacterCustomization`.

## 7. Visual idle/visibility

`KeloVisualSystem` mantiene `awake`/`hidden` solo para presentación.

Al no existir clips/FX/projectiles/sequences activos, el update cae a un fast-path idle. Eventos visuales despiertan presentación. `CLIENT_HIDDEN` duerme presentación no esencial; `CLIENT_VISIBLE` permite retomarla.

Nunca se duerme daño, economía, inventario o autoridad por esta vía.

## 8. Page Visibility

`KELO_PERF` es el owner que ya observaba `visibilitychange`. Ahora publica eventos semánticos vía `KeloEvents`:

```text
CLIENT_HIDDEN
CLIENT_VISIBLE
```

También reinicia el reloj de frame al cambiar visibilidad para que un periodo largo en background no se convierta en un `dt` gigante al volver.

No se creó `PageLifecycleManager`.

## 9. Atlas lifecycle

`KELO_ATLAS_CONTRACT` sigue siendo el único owner de creación/carga de atlas gestionados.

Roles:

```text
core
  -> retain

district
  -> refcount
  -> WARM al llegar a refs=0
  -> eviction tras TTL si sigue sin refs

optional
  -> refcount
  -> WARM corto
  -> eviction tras TTL
```

Reacquire durante WARM cancela la expulsión y reutiliza la imagen residente.

API relevante:

```js
acquire(key)
release(key, { warmMs })
evict(key, reason)
runtimeSnapshot()
```

`evict()` nunca expulsa `core` ni un asset con referencias activas.

## 10. Mobile budgets

`KELO_MOBILE_PERFORMANCE_CONTRACT` continúa definiendo presupuestos de:

- DPR;
- Canvas megapixels;
- chunk cache;
- decoded texture MB;
- district atlases residentes.

Los consumers deben respetar esos budgets en vez de crear políticas locales contradictorias.

## 11. Telemetría

`KELO_PERF.getSnapshot()` agrega sin poseerlos:

- frame p50/p95/p99/worst;
- simulation hooks active/sleeping;
- render hooks active/sleeping;
- world chunk cache/active district;
- atlas residency/memory;
- network peer/pose/culling counters;
- mobile budget snapshot.

El HUD sigue siendo debug-only mediante el mecanismo ya existente (`?perf=1` o flag local).

## Invariantes

1. Un owner de rendimiento no decide gameplay ajeno.
2. Culling cliente no destruye state server.
3. Sleep no desregistra ni duplica hooks.
4. No aparece un segundo frame/simulation loop.
5. No aparece un segundo asset loader.
6. No aparece un segundo event bus.
7. Core atlases no se expulsan.
8. Feature pesada lazy no entra en static boot sin justificación y test.
9. Visibility no puede producir un `dt` equivalente al tiempo total que la app estuvo oculta.
10. Toda optimización nueva sigue `BASELINE -> CAMBIO -> TEST -> METRICA -> KEEP/REVERT`.

## Tests / CI

`npm run audit:performance`

protege de forma determinista:

- sleep/wake idempotente en Simulation/Render;
- unregister;
- ausencia de Character Creator heavy UI en boot estático;
- Studio lazy;
- ausencia de MutationObserver global del preview;
- peer LOD/culling;
- pose change-driven + heartbeat;
- AOI server;
- visibility events;
- Atlas warm eviction/core retention.

`.github/workflows/performance-foundation-ci.yml` ejecuta syntax + performance audit + Foundation audit + docs audit.

Los benchmarks reales de startup/frame/memoria siguen siendo necesarios para decidir budgets cuantitativos. Los tests estructurales evitan regresiones arquitectónicas incluso cuando los timings de CI son ruidosos.

## Deuda / siguientes pasos

- completar lifecycle district-aware en `KELO_WORLD_RENDERER` para que consumers suelten/refuercen referencias de atlas por zona real;
- migrar sistemas con trabajo permanente a `setEnabled` solo después de demostrar condiciones correctas de wake;
- evaluar timestamp authoritative-friendly para cooldowns sin mezclarlo con un cambio de gameplay;
- reducir más módulos post-playable de `index.html` tras medir dependencias;
- evaluar build de producción/code splitting después del lifecycle, no antes;
- ampliar AOI/frecuencia server cuando el room crezca más allá del prototipo actual.

## Estado

**FOUNDATION ACTIVE — PERFORMANCE CAPABILITIES V1**
