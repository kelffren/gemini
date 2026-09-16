# IMP-2026-09-16-CREATOR-MODULAR-REPLICATION-008

**Status:** IMPLEMENTED_PENDING_VERIFY  
**Branch:** `creator-modular-replication-v1`  
**Depends on:** `IMP-2026-09-16-CREATOR-CHARACTER-BRIDGE-007` / PR #295 and all upstream Creator authority/delivery layers.

## User intent

Continue after the Character Appearance State Bridge so other players can see the server-authorized Creator skins, cosmetics and visual weapons a character has equipped, without sending image bytes from the owning client, requiring the viewer to own the item, or creating another renderer/network transport.

## Invariants

- The owning client never declares its replicated Creator asset URLs or revision list.
- The server derives the presentation from persisted exact-revision bindings and the authenticated character identity.
- Published presentation is not ownership; viewers cannot equip a revision merely because they can render it.
- Local use still requires exact entitlement + Delivery. Remote viewing does not require viewer entitlement.
- Existing `server/index.js` AOI + `engine-net.js` `avatarManifest` path remain the transport.
- Existing `KeloCharacterCustomization` / `KeloCharacterVisualStack` / `KeloAvatar` remain the render path.
- No second WebSocket, peer state store, Character owner, asset store or game loop.
- `KeloEquipment` remains gameplay stats/inventory/ability authority.

## Implemented

- Added `get_my_public_creator_character_appearance(character)` RPC.
- RPC rechecks active character ownership, exact revision publication, exact author/entitlement access, slot/target/type consistency and complete asset publication.
- Expanded `server/avatar-sync-store.js` into a trusted presentation-envelope resolver while preserving full-body avatar compatibility.
- Server sanitizes modular metadata and only reconstructs public URLs from approved `creator-global` publications with `global|official` visibility.
- Existing `avatarManifest` field now optionally carries nested `creatorAppearance`; no new socket message is required.
- Existing server AOI automatically carries the envelope through `serializePlayer()` / `publicStateFor()`.
- `KeloCreatorAvatars` detects a remote modular envelope and lazily wakes the existing Appearance feature only when needed.
- `KeloCreatorCharacterBridge` now supports remote per-actor WeakMap overlays and revision fingerprints.
- Remote runtime item IDs are revision-scoped and separated from local runtime item IDs.
- Remote items remain hidden + locked and feed the same Character visual stack.
- Creator visual equip/clear/character changes reuse existing `KeloNetAuthority.refreshAvatar()` so the server refreshes and redistributes presentation immediately.
- Added `scripts/creator-modular-replication-audit.mjs` and system documentation.

## Files

- `supabase/migrations/20260916004500_creator_modular_replication_v1.sql`
- `server/avatar-sync-store.js`
- `src/characters/creator-avatar-runtime.mjs`
- `src/characters/creator-character-state-bridge.js`
- `src/core/creators-lazy-gate.js`
- `scripts/creator-modular-replication-audit.mjs`
- `docs/systems/CREATOR_MODULAR_APPEARANCE_REPLICATION.md`
- this handoff plus canonical indexes/docs updated in the same pass.

## Deliberately deferred

- Private/signed-byte DRM for premium Creator visuals. V1 published bytes use `creator-global` as before.
- A new generic presentation protocol name replacing the compatibility `avatarManifest` envelope. Do that only when there is another server-trusted presentation domain that justifies protocol migration.
- Non-uniform Character transform support beyond the current shared renderer capability.
- Full transactional Property online authority.
- Any gameplay effect from Creator visual equipment.

## Validation gates

- `node scripts/creator-modular-replication-audit.mjs` passes.
- Upstream Creator/Character/docs audits remain green.
- Migration applies cleanly in test Supabase.
- Account A owns/entitled r3, equips it, Account B in AOI renders r3 despite B not owning it.
- B still cannot select/equip r3 for itself.
- A swaps r3→r4; B changes to r4 without stale r3 visual cache.
- entitlement revoke removes A's visual from subsequent presentation snapshots.
- clear-slot returns B's view of A to the underlying built-in slot.
- no-Creator peers do not load Appearance.
- first Creator modular peer loads Appearance once; heartbeat/state packets do not re-register unchanged revisionKey.
- peer leave/AOI exit does not retain actor overlay.
- full-body Creator avatar path remains intact.
- iPhone LIVE multiple-peer test has no freeze, duplicate renderer or unrelated Creator preload.

## Evidence / limitations

Source implementation is present on `creator-modular-replication-v1`. This environment has **not** applied the migration or executed Node audit, multi-account Supabase/WebSocket integration, Pages deployment, Playwright or iPhone LIVE. Do not mark VALIDATED from code presence alone.

## Next action

Run the stacked migrations and audits, then do a two-account AOI test. After this replication layer is validated, the next useful architectural pass is **Creator Appearance Authoring Contract V2 / preview parity**: guarantee that Creator-authored sheet/socket metadata previewed in the editor maps pixel-for-pixel to local and remote Character rendering, rather than adding another network/render layer.
