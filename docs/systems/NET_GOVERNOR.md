<!-- KELO-SYSTEM-DOC
system-id: net-governor
owner: KeloNetAuthority
source: engine-net.js
contract-version: 1
-->

# Net Governor — owner-native PvP network health

## Propósito

El Net Governor vive dentro del transporte existente `KeloNetAuthority`. Mide salud real de la ruta PvP `input → server ack` sin crear otro WebSocket, ping loop ni scheduler.

## Señales

Por cada `ackSequence` nuevo, antes de retirar inputs pendientes, el owner toma el `clientTime` del input confirmado más reciente y calcula:

- RTT input→ack;
- EMA de RTT;
- jitter EMA;
- edad del último ack;
- profundidad actual de inputs pendientes;
- número de muestras nativas.

`getPvpNetworkHealth()` devuelve un snapshot inmutable. Antes de existir una muestra válida declara `source: pending-depth-fallback`.

## Authority

Esta señal es diagnóstico/presentación. No altera daño, HP, cooldown, hitboxes, posición autoritativa, server tick, MMR/RP ni resultado Arena.

## Integración

`KeloPvPAutoReducer` consume primero `getPvpNetworkHealth()`. Solo si aún no existen muestras RTT usa el estimator histórico basado en pending depth. Toda reducción de calidad sigue pasando por `KELO_PERF`.

## Failure policy

**DEGRADE PRESENTATION-ONLY.** Si la medición no existe o falla, el gameplay conserva el transporte y autoridad actuales; únicamente se pierde precisión de adaptación visual.

## Invariantes

1. Un solo transporte: `KeloNetAuthority`.
2. Cero ping paralelo.
3. Cero scheduler adicional.
4. La medición reutiliza timestamps ya enviados con combat intents.
5. El ack se mide antes de borrar el input pendiente correspondiente.
6. El fallback no cambia gameplay.
7. El resultado expuesto es inmutable.

## Tests / CI

- `scripts/net-governor-audit.mjs`.
- `scripts/pvp-auto-reducer-audit.mjs`.
- `npm run audit:pvp-facing`.
- `npm run audit:performance`.
- smoke móvil/PvP del Main Stability Gate.
