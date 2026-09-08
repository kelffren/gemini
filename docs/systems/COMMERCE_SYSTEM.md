# Kelo World — Commerce System V1

## Propósito

Commerce V1 unifica el comercio valioso de Kelo World bajo una sola frontera de autoridad. Permite probar offline el Mercado Central, puestos de jugador, publicaciones, compras y trade directo sin construir un segundo flujo que luego haya que reemplazar al conectar servidor.

## OWNER y archivos principales

- **OWNER gameplay/economía:** `window.KeloCommerceAuthority` — `src/systems/commerce-authority.js`.
- **Movimiento físico de objetos:** `window.KeloContainers` — `src/systems/container-system.js`.
- **Escrow de publicaciones:** `window.KeloMarketEscrow` — `src/systems/market-escrow-system.js`.
- **Zona/instancia visual:** `window.KeloMarketWorld` — `src/instances/market-instance.js`.
- **UI:** `window.KeloCommerceUI` — `src/ui/commerce-ui.js`.
- **Compatibilidad UI anterior:** `src/ui/market-ui.js`, ahora delega escrituras a Commerce Authority.
- **Puente online:** `window.KeloNetAuthority.requestCommerce()` — `engine-net.js`.

## Estado que posee

`KeloCommerceAuthority` posee en modo offline:

- una sesión de trade activa;
- historial acotado de trades;
- log acotado de transacciones;
- claims de puestos;
- fixtures de vendedores/listings demo usados únicamente para pruebas offline.

`KeloContainers` posee `tradeEscrow`, además de los contenedores ya existentes.

`KeloMarketWorld` solo posee estado temporal de escena: snapshot de posición/cámara y modo vendedor local.

## Estado que NO posee

La UI no posee ni muta:

- `STATE.gold`;
- `STATE.inventory`;
- arrays de Warehouse/Market Escrow/Trade Escrow;
- estado autoritativo de un trade;
- ownership real de un puesto online.

`KeloMarketWorld` tampoco decide compras, transfers ni balances.

## API pública

### `KeloCommerceAuthority`

- `request(op, payload)` — boca única de comandos.
- `snapshot()` — vista pública del comercio.
- `getMode()` — `local-offline`, `server-authoritative` o adapter inyectado.
- `installAuthorityAdapter(adapter)` — extensión explícita para otro authority provider.
- `createMarketListing(instanceId, quantity, price, metadata)`.
- `cancelMarketListing(listingId)`.
- `buyListing(listingId)`.
- `claimStall(stallId, message)` / `releaseStall(stallId)` / `setStallMessage(message)`.
- `createTrade(peer)`.
- `addTradeItem(instanceId, quantity)` / `removeTradeItem(instanceId)`.
- `setTradeGold(gold)`.
- `setTradeReady(ready)`.
- `finalAcceptTrade(accept)`.
- `cancelTrade()`.
- `demoPeerReady()` y `demoPeerFinalAccept()` existen solo para demostrar el protocolo offline.

### `KeloContainers` añadido para Commerce

- `checkpoint()`.
- `restoreCheckpoint(snapshot, options)`.
- `receiveItem(destination, item, options)`.
- `extractItem(source, itemKey, options)`.
- contenedor `trade_escrow`, separado de `market_escrow`.

### `KeloMarketWorld`

- `enter()` / `leave()`.
- `getStalls()` / `getStall(id)` / `getClaim(id)`.
- `startSelling(stallId)` / `stopSelling()`.
- `hitTest(worldX, worldY)`.

## Flujo — Mercado

1. El jugador abre **Mercado**.
2. `KeloCommerceUI` pide entrar a `KeloMarketWorld`.
3. `KELO_INSTANCES` crea/entra a la instancia lógica `market:central-market`.
4. El renderer exclusivo de `KeloMarketWorld` dibuja suelo, puestos, alfombras y personaje usando `KeloRender` y `KeloCamera`.
5. Tocar una alfombra abre el puesto correspondiente.
6. Publicar envía `market:create` a Commerce Authority.
7. Offline, Commerce reutiliza `KeloMarketEscrow`, que mueve físicamente el item desde Backpack a `market_escrow`.
8. Comprar una fixture offline ejecuta una transacción con checkpoint de contenedores + balance de oro. Si cualquier paso falla, se restaura todo.

## Flujo — Puesto

1. Una alfombra sin claim puede reclamarse mediante `stall:claim`.
2. El jugador puede definir un mensaje corto del puesto.
3. `startSelling()` coloca al personaje detrás del puesto y adquiere un lock semántico `commerce-stall` mediante `KeloInputLocks`.
4. Dejar de vender libera exclusivamente ese lock.
5. Liberar el puesto no modifica listings por fuera de Commerce Authority.

## Flujo — Trade directo

1. `trade:create` crea una sesión.
2. Añadir un item lo mueve físicamente de Backpack a `trade_escrow`.
3. Cambiar objetos u oro reinicia **las confirmaciones de ambos lados**.
4. Cada lado marca `ready`.
5. Solo cuando ambos están ready se entra a `FINAL_REVIEW`.
6. Cada lado debe aceptar una segunda vez (`finalAccepted`).
7. Con ambas aceptaciones finales se ejecuta `commitTrade()`.
8. El commit usa checkpoint de contenedores, valida oro, recibe items entrantes y extrae los salientes.
9. Si falla cualquier operación, se restauran contenedores, oro y estado Commerce.
10. Cancelar devuelve los items de `trade_escrow` a Backpack.

## Dependencias permitidas

Commerce puede consumir:

- `KeloContainers`;
- `KeloMarketEscrow`;
- `KeloNetAuthority`;
- `STATE/saveState` dentro del adapter local;
- `KeloEvents` para observabilidad.

La UI solo consume APIs públicas de Commerce/Market World/Backpack/Containers para lectura.

## Eventos y hooks

- `commerce:changed` en `KeloEvents` cuando está disponible.
- DOM `kelo:commerce-changed`.
- DOM `kelo:commerce-server-event` para ingestión de snapshots/eventos del transporte online.
- `kelo:scenechange` para mostrar/ocultar dock del Mercado.
- `KeloRender.intercept` para render exclusivo de la instancia market.
- `KeloSimulation.after` para bounds y modo vendedor.

## Modelo offline vs autoridad online

### Offline actual

`KeloCommerceAuthority.request()` ejecuta `localRequest()`. Esto hace la demo completamente jugable sin servidor.

### Online preparado

Cuando `KeloNetAuthority.isOnline()` es verdadero:

- Commerce **no usa fallback local** para estado valioso;
- exige `KeloNetAuthority.requestCommerce()`;
- el cliente envía `commerce:request` con `{ op, payload }`;
- el contrato espera `commerce:result` para respuestas y `commerce:event` para pushes;
- snapshots/eventos se propagan a Commerce mediante `kelo:commerce-server-event`.

El servidor futuro implementa esos mensajes y se convierte en la única autoridad de oro, ownership, inventory, escrow, sessions y commit. La UI y `KeloMarketWorld` no necesitan reescritura.

## Persistencia

Offline usa el `saveState()` actual. `STATE.commerce`, `STATE.tradeEscrow` y publicaciones de Market Escrow quedan dentro del save existente.

En boot, si quedaron items en `trade_escrow` por un cierre inesperado, Commerce intenta recuperarlos a Backpack y limpia la sesión incompleta. Un backend final reemplazará esta recuperación con estado durable server-side.

## Invariantes

1. Una identidad de item no puede vivir en dos contenedores a la vez.
2. `market_escrow` se usa exclusivamente para publicaciones activas.
3. `trade_escrow` se usa exclusivamente para oferta local de una sesión de trade.
4. La UI nunca mueve items ni oro directamente.
5. Cambiar una oferta invalida ready/finalAccepted de ambos lados.
6. Un trade solo puede hacer commit después de la doble confirmación de ambos lados.
7. Commit o cancel deben ser atómicos: éxito completo o rollback.
8. Estar online nunca habilita fallback local para una operación Commerce valiosa.

## Extension points

- Nuevo tipo de venta: añadir un nuevo `op` a Commerce Authority, no un manager paralelo.
- Subastas/regalos: reutilizar `request()` + primitivas transaccionales de Containers.
- Persistencia remota: implementar server adapter; no tocar UI.
- Nuevos mapas de mercado: reutilizar `KeloMarketWorld` o registrar otro `KELO_INSTANCES` type consumiendo el mismo Commerce owner.
- Assets premium: reemplazar únicamente presentación de puestos/alfombras; sus IDs y hitboxes siguen data-driven.

## Uso correcto

```js
await KeloCommerceAuthority.createMarketListing(itemId, 1, 250, { stallId: 'stall_01' });
await KeloCommerceAuthority.setTradeGold(100);
await KeloCommerceAuthority.setTradeReady(true);
```

## Anti-patrones

No hacer:

```js
STATE.gold -= price;
STATE.inventory.splice(index, 1);
STATE.tradeEscrow.items.push(item);
KeloMarketEscrow.createMarketListing(...); // desde UI nueva
```

La única excepción a llamar `KeloMarketEscrow` directamente es el adapter local interno de Commerce Authority.

## Tests / CI

- `scripts/container-system-audit.js` protege identidad, trade escrow, checkpoint, receive/extract y rollback.
- `scripts/commerce-system-audit.js` prueba publicación/cancelación, compra, puesto, trade, reset de confirmaciones, segunda aceptación y commit atómico.
- `scripts/system-documentation-audit.js` protege documentación/catálogo.

## Observabilidad

`KELO_COMMERCE_AUDIT`, `KELO_CONTAINER_AUDIT`, `KELO_MARKET_WORLD_AUDIT` y `KELO_COMMERCE_UI_AUDIT` exponen contratos diagnósticos. Commerce mantiene además un `transactionHistory` local acotado para reconciliar pruebas offline.

## Deuda conocida / pendiente

- El servidor todavía debe implementar `commerce:request`, `commerce:result` y `commerce:event`; el cliente ya tiene el adapter final preparado.
- Los vendedores/listings externos actuales son fixtures offline explícitas, no economía real.
- La primera presentación de puestos usa Canvas procedural; assets premium pueden sustituirla sin cambiar el dominio.
- La instancia online final deberá recibir capacidad/sharding/participants desde el director de servidor.

## Checklist para extender sin duplicar owner

1. ¿La capacidad mueve oro/items/ownership? → entra por `KeloCommerceAuthority`.
2. ¿Necesita reservar un item? → usa un contenedor/escrow explícito de `KeloContainers`.
3. ¿La operación puede fallar a mitad? → checkpoint + rollback.
4. ¿Es UI? → solo intenciones y snapshots.
5. ¿Cambia una oferta de trade? → reset de ambas confirmaciones.
6. ¿Debe funcionar online? → mismo `op`; implementar servidor, no otro frontend.
7. Actualizar este documento, catálogo, guía y auditorías en el mismo cambio.