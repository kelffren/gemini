# Kelo World — Guardian Portable PvP Authority

## Propósito

Esta capacidad elimina el acoplamiento entre **las reglas PvP** y el proceso Node/Render. El mismo motor autoritativo puede ejecutarse detrás de:

```text
Node / Render
     o
Guardian Master / Web Worker
```

No existen dos reglas de combate. `KeloPvpAuthorityCore` es la única implementación de la simulación competitiva; Node y Guardian son adaptadores de hosting/transporte.

La meta de producto es que el jugador autorizado pulse **USAR ESTE DISPOSITIVO COMO HOST**, obtenga una lease Guardian válida y el dispositivo ejecute la simulación realtime mientras otros jugadores envían inputs por WebRTC. Render queda como fallback para realtime PvP, no como dueño exclusivo del motor.

## Owners y archivos

- `src/online/pvp-authority-core.js` — `KeloPvpAuthorityCore`; motor puro y portable.
- `server/pvp-authority.js` — adaptador Node del core portable.
- `src/online/guardian-pvp-worker.js` — runtime Worker foreground del mismo core.
- `src/systems/guardian-simulation-host.js` — soporte Guardian que liga lease/epoch, Worker y DataChannel existente.
- `engine-net.js` — `KeloNetAuthority`; conserva una sola API de red y selecciona `guardian-webrtc` o `server-websocket` para PvP.
- `src/systems/guardian-system.js` — único owner del DataChannel WebRTC.
- `src/systems/guardian-hot-mirror.js` — failover de lease/checkpoint observacional; complementario al mirror autoritativo completo.

## Lo que cambió arquitectónicamente

Antes:

```text
KeloNetAuthority
      ↓ WebSocket
Render / server/pvp-authority.js
      ↓
reglas PvP
```

Ahora:

```text
                         KeloPvpAuthorityCore
                         /                  \
             Node adapter                    Guardian Worker
                 │                                 │
       server WebSocket                  Guardian DataChannel
                 \                                 /
                         KeloNetAuthority
```

`server/pvp-authority.js` ya no contiene un ruleset PvP propio. Solo prepara las dependencias UMD existentes para Node y llama al core compartido.

## Autoridad y seguridad

### Realtime PvP temporal

Un Guardian solo puede ejecutar la autoridad cuando:

1. Guardian está activo;
2. la autoridad remota reconoce ese nodo como `master-host`;
3. la lease contiene el `epoch` vigente;
4. la aplicación está visible/foreground;
5. el Worker está preparado.

Mensajes de input, snapshots y state mirror incluyen `epoch`. Un cliente solo acepta snapshots Guardian procedentes del Master vigente.

### Economía durable

Guardian **NO** posee:

- KC/oro durable;
- inventario;
- mercado;
- propiedades;
- títulos/progreso persistente;
- pagos/compras;
- bans/identidad.

`KeloNetAuthority` mantiene estas operaciones en el backend durable. Si ese backend no existe, fallan con `DURABLE_SERVER_OFFLINE` en vez de delegarlas al jugador host.

Por tanto:

```text
Guardian = autoridad realtime delegable
Cloud/Supabase = verdad durable
```

Eso permite quitar Render como requisito del gameplay realtime sin convertir el dispositivo donador en dueño de la economía.

## Core portable

`KeloPvpAuthorityCore.createPvpAuthority(deps, options)` recibe dependencias explícitas:

- ability data;
- movement profile;
- Combat Engine;
- Melee Engine/profiles;
- Hit Resolver;
- Effect Engine;
- Status Effects;
- Event Bus/schema.

El core no conoce:

- DOM;
- WebSocket;
- WebRTC;
- Supabase;
- Render;
- archivos Node;
- UI;
- economía.

Expone el contrato histórico más dos primitivas nuevas:

- `exportState(nowMs)`
- `importState(state, nowMs)`

Schema actual:

```text
kelo-pvp-authority-state-v1
```

## Estado de takeover

El export completo incluye el estado transitorio necesario para continuar una pelea:

- `serverTick`;
- secuencia de proyectiles;
- actores;
- posición/HP/maná;
- input/ACK/secuencia;
- cooldowns;
- ataque/cast/dash activos;
- recursos de melee;
- combo/buffer/dodge;
- history usada por rewind;
- statuses públicos restaurables;
- proyectiles, trayectoria, pierce e IDs ya golpeados;
- event queue todavía no consumida.

No contiene JWT, secretos ni estado económico durable.

## Replicación autoritativa

`KeloGuardianSimulationHost` solicita al Worker un `exportState` aproximadamente cada segundo mientras es Primary.

El estado se serializa y se fragmenta en paquetes inferiores al límite del DataChannel Guardian:

```text
guardian:pvp_state_chunk
```

Los mirrors:

1. verifican que el emisor sea el Master actual;
2. verifican `epoch`;
3. reensamblan el state;
4. verifican el schema;
5. conservan el estado reciente;
6. responden con `guardian:pvp_state_ack`.

El Primary puede ver cuántos mirrors mantienen una copia reciente.

## Takeover

El failover usa dos capas:

```text
KeloGuardianMirror
  → detecta pérdida del Master
  → solicita nueva lease/epoch

KeloGuardianSimulationHost
  → observa que este nodo obtuvo la lease
  → arranca Worker
  → importa último authority state válido
  → continúa fixed-step desde el mismo serverTick
```

La lease/epoch sigue siendo la protección contra split-brain. La copia local nunca puede autoproclamarse autoridad por sí sola.

## Transporte KeloNetAuthority

Para PvP realtime, `KeloNetAuthority` decide dinámicamente:

```text
Guardian Master utilizable
        ↓ sí
 guardian-webrtc

        ↓ no

server WebSocket disponible
        ↓ sí
 server-websocket

        ↓ no
 offline
```

La API que consume `KeloPvPWorld` no cambia: continúa llamando `sendCombatIntent(...)`.

Eso preserva predicción/reconciliación y evita un segundo sistema de combate.

### Durable vs realtime

`KeloNetAuthority.isOnline()` puede reconocer la ruta realtime Guardian para PvP, pero operaciones durables continúan usando `request(...)`, que exige `serverOnline()`.

APIs de diagnóstico nuevas:

- `isServerOnline()`
- `isRealtimeOnline()`
- `getPvpTransport()`

## Worker foreground

`guardian-pvp-worker.js` evita bloquear la UI/canvas. No tiene timer independiente.

El main thread le entrega `dt` mediante:

```text
KeloSimulation.after('guardian:simulation-host', ...)
```

Dentro del Worker se mantiene un acumulador fixed-step de 60 Hz con límite de catch-up para evitar espirales si una frame tarda demasiado.

En iOS el Worker sigue sujeto a suspensión del navegador. Por eso un iPhone puede ser Primary útil en foreground, pero la continuidad real depende de tener otro Guardian con mirror actualizado.

## Invariantes

1. Un solo ruleset PvP: `KeloPvpAuthorityCore`.
2. Un solo owner de transporte cliente: `KeloNetAuthority`.
3. Un solo DataChannel owner: `KeloGuardian`.
4. No `setInterval` Guardian para mantener la simulación correcta.
5. Guardian authority requiere lease + epoch válidos.
6. Snapshot Guardian se acepta solo del Master actual.
7. Cliente envía intención, no HP final ni resultado de golpes.
8. Economía durable nunca se delega al host jugador.
9. Failover importa estado previo; no reinicia silenciosamente el combate.
10. Node/Render sigue siendo fallback compatible mientras se necesite.

## Limitación actual importante: participación de clientes

El data plane Guardian V2 conecta actualmente nodos registrados como Guardian. Un jugador que no haya activado/registrado Guardian no tiene todavía una sesión P2P client-only automática.

Para conseguir el objetivo final de **un botón en el host y cero fricción para los demás jugadores**, la siguiente capacidad debe separar:

```text
CLIENT P2P PARTICIPATION
≠
RESOURCE DONATION
```

Todos los jugadores online podrán tener transporte P2P client-only sin donar CPU/ancho de banda; solo quien haga opt-in entra al scheduler de altruismo/recompensas.

Hasta implementar esa separación, la ruta Render-free PvP funciona entre participantes Guardian, no debe anunciarse como sustitución completa de todo el backend para cualquier jugador.

## Render y el objetivo final

El objetivo no es operar sin ninguna infraestructura cloud. Supabase/control plane durable seguirá siendo necesario para identidad, leases, economía y persistencia segura.

El objetivo es:

```text
Render Node obligatorio para realtime        → NO
Guardian comunitario para realtime           → SÍ
Supabase/cloud mínimo para verdad durable     → SÍ
Render como fallback/compatibilidad           → opcional
```

## QA

`npm run audit:guardian` incluye `scripts/guardian-portable-pvp-audit.mjs`, que valida:

- Node consume el core portable;
- export/import state;
- continuación determinista después del import;
- Worker consume exactamente ese core;
- ausencia de `setInterval` en Worker/host;
- estado chunked + ACK;
- routing `guardian-webrtc` / `server-websocket`;
- operaciones durables fail-closed;
- UI no declara economía Guardian.

## Próximas fronteras

En orden:

1. client-only Guardian transport automático sin convertir jugadores en donadores;
2. fast failover de lease basado en witness/quorum para reducir el hueco de takeover;
3. TURN/relay comunitario para NAT restrictivo;
4. regional host selection por RTT real;
5. mover APIs durables todavía atadas al proceso Node a Supabase RPC/Edge Functions;
6. settlement Verified Service Units → KC por autoridad económica, con caps y anti-abuso.

Cuando 1 + 5 estén terminados, Render puede dejar de ser requisito operacional del juego: Guardian hospeda realtime y Supabase conserva la verdad durable.
