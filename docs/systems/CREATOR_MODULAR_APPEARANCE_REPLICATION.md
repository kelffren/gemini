# Creator Modular Appearance Replication

## Status

**Creator online V1 — IMPLEMENTED_PENDING_VERIFY.** Current server-authorized Creator `appearance` / visual `equipment` bindings can now be projected to nearby remote players through the existing authoritative **social/world WebSocket AOI** presentation path. PvP parity is implemented in the stacked `PvP Visual Presentation Bridge V1` pass but remains pending its own validation gates.

## Goal

A player who equips a published Creator skin, cosmetic or visual weapon should see it locally **and other nearby players should see the same accepted visual state** after the server has validated it, without giving those viewers ownership or use rights.

## Canonical social/world flow

```text
Creator Use Authority
  ↓ exact revision selected for character slot
creator_character_content_bindings
  ↓
get_my_public_creator_character_appearance(character)
  ↓ owner JWT + active publication + entitlement/author recheck
server/avatar-sync-store.js
  ↓ sanitize + creator-global allowlist
existing avatarManifest presentation envelope
  ↓
server/index.js serializePlayer()
  ↓ existing social/world AOI
engine-net.js peer.avatarManifest
  ↓
KeloCreatorAvatars detects creatorAppearance
  ↓ only if needed
KELO_MODULE_LOADER.ensure('appearance')
  ↓
KeloCreatorCharacterBridge remote WeakMap overlay
  ↓
KeloCharacterCustomization.stateForActor(peer)
  ↓
KeloCharacterVisualStack
  ↓
existing KeloAvatar renderer
```

## Server authority

Migration: `supabase/migrations/20260916004500_creator_modular_replication_v1.sql`.

`get_my_public_creator_character_appearance(p_character_id)` is called by the game server with the authenticated character owner's JWT. It returns only current bindings that still satisfy all of the following:

- character belongs to the JWT account and is active;
- binding is `appearance` or visual `equipment`;
- binding type matches content type;
- bound slot matches the revision payload slot;
- target is `character` / `player`;
- content revision has an active `content_publication`;
- account is still the revision author or owns an exact-revision entitlement;
- every asset bound to that revision has an active `asset_publication`.

The RPC does **not** insert or update entitlements, bindings, wallet state, inventory or gameplay equipment. If an entitlement disappears, a stale selection row alone is not enough to keep broadcasting the cosmetic.

## Presentation envelope

The existing `avatarManifest` network field is treated as a backwards-compatible **server presentation envelope**. Full-body Creator avatar fields remain optional. The envelope may additionally contain:

```js
{
  creatorAppearance: {
    version: 'creator-modular-appearance-v1',
    source: 'server-authoritative-published',
    characterId,
    revisionKey,
    loadout: [ /* sanitized current slot revisions */ ]
  }
}
```

This deliberately reuses the existing trusted presentation path instead of introducing client-owned skin state.

## Published byte boundary

The game server reconstructs runtime URLs itself. It never accepts a Creator asset URL from the remote player's client.

For V1, modular Creator replication accepts only:

- `asset_publications.is_active = true`;
- `public_storage_bucket = creator-global`;
- visibility `global` or `official`;
- sanitized storage paths and published image metadata.

A public `creator-global` URL allows **viewing** of a published visual. It is not ownership evidence and does not let the viewer equip that revision on their own character.

## Local vs remote security rules

### Local actor

The local Character bridge continues to require:

1. server use binding;
2. exact `KeloCreatorDelivery.useRevision(revisionId)`;
3. `KeloCreatorEntitlements` access;
4. exact manifest identity.

### Remote actor

The remote Character bridge does **not** call the viewer's entitlement guard. It accepts only the `server-authoritative-published` envelope already derived by the server from the remote character's accepted state.

This distinction is intentional. Requiring the viewer to own another player's skin would make purchased cosmetics invisible to everyone else.

## Client memory model

Remote overlays use `WeakMap<actor, Map<slot,itemId>>` plus a `WeakMap` fingerprint. When a peer object disappears, its overlay can be garbage-collected with it.

Remote runtime definitions are `hidden`, `locked`, tagged `remote-public`, revision-scoped and separate from local IDs:

```text
creator.visual.local.<revision>.<slot>
creator.visual.remote.<revision>.<slot>
```

This prevents a sanitized remote descriptor from replacing the richer exact local Delivery descriptor for the same revision.

## Lazy/mobile behavior

No remote modular system is loaded just because networking is active.

- peer has no `creatorAppearance` → no Appearance wake-up;
- first relevant peer with non-empty modular envelope → existing `appearance` feature loads once;
- bridge ingests the peer snapshot after the feature is ready;
- subsequent state packets with the same `revisionKey` reuse the existing overlay;
- no polling, no extra render loop and no full Creator library sync.

When the local player equips/clears a Creator modular visual, `KeloCreatorsLazyGate` reuses `KeloNetAuthority.refreshAvatar()` to refresh the existing server presentation envelope. That same server-derived envelope now feeds both social/world replication and the dedicated PvP presentation bridge.

## PvP extension — stacked pass 009

The original V1 deliberately kept presentation out of `server/pvp-authority.js`. That invariant remains correct: the competitive snapshot owner is still presentation-agnostic.

`IMP-2026-09-16-PVP-VISUAL-PRESENTATION-009` adds parity **outside** the competitive authority:

```text
trusted avatarManifest
  → server/pvp-presentation-wire.js
      ├─ pvp:presentation full envelope only on change
      └─ compact presentationKey in pvp:snapshot
  → engine-net presentation cache
  → existing KeloPvPWorld renderAvatar(peer,false)
```

This fixes two problems without weakening PvP authority:

- a `pvp:snapshot` that omits `avatarManifest` no longer clears the cached remote visual;
- the normal AOI state no longer repeats the heavy manifest while the viewer is in PvP; the wire strips it and leaves `presentationKey`.

The client still never declares its own skin revision/URL. Full PvP presentation is emitted only from already server-derived state and uses the same WebSocket. See `docs/systems/PVP_VISUAL_PRESENTATION_BRIDGE.md`.

## Full-body avatar precedence

Full-body Creator avatars keep their existing higher-priority `KeloAvatar` middleware. Modular appearance replication does not create a second body renderer. If a full-body avatar path intentionally consumes the actor render, modular pieces may be visually masked by that full-body avatar according to existing middleware priority.

## What this layer does not own

- `KeloEquipment` stats, inventory or abilities;
- PvP/combat simulation authority;
- Creator ownership or KC settlement;
- Character base saves/history/share codes;
- avatar upload/authoring;
- a second networking transport;
- private-byte DRM.

## Required validation before VALIDATED

Social/world gates:

- run `node scripts/creator-modular-replication-audit.mjs`;
- run Character bridge, Creator Use, Delivery, Entitlement and docs audits;
- apply migration `20260916004500_creator_modular_replication_v1.sql` after the complete upstream migration chain;
- A equips a purchased published Creator skin, B sees it without owning it;
- B cannot equip A's revision without entitlement;
- revoking A's entitlement removes the visual from future server presentation even if the binding row remains;
- changing r3 → r4 updates the remote visual without stale cache identity;
- clear-slot reveals the underlying remote base appearance;
- no-Creator peers do not trigger Appearance loading;
- leaving AOI/removing peer does not retain actor overlay state;
- built-in Character customization and full-body Creator avatars remain unchanged.

PvP extension gates are tracked separately in `PVP_VISUAL_PRESENTATION_BRIDGE.md` / pass `009`. Until both passes are validated, do not claim end-to-end social + PvP visual replication as validated.
