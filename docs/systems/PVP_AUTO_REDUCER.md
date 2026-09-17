<!-- KELO-SYSTEM-DOC
system-id: pvp-auto-reducer
owner: KeloPvPAutoReducer
source: src/systems/pvp-auto-reducer.js
contract-version: 2
-->

# Kelo PvP Auto Reducer — adaptive presentation quality

## Propósito

`KeloPvPAutoReducer` protege la respuesta del PvP cuando la ruta input → ack muestra degradación sostenida. Consume salud de red del transporte existente y solicita perfiles temporales de calidad a `KELO_PERF`; no crea otro transporte, renderer, scheduler ni autoridad gameplay.

## Owner

- **Owner/orquestador:** `KeloPvPAutoReducer`.
- **Calidad:** `KELO_PERF` / `KELO_PERFORMANCE_GOVERNOR`.
- **Scheduler:** `KeloSimulation.after(...)`.
- **Señales de red:** `KeloNetAuthority.getPvpNetworkHealth()`.
- **Fuente:** `src/systems/pvp-auto-reducer.js`.

## Estado que posee

Solo presentation/diagnóstico local: baseline/EMA de latencia, jitter, fase `idle | monitoring | warning | reduced`, hysteresis/recuperación, calidad manual previa y counters.

No posee hitboxes, daño/HP, cooldowns, posición autoritativa, server tick, targeting, MMR/RP, resultado Arena, transporte WebSocket ni game loop.

## API pública

- `snapshot()` — diagnóstico inmutable, incluyendo `networkSource` y muestras nativas.
- `acknowledge()` — oculta el aviso de la incidencia actual.
- `setEnabled(value)` — activa/desactiva la protección y restaura calidad al apagarla.

## Flujo

```text
PvP first-use
  → Feature Registry carga pvp-auto-reducer.js
  → KeloSimulation.after('pvp-auto-reducer:network-quality', ...)
  → KeloNetAuthority.getPvpNetworkHealth()
       ├─ RTT input→ack + jitter nativos si hay muestras
       └─ pending-depth fallback solo antes de la primera muestra
  → baseline + EMA + jitter
  → degradación sostenida
     → warning con grace period
     → KELO_PERF.setManualQuality('medium')
     → si empeora: 'performance'
  → recuperación sostenida
     → restaurar calidad previa / auto
```

## Señal actual

V1.1 usa RTT/jitter medidos dentro de `KeloNetAuthority` a partir de timestamps de combat intents y el `ackSequence` autoritativo. No añade ping paralelo. Mientras el transporte todavía no tenga una muestra válida conserva el fallback por profundidad de inputs pendientes.

## Failure policy

**DEGRADE / presentation-only.** Si la señal o el Auto Reducer fallan, el PvP mantiene sus reglas y autoridad. La pérdida aceptable es únicamente la adaptación automática de presentación.

## Invariantes

1. No crea `requestAnimationFrame`, `setInterval`, ping loop ni segundo scheduler.
2. Se ejecuta mediante `KeloSimulation` existente.
3. Solo cambia calidad a través de `KELO_PERF`.
4. No escribe estado PvP autoritativo.
5. No bloquea input, no abre modal y no recarga la página.
6. La recuperación usa hysteresis.
7. Al salir de PvP/desconectarse/deshabilitarse restaura calidad.
8. La feature sigue lazy dentro del paquete PvP.
9. `KeloNetAuthority` sigue siendo el único owner de transporte/medición.

## Observabilidad

`snapshot()` expone fase, active/online, `networkSource`, `networkSamples`, latency/jitter/baseline, threshold, reduced/emergency, counters y último motivo.

## Tests / CI

- `scripts/pvp-auto-reducer-audit.mjs`.
- `scripts/net-governor-audit.mjs`.
- `npm run audit:pvp-facing`.
- `npm run audit:performance`.
- smoke móvil/PvP del Main Stability Gate.

## Anti-patrones

- reducir server tick por jugador;
- cambiar hitbox/cooldown/damage por ping;
- crear `setInterval`/WebSocket/ping paralelo;
- usar `navigator.connection` como verdad competitiva;
- cambiar directamente variables internas de render;
- dejar calidad forzada después del combate.
