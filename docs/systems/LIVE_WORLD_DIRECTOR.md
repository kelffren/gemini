# Kelo World — Live World Director

**ID:** `LIVE_WORLD_DIRECTOR`  
**Estado:** `SERVER INTEGRATED / PRE-LIVE`  
**Owners:** `KeloWorldDirector` + `KeloWorldDirectorRuntime` + `KeloWorldEventExecutor` + Kelo server authority  
**Transport:** WebSocket/HTTP existentes de `server/index.js`; no existe un segundo servidor.

## Propósito

Convertir actividad semántica reciente del mundo en un resumen compacto y, una vez por hora, proponer una actividad cooperativa contextual que haga que los jugadores se encuentren, viajen juntos o formen alianzas temporales. La IA solo propone un contrato limitado; el servidor lo valida y `KeloWorldEventExecutor` mantiene el lifecycle autoritativo del encuentro.

Ejemplos: world boss, defensa de pueblo, rescate, escolta de caravana, crisis de recursos, rift y recuperación de zona.

## Fuentes

- `server/world-director-service.js` — señales agregadas, snapshot y propuesta IA/fallback.
- `server/world-director-runtime.js` — ciclo horario y documento atómico.
- `server/world-director-server-bridge.js` — Director ↔ Executor ↔ socket existente.
- `server/world-event-archetypes.js` — definiciones data-driven.
- `server/world-event-executor.js` — lifecycle/progreso autoritativo.
- `server/world-event-server-integration.js` — frontera segura de red para `server/index.js`.
- `server/index.js` — integración con el servidor real y hooks internos de authority.
- `server/world-director-smoke-test.js`
- `server/world-director-runtime-smoke-test.js`
- `server/world-director-bridge-smoke-test.js`
- `server/world-event-executor-smoke-test.js`
- `server/world-event-server-integration-smoke-test.js`
- `server/smoke-test.js` — composición real del servidor.

## Ownership

### KeloWorldDirector
Posee únicamente la ventana agregada de actividad, último snapshot, propuesta actual e historial acotado. Nunca posee combate, economía ni actores físicos.

### KeloWorldDirectorRuntime
Posee un solo scheduler horario y `latest-world-director.json`, sobrescrito atómicamente.

### KeloWorldEventExecutor
Posee lifecycle de encuentros, participantes, fases, boss encounter-state y progreso. No calcula hit geometry, no acepta daño de cliente y no crea recompensas.

### Kelo server authority
Posee la frontera de red. `server/index.js` decide qué intents del cliente llegan al Executor y expone hooks internos para owners autoritativos de combate/gameplay/economía.

## Integración real en `server/index.js`

El sistema está cableado al servidor existente:

- arranca una sola instancia de `KeloWorldEventServerIntegration`;
- reutiliza el `players` Map y `send()` existentes;
- reutiliza el mismo `WebSocketServer`;
- `hello` registra presencia semántica y entrega el evento actual a late joiners;
- cambios reales de zona alimentan al Director; `pose` por frame NO se registra;
- operaciones de mercado exitosas agregan señal `market`;
- kills confirmadas por server alimentan kill/death;
- disconnect expulsa al jugador de todos los encounters activos;
- el simulation timer existente hace un `sweep` compartido aproximadamente una vez por segundo; no hay timer por jugador ni por boss;
- `/healthz` y `/readyz` exponen solamente estado/audit seguro del sistema.

### Intents permitidos desde cliente

- `world:event:get`
- `world:event:join`
- `world:event:leave`
- `world:event:seal`

`world:event:seal` solo acepta los sellos canónicos `north`, `east`, `west` en la frontera de red.

### Operaciones que NO existen como opcode de cliente

- damage al boss;
- completar objetivos;
- fijar rewards;
- fijar HP;
- crear/destruir encuentros;
- escoger cantidades económicas.

Los hooks internos del servidor son:

- `confirmWorldEventDamage(...)` → fuerza `source=server-combat` + `serverConfirmed=true`;
- `confirmWorldEventObjective(...)` → únicamente `server-gameplay` o `server-economy`;
- `runWorldDirectorNow(...)` → hook interno/QA, no protocolo de jugador.

## Flujo

```text
server semantic signals
  -> compact counters in KeloWorldDirector
  -> once/hour anonymized snapshot
  -> optional OpenAI Responses API OR deterministic fallback
  -> hard normalization + real-world-zone clamp
  -> KeloWorldEventExecutor.materialize
  -> RECRUITING
  -> enough players in correct zone
  -> ACTIVE
  -> server-confirmed objective/combat progress only
  -> COMPLETED / EXPIRED
  -> reward resolver owned by server economy
```

## Documento horario y privacidad

`latest-world-director.json` contiene población agregada, actividad por zona y el contrato del evento. No contiene nombres, chat, posiciones crudas ni IDs de participantes.

No existe un event log infinito: un documento se sobrescribe y la memoria de señales está acotada.

## IA y hard gates

Con `OPENAI_API_KEY`, el Director usa Responses API con JSON Schema estricto. Si IA no está disponible, el fallback determinista mantiene el mundo operativo.

La IA puede proponer solamente archetype, texto, zona, participantes recomendados, duración y reward tier abstracto. No define HP, daño, oro, KC, drops, permisos ni código.

La zona propuesta también está limitada: debe existir en el snapshot como una zona real no-PvP. `pvp` se excluye de eventos globales y una zona inventada por el modelo cae a una zona válida del mundo.

## Archetypes V1

`WORLD_BOSS`, `TOWN_DEFENSE`, `CARAVAN_ESCORT`, `RESCUE`, `RESOURCE_CRISIS`, `RIFT`, `RECLAMATION`.

Las diferencias viven en `world-event-archetypes.js`, no en lógica duplicada por el servidor.

## WORLD_BOSS V1 — cooperación real

1. Empieza en `RECRUITING`.
2. No progresa debajo de `minPlayers`.
3. En `SEALS`, tres jugadores distintos deben activar `north`, `east` y `west` dentro de la ventana de sellos.
4. Abre `VULNERABLE` por tiempo limitado.
5. Solo `server-combat` puede confirmar daño.
6. Si la población cae debajo del mínimo, se cierran vulnerabilidad y sellos; el grupo debe coordinar otra vez.
7. Si un jugador sale de la zona o desconecta, deja el encounter.
8. Al llegar a 0 HP, el Executor marca `COMPLETED` y delega rewards.

El HP escala con población recomendada, pero la cooperación está impuesta por mecánica, no simplemente por multiplicar HP.

## Encuentros simultáneos

Un evento puede durar más de una hora, por lo que el sistema admite un número acotado de encuentros activos. El bridge ya maneja esta superposición:

- late joiners reciben la lista compacta de encounters activos;
- cambio de zona expulsa al jugador de todos los encounters de esa zona que abandonó;
- disconnect elimina al jugador de todos sus encuentros activos;
- `maxActive` limita crecimiento de memoria.

## Otros archetypes

`confirmObjective()` exige una fuente server-authoritative definida por el template:

- defensa/rescate/rift/reclamation/caravan → `server-gameplay`;
- crisis de recursos → `server-economy`;
- world boss → `server-combat` mediante `confirmDamage()`.

Los owners físicos todavía deben conectar esos hooks a sus resultados reales; el cliente no puede declarar `wave_clear`, `deposit=100` ni daño.

## Dependencias y reutilización

- `KeloCombatEngine` / futura authority open-world de NPC: resolver hit/damage real; el Executor consume resultado confirmado.
- `KeloRegionalEconomy`: confirmar depósitos/recursos sin economía paralela.
- `KeloCaravans`: movimiento/checkpoints físicos de escort.
- `KeloEvents`: futura presentación cliente; no se crea otro bus.
- `server/index.js`: transporte y authority central existente.

## Invariantes

- IA propone; servidor decide.
- Cliente no declara damage/progress/rewards válidos.
- `participantCount < minPlayers` bloquea progreso.
- un jugador no activa varios sellos del mismo ciclo.
- arena `pvp` nunca se usa como ubicación de world events.
- rewards son `SERVER_RESOLVED`.
- no hay timers individuales.
- snapshots globales no incluyen IDs de participantes.

## Eventos emitidos

- `world:event` — contrato + snapshot inicial/actual.
- `world-event:state` — lifecycle/progreso.
- `world-event:result` — respuesta a intents permitidos del jugador.
- lifecycle: `materialized`, `joined`, `left`, `activated`, `stalled`, `phase`, `progress`, `completed`, `failed`.
- `commerce:event / world-notification` — canal visible existente.

## Persistencia

El Director conserva memoria acotada y un snapshot horario en archivo. Los encounters del Executor siguen siendo efímeros: un restart del servidor todavía no reconstruye un encuentro activo. Por eso el sistema permanece PRE-LIVE.

## Budget

- cero pose/frame logging;
- contadores enteros por jugador activo/reciente;
- como máximo un ciclo IA por hora;
- un archivo sobrescrito;
- encounters limitados por `maxActive`;
- un sweep compartido de baja frecuencia;
- sin timers por jugador/boss;
- snapshots compactos.

## Tests / CI

`npm run test:world-director` dentro de `server/` valida:

- privacidad del snapshot;
- fallback + hard clamps;
- zona real no-PvP;
- documento horario;
- materialización automática;
- population gate;
- sellos por jugadores distintos;
- reset al perder población;
- rechazo de damage/progress no confiable;
- internal-only server damage;
- completion/reward delegation;
- expiración;
- cambio de zona/disconnect;
- encounters superpuestos;
- late join state.

`.github/workflows/world-director-regression.yml` ejecuta la suite y además `npm run test:smoke` para levantar el `server/index.js` real, verificar `/readyz`, handshake WebSocket, world-event authority y shutdown limpio.

## Estado actual y deuda antes de LIVE

La capa **Director → Executor → server/index.js** ya está integrada. El siguiente bloque es el **World Boss físico**: convertir el encounter en un actor real del mundo sin crear un segundo combat/NPC engine.

1. conectar el hook `confirmWorldEventDamage` al resultado del combat/NPC authority de mundo abierto;
2. crear el actor físico del boss reutilizando el owner NPC/actor existente y colocar posiciones autoritativas de boss/sellos;
3. validar distancia/interacción server-side al activar sellos, no solo la zona;
4. conectar objetivos a Caravans, Regional Economy y owners gameplay reales;
5. persistir/reconstruir encounters activos tras restart;
6. construir HUD móvil/CTA/map/countdown/progreso y traducir mensajes a `KeloEvents`;
7. resolver rewards idempotentes por `player-economy-store`;
8. pasar Foundation/docs/online/performance + Playwright iPhone antes de declarar LIVE.

## Anti-patrones

- registrar `pose` cada 100 ms;
- IA por jugador;
- permitir que IA defina cantidades valiosas;
- endpoint `damageBoss(999999)` desde cliente;
- usar `visual:event` como prueba de daño;
- crear un segundo combat/NPC/economy engine;
- timer por boss/jugador;
- world event dentro de arena PvP;
- evento cooperativo que progrese con menos población que su gate;
- publicar IDs de participantes.

## Checklist de extensión

Antes de añadir señal/archetype:

- ¿el dato tiene owner existente?
- ¿la señal es semántica y baja frecuencia?
- ¿el snapshot sigue anónimo?
- ¿la ubicación existe realmente?
- ¿el archetype es data-driven?
- ¿el progreso exige confirmación server-side?
- ¿reutiliza owners existentes?
- ¿la IA sigue sin controlar cantidades valiosas?
- ¿hay límites de memoria/retención?
- ¿hay smoke test, CI y documentación actualizados?
