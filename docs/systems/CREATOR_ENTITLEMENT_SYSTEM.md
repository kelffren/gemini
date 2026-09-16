# Creator Entitlement System

## Purpose

`KeloCreatorEntitlements` is the single runtime access boundary for Creator content that carries persistent marketplace value. It answers one question before a Creator revision reaches an existing runtime owner:

> Can the current authenticated account use this exact Creator revision?

Publication and ownership are intentionally different states.

```text
DRAFT != REVIEWED != PUBLISHED != LISTED != OWNED != USABLE
```

A published revision is discoverable. A revision is usable only when the authenticated account either authored it or owns an entitlement for that exact revision.

## Owner

- Runtime access cache/gate: `src/systems/creator-entitlement-system.js` (`KeloCreatorEntitlements`).
- Server truth: `creator_content_entitlements` + content ownership in `content_definitions`.
- Authoritative RPCs: `list_my_creator_content_access()` and `check_creator_content_access(uuid)`.
- Creator runtime dispatch: `src/creators/content/runtime-content-registry.mjs`.

The entitlement system does not own payments, publication, assets, rendering, equipment stats, property placement or authentication.

## Core policy

For a Creator content revision `R` and authenticated account `U`:

- allow when `U` owns the content definition that produced `R`;
- allow when `creator_content_entitlements(buyer_user_id=U, revision_id=R)` exists;
- deny otherwise;
- fail closed when Creator identity/access state is unavailable.

V1 entitlement is **revision-specific**. Buying revision 3 does not automatically grant revision 4. Future upgrade/subscription policies may add explicit grants; consumers must not infer them.

## Account vs character

Creator usage rights are account-level. KC settlement can use a selected character wallet, but the resulting Creator entitlement belongs to the account.

## Client/runtime flow

```text
published metadata / purchased entitlement
        ↓
authoritative access RPCs
        ↓
KeloCreatorEntitlements in-memory cache
        ↓
KELO_CREATOR_CONTENT_REGISTRY
        ├─ allowed → specialized runtime owner
        └─ denied  → activation.status = restricted
```

When entitlement state changes, the guard emits `kelo:creator-entitlements-changed`. The Creator runtime registry retries restricted records, so a successful purchase can unlock an already-known revision without re-importing it.

## Authentication provider reuse

The guard does not create another Supabase client.

It supports an existing provider via `bindProvider()`:

```js
KeloCreatorEntitlements.bindProvider({
  name,
  accountId,
  listAccess,
  checkAccess
})
```

Creator OS binds the existing authenticated Creator content repository. Outside Creator OS, the guard may reuse `KeloOnlineAuth` as fallback.

## Runtime metadata

Universal Creator ingestion stamps semantic runtime records with:

- `revisionId` — immutable `content_definition_revisions.id` UUID;
- `ownerUserId` — authenticated content owner;
- `contentId` — semantic/versioned content id.

Downstream Creator adapters preserve this identity in their metadata where supported.

### Appearance

Creator Appearance items preserve:

- `creatorContentId`;
- `creatorRevisionId`;
- `creatorOwnerUserId`.

`KeloAppearance.resolveLoadout()` rechecks access before producing a render layer. Unauthorized Creator items are omitted and reported in `restricted`.

### Mounts

Creator Mount metadata carries the same fields. `KeloMountCatalog.get/list/query/has` hide Creator mounts without access. `getRaw()` remains a definition/debug API and must not be used as a gameplay-use authorization path.

### World / property

Unauthorized Creator world/tile records are stopped by the Creator runtime registry before they can register a template in `KELO_PROPERTY_CATALOG`. The current property catalog therefore does not need a second marketplace authority.

### Character / VFX / other semantic content

Character adaptation is gated before `KeloCreatorAvatars.register()`.

Generic semantic consumers must use access-safe Creator Registry APIs (`getForUse()` or `query({usable:true})`) rather than treating raw registry presence as permission.

## Public API

```js
KeloCreatorEntitlements.bindProvider(provider)
KeloCreatorEntitlements.refresh()
KeloCreatorEntitlements.verifyRevision(revisionId)
KeloCreatorEntitlements.checkRecord(record)
KeloCreatorEntitlements.canUse(record)
KeloCreatorEntitlements.hasRevision(revisionId)
KeloCreatorEntitlements.getRevision(revisionId)
KeloCreatorEntitlements.revisionsForContent(contentId)
KeloCreatorEntitlements.snapshot()
KeloCreatorEntitlements.onChange(fn)
```

Creator Registry additions:

```js
KELO_CREATOR_CONTENT_REGISTRY.getForUse(contentId)
KELO_CREATOR_CONTENT_REGISTRY.query({ usable: true })
KELO_CREATOR_CONTENT_REGISTRY.reactivateRestricted()
```

## Security boundary

Client/runtime gating is defense in depth, not the final security authority. A modified browser can always alter its own JavaScript.

Any server-authoritative future action that persists or broadcasts use of paid Creator content—equip, place, spawn, activate, apply to avatar, etc.—must verify the same revision-specific access rule on the server before accepting the mutation. UI hiding or a client `canUse()` result is never sufficient authorization.

## Performance

- no Creator entitlement code is added to normal game boot by this pass;
- the guard is loaded with Creator OS today;
- access state is metadata-only and in-memory;
- no asset bytes are downloaded by the guard;
- marketplace purchase refreshes access metadata, then restricted records may reactivate;
- a future public purchased-content loader must initialize/reuse this same guard before registering Creator runtime records.

## Invariants

1. `PUBLISHED` does not grant usage.
2. `LISTED` does not grant usage.
3. `OWNED` means an authoritative entitlement row exists or the account authored the revision.
4. Creator access is exact-revision by default.
5. Built-in/non-Creator content is unaffected.
6. Missing access authority fails closed for Creator content.
7. No localStorage/IndexedDB ownership flags.
8. No second Supabase auth client.
9. No KC mutation inside the entitlement system.
10. Server mutations must independently enforce access before becoming authoritative.

## Validation

Static contract audit:

```bash
node scripts/creator-entitlement-audit.mjs
```

Required integration evidence before `VALIDATED`:

- creator can use own revision without purchasing it;
- buyer cannot use a published/listed revision before purchase;
- buyer can use exact revision after purchase/refresh;
- another account remains denied;
- buying r3 does not grant r4;
- sign-out clears buyer access;
- Appearance skips unauthorized Creator layers;
- Mount catalog hides unauthorized Creator mounts;
- world Creator template is not registered when denied;
- normal built-in content remains unaffected;
- iPhone/LIVE Creator flow remains stable.
