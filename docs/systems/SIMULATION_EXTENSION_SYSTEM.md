# KeloSimulation — extensiones de simulación

## Propósito

`KeloSimulation` es el OWNER único de extensiones que necesitan ejecutar lógica antes o después de la simulación legacy consolidada por `engine-c.js`.

No crea un segundo game loop y no reemplaza la física base. Su función es retirar la cadena histórica de wrappers de `updateSimulation` y convertirla en hooks observables y ordenados.

```text
updateSimulation legacy post-engine-c
            │
            ▼
      KeloSimulation
      ├─ before hooks
      ├─ simulación base exacta
      └─ after hooks
```

## Owner

**Owner:** `window.KeloSimulation`  
**Fuente:** `src/core/simulation-extension-system.js`

## API pública

### `KeloSimulation.before(owner, fn, priority)`

Registra preparación previa a la simulación base.

### `KeloSimulation.after(owner, fn, priority)`

Registra updates posteriores: timers gameplay ya existentes, interpolación, actualizaciones de entidades auxiliares o compatibilidad en migración.

### `KeloSimulation.unregister(id)`

Retira un hook.

### `KeloSimulation.snapshot()`

Devuelve owners/prioridades para observabilidad.

## Invariantes

- Solo `src/core/simulation-extension-system.js` puede envolver directamente el `updateSimulation` post-`engine-c` durante esta fase.
- El update capturado se ejecuta exactamente una vez.
- Los hooks no renderizan.
- Los hooks no crean otro `requestAnimationFrame` ni otro game loop.
- Features nuevas no deben envolver `updateSimulation` directamente.
- Menor prioridad se ejecuta primero dentro de cada fase.

## Migración legacy

Cada wrapper se migra de forma incremental y conserva su orden histórico mediante prioridad explícita. No se mezcla esta migración con cambios de gameplay.

## Online-first

La simulación local puede contener predicción/presentación. Estado autoritativo online debe permanecer en los owners/server correspondientes; `KeloSimulation` es infraestructura de extensión cliente, no authority.

## Estado

**FOUNDATION ACTIVE / TRANSITIONAL CORE BRIDGE**
