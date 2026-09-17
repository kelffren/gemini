<!-- KELO-SYSTEM-DOC
system-id: simulation-extensions
owner: KeloSimulation
source: src/core/simulation-extension-system.js
contract-version: 1
-->

# KeloSimulation — extensiones de simulación

## Propósito

`KeloSimulation` es el OWNER único de extensiones que necesitan ejecutar lógica antes o después de la simulación legacy consolidada por `engine-c.js` y el owner de los claims de suspensión global usados por superficies cliente que necesitan detener temporalmente toda simulación, como un Creator pesado.

No crea un segundo game loop y no reemplaza la física base. Retira la cadena histórica de wrappers de `updateSimulation`, la convierte en hooks observables/ordenados y permite lifecycle explícito sin que features externas vuelvan a envolver el global.

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

- **Owner:** `KeloSimulation`
- **Fuente:** `src/core/simulation-extension-system.js`
- **Estado:** Foundation transitional / suspension claims active.

## Estado que posee

- hooks `before` y `after` con prioridad explícita;
- estado `enabled` de cada hook;
- claims de suspensión global identificados por token;
- contador diagnóstico de frames suspendidos.

No posee física base, autoridad gameplay online, render, UI ni persistencia.

## API pública

- `KeloSimulation.before(owner, fn, priority)`
- `KeloSimulation.after(owner, fn, priority)`
- `KeloSimulation.setEnabled(id, enabled)`
- `KeloSimulation.unregister(id)`
- `KeloSimulation.suspend(owner, meta)`
- `KeloSimulation.resume(token)`
- `KeloSimulation.resumeOwner(owner)`
- `KeloSimulation.isSuspended()`
- `KeloSimulation.snapshot()`

## Invariantes

1. Solo `src/core/simulation-extension-system.js` puede envolver directamente el `updateSimulation` post-`engine-c` durante esta fase.
2. Sin claims de suspensión, el update capturado se ejecuta exactamente una vez.
3. Con al menos un claim, no se ejecuta ninguna parte de la simulación administrada por este owner.
4. Los hooks no renderizan ni crean otro `requestAnimationFrame`, `setInterval` o game loop.
5. Menor prioridad se ejecuta primero dentro de cada fase.
6. Un hook dormido no se ejecuta y no necesita registrarse de nuevo al despertar.
7. Un consumidor que llama `suspend()` debe garantizar `resume()` en todos sus caminos de salida.
8. Suspension local no confirma, revierte ni muta verdad de servidor.

## Consumidores principales

`src/creators/core/creator-exclusive-runtime.mjs` adquiere un claim mientras un Creator pesado está activo. Input, movimiento y render usan sus respectivos owners; `KeloSimulation` solo posee la suspensión de simulación.

## Migración legacy

Cada wrapper se migra de forma incremental:

`IDENTIFICAR → MAPEAR ORDEN → MIGRAR A HOOK/API → TEST → LIVE → RETIRAR`

La migración no debe mezclarse con cambios de gameplay.

## Observabilidad

`snapshot()` expone versión, hooks registrados/activos/dormidos, bridge legacy, claims de suspensión y `suspendedFrames`. Recovery/diagnóstico puede leer este snapshot bajo demanda; no se añade polling por frame.

## Anti-patrones

- segundo game loop;
- wrapper feature-level de `updateSimulation`;
- usar suspensión como regla de gameplay autoritativo;
- crear watchdogs para reactivar estado roto;
- renderizar o mutar UI desde hooks de simulación.

## Performance Foundation

Para el contrato conjunto de startup, CPU, memoria, mundo y red, ver `docs/systems/PERFORMANCE_FOUNDATION.md`. Para el consumidor Creator exclusivo, ver `docs/systems/CREATOR_EXCLUSIVE_RUNTIME.md`.
