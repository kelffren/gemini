# KeloSimulation — extensiones de simulación

## Propósito

`KeloSimulation` es el OWNER único de extensiones que necesitan ejecutar lógica antes o después de la simulación legacy consolidada por `engine-c.js`.

No crea un segundo game loop y no reemplaza la física base. Su función es retirar la cadena histórica de wrappers de `updateSimulation`, convertirla en hooks observables/ordenados y permitir que una extensión registrada deje de consumir CPU cuando no tiene trabajo.

```text
updateSimulation legacy post-engine-c
            │
            ▼
      KeloSimulation
      ├─ before hooks ENABLED
      ├─ simulación base exacta
      └─ after hooks ENABLED

hooks SLEEPING permanecen registrados pero no se recorren en el hot path.
```

## Owner

**Owner:** `window.KeloSimulation`  
**Fuente:** `src/core/simulation-extension-system.js`

## API pública

### `KeloSimulation.before(owner, fn, priority)`

Registra preparación previa a la simulación base. Devuelve `hookId`.

### `KeloSimulation.after(owner, fn, priority)`

Registra updates posteriores: gameplay local/predicción, interpolación, actualizaciones de entidades auxiliares o compatibilidad en migración. Devuelve `hookId`.

### `KeloSimulation.setEnabled(hookId, enabled)`

Suspende o despierta un hook sin desregistrarlo.

- `false` → `REGISTERED + SLEEPING`.
- `true` → `REGISTERED + ENABLED`.
- Es idempotente: repetir el mismo estado no duplica hooks.
- Un hook sleeping no ejecuta su callback.
- El owner mantiene una lista activa cacheada; el coste por frame no crece linealmente con cientos de hooks dormidos.

### `KeloSimulation.unregister(id)`

Retira definitivamente un hook.

### `KeloSimulation.snapshot()`

Devuelve owners/prioridades/estado `enabled` y totales `registered`, `enabled`, `sleeping` para auditoría y `KELO_PERF`.

## Lifecycle

```text
register
  ↓
ENABLED ── setEnabled(false) ──> SLEEPING
   ↑                              │
   └──── setEnabled(true) ────────┘

ENABLED/SLEEPING ── unregister ──> UNREGISTERED
```

El sistema consumidor decide **cuándo** tiene trabajo. `KeloSimulation` solo posee el mecanismo de scheduling; no conoce abilities, networking, AI ni UI.

## Invariantes

- Solo `src/core/simulation-extension-system.js` puede envolver directamente el `updateSimulation` post-`engine-c` durante esta fase.
- El update capturado se ejecuta exactamente una vez.
- Los hooks no renderizan.
- Los hooks no crean otro `requestAnimationFrame` ni otro game loop.
- Features nuevas no deben envolver `updateSimulation` directamente.
- Menor prioridad se ejecuta primero dentro de cada fase.
- Sleep/wake no altera prioridad ni identidad del hook.
- Despertar repetidamente no puede crear múltiples registros.

## Performance

El objetivo Foundation es que contenido disponible no implique coste continuo. Un sistema con trabajo es `ENABLED`; uno sin trabajo puede seguir existiendo y conservar estado como `SLEEPING` sin ejecutar callbacks por frame.

Tests deterministas: `scripts/performance-foundation-audit.js`.

## Migración legacy

Cada wrapper se migra de forma incremental y conserva su orden histórico mediante prioridad explícita. No se mezcla esta migración con cambios de gameplay.

## Online-first

La simulación local puede contener predicción/presentación. Estado autoritativo online debe permanecer en los owners/server correspondientes; `KeloSimulation` es infraestructura de extensión cliente, no authority. Dormir presentación/interpolación jamás elimina la entidad o verdad autoritativa del servidor.

## Estado

**FOUNDATION ACTIVE / TRANSITIONAL CORE BRIDGE / SLEEP-WAKE CAPABLE**
