# Kelo World — Guardian PvP Host V1.2

## Propósito

`KeloGuardianPvPHost` permite que el Guardian Master actual ejecute una sala PvP **temporal** cuando el servidor PvP central no está disponible. Usa exactamente el mismo core de autoridad de combate que Node (`KeloSharedPvPAuthority`) y el DataChannel WebRTC que ya posee `KeloGuardian`.

No es un reemplazo de la autoridad persistente de Kelo World. El dispositivo donante solo decide gameplay efímero dentro de la sala mientras conserva una lease Master válida.

## Owners

- Core compartido: `src/systems/pvp/shared-pvp-authority.js`
- Adaptador Node: `server/pvp-authority.js`
- Host temporal: `src/systems/guardian-pvp-host.js`
- Bridge hacia la API de red del cliente: `src/systems/guardian-pvp-net-adapter.js`
- Control móvil: `src/ui/guardian-pvp-ui.js`
- Transporte y lease: `src/systems/guardian-system.js`
- QA: `scripts/guardian-pvp-host-audit.mjs`

## Regla de autoridad

Orden de prioridad:

```text
Servidor PvP central disponible
  -> autoridad central

Servidor central offline + Guardian Master válido
  -> Guardian PvP temporal

Sin servidor central y sin Master Guardian
  -> no hay autoridad PvP online
```

Nunca deben existir dos autoridades PvP activas a la vez. Si el servidor central vuelve, el adaptador detiene el modo Guardian y abandona la sala temporal.

## First-use

El paquete PvP se carga bajo demanda. Orden relevante:

```text
KeloGuardian
  -> KeloSharedPvPAuthority
  -> KeloGuardianPvPHost
  -> engine-net / KeloNetAuthority
  -> KeloGuardianPvPNetAdapter
  -> KeloPvPWorld
  -> KeloGuardianPvPUI
```

El runtime Guardian no crea otro game loop. Se registra en `KeloSimulation.after(...)` y ejecuta el core compartido a fixed-step de 60 Hz con catch-up limitado.

## Mensajes P2P

El host usa el DataChannel Guardian existente:

- `guardian:pvp_intent`
- `guardian:pvp_snapshot`
- `guardian:pvp_reject`
- `guardian:pvp_takeover`

Los mensajes están limitados a 48 KiB, por debajo del límite interno del transporte Guardian. Los inputs también tienen rate limit por peer.

## Fencing

Un intent solo puede entrar cuando:

1. Guardian está habilitado;
2. este dispositivo es el Master vigente;
3. la app está visible;
4. el `epoch` del mensaje coincide con el `epoch` de la lease vigente;
5. el servidor central no está activo;
6. el mensaje cumple límites de tamaño y frecuencia;
7. el core compartido acepta su `sequence`.

Los snapshots se ordenan por `(epoch, seq)`. Al cambiar el `epoch`, el receptor reinicia el contador de snapshot para aceptar correctamente el primer snapshot del nuevo Master.

## Takeover de Master

Cada participante conserva en memoria el snapshot PvP Guardian más reciente. Si ese participante obtiene una nueva lease Master y el snapshot tiene menos de 7 segundos:

1. se crea una nueva instancia de `KeloSharedPvPAuthority`;
2. se conserva un `tickOffset` para que `serverTick` no retroceda;
3. se restauran jugadores del snapshot;
4. se emite `guardian:pvp_takeover`;
5. el nuevo Master continúa enviando snapshots con el nuevo `epoch`.

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

Es preferible perder unos milisegundos de una acción antes que duplicar daño, revivir un proyectil ya impactado o continuar un iframe ambiguo en dos hosts distintos.

Los nuevos eventos se namespacéan por `epoch` para que el cliente no los confunda con eventos ya consumidos del Master anterior.

## Recuperación de sequence

El cliente mantiene `lastAck` y nunca reduce su contador de intents. Después de un takeover:

```text
nextSequence >= lastAck + 1
```

Si recibe `STALE_SEQUENCE` o `IMPOSSIBLE_SEQUENCE_JUMP`, el adaptador adelanta su contador al ACK autoritativo y continúa, en vez de quedarse atrapado en un ciclo de rechazos.

## Límites para móvil

- una sala Guardian PvP por dispositivo;
- máximo 16 jugadores en esta fase;
- 20 snapshots/s;
- fixed-step 60 Hz;
- máximo 5 pasos de catch-up por frame;
- máximo 90 intents/s por peer;
- payload máximo 48 KiB;
- sin `setInterval` adicional;
- sin `localStorage`/IndexedDB para estado de combate.

Estos límites son deliberados para que un iPhone pueda actuar como host de laboratorio sin permitir que una pestaña atrasada intente simular segundos completos de golpe.

## Frontera de seguridad

El Guardian PvP Host NO es autoridad de:

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

El takeover V1.2 es continuidad de estado, no migración de frame perfecta. Las acciones/proyectiles en vuelo se cancelan. Además, iOS puede suspender Safari/PWA en background; si el Master deja de renovar su lease, otro Guardian elegible necesita obtener la nueva lease antes de continuar.

El siguiente salto de madurez debe medir takeover real con dos dispositivos físicos y pérdida forzada del Master, registrando: tiempo sin snapshots, inputs rechazados, desviación de posición, pérdida de acciones y tiempo hasta primer snapshot del nuevo epoch.

## QA

Comando:

```text
npm run audit:guardian-pvp-host
```

El gate verifica core compartido Node/browser, first-use order, lease/epoch fencing, rate limit, takeover, sequence resync, prioridad del servidor central y ausencia de autoridad persistente/económica.
