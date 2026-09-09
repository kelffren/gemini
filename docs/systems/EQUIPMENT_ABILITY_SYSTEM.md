# Kelo World — Equipment Ability System

## Propósito

Añade identidad de combate basada en el arma equipada sin crear clases fijas ni un segundo motor de habilidades. Los cinco slots Stone siguen siendo el loadout principal. Cuando el jugador está a pie, el arma equipada proyecta exactamente tres técnicas `Q/W/E`. Cuando monta, esa fila se sustituye por `M1/M2/M3` de la montura; nunca se apilan dos filas adicionales.

La fase 2 añade dos capacidades sin cambiar ownership: familias de arma escalables y selección permitida por slot dentro de una misma familia. Esto permite que miles de items compartan runtime y profile, mientras variantes concretas pueden elegir una Q/W/E distinta entre opciones autorizadas por datos.

## Ownership y archivos

- `KeloEquipment` (`src/systems/equipment-system.js`) sigue siendo el único owner del arma y del equipo del jugador.
- `KeloAbilities` (`src/abilities/kelo-ability-boot.js`) sigue siendo el único owner de targeting, delivery, effects y ejecución de habilidades.
- `KeloStones` sigue siendo el único owner de los cinco Stone slots.
- `KeloMounts` + `KeloMountAbilityChannel` siguen poseyendo el estado/canal exclusivo de monturas.
- `src/abilities/equipment-ability-data.js` es contenido puro: AbilityDefinitions, WeaponProfiles, bindings de templates y opciones permitidas por slot.
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
- `getProfilesByFamily(family)`
- `resolveProfileForItem(item)`
- `resolveLoadoutForItem(item)`
- `validateProfile(profile)`
- `validateLoadout(profile, abilityKeys)`

Cada `WeaponProfile` declara exactamente tres `abilityKeys` por defecto, correspondientes a Q, W y E. Opcionalmente declara `slotChoices`, también con exactamente tres entradas. Cada entrada es la lista de Ability keys que están autorizadas en ese slot.

Un item puede declarar `combatAbilityKeys` o `weaponAbilityKeys` como array `[Q,W,E]` o como objeto `{Q,W,E}`. El resolver solo acepta una selección si cada habilidad existe y está autorizada para ese slot del profile. Una selección inválida nunca se ejecuta: se usa el kit por defecto y `selectionStatus` pasa a `invalid_fallback`.

### `KeloEquipmentAbilityChannel`

- `sync(force)`
- `getSlots()`
- `getSnapshot()`
- `cast(request)`
- `on(event, fn)`
- `getRemainingCooldown(slot)`
- `labels` = `['Q','W','E']`

El snapshot expone además `profileName`, `abilityKeys`, `selectionStatus` y `customized` para UI, edición y futura autoridad online.

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
4. `resolveLoadoutForItem()` toma las Q/W/E por defecto o una selección permitida del item.
5. Si la selección no es válida, el resolver vuelve al kit por defecto del profile.
6. La UI convierte el gesto táctil en dirección/posición y llama `KeloEquipmentAbilityChannel.cast()`.
7. El channel valida slot, montura y cooldown local y delega a `KeloAbilitySourceCast`.
8. El adapter proyecta la AbilityDefinition durante el cast síncrono dentro del hotbar runtime de `KeloAbilities`.
9. `KeloAbilities` ejecuta su validación, targeting, resource cost, delivery, collision, effects y eventos existentes.
10. El adapter restaura el mismo objeto Stone que existía antes del cast.
11. El channel inicia su `readyAt` solo si el cast fue válido.
12. Al montar, Q/W/E queda deshabilitado y la misma posición visual se entrega a M1/M2/M3.

## Familias disponibles

### Hoja de Vanguardia — `weapon.vanguard_blade`

- Q — **Corte de Vanguardia**.
- Q alternativa autorizada — **Rompeguardia**.
- W — **Paso del Duelista**.
- E — **Ruptura Real**.

### Bastón Arcano — `weapon.arcane_staff`

- Q — **Proyectil Arcano**.
- W — **Salto Arcano**.
- E — **Tempestad Arcana**.

### Arco Largo — `weapon.longbow`

- Q — **Disparo Rápido**.
- Q alternativa autorizada — **Flecha Perforante**.
- W — **Paso Evasivo**.
- E — **Lluvia de Flechas**.

### Dagas de Sombra — `weapon.shadow_daggers`

- Q — **Ráfaga de Hojas**.
- W — **Paso Sombrío**.
- E — **Círculo de Ejecución**.

### Martillo de Guerra — `weapon.war_hammer`

- Q — **Golpe de Tierra**.
- W — **Carga del Toro**.
- E — **Terremoto**.

### Bastón Glacial — `weapon.frost_staff`

- Q — **Esquirla de Hielo**.
- W — **Paso Glacial**.
- E — **Campo Glacial**.

Todas estas técnicas reutilizan únicamente deliveries existentes de `KeloAbilities`: `projectile`, `self_aoe`, `dash`, `blink` y `persistent_area`.

## Bindings iniciales

- `starter_weapon` / `vanguard_blade` → `weapon.vanguard_blade`
- `arcane_staff` → `weapon.arcane_staff`
- `starter_bow` / `longbow` → `weapon.longbow`
- `starter_daggers` / `shadow_daggers` → `weapon.shadow_daggers`
- `starter_hammer` / `war_hammer` → `weapon.war_hammer`
- `frost_staff` → `weapon.frost_staff`

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
10. Una selección personalizada solo puede usar habilidades autorizadas por `slotChoices` para ese profile y slot.
11. Una selección inválida hace fallback al kit por defecto; nunca se castea una habilidad ajena a la familia.

## Eventos y observabilidad

- `EQUIPMENT_ABILITY_LOADOUT_CHANGED`
- `EQUIPMENT_ABILITY_CAST`
- `KELO_ABILITY_SOURCE_CAST`
- eventos existentes de `KeloAbilities`, incluido `ABILITY_CAST`

`KELO_ABILITY_SOURCE_CAST` contiene `sourceType`, `sourceId`, `sourceSlot`, `sourceFingerprint`, `abilityId` y `abilityKey` para depuración y futura validación autoritativa.

## Online-first / autoridad

El prototipo actual mantiene predicción/ejecución cliente igual que el runtime de habilidades existente. Antes de PvP competitivo de producción, el servidor debe validar como mínimo que `sourceId` pertenece al jugador, que esa arma está realmente equipada, que el WeaponProfile corresponde al item, que la Q/W/E elegida está autorizada en `slotChoices`, resource cost y cooldown autoritativos, target/range y el resultado de daño.

El fingerprint incluye el loadout Q/W/E resuelto, de modo que cambiar una técnica modifica la identidad semántica del arma sin requerir otro engine.

Los IDs estables y `sourceFingerprint` permiten mover esa decisión al servidor sin cambiar el flujo visible ni los contratos de contenido. El adapter temporal existe porque `KeloAbilities.engine.cast()` todavía recibe un índice del hotbar Stone. La deuda correcta es evolucionar `KeloAbilities` hacia un cast source-native y retirar el bridge; no crear un segundo engine.

## Persistencia

No se introduce un store paralelo. El arma se persiste por `KeloEquipment`. Si un item necesita una variante puede persistir `combatAbilityKeys` dentro de su propio registro de item; el Equipment Ability System solo lo lee y valida. Los cooldowns Q/W/E son runtime efímero. Online competitivo requerirá cooldown autoritativo del servidor.

## Extensión / reutilización

Para añadir otra familia de arma:

1. definir las AbilityDefinitions usando deliveries/effects ya soportados;
2. crear un `WeaponProfile` con exactamente tres `abilityKeys` por defecto;
3. si existe elección por slot, añadir `slotChoices` sin cambiar el channel;
4. enlazar el template del arma al profile o publicar `weaponProfileId` en el item;
5. ejecutar audits;
6. solo extender `KeloAbilities` si falta una primitive genérica real.

Miles de armas pueden reutilizar el mismo profile. Diferencias de calidad, tier, skin o stats no requieren profiles nuevos. Una variante que solo cambia una Q/W/E puede usar `combatAbilityKeys`; un kit realmente distinto puede usar otro profile.

## Uso correcto

```js
const weapon = {
  id: 'weapon_2042',
  templateId: 'starter_bow',
  slot: 'weapon',
  combatAbilityKeys: {
    Q: 'weapon_bow_piercing_arrow',
    W: 'weapon_bow_evasive_step',
    E: 'weapon_bow_arrow_rain'
  }
};
// KeloEquipment posee el item/equip.
// El data resolver valida cada elección contra weapon.longbow.slotChoices.
```

## Anti-patrones

- No añadir Q/W/E a `STATE.equipped`.
- No cambiar Stone de 5 a 8 slots.
- No duplicar `deliveryHandlers`.
- No escribir cooldowns desde el DOM.
- No hardcodear familias dentro de `KeloEquipment`.
- No crear un profile nuevo solo porque cambió quality/tier/skin.
- No aceptar una ability key que no esté autorizada por el slot del profile.
- No permitir Q/W/E y M1/M2/M3 simultáneamente.
- No usar VFX para decidir daño.
- No declarar el cliente autoridad competitiva final.

## Tests / CI

- `npm run audit:equipment-abilities`
- `npm run audit:mounts`
- `npm run audit:stones`
- `npm run audit:foundation`
- `npm run audit:docs`

El audit específico verifica que existen seis familias, veinte AbilityDefinitions, que los profiles/slotChoices son válidos, que una Q personalizada permitida funciona, que una selección cruzada inválida hace fallback, que el bridge restaura la referencia original del Stone, que siguen existiendo exactamente cinco Stone slots, que Q/W/E son tres, que M1–M3 son tres y que montura/arma son mutuamente excluyentes.

## Deuda conocida

- `KeloAbilitySourceCast` usa de forma transicional el slot runtime 0 durante un cast estrictamente síncrono; siempre lo restaura con `finally`.
- `ABILITY_CAST` del runtime antiguo todavía nace desde la semántica del hotbar Stone. Para autoridad online de fuentes no-Stone debe preferirse el payload semántico `KELO_ABILITY_SOURCE_CAST` hasta que `KeloAbilities` exponga cast source-native.
- Las técnicas reutilizan presentación/fallback existente; arte/VFX exclusivo puede añadirse por el Visual System sin cambiar gameplay.
- La fase actual valida `combatAbilityKeys` en cliente. El servidor deberá volver a resolver y validar el mismo profile/slotChoice en PvP competitivo.

## Checklist para ampliar sin duplicar owner

- [ ] ¿Es contenido expresable con AbilityDefinition existente?
- [ ] ¿El arma resuelve un profile por datos?
- [ ] ¿El profile contiene exactamente Q/W/E por defecto?
- [ ] ¿Cada `slotChoices` contiene solo abilities permitidas de esa familia?
- [ ] ¿Una selección inválida hace fallback en lugar de ejecutarse?
- [ ] ¿Los cinco Stone siguen intactos?
- [ ] ¿Montado sustituye Q/W/E por M1/M2/M3?
- [ ] ¿KeloAbilities sigue siendo el único runtime de delivery/effects?
- [ ] ¿KeloEquipment sigue siendo el único owner del arma equipada?
- [ ] ¿La operación conserva IDs/fingerprint aptos para autoridad server?
- [ ] ¿Pasaron los audits de equipment abilities, mounts, stones, foundation y docs?
