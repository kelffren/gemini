# PvP Visual Presentation Bridge

## Status

**PvP presentation V1 — IMPLEMENTED_PENDING_VERIFY.** This bridge makes server-authorized full-body avatars and modular Creator appearance remain visually stable inside online PvP without putting heavy manifests into the 20 Hz competitive snapshot.

It does not change PvP movement, HP, damage, cooldowns, hits, rewind, CC, death or kill authority.

## Problem it closes

Before this pass, two network streams overlapped while a player was in PvP:

1. `pvp:snapshot` at the competitive snapshot rate carried movement/combat fields but no `avatarManifest`;
2. the normal AOI `state` stream still carried the full server presentation envelope.

`engine-net.js` treated a missing manifest in the PvP row as `null`, so a fast PvP snapshot could clear a visual that the slower social state had just installed. That could produce skin/weapon flicker. At the same time, the social state repeatedly retransmitted the heavy presentation envelope even when it had not changed.

V1 fixes both issues while preserving the existing single WebSocket and existing Character renderer.

## Canonical flow

```text
Supabase / Creator Use Authority
        ↓
server/avatar-sync-store.js
        ↓ trusted avatarManifest presentation envelope
server/index.js existing player state
        ↓
server/pvp-presentation-wire.js
        ├─ stable presentationKey = hash(avatar identity + modular revisionKey)
        ├─ pvp:presentation only on first real visual / change / clear / re-visible
        └─ pvp:snapshot carries presentationKey only
        ↓ same WebSocket, ordered messages
engine-net.js
        ├─ pvp:presentation updates cached peer avatarManifest
        ├─ pvp:snapshot never clears manifest merely because field is absent
        └─ competitive reconciliation continues unchanged
        ↓
src/systems/pvp-world.js
        ↓ existing renderAvatar(peer, false)
KeloAvatar → KeloCharacterVisualStack → KeloCharacterCustomization
```

## Owners

- PvP gameplay truth: `server/pvp-authority.js`.
- Server presentation truth: existing `player.avatarManifest`, derived by `server/avatar-sync-store.js`.
- Wire/delta adaptation: `server/pvp-presentation-wire.js`.
- Transport: existing `ws` socket owned by the Kelo server / `KeloNetAuthority`.
- Client peer cache/reconciliation: `engine-net.js`.
- PvP scene orchestration: `KeloPvPWorld`.
- Final avatar rendering: existing `renderAvatar` / `KeloAvatar` stack.

The bridge does not become an owner of gameplay or cosmetics. It only transports already-authorized presentation efficiently.

## Why presentation is not inside `pvp-authority`

`pvp-authority` is intentionally presentation-agnostic. Its `actorPublic()` snapshot remains focused on competitive state: position, HP, mana, cooldowns, attack/cast phases, resource state, dodge and statuses.

That separation matters because cosmetic metadata must never become a prerequisite for combat simulation or a client-trusted input to competitive authority.

The presentation wire wraps the outgoing server socket after the authoritative snapshot has already been produced. It may add a small `presentationKey`; it never edits HP, position, damage, cooldowns or combat events.

## Delta contract

### `presentationKey`

The server computes a deterministic key from server-derived presentation identity:

```text
full-body avatar revision/content identity
+
creatorAppearance.revisionKey
→ SHA-256
→ first 20 hex chars
→ p1:<hash>
```

The client does not calculate or submit this key as authority.

### `pvp:presentation`

The full trusted envelope is sent on the same WebSocket only when required:

```js
{
  t: 'pvp:presentation',
  actorId,
  presentationKey,
  avatarManifest, // trusted server envelope or null for explicit clear
  serverTime,
  source: 'server-authoritative-pvp-presentation'
}
```

WebSocket ordering means this message is emitted before the PvP snapshot that references its new key.

### `pvp:snapshot`

The competitive actor row receives only:

```js
{
  ...competitiveFields,
  presentationKey
}
```

The heavy manifest is not copied into every 20 Hz snapshot.

## Empty / unchanged optimization

- A player who has never had a presentation gets `presentationKey: null` with **no useless initial clear packet**.
- Repeated snapshots with the same key do not resend the manifest.
- r3 → r4 changes the key and sends one new presentation envelope.
- A real visual → no visual sends one explicit clear.
- If an actor leaves the viewer's PvP visibility set, the per-viewer sent-key entry is pruned. Re-entering visibility resends the current real presentation once.

## Existing social-state interaction

The normal AOI state still carries other social/player metadata during PvP. The wire does not delete that whole state packet because other systems may consume it.

While the viewer is in PvP, the wire:

1. observes the authoritative `avatarManifest` from that normal server state;
2. emits `pvp:presentation` only if needed;
3. removes `avatarManifest` from the outgoing redundant PvP-time social state;
4. leaves a compact `presentationKey` instead.

Outside PvP, normal social state remains unchanged.

## Client cache rule

`engine-net.js` now distinguishes:

```text
field absent  → preserve last trusted presentation
field present null → explicit clear
field present manifest → replace with new trusted presentation
```

This is the key correctness fix. A competitive snapshot that simply does not own presentation data can no longer erase visual state.

`pvp:presentation` updates the peer's cached envelope and wakes/reuses the same Creator avatar/modular appearance path already introduced for social replication.

## Renderer rule

`KeloPvPWorld.drawArena()` already renders online PvP peers with:

```js
renderAvatar(peer, false)
```

Therefore this pass adds **no renderer**. Once the peer cache contains the correct server presentation, existing `KeloAvatar` / Character middleware renders it in PvP exactly as it does elsewhere.

## Security invariants

1. client never submits avatar/skin asset URLs for PvP;
2. client never submits Creator revision IDs as PvP presentation authority;
3. `pvp-authority` remains the only competitive simulation owner;
4. presentation does not grant entitlement, inventory, stats or abilities;
5. remote viewing remains different from local right-to-use;
6. one WebSocket only;
7. no presentation polling/timer/render loop;
8. full presentation bytes are sent only from server state already sanitized by the existing Creator presentation authority;
9. `presentationKey` is cache identity, not ownership proof;
10. an omitted presentation field can never mean revocation — revocation/clear is explicit.

## Performance model

If a cosmetic does not change, the 20 Hz PvP stream pays only the small `presentationKey` string per visible actor. The larger manifest is event-like rather than tick-like.

The bridge also strips repeated `avatarManifest` from the redundant normal state while the viewer is in PvP, avoiding two simultaneous high-frequency copies of the same visual metadata.

## Files

- `server/pvp-presentation-wire.js`
- `server/pvp-presentation-wire-smoke-test.js`
- `server/sprite-ai-bootstrap.js` — installs the wire before `server/index.js` boots.
- `engine-net.js` — presentation ingest + preserve-on-omission rule.
- `scripts/pvp-visual-presentation-audit.mjs`

No Supabase migration is added in this pass. It reuses the trusted presentation state produced by the previous Creator Modular Appearance Replication layer.

## QA

Pure Node smoke coverage verifies:

- deterministic key;
- r3 and r4 produce different keys;
- first real remote visual sends once;
- player with no visual sends no empty first packet;
- unchanged snapshots do not resend;
- change sends once and precedes the referencing snapshot/state;
- PvP-time social state strips the heavy manifest;
- explicit clear propagates after a real visual;
- real visual can return after clear;
- leaving/re-entering visibility resends the current real presentation.

Static architecture audit: `node scripts/pvp-visual-presentation-audit.mjs`.

## Required validation before `VALIDATED`

- run the static audit in a full repository checkout;
- run `npm --prefix server run test:pvp-presentation` under the repository's declared Node version;
- preserve all existing PvP authority/smoke tests;
- two authenticated accounts enter online PvP and see each other's same social cosmetics;
- r3 → r4 while both are in PvP updates once without flicker;
- clear-slot while in PvP removes the remote modular piece without affecting combat state;
- full-body Creator avatar remains visible in PvP;
- a no-cosmetic opponent does not create presentation packet spam;
- packet size/rate inspection confirms manifests are not repeated in every PvP snapshot;
- iPhone portrait/landscape PvP with multiple peers shows no freeze, duplicate renderer or input-lock leak.

Until those gates pass, status stays **IMPLEMENTED_PENDING_VERIFY**.
