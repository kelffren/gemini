# KeloInventory — Inventory State Foundation

> **OWNER:** `KeloInventory`  
> **Fuente:** `src/core/inventory-state-system.js`  
> **Estado:** Foundation V4 / transitional  
> **Player visible:** no; es infraestructura interna para items portátiles.

## Propósito

`KeloInventory` es la frontera única para **identidad, acceso a colecciones, cantidad, stacking compartido, mutación portable y rollback** de items de Kelo World.

Antes de V4, Backpack, Containers, Equipment, Market Escrow, Emotes, Forge, Boutique y el bridge de Stones podían leer o modificar `STATE.inventory` directamente y varios sistemas duplicaban helpers de identidad, stacks y snapshots. Eso hacía posible que dos features interpretaran un mismo item de forma distinta y que una migración de piedras destruyera o pusiera en cuarentena contenido no-stone.

V4 no crea un segundo `STATE` y no reescribe la persistencia completa. Conserva el estado legacy de `engine-a.js`, pero coloca un owner reutilizable encima del dominio portable.

## Ownership

### KeloInventory posee

- contrato de identidad portable compatible con `id`, `uid` y `_backpackId`;
- acceso canónico a los arrays de items portátiles;
- `quantity`, `maxStack`, `stackSignature` y `canStack` compartidos;
- add/remove/replace de items;
- cambio de quantity como primitive;
- clon con identidad nueva para splits;
- snapshots/restores del dominio de items para rollback;
- auditoría de identidad entre containers.

### KeloInventory NO posee

- orden visual/capacidad de slots del backpack → `KeloBackpack`;
- reglas de transferencias/capacidad/permisos → `KeloContainers`;
- qué item está equipado y sus stats → `KeloEquipment`;
- semántica de piedras/loadout → `KeloStones`;
- listings de mercado → `KeloMarketEscrow`;
- reglas de Forge → `KeloForge`;
- oro/economía → todavía legacy `STATE`/futuros owners;
- persistencia global final → todavía `saveState()` de `engine-a.js` durante transición.

## Colecciones conocidas

| Tipo lógico | Storage actual |
|---|---|
| `backpack` | `STATE.inventory` |
| `warehouse` | `STATE.warehouse.items` |
| `market_escrow` | `STATE.marketEscrow.items` |
| `emote_loadout` | `STATE.emoteLoadout.items` |

Estas rutas son un detalle transicional. Consumidores nuevos no deben depender de ellas directamente.

## API pública

```text
KeloInventory.ensure()
KeloInventory.persist()
KeloInventory.getItems(type)
KeloInventory.itemIdentity(item)
KeloInventory.ensureIdentity(item, index)
KeloInventory.keyForItem(item, index)
KeloInventory.quantity(item)
KeloInventory.stackLimit(item)
KeloInventory.stackSignature(item)
KeloInventory.canStack(a, b)
KeloInventory.itemMap(typeOrArray)
KeloInventory.indexOfItem(type, itemOrKey)
KeloInventory.findByKey(type, key)
KeloInventory.addItem(type, item, options)
KeloInventory.removeItem(type, itemOrKey, options)
KeloInventory.replaceItems(type, nextItems, options)
KeloInventory.setQuantity(item, value, options)
KeloInventory.cloneWithNewIdentity(item, overrides)
KeloInventory.snapshot(keys)
KeloInventory.restore(snapshot, options)
KeloInventory.identityAudit(types)
```

`options.persist:false` permite que un owner superior agrupe una transacción y persista una sola vez cuando termina correctamente.

## Invariantes

1. **Una identidad portable no debe existir en dos containers a la vez.**
2. Features LIVE no escriben `STATE.inventory` directamente.
3. `engine-a.js` es la única excepción legacy para bootstrap/load de `STATE.inventory`; no es un patrón para código nuevo.
4. Identidad no se reinventa en Backpack, Containers, Market o cualquier feature nueva.
5. Stacking no se reinventa: la firma viene de `KeloInventory.stackSignature`.
6. Un transfer completo conserva identidad.
7. Un split crea una identidad nueva.
8. Rollback devuelve las colecciones al snapshot previo.
9. Una migración de Stones solo transforma candidatos stone; todos los demás items portátiles se preservan.
10. UI no muta arrays de inventory; llama al owner o al sistema de dominio apropiado.

## Flujo correcto: obtener un item

```text
Feature genera/recibe definición de item
        ↓
KeloInventory.addItem('backpack', item)
        ↓
KeloBackpack.ensure() coloca su key en un slot
        ↓
UI consume KeloBackpack/KeloInventory
```

Si la feature tiene un owner especializado, ese owner debe ser el punto público de entrada. Por ejemplo, Market usa `KeloMarketEscrow`, que internamente usa `KeloContainers`, y Containers usa `KeloInventory`.

## Flujo correcto: transferir un item

```text
UI / feature
   ↓
KeloContainers.transferItem(...)
   ↓
validación de container/equipped/capacidad
   ↓
KeloInventory remove/add/quantity/identity
   ↓
persist o rollback
```

No mover manualmente un objeto entre arrays.

## Stones y migraciones

`KeloStones.migrateState` históricamente asumía que `inventory` contenía solo stones. V4 introduce `stone-backpack-bridge-v1.2.0`:

1. separa candidatos stone de items portátiles no-stone;
2. ejecuta la migración en un shadow state;
3. recupera stones normalizadas;
4. concatena sin modificar los items no-stone;
5. publica el resultado por `KeloInventory.replaceItems`.

Esto permite añadir consumibles, materiales, joyería, emotes y futuros kinds sin convertirlos accidentalmente en basura de una migración Stone.

## Persistencia

V4 reutiliza `saveState()`; no introduce otro storage ni otra copia persistente de inventory. `KeloInventory.persist()` es un adapter hacia ese mecanismo.

**Pendiente posterior:** separar la persistencia monolítica de `engine-a.js`, medir volumen/latencia y decidir una storage layer. Eso no forma parte de V4.

## Local vs online

`KeloInventory` es actualmente un owner client-side de representación/estado portable. No convierte al cliente en autoridad online. Operaciones económicas o trades online deben seguir pasando por autoridad de servidor cuando exista.

## Uso correcto

```js
const item = {
  templateId: 'health_potion',
  kind: 'consumable',
  quantity: 1,
  maxStack: 20
};

const result = KeloInventory.addItem('backpack', item);
if (!result.ok) {
  // manejar error del owner
}
```

Para transferencias:

```js
KeloContainers.transferItem('backpack', 'warehouse', itemKey, 1);
```

## Anti-patrones

No hacer:

```js
STATE.inventory.push(item);
STATE.inventory.splice(index, 1);
STATE.inventory = next;
```

No copiar helpers como:

```js
function keyForItem(...) { ... }
function stackSignature(...) { ... }
function cloneInventoryState(...) { ... }
```

Si el primitive falta, se extiende `KeloInventory` y se documenta/testea una vez.

## Tests y CI

Protección principal:

- `scripts/inventory-state-contract-audit.js`
- `scripts/backpack-system-audit.js`
- `scripts/container-system-audit.js`
- `scripts/market-escrow-audit.js`
- `scripts/emote-system-audit.js`
- `Backpack CI`
- `Kelo Foundation Architecture CI`
- `Forge CI` para integración Forge/Equipment.

El contract audit obtiene la lista de scripts LIVE desde `index.html` y falla si encuentra un writer directo de `STATE.inventory` fuera de la excepción legacy de `engine-a.js`.

## Observabilidad

`window.KELO_INVENTORY_AUDIT` declara:

- versión;
- owner;
- adapter legacy;
- contrato de identidad;
- stacks compartidos;
- primitive de snapshot/rollback;
- estado de autoridad online.

`KeloInventory.identityAudit(...)` devuelve errores concretos de identidad duplicada entre containers.

## Deuda conocida

- `STATE.inventory` y `saveState()` siguen físicamente en `engine-a.js`.
- `STATE.equipped` todavía representa el loadout Stone legacy/moderno y no pertenece a este pass.
- oro/economía todavía puede ser escrito por sistemas legacy.
- storage global sigue usando localStorage síncrono.
- server authority de inventory/economía no está consolidada completamente.

Ninguna de estas deudas justifica crear un segundo inventory owner.

## Checklist para añadir contenido portable

Antes de implementar:

1. ¿Es solo CONTENT? Si sí, no crear sistema nuevo.
2. ¿Ya existe un owner especializado para obtener/consumir ese item?
3. ¿La identidad puede expresarse con el contrato actual?
4. ¿El stack usa el primitive existente?
5. ¿La entrada/salida pasa por `KeloInventory` o `KeloContainers`?
6. ¿No hay `STATE.inventory` directo?
7. ¿La migración/reload conserva el item?
8. ¿Se mantiene una sola identidad entre backpack/warehouse/escrow/loadout?
9. ¿Los tests cubren el cambio?

Si al añadir un item nuevo alguien necesita preguntar “¿en qué array lo empujo?”, V4 no se está respetando.
