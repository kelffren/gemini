# Creator Character State Bridge

## Status

**Creator online V1.1 — IMPLEMENTED_PENDING_VERIFY.** The bridge projects server-authoritative Creator appearance/equipment bindings into the existing Character Customization visual stack for the local actor and projects server-published presentation snapshots for remote actors. It does not replace `KeloCharacterCustomization`, `KeloCharacterVisualStack`, `KeloAvatar`, Creator Use Authority or entitlement truth.

## Owners

- Persistent local binding authority: **Kelo Creator Use Authority / Supabase**.
- Local ownership/access truth: **KeloCreatorEntitlements**.
- Local exact-revision metadata: **Kelo Creator Content Delivery**.
- Remote presentation authority: **Kelo server + `server/avatar-sync-store.js`**.
- Base visual state/catalog/history/saves: **KeloCharacterCustomization**.
- Slot schema/order: **KeloCharacterSlotSchema**.
- Ordered resolver: **KeloCharacterVisualStack**.
- Final composition: **KeloAvatar**.
- Projection adapter: `src/characters/creator-character-state-bridge.js`.

The bridge owns only ephemeral slot overlays. It never owns inventory, wallet, gameplay stats, entitlement or character persistence.

## Local actor flow

```text
get_my_creator_use_state(character)
  ↓ authoritative exact revision bindings
KeloCreatorDelivery.useRevision(revision)
  ↓ exact delivered manifest
KeloCreatorEntitlements recheck
  ↓
hidden + locked revision-scoped Character item
  ↓
local in-memory overlay
  ↓
KeloCharacterCustomization.stateForActor(local)
  ↓
KeloCharacterVisualStack → KeloAvatar
```

The local bridge deliberately does not call `select()` or `applySnapshot()`. A purchased Creator item therefore never becomes ordinary local persisted Character state.

Local visual IDs include revision identity:

```text
creator.visual.local.<revision UUID>.<slot>
```

This prevents r3 and r4 from sharing a visual cache key.

## Remote actor flow

Remote players are different: the viewer should be able to **see** a cosmetic another player is authorized to wear without owning that revision themselves.

```text
remote character authoritative binding
  ↓
server public presentation RPC
  ↓ publication + owner/entitlement + published-assets recheck
server avatar presentation envelope
  ↓ existing AOI/WebSocket path
peer.avatarManifest.creatorAppearance
  ↓
remote WeakMap slot overlay
  ↓
KeloCharacterCustomization.stateForActor(peer)
  ↓
KeloCharacterVisualStack → KeloAvatar
```

The remote bridge accepts modular data only when the nested snapshot is marked `source: 'server-authoritative-published'`. It does **not** run the viewer's entitlement gate for remote presentation.

Remote visual IDs are separate from local IDs:

```text
creator.visual.remote.<revision UUID>.<slot>
```

This keeps the server-sanitized remote descriptor from replacing the richer local Delivery descriptor for the same revision.

## Remote memory model

Remote overlays and revision fingerprints live in `WeakMap` keyed by the peer actor object. A peer leaving the AOI does not create a permanent actor-state registry in the Character bridge.

Each changed `revisionKey` is ingested once. Repeated server state packets for the same remote loadout reuse the current overlay.

Runtime definitions remain:

- `hidden: true`;
- `locked: true`;
- no local selection privilege;
- no gameplay stats or abilities.

## Visual descriptor mapping

Both local and remote projections use the same existing Character visual descriptor factories.

### Sheet

A declared `payload.characterVisual.mode === 'sheet'`, or compatible published dimensions, maps into `KeloCharacterVisualPresets.sheet()`.

Default direction rows remain down/left/right/up = 0/1/2/3.

### Socket

A declared socket visual or non-sheet asset maps into the existing socket contract. `weaponMain` and `weaponSecondary` reuse the shared weapon preset.

If no Creator weapon transforms are declared, the standard Character weapon offsets remain intact.

### Transform limitation

The current Character renderer has one uniform per-direction scale. Independent Creator `scaleX/scaleY` values are projected to one geometric-mean scale. Do not create a second renderer for this; extend the shared Character descriptor if exact non-uniform transforms become necessary.

## Full-body avatar precedence

Full-body Creator avatars keep their existing higher-priority `KeloAvatar` middleware. This bridge does not paint another body on top. Modular overlays remain the state path for the normal Character renderer and may be visually masked when a full-body avatar intentionally consumes the actor render.

## Lazy/mobile behavior

### Local

The Creator lazy gate performs one metadata-only use-state probe after authenticated Character resolution.

- no Creator modular bindings → Appearance stays unloaded;
- bindings exist → load existing `appearance` feature and hydrate only those exact revisions.

### Remote

Networking alone does not load Appearance. `KeloCreatorAvatars` notices a non-empty server-published `creatorAppearance` envelope and calls the existing `KELO_MODULE_LOADER.ensure('appearance')` once. No peer modular envelope means no remote Appearance wake-up.

There is no full Owned-library sync, polling, second game loop or second renderer.

## Public API

`KeloCreatorCharacterBridge` exposes:

- `sync({ state? })` — local authoritative hydration;
- `clear(reason)` — clear local overlay;
- `ingestRemote(actor, snapshot)` — ingest server-published remote presentation;
- `clearRemote(actor, reason)` — clear one remote overlay;
- `state()`;
- `diagnostics()`;
- `getResolvedState(actor?)`.

The facade preserves every existing `KeloCharacterCustomization` operation and only overrides the `stateForActor()` read boundary used by the visual stack.

## Invariants

1. Creator bindings never become localStorage/IndexedDB ownership.
2. No second Character state owner, visual stack or avatar renderer.
3. Local use requires exact Delivery + entitlement.
4. Remote viewing requires server-published presentation, not viewer entitlement.
5. Local and remote runtime IDs are revision-scoped and cannot collide.
6. Base `getState()`, history, save slots, share codes and `networkSnapshot()` remain the original Character contract.
7. Creator visual `equipment` never grants gameplay stats, inventory or abilities.
8. Remote actor overlay state is weak/ephemeral.
9. No polling or parallel render loop.
10. AOI/network transport remains owned by the existing Kelo server / `engine-net.js` path.

## Related system

Remote publication/sanitization/AOI behavior is documented in `CREATOR_MODULAR_APPEARANCE_REPLICATION.md`.

## Required validation

Before `VALIDATED`:

- `node scripts/creator-character-state-bridge-audit.mjs` passes;
- `node scripts/creator-modular-replication-audit.mjs` passes;
- upstream Creator Use, Delivery, Entitlement, Character and docs audits stay green;
- local purchased skin restores after reload without mutating base local save/share/history state;
- local r3 cannot hydrate r4;
- clear-slot exposes the underlying local slot;
- logout/account switch clears local overlay;
- second account sees the first account's authorized published modular visuals without owning them;
- second account still cannot equip those visuals without entitlement;
- entitlement revocation removes remote presentation on refresh;
- remote r3→r4 changes without stale cache identity;
- repeated unchanged AOI state packets do not repeatedly ingest the same remote revisionKey;
- peer leave/AOI exit does not retain actor overlay state;
- built-in and full-body Creator avatar rendering remain unchanged;
- iPhone portrait/landscape multi-peer test shows no freeze, duplicate renderer, leaked input lock or unrelated Creator preload.
