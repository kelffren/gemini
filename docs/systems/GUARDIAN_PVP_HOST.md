# Kelo World — Guardian PvP Host V2

## Propósito

`KeloGuardianPvPHost` permite que el Guardian Master actual ejecute una sala PvP **temporal** cuando el servidor PvP central no está disponible. La simulación autoritativa corre dentro de un **Web Worker aislado**, que carga exactamente el mismo core de combate que Node (`KeloSharedPvPAuthority`). El hilo principal solo coordina lease, WebRTC, inputs, snapshots y UI.

No es un reemplazo de la autoridad persistente de Kelo World. El dispositivo donante solo decide gameplay efímero dentro de la sala mientras conserva una lease Master válida.

## Owners

- Core compartido Node/Worker: `src/systems/pvp/shared-pvp-authority.js`
- Adaptador Node: `server/pvp-authority.js`
- Coordinador Guardian: `src/systems/guardian-pvp-host.js`
- Realm de simulación aislado: `src/workers/guardian-pvp-authority-worker.js`
- Bridge hacia la API de red del cliente: `src/systems/guardian-pvp-net-adapter.js`
- Control móvil: `src/ui/guardian-pvp-ui.js`
- Transporte y lease: `src/systems/guardian-system.js`
- QA: `scripts/guardian-pvp-host-audit.mjs`

## Por qué Worker

El cliente visual también usa sistemas de status/effects. Si el host ejecutara la autoridad PvP en el mismo realm, ambos podrían compartir singletons o buses globales accidentalmente. El Worker crea un realm separado para la simulación autoritativa y carga allí movement, abilities, combat, effects, melee y el core PvP compartido.

El Worker **no posee un timer de juego**. `KeloSimulation` del hilo principal sigue siendo el único owner del ritmo: calcula cuántos fixed steps corresponden y envía un mensaje `step` al Worker. Esto mantiene aislamiento sin introducir un segundo loop.

## Regla de autoridad

Orden de prioridad:

```text
Servidor PvP central disponible
  -> autoridad central

Servidor central offline + Guardian Master válido
  -> Worker PvP temporal del Guardian Master

Sin servidor central y sin Master Guardian
  -> no hay autoridad PvP online
```

Nunca deben existir dos autoridades PvP activas a la vez. Si el servidor central vuelve, el adaptador detiene el Worker Guardian y abandona la sala temporal.

## First-use

El paquete PvP se carga bajo demanda. El core autoritativo compartido **no se evalúa en el hilo principal** solo por abrir PvP; lo importa el Worker cuando realmente se necesita un host temporal.

Orden relevante del hilo principal:

```text
KeloGuardian
  -> KeloGuardianPvPHost
  -> engine-net / KeloNetAuthority
  -> KeloGuardianPvPNetAdapter
  -> KeloPvPWorld
  -> KeloGuardianPvPUI
```

Cuando este dispositivo obtiene/usa la lease Master:

```text
KeloGuardianPvPHost
  -> new Worker(guardian-pvp-authority-worker.js)
       -> importScripts(shared-pvp-authority.js + dependencias de combate)
       -> KeloSharedPvPAuthority.createPvpAuthority()
```

## Mensajes

### Guardian DataChannel

- `guardian:pvp_intent`
- `guardian:pvp_snapshot`
- `guardian:pvp_reject`
- `guardian:pvp_takeover`

### Main thread ↔ Worker

Hacia el Worker:

- `init`
- `intent`
- `step`
- `dispose`

Desde el Worker:

- `boot`
- `ready`
- `reject`
- `snapshot`
- `error`
- `disposed`

Los mensajes de red se limitan a 48 KiB. Los inputs también tienen rate limit por peer.

## Fencing

Un intent solo puede entrar cuando:

1. Guardian está habilitado;
2. este dispositivo es el Master vigente;
3. la app está visible;
4. el `epoch` del mensaje coincide con el `epoch` de la lease vigente;
5. el servidor central no está activo;
6. el mensaje cumple límites de tamaño y frecuencia;
7. el Worker pertenece a la misma room y epoch;
8. el core compartido acepta su `sequence`.

El Worker también rechaza mensajes cuya `roomId` o `epoch` no coinciden con su instancia actual.

Los snapshots se ordenan por `(epoch, seq)`. Al cambiar el `epoch`, el receptor reinicia el contador de snapshot para aceptar correctamente el primer snapshot del nuevo Master.

## Takeover de Master

Cada participante conserva en memoria el snapshot PvP Guardian más reciente. Si ese participante obtiene una nueva lease Master y el snapshot tiene menos de 7 segundos:

1. el coordinador termina cualquier Worker viejo;
2. crea un Worker nuevo para el nuevo `epoch`;
3. pasa el último snapshot como `seed` durante `init`;
4. el Worker crea una nueva instancia de `KeloSharedPvPAuthority`;
5. restaura estado seguro de los jugadores;
6. conserva un `tickOffset` para que `serverTick` no retroceda;
7. responde `ready` con métricas de restauración;
8. el host emite `guardian:pvp_takeover`;
9. continúa enviando snapshots bajo el nuevo `epoch`.

### Estado restaurado

Se restaura de forma acotada:

- posición;
- HP / max HP;
- mana / max mana;
- facing y gait;
- zona PvP;
- último input ACK / sequence;
- cooldowns;
- cargas de ataque básico y especial;
- combo step con una ventana corta de gracia;
- dodge cooldown;
- status effects temporales saneados.

El input de movimiento queda en cero hasta recibir un intent nuevo.

### Estado que se cancela intencionalmente

En el relevo NO se reanuda a mitad de frame:

- ataque melee activo;
- cast activo;
- dash/dodge activo;
- special hold;
- input buffer;
- proyectiles en vuelo;
- `invulnerable` transitorio de un dodge.

Esto evita duplicar daño, revivir proyectiles ya resueltos o mantener iframes ambiguos después del cambio de autoridad.

Los eventos de gameplay se namespacéan por `epoch` para que el cliente no los confunda con eventos ya consumidos del Master anterior.

## Recuperación de sequence

El cliente mantiene `lastAck` y nunca reduce su contador de intents. Después de un takeover:

```text
nextSequence >= lastAck + 1
```

Si recibe `STALE_SEQUENCE` o `IMPOSSIBLE_SEQUENCE_JUMP`, `KeloGuardianPvPNetAdapter` adelanta su contador al ACK autoritativo y continúa.

## Límites para móvil

- una sala Guardian PvP por dispositivo;
- máximo 16 jugadores en esta fase;
- snapshots objetivo: 20/s;
- fixed-step: 60 Hz;
- máximo 5 pasos de catch-up por frame;
- máximo 90 intents/s por peer;
- payload máximo 48 KiB;
- un solo Worker autoritativo por host;
- sin `setInterval`/`setTimeout` de gameplay dentro del Worker;
- sin `localStorage`/IndexedDB para estado de combate;
- Worker sin DOM, WebSocket, WebRTC ni fetch de gameplay.

Estos límites protegen el dispositivo móvil y evitan que una pestaña atrasada intente simular de golpe una ventana larga de tiempo.

## Frontera de seguridad

El Guardian PvP Host y su Worker NO son autoridad de:

- KC/oro;
- inventario;
- mercado;
- drops;
- compras;
- propiedades;
- progresión persistente;
- recompensas permanentes;
- identidad o permisos de cuenta.

Una victoria o muerte dentro del PvP Lab no puede acuñar recompensas persistentes desde el dispositivo donante.

## Limitaciones actuales

El takeover V2 es continuidad de estado, no migración de frame perfecta. Las acciones/proyectiles en vuelo se cancelan. Además, iOS puede suspender Safari/PWA en background; si el Master deja de renovar su lease, otro Guardian elegible necesita obtener la nueva lease antes de continuar.

La siguiente prueba de madurez debe usar dos dispositivos reales y pérdida forzada del Master, midiendo: tiempo sin snapshots, tiempo hasta primer snapshot del nuevo epoch, inputs rechazados, sequence resyncs, desviación de posición y acciones canceladas.

## QA

Comando:

```text
npm run audit:guardian-pvp-host
```

El gate verifica:

- paridad del core Node/Worker;
- aislamiento del Worker;
- ausencia de timers/red/persistencia dentro del Worker;
- first-use order;
- lease/epoch fencing;
- rate limit;
- takeover;
- sequence resync;
- prioridad del servidor central;
- ausencia de autoridad persistente/económica.
