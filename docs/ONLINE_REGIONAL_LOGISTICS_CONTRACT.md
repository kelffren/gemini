# Online Migration Contract — Regional Economy & Logistics

## Objetivo

La foundation offline debe poder migrar a autoridad de servidor sin reescribir UI ni dominio. Los consumidores llaman siempre a `request(command, payload)` del owner correspondiente.

## Fronteras

### Economy

Cliente:

`KeloRegionalEconomy.request(command, payload)`

Bridge futuro:

`KeloNetAuthority.requestRegionalEconomy(command, payload)`

Autoridad server debe validar y devolver estado/revision para:

- `BuyResource`
- `SellResource`
- `DeliverSupplyContract`
- refresco/producción de settlements
- world events y route risk authoritative inputs

El cliente no puede decidir precio final, reward, stock o contrato completado.

### Caravans

Cliente:

`KeloCaravans.request(command, payload)`

Bridge futuro:

`KeloNetAuthority.requestCaravan(command, payload)`

Servidor valida:

- actor/range;
- cart revision;
- owner/controller;
- attach/detach;
- claim start/interrupt/complete;
- load/unload;
- cargo visibility;
- muerte/abandono.

El contenido de carga nunca debe enviarse a clientes no autorizados.

### Factions / Clans

Cliente:

`KeloFactions.request(command, payload)`

Bridge futuro:

`KeloNetAuthority.requestFactionClan(command, payload)`

Servidor valida memberships, faction binding, roster, role, permissions y revision.

## No fallback online

Cuando `KeloNetAuthority.isOnline()` sea true y el bridge correspondiente no exista, el owner devuelve un error `*_SERVER_BRIDGE_UNAVAILABLE`. No ejecuta la mutación local como fallback.

## Stable IDs / revisions

Entidades que deben viajar con IDs estables y revision:

- settlements/state;
- supply contracts;
- world/route events;
- carts;
- clans;
- faction membership.

## Idempotency

El transporte final debe añadir `commandId`/idempotency key por operación valiosa. Reintentar una request de red no debe duplicar compras, rewards, deliveries, claims o clan mutations.

## Clock

El servidor final posee el clock autoritativo. La fórmula lazy de producción se mantiene idéntica:

`hourlyRate × elapsed(serverNow - lastUpdatedAt)`.

No hace falta migrar timers porque V1 no los utiliza.

## Invariante principal

`UI → owner.request → authority adapter → domain result`

La UI no conoce si la authority es local o server.
