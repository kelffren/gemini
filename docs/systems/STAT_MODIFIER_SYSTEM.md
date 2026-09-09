# Stat Modifier System

## Status

**Foundation candidate.** `KeloStatModifiers` is the shared deterministic resolver for derived gameplay attributes such as attack, defense, HP, movement-related mount stats and future equipment/buff modifiers.

`KeloStatModifiers` is intentionally different from `KeloPlayerStats`:

- `KeloPlayerStats` owns progression counters such as kills and title/achievement progress.
- `KeloStatModifiers` resolves temporary/derived attributes from equipment, mounts, buffs and similar sources.

These owners must never be merged or treated as aliases.

## Owner and files

- **Owner:** `KeloStatModifiers`
- **Source:** `src/stats/stat-modifier-system.js`
- **Legacy equipment adapter:** `src/systems/equipment-system.js`
- **Mount source:** `src/mounts/mount-system.js`

`KeloStatModifiers` does not own inventory, progression counters, equipment slots, mounts, persistence or UI.

## Modifier contract

```js
{
  id,
  target: 'player' | 'mount' | futureTarget,
  targetId: null | stableId,
  stat,
  operation,
  value,
  scope,
  sourceId,
  priority
}
```

Supported V1 operations:

- `flatAdd`
- `flatSubtract`
- `percentAdd`
- `percentMultiply`
- `override`
- `clampMin`
- `clampMax`

Supported V1 scopes:

- `always`
- `whileEquipped`
- `whileMounted`
- `whileDismounted`
- `inCombat`
- `outOfCombat`

## Resolution order

```text
base
→ flatAdd / flatSubtract
→ summed percentAdd
→ percentMultiply chain
→ override
→ clampMin / clampMax
→ final
```

Modifiers are sorted by explicit priority and stable modifier ID so results do not depend on object iteration order.

## Public API

- `registerSource(id, provider)`
- `unregisterSource(id)`
- `markDirty()`
- `validateModifier(raw)`
- `normalizeModifier(raw)`
- `resolve(target, baseStats, context, targetId)`

## Flow

```text
Equipment / Mount / future Buff owner
        ↓ provider()
      modifiers
        ↓
 KeloStatModifiers
        ↓
 deterministic resolve
        ↓
    final attributes
```

A source owns its own canonical state and only publishes modifiers. The resolver owns math and cache, not the source data.

## Caching

`KeloStatModifiers` keeps a revisioned cache. Registering/unregistering a source or calling `markDirty()` invalidates cached results. Gameplay owners call `markDirty()` only when stat-producing state changes; never every render frame.

## Player equipment adapter

`KeloEquipment` preserves its existing public API and legacy `player.equipmentStats` compatibility while publishing equipment through the shared modifier source. `player.finalStats` / `getFinalStats()` are derived values, not a second canonical inventory state.

## Mount equipment

`KeloMounts` publishes a `mount-equipment` source. A saddle or other mount item may provide modifiers to the player, the mount, or both. `whileMounted` controls bonuses that apply only while riding; `whileEquipped` may affect the mount even when not currently ridden.

## Local vs online authority

The resolver is deterministic domain math. Production authority decides which items/sources/modifiers are valid and owned. Clients may calculate previews, but they must not invent trusted gameplay modifiers.

## Persistence

`KeloStatModifiers` persists nothing. Source owners persist stable IDs/state. Derived final numbers remain recomputable.

## Invariants

- one modifier format for all sources;
- one deterministic resolution order;
- source state stays outside the resolver;
- UI never becomes authority;
- removing a source reverses its contribution exactly;
- cosmetic appearance is stat-free unless a separate gameplay equipment item explicitly contributes modifiers;
- `KeloPlayerStats` progression counters remain a separate owner.

## Correct use

```js
const stop = KeloStatModifiers.registerSource('example', () => [
  { id:'example.def', target:'player', stat:'defense', operation:'percentAdd', value:.04, scope:'whileMounted' }
]);
KeloStatModifiers.markDirty();
const result = KeloStatModifiers.resolve('player', { defense:100 }, { mounted:true });
```

## Anti-patterns

- calculating mount bonuses directly in UI;
- mutating player stats from item-ID branches;
- persisting `finalStats` as canonical state;
- recalculating entire inventories every frame;
- creating separate PlayerAttributeEngine and MountAttributeEngine;
- using `KeloPlayerStats` progression counters as the equipment attribute resolver.

## Tests / CI

`npm run audit:stats` verifies deterministic resolution, scopes, player + mount targets, exact reversion and explicit separation from `KeloPlayerStats`.

## Checklist for a new stat-producing system

1. keep canonical state in its own owner;
2. publish stable modifier IDs;
3. reuse existing operation/scope when possible;
4. add a generic operation/scope only when genuinely reusable;
5. call `markDirty()` on meaningful state changes;
6. test before/after and exact reversion;
7. never use progression counters as derived combat attributes.
