# KeloSimulation — extensiones de simulación

## Propósito

`KeloSimulation` es el OWNER único de extensiones que necesitan ejecutar lógica antes o después de la simulación legacy consolidada por `engine-c.js` y el owner de los **claims de suspensión global** usados por superficies cliente que necesitan detener temporalmente toda simulación, como un Creator pesado.

No crea un segundo game loop y no reemplaza la física base. Su función es retirar la cadena histórica de wrappers de `updateSimulation`, convertirla en hooks observables/ordenados y permitir lifecycle explícito sin que features externas vuelvan a envolver el global.

```text
updateSimulation legacy post-engine-c
            │
            ▼
      KeloSimulation
      ├─ ¿hay suspension claim? ── sí → return
      ├─ before hooks activos
      ├─ legacy bridge before
      ├─ simulación base exacta
      ├─ legacy bridge after
      └─ after hooks activos
```

## Owner

**Owner:** `window.KeloSimulation`  
**Fuente:** `src/core/simulation-extension-system.js`

## API pública

### `KeloSimulation.before(owner, fn, priority)`

Registra preparación previa a la simulación base.

### `KeloSimulation.after(owner, fn, priority)`

Registra updates posteriores: timers gameplay ya existentes, interpolación, actualizaciones de entidades auxiliares o compatibilidad en migración.

### `KeloSimulation.setEnabled(id, enabled)`

Activa o duerme un hook ya registrado. `false` lo saca del hot path sin perder identidad, prioridad ni función; `true` lo devuelve al orden determinista original. Es la API Foundation para sleep/wake de una extensión individual.

### `KeloSimulation.suspend(owner, meta)`

Crea un claim de suspensión global y devuelve un token. Mientras exista al menos un token:

- no se ejecutan before hooks;
- no se ejecuta el legacy bridge;
- no se ejecuta la simulación base;
- no se ejecutan after hooks.

Este contrato está pensado para lifecycle explícito y de corta duración. No se usa como regla de gameplay ni como pausa autoritativa online.

### `KeloSimulation.resume(token)`

Suelta exactamente un claim. La simulación sólo vuelve cuando no quedan claims.

### `KeloSimulation.resumeOwner(owner)`

Suelta todos los claims de un owner. Útil como cleanup defensivo, no como sustituto de conservar los tokens propios.

### `KeloSimulation.isSuspended()`

Indica si existe al menos un claim.

### `KeloSimulation.unregister(id)`

Retira definitivamente un hook.

### `KeloSimulation.snapshot()`

Devuelve owners/prioridades de hooks, estado `enabled`, claims de suspensión y `suspendedFrames` para observabilidad.

## Invariantes

- Solo `src/core/simulation-extension-system.js` puede envolver directamente el `updateSimulation` post-`engine-c` durante esta fase.
- Sin suspension claims, el update capturado se ejecuta exactamente una vez.
- Con suspension claim, no se ejecuta ninguna parte de la simulación cliente administrada por este owner.
- Los hooks no renderizan.
- Los hooks no crean otro `requestAnimationFrame` ni otro game loop.
- Features nuevas no deben envolver `updateSimulation` directamente.
- Menor prioridad se ejecuta primero dentro de cada fase.
- Un hook dormido no se ejecuta.
- Cambiar `enabled` reconstruye la lista activa sólo al cambiar lifecycle; no se filtra el registro completo por frame.
- Un feature que llama `suspend()` debe garantizar `resume()` en todos sus paths de salida.

## Consumidor inicial

`src/creators/core/creator-exclusive-runtime.mjs` adquiere un claim mientras Pixelorama Pro está abierto. Input, movimiento y render usan sus respectivos owners; `KeloSimulation` sólo posee la parte de simulación.

## Migración legacy

Cada wrapper se migra de forma incremental y conserva su orden histórico mediante prioridad explícita. No se mezcla esta migración con cambios de gameplay.

## Online-first

La simulación local puede contener predicción/presentación. Estado autoritativo online debe permanecer en los owners/server correspondientes; un suspension claim sólo pausa trabajo cliente y no confirma, revierte ni muta verdad de servidor.

## Performance Foundation

Para el contrato conjunto de startup, CPU, memoria, mundo y red, ver `docs/systems/PERFORMANCE_FOUNDATION.md`. Para Creator exclusive mode, ver `docs/systems/CREATOR_EXCLUSIVE_RUNTIME.md`.

## Estado

**FOUNDATION ACTIVE — SLEEP/WAKE + SUSPENSION CLAIMS**
