<!-- KELO-SYSTEM-DOC
system-id: pvp-auto-reducer
owner: KeloPvPAutoReducer
source: src/systems/pvp-auto-reducer.js
contract-version: 4
-->

# Kelo PvP Auto Reducer — adaptive presentation quality

## Propósito

`KeloPvPAutoReducer` protege la respuesta del PvP cuando la ruta input → ack muestra degradación sostenida **o** cuando el cliente ya está bajo presión real de frame. Reutiliza `KeloNetAuthority` y el snapshot existente de `KELO_PERF`; no crea otro transporte, renderer, scheduler, `PerformanceObserver` ni autoridad gameplay.

El sistema implementa la parte PvP del Net Governor descrito por X-Foundation: degradación y recuperación con hysteresis, sin cambiar reglas competitivas.

## Owner

- **Owner/orquestador:** `KeloPvPAutoReducer`.
- **Calidad:** `KELO_PERF` / `KELO_PERFORMANCE_GOVERNOR`.
- **Scheduler:** `KeloSimulation.after(...)`.
- **Señales de red:** `KeloNetAuthority`.
- **Fuente:** `src/systems/pvp-auto-reducer.js`.

## Estado que posee

Solo presentation/diagnóstico local:

- baseline y EMA de latencia estimada;
- jitter estimado;
- FPS, frame EMA y frame p95 leídos desde `KELO_PERF`;
- fase `idle | monitoring | warning | reduced`;
- hysteresis/tiempos de recuperación;
- quality floor PvP solicitado (`pvp_low | pvp_emergency | null`);
- counters de warnings/reductions/restores.

## Estado que NO posee

- hitboxes o hit result;
- daño/HP;
- cooldowns;
- posición/velocidad autoritativa;
- server tick;
- targeting;
- MMR/RP;
- resultado de Arena;
- transporte WebSocket;
- `requestAnimationFrame` o game loop propio.

## API pública

- `KeloPvPAutoReducer.snapshot()` — diagnóstico inmutable.
- `KeloPvPAutoReducer.acknowledge()` — oculta el aviso de la incidencia actual.
- `KeloPvPAutoReducer.setEnabled(value)` — habilita/deshabilita la protección; al deshabilitar restaura calidad si estaba reducida.

## Flujo

```text
PvP first-use
  → Feature Registry carga pvp-auto-reducer.js
  → KeloSimulation.after('pvp-auto-reducer:network-quality', ...)
  → medir RTT/jitter desde el ack autoritativo del input
  → fallback a pending input/ack depth si la muestra RTT está ausente o vieja
  → leer FPS/frame p95 del snapshot existente de `KELO_PERF`
  → baseline + EMA + jitter
  → degradación sostenida
     → warning con grace period
     → construir descriptor lazy `pvp_low` y pasarlo a `KELO_PERF.setQualityFloor(profile)`
     → si empeora: descriptor lazy `pvp_emergency`
  → recuperación sostenida
     → limpiar el floor y volver a la política base/manual previa
```

## Señal actual

V4 mide RTT real de la ruta PvP usando el `clientTime` del input y el `ackSequence` que ya devuelve la autoridad del servidor. `KeloNetAuthority.getPvpRttSnapshot()` expone EMA de RTT, jitter, última muestra y edad; no añade mensajes ping/pong, timers ni transporte. Si no existe una muestra reciente (≤2.5 s), el AutoReducer cae al estimator anterior de profundidad input→ack. La señal de frame sigue reutilizando FPS, frame EMA y frame p95 de `KELO_PERF`, sin crear otro observer.

## Failure policy

**DEGRADE / presentation-only.**

Si el Auto Reducer falla o está deshabilitado, el PvP conserva su autoridad y reglas actuales. La pérdida aceptable es únicamente la adaptación automática de presentación.

Nunca se permite degradar corrección competitiva para “ganar FPS”.

## Invariantes

1. No crea `requestAnimationFrame`, `setInterval` ni segundo loop.
2. Se ejecuta mediante `KeloSimulation` existente.
3. Solo cambia calidad a través del owner `KELO_PERF`.
4. No escribe estado PvP autoritativo.
5. No bloquea input ni abre modal.
6. No recarga la página para aplicar calidad.
7. La recuperación usa hysteresis; no oscila calidad cada sample.
8. Al salir de PvP/desconectarse/deshabilitarse restaura calidad y limpia el episodio.
9. El aviso puede ser reconocido sin desactivar la protección.
10. La feature y sus descriptores `pvp_low`/`pvp_emergency` se cargan lazy con el paquete PvP; first-playable conserva solo la primitive genérica de floor en `KELO_PERF`.
11. El quality floor es monotónico: nunca puede mejorar la calidad por encima del perfil base/manual actual.
12. Mientras el floor está activo, `KELO_PERF` congela el autotuning base para que la recuperación vuelva exactamente al perfil previo, sin una mejora oculta acumulada.
13. El autotuning genérico sigue teniendo prioridad mientras pueda bajar calidad normal. El AutoReducer solo usa presión de frame para forzar por debajo de `performance` cuando el perfil base ya tocó ese piso, o ante stutter severo (p95 ≥ 50 ms).
14. Los umbrales V4 de frame permanecen explícitos: degradación sostenida en el piso normal alrededor de ≤48 FPS / ≥22 ms EMA / ≥34 ms p95; crítico alrededor de ≤30 FPS / ≥33 ms EMA / ≥50 ms p95.
15. `FEATURE_PVP_AUTO_REDUCER=false` desactiva la protección al cargar el paquete; `setEnabled(false)` permite apagarla en caliente.

## Observabilidad

`snapshot()` expone versión, fase, active/online, `networkSource`, latency/jitter/baseline, threshold, `requestedQuality`, `effectiveQuality`, reduced/emergency, counters y último motivo.

`KELO_PVP_AUTO_REDUCER_AUDIT` declara los invariantes de integración usados por QA.

## Tests / CI

- `scripts/pvp-auto-reducer-audit.mjs` — contrato owner/scheduler/calidad/autoridad/lazy/no-loop + prueba determinista 390×844 de que el floor no puede subir calidad y restaura la política previa.
- `npm run audit:pvp-facing` — frontera PvP existente.
- `npm run audit:performance` — el owner de calidad y performance sigue intacto.
- smoke móvil/PvP del Main Stability Gate.

## Anti-patrones

- reducir server tick por jugador;
- cambiar hitbox/cooldown/damage por ping;
- crear `setInterval` de ping paralelo;
- usar `navigator.connection` como única verdad;
- cambiar directamente variables internas de render en vez de `KELO_PERF`;
- convertir el warning en modal que bloquee controles;
- dejar la calidad forzada después de salir del combate.
