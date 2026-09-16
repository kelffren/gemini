# Creator Character State Bridge

## Status

**Creator online V1 — IMPLEMENTED_PENDING_VERIFY.** The bridge projects server-authoritative Creator appearance/equipment bindings into the existing Character Customization visual stack. It does not replace `KeloCharacterCustomization`, `KeloCharacterVisualStack`, `KeloAvatar`, Creator Use Authority or entitlement truth.

## Purpose

Creator Use Authority can persist an exact Creator revision to a character slot, but persistence alone does not make that piece visible after a reload. This bridge closes that rendering gap without copying online ownership into local character state.

Canonical flow:

```text
KeloOnlineAuth ready
  ↓
metadata-only get_my_creator_use_state(character)
  ↓
no appearance/equipment bindings? STOP — do not load Appearance
  ↓ bindings exist
KELO_MODULE_LOADER.ensure('appearance')
  ↓
KeloCreatorDelivery.useRevision(exact revision)
  ↓
KELO_CREATOR_CONTENT_REGISTRY usable runtime row
  ↓
register hidden + locked CharacterCustomization visual item
  ↓
ephemeral slot overlay in stateForActor(local player)
  ↓
KeloCharacterVisualStack
  ↓
existing KeloAvatar CharacterCustomization middleware
```

## Owners

- Authoritative binding state: **Kelo Creator Use Authority / Supabase**.
- Entitlement truth: **KeloCreatorEntitlements**.
- Exact-revision metadata/assets: **Kelo Creator Content Delivery**.
- Base local visual state/catalog/history/saves: **KeloCharacterCustomization**.
- Slot schema/order: **KeloCharacterSlotSchema**.
- Ordered visual resolution: **KeloCharacterVisualStack**.
- Final avatar composition: **KeloAvatar**.
- This bridge: `src/characters/creator-character-state-bridge.js`.
- Lazy restore probe: `src/core/creators-lazy-gate.js`.

The bridge owns only an in-memory overlay mapping canonical character slots to runtime visual item IDs.

## Why an overlay instead of `select()`

Calling `KeloCharacterCustomization.select()` for a purchased Creator item would write that item into the local persisted character state. After logout/account switch, that would make a previous account's licensed item look like ordinary local state.

V1 therefore never calls `select()`, `applySnapshot()` or another persistence mutation for authoritative Creator bindings. It wraps the owner API only at the read boundary used by the visual stack:

```text
base CharacterCustomization state
           +
server-derived Creator slot overlay
           ↓
resolved local render state
```

The base state, history, five local save slots, share code and legacy network snapshot stay unchanged.

## Runtime item safety

A delivered Creator binding is registered in the existing CharacterCustomization catalog as:

- `hidden: true`
- `locked: true`
- tagged `creator-content` + `server-bound`

This lets the existing renderer resolve the item by ID but prevents ordinary local item lists/randomizers from treating it as an unlocked local cosmetic.

The overlay is cleared on auth end, account/character identity change, or explicit bridge clear. The registered metadata definition may remain in memory, but without a current server binding it is not selected by the overlay. Delivery/entitlement gates still protect exact-revision activation.

## Visual asset mapping

V1 consumes the primary published asset URL from the delivered runtime record.

### Sheet path

If `payload.characterVisual.mode === 'sheet'`, or the published dimensions look like a 4x4 Character Asset Contract sheet with approximately 2:3 frame ratio, the bridge uses the existing `KeloCharacterVisualPresets.sheet()` contract.

Default direction rows remain:

- down 0
- left 1
- right 2
- up 3

### Socket path

If `payload.characterVisual.mode === 'socket'` or sheet inference fails, the piece uses the existing socket descriptor. Weapon slots use the existing weapon preset for `weaponMain` and `weaponSecondary`.

For non-sheet content, creators should eventually author explicit `characterVisual` metadata such as:

```js
{
  mode: 'socket',
  socket: 'weapon',
  width: 58,
  height: 58,
  anchor: { x: 0.5, y: 0.88 },
  layer: 'front'
}
```

When no custom weapon transforms exist, the standard Character weapon offsets remain intact.

## Transform limitation

`KeloAppearance` can describe independent `scaleX` / `scaleY`; the current CharacterCustomization visual descriptor uses one uniform per-direction `scale`. V1 converts non-uniform Creator scale to a single geometric-mean scale when projecting into CharacterCustomization.

Do not add a second renderer to preserve non-uniform scale. If pixel-accurate non-uniform transforms become necessary, extend the shared Character visual descriptor/render owner and its tests.

## Lazy/mobile behavior

The already-loaded Creator lazy gate performs a single metadata-only use-state probe for the authenticated character.

- zero Creator visual bindings → stop; Appearance package and visual bytes remain unloaded;
- one or more bindings → first-use load Appearance, hydrate only those exact revisions, then render through existing owners.

There is no Owned-library sync, no interval, no render loop and no preload of unrelated marketplace content.

This is intentionally a small authenticated restore query at normal session start. It supersedes the earlier stronger statement that Creator Use code is never imported during normal boot: Use Authority/Delivery metadata code may now load for this one restore probe, while Creator OS UI, Appearance runtime and asset bytes stay lazy unless bindings actually exist.

## Local vs remote players

This V1 overlay applies only to the local actor. Remote Creator avatars already have their own published-avatar path, but modular Creator skin/equipment replication for other players is not completed here.

A later multiplayer visual snapshot bridge should transmit accepted stable revision/runtime identities from server authority. It must not send image bytes and must not reuse the local account's entitlement requirement to decide whether another player's already-authorized public appearance can be viewed.

## Invariants

1. authoritative Creator bindings never become localStorage/IndexedDB ownership;
2. no second Character state owner;
3. no second visual stack or avatar renderer;
4. only the local actor receives this account-bound overlay;
5. exact revisions are delivered and entitlement-checked before registration;
6. Creator items are hidden/locked in the local catalog;
7. base `getState()`, history, saves and `networkSnapshot()` remain the original CharacterCustomization contract;
8. no gameplay stats, inventory, abilities or weapon authority are granted;
9. zero bindings do not load Appearance;
10. no polling or second loop.

## Public API

`KeloCreatorCharacterBridge` exposes:

- `sync({ state?, force? })`
- `clear(reason)`
- `state()`
- `diagnostics()`
- `getResolvedState(actor?)`

When installed, the `KeloCharacterCustomization` facade also exposes `getResolvedState(actor?)`; all original owner methods delegate unchanged.

## Required validation

Before `VALIDATED`:

- `node scripts/creator-character-state-bridge-audit.mjs` passes;
- Character, Creator Use, Delivery, Entitlement and docs audits remain green;
- authenticated character with no bindings does not load Appearance;
- entitled bound skin restores after reload and becomes visible through the existing Character renderer;
- clearing the binding restores the underlying local slot;
- logout/account switch clears the overlay immediately;
- r3 binding cannot silently hydrate r4;
- revoked access cannot remain visible after entitlement refresh;
- hidden Creator items do not appear in ordinary randomizer/list UI;
- local base save/share/history state is unchanged by bridge hydration;
- built-in Character customization still works before and after Creator overlay use;
- iPhone portrait/landscape first-use and reload have no freeze, duplicate renderer or leaked input lock;
- remote-player modular Creator appearance behavior is not claimed until its own replication path is tested.
