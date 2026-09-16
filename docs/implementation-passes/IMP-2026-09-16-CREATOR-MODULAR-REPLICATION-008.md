# IMP-2026-09-16-CREATOR-MODULAR-REPLICATION-008

**Status:** IMPLEMENTED_PENDING_VERIFY  
**Branch:** `creator-modular-replication-v1`  
**Depends on:** `IMP-2026-09-16-CREATOR-CHARACTER-BRIDGE-007` / PR #295 and all upstream Creator authority/delivery layers.

## User intent

Continue after the Character Appearance State Bridge so other players can see the server-authorized Creator skins, cosmetics and visual weapons a character has equipped, without sending image bytes from the owning client, requiring the viewer to own the item, or creating another renderer/network transport.

## Scope

V1 covers the existing **social/open-world AOI state path**. PvP uses a separate competitive snapshot and is deliberately not expanded in this pass.

## Invariants

- The owning client never declares replicated Creator asset URLs or revision lists.
- The server derives presentation from persisted exact-revision bindings and authenticated character identity.
- Published presentation is not ownership; viewers cannot equip a revision merely because they can render it.
- Local use still requires exact entitlement + Delivery. Remote viewing does not require viewer entitlement.
- Existing `server/index.js` social AOI + `engine-net.js` `avatarManifest` path remain the transport.
- Existing `KeloCharacterCustomization` / `KeloCharacterVisualStack` / `KeloAvatar` remain the render path.
- No second WebSocket, peer state store, Character owner, asset store or game loop.
- `KeloEquipment` remains gameplay stats/inventory/ability authority.
- PvP presentation must remain server-derived if/when added; never solve it by trusting client skin URLs/revisions.

## Implemented

- Added `get_my_public_creator_character_appearance(character)` RPC.
- RPC rechecks active character ownership, exact revision publication, exact author/entitlement access, slot/target/type consistency and complete asset publication.
- Expanded `server/avatar-sync-store.js` into a trusted presentation-envelope resolver while preserving full-body avatar compatibility.
- Server sanitizes modular metadata and only reconstructs public URLs from approved `creator-global` publications with `global|official` visibility.
- Existing `avatarManifest` field now optionally carries nested `creatorAppearance`; no new socket message is required.
- Existing social server AOI automatically carries the envelope through `serializePlayer()` / `publicStateFor()`.
- `KeloCreatorAvatars` detects a remote modular envelope and lazily wakes the existing Appearance feature only when needed.
- `KeloCreatorCharacterBridge` now supports remote per-actor WeakMap overlays and revision fingerprints.
- Remote runtime item IDs are revision-scoped and separated from local runtime item IDs.
- Remote items remain hidden + locked and feed the same Character visual stack.
- Creator visual equip/clear/character changes reuse existing `KeloNetAuthority.refreshAvatar()` so the server refreshes and redistributes social presentation immediately.
- Server sanitizer preserves the semantic difference between absent transforms and explicit zero transforms so shared weapon defaults remain intact.
- Added `scripts/creator-modular-replication-audit.mjs`, `server/creator-modular-replication-smoke-test.js` and system documentation.

## Files

- `supabase/migrations/20260916004500_creator_modular_replication_v1.sql`
- `server/avatar-sync-store.js`
- `server/creator-modular-replication-smoke-test.js`
- `server/package.json`
- `src/characters/creator-avatar-runtime.mjs`
- `src/characters/creator-character-state-bridge.js`
- `src/core/creators-lazy-gate.js`
- `scripts/creator-modular-replication-audit.mjs`
- `docs/systems/CREATOR_MODULAR_APPEARANCE_REPLICATION.md`
- this handoff plus canonical indexes/docs updated in the same pass.

## Deliberately deferred

- PvP modular appearance parity. `pvp-authority` snapshots carry competitive state and should get a separate server-owned presentation bridge after this social path is validated.
- Private/signed-byte DRM for premium Creator visuals. V1 published bytes use `creator-global` as before.
- A generic presentation protocol name replacing compatibility `avatarManifest`; migrate only when another trusted presentation domain justifies it.
- Non-uniform Character transform support beyond current shared renderer capability.
- Full transactional Property online authority.
- Any gameplay effect from Creator visual equipment.

## Validation gates

- `node scripts/creator-modular-replication-audit.mjs` passes.
- `node server/creator-modular-replication-smoke-test.js` passes.
- Upstream Creator/Character/docs audits remain green.
- Migration applies cleanly in test Supabase.
- Social test: Account A owns/entitled r3, equips it, Account B inside AOI renders r3 despite B not owning it.
- B still cannot select/equip r3 for itself.
- A swaps r3→r4; B changes to r4 without stale r3 visual cache.
- entitlement revoke removes A's visual from subsequent social presentation snapshots.
- clear-slot returns B's view of A to the underlying built-in slot.
- no-Creator peers do not load Appearance.
- first Creator modular peer loads Appearance once; heartbeat/state packets do not re-register unchanged revisionKey.
- peer leave/AOI exit does not retain actor overlay.
- full-body Creator avatar path remains intact.
- iPhone LIVE social/open-world multi-peer test has no freeze, duplicate renderer or unrelated Creator preload.
- PvP cosmetic parity is explicitly **not** part of this validation claim.

## Evidence / limitations

- Source implementation is present on `creator-modular-replication-v1`.
- An isolated Node execution of the exact current `server/avatar-sync-store.js` plus `creator-modular-replication-smoke-test.js` passed. It covered syntax, valid published weapon sanitization, preservation of absent transforms, declared transforms, rejection of `creator-private`, rejection of invalid visibility and slot mismatch.
- A full branch clone/audit run was attempted but this execution shell could not resolve `github.com`; therefore the repository-wide audit suite is **not** claimed executed.
- This environment has **not** applied the migration or executed multi-account Supabase/WebSocket integration, Pages deployment, Playwright or iPhone LIVE.

Do not mark VALIDATED from source presence or the isolated sanitizer smoke alone.

## Next action

Run the stacked migrations/audits and execute the two-account social AOI test. After social replication is validated, the next network-focused pass is **PvP Visual Presentation Bridge V1**: attach server-trusted cosmetic presentation references to PvP actors without bloating or weakening the competitive authority snapshot. After PvP parity, move to Creator Appearance Authoring Contract V2 / preview parity.
