<!-- KELO-SYSTEM-DOC
system-id: runtime-lifecycle
owner: KeloLifecycleSupervisor
source: src/core/lifecycle-supervisor.js
contract-version: 1
-->

# Runtime Lifecycle Supervisor

## Propósito

`KeloLifecycleSupervisor` mantiene una máquina de estados explícita y observable para features opcionales sin convertirse en loader, scheduler, renderer ni dueño gameplay.

Estados canónicos: `idle → loading-dependencies → mounting → connecting → ready`, con rutas controladas a `degraded`, `error`, `unmounting` y `disposed`.

## Owner y fronteras

- Owner: `KeloLifecycleSupervisor`.
- Loader real: sigue siendo `KeloModuleLoader`.
- Feature definitions: siguen siendo `KELO_FEATURE_REGISTRY`.
- Render/simulation: siguen siendo `KeloRender` y `KeloSimulation`.
- El supervisor solo posee metadata de lifecycle bounded por feature.

## Integración V1

V1 observa eventos ya emitidos por `KeloModuleLoader`. No introduce polling. `module-load-start` mueve una feature hacia mounting; `module-feature-complete` la deja en ready/error; bloqueos/quarantine se reflejan como degraded.

El API `transition(...)` existe para owners futuros que necesiten declarar explícitamente `loading-dependencies`, `connecting`, `unmounting` o `disposed` sin crear un segundo state machine local.

## Failure policy

**DEGRADE por feature.** Una transición inválida no modifica el estado: emite diagnóstico `kelo:lifecycle-invalid-transition`. Nunca congela el loop global ni cambia autoridad gameplay.

## Invariantes

1. Cero `setInterval` / `requestAnimationFrame`.
2. No carga archivos ni ejecuta retry.
3. No escribe gameplay, red, economía o publicación.
4. Historial bounded: máximo 12 transiciones por feature.
5. Una feature en error no cambia el estado de otra.
6. Estados/transiciones ilegales se rechazan explícitamente.

## Observabilidad

- `KeloLifecycleSupervisor.get(id)`.
- `KeloLifecycleSupervisor.snapshot()`.
- evento `kelo:lifecycle-transition`.
- audit `KELO_LIFECYCLE_SUPERVISOR_AUDIT`.

## Tests / CI

- `scripts/lifecycle-failure-audit.mjs`.
- `npm run audit:foundation`.
- Main Stability Gate + smoke móvil/PvP.
