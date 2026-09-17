<!-- KELO-SYSTEM-DOC
system-id: failure-boundary
owner: KeloFailureBoundary
source: src/core/failure-boundary.js
contract-version: 1
-->

# Failure Boundary — per-feature circuit breaker

## Propósito

`KeloFailureBoundary` contiene fallos repetidos de features opcionales mediante circuit breakers independientes. Evita que una dependencia rota provoque intentos repetidos y degradación en cascada.

## Estados

- `closed`: operación normal.
- `open`: la feature queda temporalmente bloqueada después del threshold.
- `half-open`: al vencer el cooldown, la próxima llamada real puede probar recuperación.

No existe timer para mover estados: el tiempo se evalúa únicamente cuando alguien consulta `isBlocked(...)`.

## Bulkhead

Cada feature tiene su propio circuito. `pvp` no abre `market`; `market` no abre `properties`. No hay un kill switch global implícito.

## Integración

`KELO_ASSET_REGISTRY.isEnabled(...)` conserva la selección persistente del usuario y añade el estado efectivo del circuito como gate temporal. `KeloModuleLoader` sigue siendo el único loader.

El breaker escucha `kelo:module-feature-complete`: un intento completo fallido suma una falla; uno exitoso cierra y limpia el contador.

## Failure policy

**FAIL-OPEN CORE / FAIL-FAST OPTIONAL.** Core boot no depende de este breaker. Solo los packs opcionales pueden quedar temporalmente cortocircuitados.

## Invariantes

1. Sin polling, retry loop, `setInterval` ni `requestAnimationFrame`.
2. Threshold/cooldown por feature.
3. No cambia gameplay ni autoridad server.
4. No modifica la selección persistente del usuario.
5. No reintenta por sí mismo; solo permite/bloquea llamadas reales.
6. Estado observable y reset explícito.

## Observabilidad

- `KeloFailureBoundary.get(id)`.
- `KeloFailureBoundary.snapshot()`.
- evento `kelo:failure-boundary`.
- audit `KELO_FAILURE_BOUNDARY_AUDIT`.

## Tests / CI

- `scripts/lifecycle-failure-audit.mjs`.
- Main Stability Gate.
