# Creator Use Authority

## Status

**Creator online V1 — IMPLEMENTED_PENDING_VERIFY.** This layer turns exact-revision Creator ownership into server-authorized persistent use bindings without replacing the existing Character, Appearance, Mount or Property owners.

## Purpose

A marketplace entitlement is only valuable if the game cannot persist/use paid Creator content merely because the browser says `OWNED`. Creator Use Authority adds one reusable server boundary for the persistent selection/use of Creator revisions.

The canonical chain is:

```text
PUBLISHED -> ENTITLED/CREATOR-OWNED -> DELIVERED -> SERVER-AUTHORIZED USE -> DOMAIN OWNER
```

`PUBLISHED`, `OWNED`, `DELIVERED` and `USABLE` remain different states.

## Owners and files

- Client orchestration: `src/creators/content/creator-use-authority.mjs`
- Lazy normal-game facade: `KeloCreatorUse` in `src/core/creators-lazy-gate.js`
- Transport adapter: `src/creators/content/supabase-content-repository.mjs`
- Server authority migration: `supabase/migrations/20260916004000_creator_use_authority_v1.sql`
- Entitlement truth: `KeloCreatorEntitlements` + `creator_content_entitlements`
- Delivery: `Kelo Creator Content Delivery`
- Local Character visual projection: `src/characters/creator-character-state-bridge.js`
- Domain owners remain `KeloCreatorAvatars`, `KeloCharacterCustomization` / `KeloAppearance`, `KeloMounts`, and `KELO_PROPERTY_SYSTEM`.

## One server rule

`kelo_private.require_creator_revision_use(user, revision, allowedTypes)` is the shared precondition for persistent Creator-use mutations. It requires:

1. authenticated account;
2. exact immutable revision exists;
3. content type matches the mutation;
4. active `content_publications` row;
5. account is the revision author or has an exact `creator_content_entitlements` row.

Buying `r3` does not grant `r4`.

## Mutation matrix

| Use | Server mutation | What it owns |
| --- | --- | --- |
| Character/avatar | `set_active_character_avatar` | selected Creator character/avatar for the caller's character |
| Character skin / visual equipment | `set_character_creator_content` | exact Creator appearance/equipment revision bound to one character slot |
| Creator mount | `set_character_creator_mount` | selected exact Creator mount revision for one character |
| Creator prop/tile placement | `authorize_creator_property_placement` | proof that the account may use that Creator revision for a requested parcel/transform before Property applies its own rules |

## Character appearance and weapons

V1 server-persisted `appearance` / `equipment` bindings are **visual Creator content bindings**. They do not move gameplay weapon stats, inventory or combat ability authority into Creator Use. `KeloEquipment` remains the gameplay equipment/stat owner. A Creator weapon/skin becoming visually selected does not grant attack stats or bypass inventory/equipment rules.

`KeloCharacterCustomization` remains the local visual owner. `Creator Character State Bridge` now projects the authoritative slot bindings into an ephemeral local-only overlay consumed by the existing `KeloCharacterVisualStack` and `KeloAvatar` middleware. The bridge deliberately does not call CharacterCustomization `select()` or `applySnapshot()`, so an online license is never copied into local persisted visual state.

Delivered Creator items used by that overlay are registered `hidden + locked`: they can render through the existing catalog but do not appear as ordinary locally unlocked cosmetics after logout. See `docs/systems/CREATOR_CHARACTER_STATE_BRIDGE.md`.

Remote-player modular Creator skin/equipment replication is still a separate multiplayer integration. Full-body Creator avatar selection/rendering continues through the existing Creator Avatar path.

## Mount integration

`KeloMounts` supports composable `useGuard(fn)` preconditions. Guards run before its existing replaceable `authority.request()` boundary.

For Creator mounts:

- entitlement is checked in the runtime catalog;
- Creator Use Authority persists the exact selected revision server-side;
- then `KeloMounts` continues its normal domain logic;
- built-in starter/local mounts keep their existing behavior.

Creator Use does not become the mount gameplay owner.

## Property integration

`KELO_PROPERTY_SYSTEM` supports composable `useGuard(fn)` preconditions. A Creator `world`/`tile` placement first obtains `authorize_creator_property_placement` server-side.

That RPC is intentionally **not** a full parcel authority. It proves only that the caller may use the paid Creator revision. The existing Property/House/remote authority still owns:

- parcel ownership/edit permission;
- bounds and snapping;
- quantity/unit rules for built-in content;
- actual placement persistence;
- collision/render placement state.

A later online Property authority may combine content authorization and parcel validation transactionally without changing the Creator-content contract.

## Lazy/mobile behavior

The normal boot still avoids Creator OS UI, Creator Library data, Appearance runtime and Creator asset bytes. To restore an already-authorized modular Creator outfit after reload, the already-loaded Creator lazy gate may now import the small Use Authority/Delivery metadata layer and perform **one metadata-only use-state probe** for the authenticated character.

- no visual bindings -> stop; Appearance stays unloaded;
- visual bindings -> first-use load Appearance + Character bridge, then deliver only the exact bound revisions.

This intentionally supersedes the earlier stronger rule that the Use Authority implementation never loads during normal session boot. The important scalability invariant is now: **no heavy Creator OS, no bulk Owned sync, no Appearance package and no Creator visual bytes unless the character actually has bound visual revisions**.

No polling, timer or second render loop is introduced.

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

The browser remains tamperable. The durable proof is the server RPC/database state. UI/runtime checks provide defense in depth and better UX; they are not replacements for server validation.

Direct table writes are revoked from authenticated clients. Use changes occur through security-definer RPCs that derive `auth.uid()` and validate exact revision access.

## Invariants

1. one exact-revision access rule, not separate ownership logic per domain;
2. no localStorage/IndexedDB ownership authority;
3. no second Supabase/auth client;
4. publication alone never grants paid use;
5. use-state tables are not marketplace entitlements;
6. Creator Use preconditions compose with domain authority instead of replacing it;
7. built-in content paths remain supported;
8. Creator visual equipment does not become gameplay-stat authority;
9. Property authorization receipt does not claim parcel/geometry authority;
10. no eager full Creator library load;
11. Character render restoration uses an ephemeral overlay, not persisted local ownership.

## Required validation

Before `VALIDATED`:

- apply migration in test Supabase;
- run `node scripts/creator-use-authority-audit.mjs`, `node scripts/creator-character-state-bridge-audit.mjs` and all upstream Creator audits;
- owner can persist own published revision;
- buyer cannot persist foreign revision pre-purchase;
- buyer can persist exact revision post-purchase;
- second account remains denied;
- r3 entitlement does not authorize r4;
- inactive/unpublished revision is denied;
- account switch/sign-out cannot reuse previous selection authority;
- bound Creator skin/visual equipment restores through the existing Character renderer after reload;
- clearing a Creator visual binding reveals the underlying local Character slot again;
- mount guard persists exact revision before mount-domain mutation;
- property guard denies unauthorized Creator placement before Property mutation;
- built-in Character/mount/property behavior remains unchanged;
- purchased avatar selection continues to work and remote players can render published avatars;
- iPhone/LIVE first-use has no freeze/eager bulk sync;
- remote modular Creator appearance replication is tested separately before being claimed complete.
