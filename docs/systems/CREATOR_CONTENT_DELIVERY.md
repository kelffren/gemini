# Kelo World — Creator Content Delivery

**Status:** V1 implemented, pending migration/runtime/iPhone verification.  
**Owner:** `Kelo Creator Content Delivery` + Supabase publication/access authority.  
**Primary client:** `src/creators/content/creator-content-delivery.mjs`  
**Lazy facade:** `window.KeloCreatorDelivery` installed by `src/core/creators-lazy-gate.js`  
**Authority migration:** `supabase/migrations/20260916003500_creator_content_delivery_v1.sql`

## Purpose

Convert one **exact immutable Creator revision** that the current account is allowed to use into a runtime-ready semantic record without syncing the whole marketplace or loading every owned asset.

Flow:

`revisionId → exact access check → published delivery manifest → public asset URLs → wake only required owner → runtime registry → specialized owner`

V1 deliberately requests content one revision at a time. It does **not** download the full Owned library on login.

## Authority rules

`PUBLISHED != LISTED != OWNED != DELIVERABLE != ACTIVE`.

`get_creator_content_delivery(uuid)` returns a manifest only when all of these are true:

1. the caller is authenticated;
2. the exact content revision exists;
3. the caller authored that exact revision **or** owns an entitlement to that exact revision;
4. the content revision has an active authority publication;
5. every bound asset revision has an active authority publication.

The RPC returns only published locations. It never returns the creator-private storage path.

### Revision semantics

Entitlements are revision-specific in V1. Buying r3 does not automatically unlock r4. Delivery therefore takes a revision UUID, never only a slug/content family.

## Asset transport

Published Creator asset bytes remain in the existing public `creator-global` storage bucket. The delivery manifest returns `publicStorageBucket` + `publicStoragePath`; the client converts these to public Storage URLs.

A public byte URL is **transport, not license evidence**. Runtime use is still gated by `KeloCreatorEntitlements`, and server-authoritative mutations must validate access independently.

If future product requirements demand byte secrecy for premium content, add a private published bucket + signed short-lived delivery URLs behind this same manifest contract rather than creating a second content system.

## Mobile/performance contract

- No bulk Owned synchronization on boot.
- No timers, polling or render loop.
- Manifest cache is memory-only, identity-keyed and capped at 48 entries.
- No asset bytes are fetched by the delivery service itself.
- Specialized owners receive URLs only after access succeeds.
- `KeloCreatorDelivery` is a tiny normal-boot facade; the real ESM delivery module is dynamically imported on first revision request.
- Only the relevant optional owner package is awakened: Appearance, Mounts or Properties. Character installs the existing Creator Avatar adapter.

This preserves the scaling target:

`Marketplace huge → account owns many → request one revision → load only that revision's assets`

## Runtime integration

`src/creators/content/runtime-content-registry.mjs` receives the normalized manifest and adapts it into existing owners. It does not render anything itself.

Current specialized routes:

- `world` / `tile` → `KELO_PROPERTY_CATALOG`
- `appearance` / `equipment` → `KeloAppearance`
- `mount` → `KeloMountCatalog`
- `character` → `KeloCreatorAvatars`
- other semantic types remain in `KELO_CREATOR_CONTENT_REGISTRY` until their specialized adapter exists.

`getForUse()` re-checks current access even when a record was previously active.

## Defense in depth after account changes

Metadata may remain in memory after logout/account switch, but use must stop immediately.

- Appearance re-checks Creator revision access when resolving a loadout.
- Mount Catalog filters use-facing reads dynamically.
- Property uses `creator-property-entitlement-guard.mjs`, a facade that filters Creator templates dynamically by `sourceId = revisionId`.
- Creator Avatar checks entitlement for the local player's selected revision on select/current/draw. Remote players' authority-approved avatar manifests remain renderable so multiplayer visuals do not disappear merely because the viewer did not buy the cosmetic.

## Avatar server authority

V1 upgrades `set_active_character_avatar` so a character revision may be selected when it is either:

- authored by the current account, or
- owned by exact-revision entitlement **and** actively published.

This is an actual server-authoritative use gate, not only UI filtering. `get_avatar_manifest` now includes `revisionId` and `ownerUserId` so the local runtime can enforce the same identity.

Other domains still need their server-authoritative mutation gates when those mutations exist (`equip Creator item`, `place Creator prop`, `spawn/use Creator mount`, etc.). Client checks alone are never sufficient for competitive/persistent state.

## Public API

Normal gameplay can request one revision without opening Creator Library:

```js
const result = await KeloCreatorDelivery.useRevision(revisionId);
```

Metadata only:

```js
const manifest = await KeloCreatorDelivery.manifest(revisionId);
```

Diagnostics:

```js
KeloCreatorDelivery.diagnostics();
```

Creator OS binds the same delivery instance to the existing Creator repository/session. Outside Creator OS, delivery reuses `KeloOnlineAuth`; it never creates a second Supabase auth client.

## Required validation before VALIDATED

1. Apply `20260916003500_creator_content_delivery_v1.sql` to a test Supabase project.
2. Run `node scripts/creator-content-delivery-audit.mjs` plus entitlement/market/release/docs audits.
3. Two-account test:
   - buyer before purchase → delivery denied;
   - seller/author → published own revision delivered;
   - buyer after purchase → exact revision delivered;
   - buyer r3 entitlement → r4 denied;
   - logout/account switch → previously cached local use denied.
4. Publication-integrity test: one missing bound `asset_publication` must fail `CONTENT_ASSET_PUBLICATION_INCOMPLETE`.
5. Avatar test: purchased published character can be selected server-side; unowned character cannot.
6. Remote avatar test: another player's approved avatar still renders to viewers without local entitlement.
7. iPhone/LIVE: first-use Delivery must not freeze gameplay; only requested owner/assets load.
8. Normal game boot must show no eager Creator delivery/asset downloads.

Do not mark this system `VALIDATED` from static inspection alone.
