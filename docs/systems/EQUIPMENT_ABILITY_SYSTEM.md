# Kelo World — Equipment Ability System

## Propósito

Añade identidad de combate basada en el arma equipada sin crear clases fijas ni un segundo motor de habilidades. Los cinco slots Stone siguen siendo el loadout principal. Cuando el jugador está a pie, el arma equipada proyecta exactamente tres técnicas `Q/W/E`. Cuando monta, esa fila se sustituye por `M1/M2/M3` de la montura; nunca se apilan dos filas adicionales.

## Ownership y archivos

- `KeloEquipment` (`src/systems/equipment-system.js`) sigue siendo el único owner del arma y del equipo del jugador.
- `KeloAbilities` (`src/abilities/kelo-ability-boot.js`) sigue siendo el único owner de targeting, delivery, effects y ejecución de habilidades.
- `KeloStones` sigue siendo el único owner de los cinco Stone slots.
- `KeloMounts` + `KeloMountAbilityChannel` siguen poseyendo el estado/canal exclusivo de monturas.
- `src/abilities/equipment-ability-data.js` es contenido puro: AbilityDefinitions, WeaponProfiles y bindings de templates.
- `src/abilities/equipment-ability-channel.js` es una proyección SUPPORT del arma equipada a tres slots runtime.
- `src/abilities/ability-source-cast.js` es un adapter SUPPORT reutilizable para que fuentes no-Stone usen `KeloAbilities` sin tocar `STATE.equipped`.
- `src/ui/equipment-action-bar.js` es UI consumidora únicamente.

No se crea `WeaponAbilityEngine`, `EquipmentAbilityEngine` ni otro runtime de delivery/effects.

## Estado que posee

`KeloEquipmentAbilityChannel` posee únicamente tres descriptors runtime `Q/W/E`, sus `readyAt` de cooldown local y el fingerprint de la proyección actual del arma. No posee inventario, `STATE.equipmentSlots`, Stone loadout, HP, maná, stats, posición ni autoridad de daño.

`KeloAbilitySourceCast` no persiste estado. Sustituye temporalmente un slot runtime de `KeloAbilities.hotbar` durante un cast síncrono y lo restaura en `finally`.

## APIs públicas

### `KELO_EQUIPMENT_ABILITY_DATA`

- `abilities`
- `profiles`
- `templateBindings`
- `getAbility(keyOrId)`
- `getProfile(id)`
- `resolveProfileForItem(item)`
- `validateProfile(profile)`

Cada `WeaponProfile` debe declarar exactamente tres `abilityKeys`, correspondientes a Q, W y E.

### `KeloEquipmentAbilityChannel`

- `sync(force)`
- `getSlots()`
- `getSnapshot()`
- `cast(request)`
- `on(event, fn)`
- `getRemainingCooldown(slot)`
- `labels` = `['Q','W','E']`

### `KeloAbilitySourceCast`

- `cast({ sourceType, sourceId, sourceSlot, sourceFingerprint, definition, request })`
- `isAvailable()`

### `KELO_EQUIPMENT_ACTION_BAR`

- `refresh()`
- `destroy()`

## Flujo

1. `KeloEquipment` equipa o desequipa un arma mediante su API actual.
2. `KeloEquipmentAbilityChannel.sync()` lee el equipo mediante `KeloEquipment.getEquipped()`; nunca lee/escribe `STATE.equipmentSlots` directamente.
3. `KELO_EQUIPMENT_ABILITY_DATA.resolveProfileForItem()` resuelve el `WeaponProfile` por `weaponProfileId`/`combatProfileId` o por binding del `templateId`.
4. El perfil produce exactamente Q/W/E.
5. La UI convierte el gesto táctil en dirección/posición y llama `KeloEquipmentAbilityChannel.cast()`.
6. El channel valida slot, montura y cooldown local y delega a `KeloAbilitySourceCast`.
7. El adapter proyecta la AbilityDefinition durante el cast síncrono dentro del hotbar runtime de `KeloAbilities`.
8. `KeloAbilities` ejecuta su validación, targeting, resource cost, delivery, collision, effects y eventos existentes.
9. El adapter restaura el mismo objeto Stone que existía antes del cast.
10. El channel inicia su `readyAt` solo si el cast fue válido.
11. Al montar, Q/W/E queda deshabilitado y la misma posición visual se entrega a M1/M2/M3.

## Contenido inicial

`starter_weapon` resuelve a `weapon.vanguard_blade`:

- Q — **Corte de Vanguardia**: golpe físico cercano.
- W — **Paso del Duelista**: desplazamiento corto.
- E — **Ruptura Real**: daño de área + ralentización.

También queda preparado `weapon.arcane_staff` como segunda familia data-driven para probar escalabilidad del contrato sin ramas por ID.

## Invariantes

1. `KeloStones.LOADOUT_SIZE` permanece exactamente en 5.
2. El Equipment Ability System nunca inserta una habilidad en `STATE.equipped`.
3. A pie puede haber 5 Stone + 3 weapon = 8 habilidades activas visibles como máximo.
4. Montado puede haber 5 Stone + 3 mount = 8 habilidades activas visibles como máximo.
5. Q/W/E y M1/M2/M3 son mutuamente excluyentes.
6. Toda habilidad de arma reutiliza deliveries/effects existentes de `KeloAbilities`.
7. Casco, pecho, botas y otras piezas continúan aportando stats/pasivas mediante `KeloEquipment → KeloStats`; esta capacidad no duplica ese cálculo.
8. UI no modifica estado gameplay.
9. Cambiar de familia de arma cambia el kit por datos; no se añaden ramas por weapon ID al runtime.

## Eventos y observabilidad

- `EQUIPMENT_ABILITY_LOADOUT_CHANGED`
- `EQUIPMENT_ABILITY_CAST`
- `KELO_ABILITY_SOURCE_CAST`
- eventos existentes de `KeloAbilities`, incluido `ABILITY_CAST`

`KELO_ABILITY_SOURCE_CAST` contiene `sourceType`, `sourceId`, `sourceSlot`, `sourceFingerprint`, `abilityId` y `abilityKey` para depuración y futura validación autoritativa.

## Online-first / autoridad

El prototipo actual mantiene predicción/ejecución cliente igual que el runtime de habilidades existente. Antes de PvP competitivo de producción, el servidor debe validar como mínimo que `sourceId` pertenece al jugador, que esa arma está realmente equipada, que el WeaponProfile/ability pertenece a esa arma, el slot Q/W/E solicitado, resource cost y cooldown autoritativos, target/range y el resultado de daño.

Los IDs estables y `sourceFingerprint` permiten mover esa decisión al servidor sin cambiar el flujo visible ni los contratos de contenido. El adapter temporal existe porque `KeloAbilities.engine.cast()` todavía recibe un índice del hotbar Stone. La deuda correcta es evolucionar `KeloAbilities` hacia un cast source-native y retirar el bridge; no crear un segundo engine.

## Persistencia

No hay persistencia nueva. El arma se persiste por `KeloEquipment`; el perfil se deriva de datos. Los cooldowns Q/W/E son runtime efímero. Online competitivo requerirá cooldown autoritativo del servidor.

## Extensión / reutilización

Para añadir otra familia de arma:

1. definir las AbilityDefinitions usando deliveries/effects ya soportados;
2. crear un `WeaponProfile` con exactamente tres `abilityKeys`;
3. enlazar el template del arma al profile o publicar `weaponProfileId` en el item;
4. ejecutar audits;
5. solo extender `KeloAbilities` si falta una primitive genérica real.

Miles de armas pueden reutilizar el mismo profile. Una variante nueva puede usar otro profile sin tocar el channel.

## Uso correcto

```js
const weapon = {
  id: 'weapon_2042',
  templateId: 'arcane_staff',
  slot: 'weapon'
};
// KeloEquipment posee el equip. El channel resolverá weapon.arcane_staff automáticamente.
```

## Anti-patrones

- No añadir Q/W/E a `STATE.equipped`.
- No cambiar Stone de 5 a 8 slots.
- No duplicar `deliveryHandlers`.
- No escribir cooldowns desde el DOM.
- No hardcodear familias dentro de `KeloEquipment`.
- No permitir Q/W/E y M1/M2/M3 simultáneamente.
- No usar VFX para decidir daño.
- No declarar el cliente autoridad competitiva final.

## Tests / CI

- `npm run audit:equipment-abilities`
- `npm run audit:mounts`
- `npm run audit:stones`
- `npm run audit:foundation`
- `npm run audit:docs`

El audit específico verifica que el bridge restaura la referencia original del Stone, que siguen existiendo exactamente cinco Stone slots, que Q/W/E son tres, que M1–M3 son tres y que montura/arma son mutuamente excluyentes.

## Deuda conocida

- `KeloAbilitySourceCast` usa de forma transicional el slot runtime 0 durante un cast estrictamente síncrono; siempre lo restaura con `finally`.
- `ABILITY_CAST` del runtime antiguo todavía nace desde la semántica del hotbar Stone. Para autoridad online de fuentes no-Stone debe preferirse el payload semántico `KELO_ABILITY_SOURCE_CAST` hasta que `KeloAbilities` exponga cast source-native.
- Las primeras técnicas reutilizan presentación/fallback existente; arte/VFX exclusivo puede añadirse después por el Visual System sin cambiar gameplay.

## Checklist para ampliar sin duplicar owner

- [ ] ¿Es contenido expresable con AbilityDefinition existente?
- [ ] ¿El arma resuelve un profile por datos?
- [ ] ¿El profile contiene exactamente Q/W/E?
- [ ] ¿Los cinco Stone siguen intactos?
- [ ] ¿Montado sustituye Q/W/E por M1/M2/M3?
- [ ] ¿KeloAbilities sigue siendo el único runtime de delivery/effects?
- [ ] ¿KeloEquipment sigue siendo el único owner del arma equipada?
- [ ] ¿La operación conserva IDs aptos para autoridad server?
- [ ] ¿Pasaron los audits de equipment abilities, mounts, stones, foundation y docs?
