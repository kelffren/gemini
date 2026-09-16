# Creator Use Authority

## Status

**Creator online V1 — IMPLEMENTED_PENDING_VERIFY.** This layer turns exact-revision Creator ownership into server-authorized persistent use bindings without replacing existing Character, Appearance, Mount or Property owners.

## Purpose

A marketplace entitlement is only valuable if the game cannot persist/use paid Creator content merely because the browser says `OWNED`. Creator Use Authority adds one reusable server boundary for persistent selection/use of Creator revisions.

```text
PUBLISHED -> ENTITLED/CREATOR-OWNED -> DELIVERED -> SERVER-AUTHORIZED USE -> DOMAIN OWNER
```

`PUBLISHED`, `OWNED`, `DELIVERED`, `SELECTED` and `VISIBLE TO OTHERS` remain distinct states.

## Owners and files

- Client orchestration: `src/creators/content/creator-use-authority.mjs`
- Lazy facade: `KeloCreatorUse` in `src/core/creators-lazy-gate.js`
- Transport adapter: `src/creators/content/supabase-content-repository.mjs`
- Server authority migration: `supabase/migrations/20260916004000_creator_use_authority_v1.sql`
- Entitlement truth: `KeloCreatorEntitlements` + `creator_content_entitlements`
- Delivery: Kelo Creator Content Delivery
- Local/remote Character visual projection: `src/characters/creator-character-state-bridge.js`
- Social remote presentation: `supabase/migrations/20260916004500_creator_modular_replication_v1.sql` + `server/avatar-sync-store.js`
- Domain owners remain `KeloCreatorAvatars`, `KeloCharacterCustomization` / `KeloAppearance`, `KeloMounts`, and `KELO_PROPERTY_SYSTEM`.

## One server rule

`kelo_private.require_creator_revision_use(user, revision, allowedTypes)` backs persistent Creator-use mutations. It requires authenticated account, exact immutable revision, allowed content type, active publication, and author or exact entitlement. Buying r3 does not grant r4.

## Mutation matrix

| Use | Server mutation | What it owns |
| --- | --- | --- |
| Character/avatar | `set_active_character_avatar` | selected Creator character/avatar for caller character |
| Character skin / visual equipment | `set_character_creator_content` | exact Creator appearance/equipment revision bound to one slot |
| Creator mount | `set_character_creator_mount` | selected exact Creator mount revision |
| Creator prop/tile placement | `authorize_creator_property_placement` | content-use proof before Property applies its own rules |

## Character appearance and weapons

Server-persisted `appearance` / `equipment` bindings are **visual Creator content bindings**. They do not move gameplay weapon stats, inventory or combat ability authority into Creator Use. `KeloEquipment` remains gameplay equipment/stat owner.

For the local actor, `Creator Character State Bridge` projects authoritative bindings into an ephemeral overlay consumed by the existing `KeloCharacterVisualStack` and `KeloAvatar` middleware. It does not call CharacterCustomization `select()` / `applySnapshot()`, so a paid online license is not copied into local persisted visual state.

For remote social/open-world viewers, `get_my_public_creator_character_appearance()` derives a presentation snapshot from the selected bindings using the owning character's authenticated server path. It rechecks active publication, exact author/entitlement access, slot/target/type and asset publication before `server/avatar-sync-store.js` sanitizes it for AOI replication.

The viewer does **not** need to own the remote player's cosmetic. Viewing a server-authorized published presentation does not create an entitlement and does not let the viewer equip that revision.

Delivered/projected Creator items remain `hidden + locked` in CharacterCustomization. Local and remote revision-scoped item IDs are separate. See `CREATOR_CHARACTER_STATE_BRIDGE.md` and `CREATOR_MODULAR_APPEARANCE_REPLICATION.md`.

PvP cosmetic parity remains a separate integration because PvP uses its own competitive snapshot.

## Mount integration

`KeloMounts` supports composable `useGuard(fn)` preconditions before its existing domain authority. Creator Use persists exact selected revision while `KeloMounts` retains mount gameplay/state.

## Property integration

`KELO_PROPERTY_SYSTEM` supports composable `useGuard(fn)` preconditions. Creator world/tile placement first obtains `authorize_creator_property_placement`; Property/House/remote authority still owns parcel permission, bounds, quantities and actual placement persistence.

## Lazy/mobile behavior

Normal boot avoids Creator OS UI, full library data and Creator visual bytes.

Local restore:
- no visual bindings → stop; Appearance stays unloaded;
- bindings exist → first-use load Appearance + Character bridge and deliver only exact selected revisions.

Remote social replication:
- peers without `creatorAppearance` → no Appearance wake-up;
- first relevant peer with non-empty server presentation → existing Appearance feature loads on demand;
- unchanged `revisionKey` snapshots reuse the current WeakMap overlay.

No polling, second socket or second render loop is introduced.

## Public client API

```js
await KeloCreatorUse.avatar(revisionId, { characterId });
await KeloCreatorUse.equip(revisionId, { characterId, slotKey });
await KeloCreatorUse.clearSlot(slotKey, { characterId });
await KeloCreatorUse.mount(revisionId, { characterId });
await KeloCreatorUse.clearMount({ characterId });
await KeloCreatorUse.place(revisionId, { characterId, parcelKey, transform });
await KeloCreatorUse.state({ characterId, hydrateRuntime: true });
```

These methods request server authority; local hydrated state is a convenience cache, never ownership proof.

## Security boundary

The browser remains tamperable. Durable proof is server RPC/database state. Direct use-state table writes are revoked from authenticated clients.

Remote presentation is derived server-side; the owning client does not declare replicated asset URLs/revisions. V1 only republishes approved `creator-global` bytes with active asset publication and allowed visibility. A public URL is not entitlement evidence.

## Invariants

1. one exact-revision access rule, not separate ownership logic per domain;
2. no localStorage/IndexedDB ownership authority;
3. no second Supabase/auth client;
4. publication alone never grants paid local use;
5. use-state tables are not marketplace entitlements;
6. Creator Use composes with domain authority instead of replacing it;
7. built-in content paths remain supported;
8. Creator visual equipment does not become gameplay-stat authority;
9. Property authorization receipt does not claim parcel authority;
10. no eager full Creator library load;
11. local Character restore uses ephemeral overlay;
12. remote social presentation does not create viewer ownership or local-use permission;
13. PvP presentation remains outside this V1 claim.

## Required validation

Before `VALIDATED`:

- apply stacked migrations in test Supabase;
- run `creator-use-authority`, `creator-character-state-bridge`, `creator-modular-replication` and upstream audits;
- owner can persist own published revision;
- buyer cannot persist foreign revision pre-purchase;
- buyer can persist exact revision post-purchase;
- second account remains denied for **use**;
- r3 entitlement does not authorize r4;
- inactive/unpublished revision is denied;
- account switch/sign-out cannot reuse previous local selection authority;
- bound Creator skin restores locally after reload;
- clear binding reveals underlying local slot;
- social Account B can **view** Account A's server-authorized Creator skin without owning it;
- B still cannot equip A's revision without entitlement;
- revoke/swap r3→r4 propagates to social remote presentation correctly;
- mount/property guards retain existing domain behavior;
- built-in Character/mount/property behavior remains unchanged;
- iPhone/LIVE local + social multi-peer first-use has no freeze/eager bulk sync;
- PvP modular appearance parity is not claimed until its separate bridge is validated.
