# Creator Modular Appearance Replication

## Status

**Creator online V1 — IMPLEMENTED_PENDING_VERIFY.** Current server-authorized Creator `appearance` / visual `equipment` bindings can now be projected to nearby remote players through the existing authoritative **social/world WebSocket AOI** presentation path. This pass does not add a second transport, renderer, ownership system or gameplay equipment authority.

## Goal

A player who equips a published Creator skin, cosmetic or visual weapon should see it locally **and other nearby players in the social/world AOI should see the same accepted visual state** after the server has validated it.

The viewer must not need to own another player's cosmetic. Viewing an already-authorized public presentation is different from acquiring or using that revision on the viewer's own character.

## Canonical flow

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

The RPC does **not** insert or update entitlements, bindings, wallet state, inventory or gameplay equipment.

If an entitlement disappears, a stale selection row alone is not enough to keep broadcasting the cosmetic.

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

This deliberately reuses the existing trusted presentation path instead of introducing `skin:update`, a second WebSocket or another peer-state channel.

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
- subsequent social state packets with the same `revisionKey` reuse the existing overlay;
- social/world AOI sends actor presentation only to relevant nearby viewers;
- no polling, no extra render loop and no full Creator library sync.

When the local player equips/clears a Creator modular visual, `KeloCreatorsLazyGate` reuses `KeloNetAuthority.refreshAvatar()` to refresh the existing server presentation envelope. `server/index.js` then distributes the updated `serializePlayer()` through its existing social/world AOI state path.

## PvP boundary

**V1 does not inject Creator presentation metadata into `pvp-authority` snapshots.** PvP uses a separate competitive snapshot containing movement/resources/combat authority. Keeping cosmetics out of that packet avoids expanding a sensitive protocol while this social replication layer is still pending validation.

During active PvP, presentation parity must be handled by a dedicated PvP visual-state bridge or a future server presentation reference attached safely to PvP actors. Do not make the client declare its own skin revision/URL to solve this.

Therefore the acceptance claim for this pass is **social/open-world AOI replication**, not PvP cosmetic parity.

## Full-body avatar precedence

Full-body Creator avatars keep their existing higher-priority `KeloAvatar` middleware. Modular appearance replication does not create a second body renderer. If a full-body avatar path intentionally consumes the actor render, modular pieces may be visually masked by that full-body avatar according to existing middleware priority.

## What this pass does not own

- `KeloEquipment` stats, inventory or abilities;
- PvP/combat authority or PvP presentation parity;
- Creator ownership or KC settlement;
- Character base saves/history/share codes;
- avatar upload/authoring;
- a new networking transport;
- private-byte DRM.

## Required validation before VALIDATED

- run `node scripts/creator-modular-replication-audit.mjs`;
- run Character bridge, Creator Use, Delivery, Entitlement and docs audits;
- apply migration `20260916004500_creator_modular_replication_v1.sql` after the complete upstream migration chain;
- social two-account test: A equips a purchased published Creator skin, B sees it without owning it;
- B cannot equip A's revision without entitlement;
- revoking A's entitlement removes the visual from future social server snapshots even if the binding row remains;
- changing r3 → r4 updates the remote visual and never reuses r3 cache identity;
- clear-slot reveals the underlying remote base appearance;
- a player with no modular Creator visuals does not trigger Appearance loading on viewers;
- a nearby modular peer triggers one Appearance first-use load, not repeated loads on every state packet;
- leaving AOI/removing peer does not retain actor overlay state;
- full-body Creator avatar behavior remains unchanged;
- built-in Character customization remains unchanged;
- iPhone portrait/landscape with multiple social/open-world peers shows no freeze, duplicate renderer, input-lock leak or unexpected Creator-library preload;
- PvP cosmetic parity remains explicitly unclaimed until its separate bridge is validated.
