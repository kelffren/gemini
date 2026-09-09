# Mount System

## Status

**Foundation candidate on `feature/mount-appearance-foundation-v1-refresh`.** Runtime/domain code, creator foundations and automated validation exist. Real production mount art bundles are still pending, so this document does not claim pixel-perfect final visual approval.

## Purpose

Mounts are data-driven gameplay content. A mount can be equipped independently from being mounted, changes traversal, exposes exactly three exclusive abilities while mounted, accepts mount equipment, and accepts cosmetic appearance items. The system is designed to scale to 20,000+ definitions without one class, switch branch, runtime actor, DOM row or texture per definition.

## Owners and files

- **Runtime/state owner:** `KeloMounts` — `src/mounts/mount-system.js`
- **Definition/profile owner:** `KeloMountCatalog` — `src/mounts/mount-catalog.js`
- **Exclusive ability content:** `src/mounts/mount-ability-data.js`
- **Mount equipment content:** `KeloMountEquipmentCatalog` — `src/mounts/mount-equipment-catalog.js`
- **Ability adapter:** `KeloMountAbilityChannel` — `src/mounts/mount-ability-channel.js`
- **Movement owner consumed:** `KeloMovement`
- **Ability runtime owner consumed:** `KeloAbilities`
- **Derived attribute owner consumed:** `KeloStatModifiers`
- **Progression counter owner kept separate:** `KeloPlayerStats`
- **Appearance owner consumed:** `KeloAppearance`
- **Asset owner consumed:** `KeloAssetRegistry` through `KeloMountAssets`
- **UI consumers:** `src/ui/mount-panel.js`, `src/ui/mount-action-bar.js`

## State ownership

`KeloMounts` owns only `STATE.mounts`:

```js
{
  schemaVersion: 1,
  equippedMountId,
  mounted,
  owned,
  equipmentByMountId,
  appearanceByMountId,
  equipmentInventory,
  revision
}
```

It does not own `STATE.equipped` Stone loadout, player equipment slots, `KeloPlayerStats` progression, `KeloAbilities` effects, base movement physics, character customization or low-level asset loading.

## Definition contract

A mount definition declares stable IDs:

```js
{
  schemaVersion: 1,
  id,
  displayName,
  speciesId,
  rarity,
  movementProfileId,
  abilityIds: [m1, m2, m3],
  appearanceProfileId,
  equipmentSlotProfileId,
  assetBundleId,
  animationSetId,
  riderAnchorProfileId,
  unlockRuleId,
  tags,
  baseStats
}
```

Exactly three mount ability IDs are required. Definitions are lightweight metadata: registering content does not instantiate an actor or preload an image.

## Runtime flow

```text
MountDefinition
   ↓
KeloMountCatalog
   ↓
KeloMounts equipMount()
   ↓
mount() / dismount()
   ├─ KeloMovement → temporary movement profile
   ├─ KeloStatModifiers → player/mount derived attributes
   ├─ KeloMountAbilityChannel → M1/M2/M3
   │      ↓
   │   KeloAbilities delivery/effect runtime
   ├─ KeloAppearance → cosmetic layer descriptors
   └─ KeloMountAssets → KeloAssetRegistry lazy asset resolution
```

The five Stone slots remain owned by `KeloStones`. They are never converted into eight Stone slots and mount abilities are never stored as fake Stones.

## Public API

`KeloMounts` exposes:

- `equipMount(id)`, `unequipMount()`
- `mount()`, `dismount()`, `isMounted()`
- `getEquippedMountId()`, `getEquippedMount()`
- `getAbilityLoadout()`
- `getMountStats(id)`
- `equipItem(mountId,itemId)`, `unequipItem(mountId,slotId)`
- `setOutfitItem(mountId,itemId)`
- `getAppearance(mountId,direction,motion)`
- `snapshot()`, `migrateState()`
- `setAuthority(adapter)`

`KeloMountCatalog` owns registration, lookup, query, validation, migration, MovementProfile and EquipmentSlotProfile registries.

## Ability contract

While dismounted the mount channel has zero active abilities. While mounted it exposes exactly M1/M2/M3. `KeloMountAbilityChannel` is an adapter; it does not duplicate delivery handlers.

V1 uses a compatibility bridge into the existing `KeloAbilities.engine.cast` path and restores the Stone hotbar object immediately after a mount cast. Semantic mount events carry `sourceType:'mount'`, mount ID and mount slot.

A future native generic AbilitySource inside `KeloAbilities` may remove the compatibility bridge, but it must preserve the same public mount IDs and must not create a second ability engine.

## Movement

Mount movement reuses `KeloMovement.before/after`. During the existing movement tick it temporarily applies resolved mount speed/acceleration/braking values, then restores shared configuration. A second movement loop or mount-specific physics engine is prohibited.

## Equipment and attributes

Equipment slots come from `EquipmentSlotProfile`; species do not need identical slots. Mount equipment is separate from player `STATE.equipmentSlots`.

Gameplay modifiers are published to `KeloStatModifiers` and may target the player, a specific mount, or both. `KeloPlayerStats` remains reserved for progression counters such as kills and title requirements and is not used for equipment math.

## Appearance

Mount outfits use `KeloAppearance` profiles/items. Cosmetics do not carry gameplay stats. Rider/head/back/effect/shadow anchors live in profiles/data rather than mount-ID branches.

## Assets and scale

`KeloMountAssets` is an adapter over `KeloAssetRegistry`; it is not another loader. Mount metadata can exist without heavy textures being resident. Assets are intended to load for equipped/local/nearby/previewed content only.

Automated stress validation registers 20,002 mount definitions without creating 20,002 actors, DOM nodes or textures.

## Local vs online authority

Every mutation goes through the replaceable `KeloMounts.setAuthority({request})` boundary. V1 provides a local fallback for offline/prototype play. Production authority must validate ownership, equipped mount, equipment, cooldowns and accepted gameplay modifiers server-side. Network payloads should transmit stable IDs/state rather than full definitions or images.

## Persistence

Prototype mount state persists through the existing save owner. `schemaVersion` and `revision` keep the state migration-ready. On boot, mount equipment registers its modifier source and triggers one derived-stat recalculation so saved bonuses do not remain stale until the next equipment change.

## Invariants

1. Stone loadout size remains five.
2. Mounted exclusive ability count is three.
3. Equipment and cosmetic appearance remain separate.
4. New mount content does not require Mount Core branches.
5. Definitions do not imply active actors or loaded textures.
6. Gameplay mutation never originates in UI.
7. Movement uses `KeloMovement`.
8. Abilities use `KeloAbilities`.
9. Derived attributes use `KeloStatModifiers`.
10. Progression counters remain in `KeloPlayerStats`.
11. Assets reuse `KeloAssetRegistry`.

## Correct use

```js
KeloMountCatalog.register(definition);
await KeloMounts.equipMount(definition.id);
await KeloMounts.mount();
KeloMountAbilityChannel.cast({slotIndex:0,direction:{x:1,y:0}});
```

## Anti-patterns

- one class per horse/wolf/mount;
- `if (mountId === ...)` in core;
- pushing mount abilities into `STATE.equipped`;
- creating `MountAbilityEngine`;
- creating a second movement loop;
- creating a second asset loader/cache;
- loading every mount texture at startup;
- changing player attributes from UI/outfit code;
- using `KeloPlayerStats` as an equipment modifier engine.

## Tests / CI

- `npm run audit:mounts` — definition validation, 20k scale, exactly 3 mount slots, five Stone slots untouched, Ability/Asset owner reuse and saved-stat rehydration.
- `npm run audit:stats` — deterministic shared derived attributes and exact reversion.
- `npm run audit:appearance` — shared cosmetic contract and 20k definition scale.
- `npm run audit:mount-creator` — virtualized creator/import/undo/drag-anchor contracts.
- Stone, Character, Foundation, Docs and Studio regressions remain part of the PR gate.
- Browser smoke validates a 390×844 mobile boot.

## Known limitations

- Real horse/wolf art bundles are not yet present, so final visual approval is pending.
- The authority adapter is a production boundary, not yet a deployed mount server service.
- Native generic AbilitySource inside `KeloAbilities` remains follow-up debt; the isolated V1 bridge is tested.

## Checklist for a new mount

- stable unique ID;
- reusable MovementProfile;
- exactly 3 valid mount abilities;
- valid AppearanceProfile and EquipmentSlotProfile;
- lazy asset/animation bundle registration;
- no Mount Core edit for mount-specific behavior;
- validator/audits green;
- real mobile/LIVE visual preview before production release.
