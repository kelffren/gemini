# IMP-2026-09-16-CREATOR-CHARACTER-BRIDGE-007

**Status:** IMPLEMENTED_PENDING_VERIFY  
**Depends on:** `IMP-2026-09-15-CREATOR-USE-AUTHORITY-006` / PR #277 and the full upstream Creator stack.  
**Owner(s):** `KeloCharacterCustomization` remains Character visual-state/render owner; `KeloCreatorCharacterBridge` owns only an ephemeral local projection of server-authoritative Creator visual bindings.

## User intent / source prompt

Continue after Creator Use Authority so purchased/owned Creator skins, visual weapons/equipment and other modular character pieces actually restore and render after reload, while reusing the existing CharacterCustomization renderer/state owners instead of creating a second character system.

## Why

PR #277 persists exact Creator appearance/equipment revisions server-side, but the existing local Character renderer still reads `KeloCharacterCustomization` base slots. Persisting a license by calling local `select()` would contaminate localStorage and make account-bound content look locally unlocked. The bridge must therefore project, not migrate, authoritative state.

## Invariants

- `KeloCharacterCustomization` remains the base visual state/catalog/history/save owner.
- `KeloCharacterVisualStack` + `KeloAvatar` remain the render path.
- Creator server bindings never become localStorage/IndexedDB ownership or local save/share state.
- The bridge overlays only the local actor.
- Every bound revision is exact-revision delivered and entitlement-usable before registration.
- Runtime Creator items are `hidden + locked` in the existing Character catalog.
- Creator visual `equipment` remains cosmetic and never grants KeloEquipment stats/inventory/abilities.
- Zero server visual bindings must not load Appearance or Creator visual bytes.
- No polling, second renderer, second auth client or bulk Owned synchronization.

## Implemented now

- Added `src/characters/creator-character-state-bridge.js`.
- Bridge wraps the public `KeloCharacterCustomization` facade only at `stateForActor(local)` and delegates every existing owner operation to the original owner.
- Base `getState()`, history, saves, share code and network snapshot remain unchanged.
- Added `getResolvedState(actor?)` for consumers that explicitly need the render-resolved local state.
- Exact revisions activate through `KeloCreatorDelivery.useRevision()` and are read from `KELO_CREATOR_CONTENT_REGISTRY.query({usable:true})`.
- Server-bound visual items register in CharacterCustomization as hidden/locked.
- Added sheet inference for canonical 4x4/2:3 Character assets and socket fallback for other pieces.
- Both `weaponMain` and `weaponSecondary` reuse the existing Character weapon preset; default weapon offsets survive when Creator payload has no custom transforms.
- Bridge hydration is single-flight to prevent duplicate exact-revision activation during Appearance first-use boot.
- Overlay clears on logout/session end/account-character identity change; entitlement refresh re-hydrates and drops inaccessible revisions.
- Creator lazy gate now performs one metadata-only use-state restore probe after auth. It loads `appearance` only when `loadout.length > 0`.
- Appearance feature now declares its actual Character dependencies and loads the bridge under the existing Module Loader.
- Added `scripts/creator-character-state-bridge-audit.mjs`.
- Added `docs/systems/CREATOR_CHARACTER_STATE_BRIDGE.md` and synchronized Creator Use, Character owner, architecture, code index and system catalog documentation.

## Files/contracts touched

- `src/characters/creator-character-state-bridge.js`
- `src/core/creators-lazy-gate.js`
- `src/core/feature-registry.js`
- `scripts/creator-character-state-bridge-audit.mjs`
- `docs/systems/CREATOR_CHARACTER_STATE_BRIDGE.md`
- `docs/systems/CREATOR_USE_AUTHORITY.md`
- `docs/systems/CHARACTER_CUSTOMIZATION_SYSTEM.md`
- `docs/ARCHITECTURE_CURRENT.md`
- `docs/CODE_INDEX.md`
- `docs/system-catalog.json`
- this implementation-pass handoff

## Deferred deliberately

- Remote multiplayer replication of modular Creator skin/equipment selections. Full-body Creator avatars keep their existing remote path, but modular slot bindings need a server-accepted visual snapshot/broadcast contract.
- Full online Property parcel/geometry persistence authority.
- Gameplay equipment/stat/ability integration; Creator visual weapons remain visual only.
- Non-uniform Character slot scaling. V1 maps `scaleX/scaleY` to one uniform scale because the shared Character descriptor currently exposes one offset scale.
- Dedicated Creator UI for explicit `payload.characterVisual` mode/socket/grid metadata. V1 supports that payload when present and safely infers canonical sheets otherwise.
- Any claim that arbitrary one-off images are pixel-perfect without explicit socket metadata and real LIVE review.

## Acceptance / gates

- `node scripts/creator-character-state-bridge-audit.mjs` passes.
- Character, Creator Use, Delivery, Entitlement, Marketplace, Release, Creator OS and docs audits remain green.
- Authenticated character with zero Creator visual bindings does not load Appearance.
- Bound entitled Creator skin restores after page reload and is visibly rendered by the existing Character stack.
- Clearing a Creator binding immediately reveals the underlying local slot.
- Logout/account switch clears the prior account overlay.
- r3 binding cannot hydrate r4 and revoked entitlement removes the visual after refresh.
- Hidden Creator items do not appear in local randomizer/ordinary item selection.
- Local Character save/share/history payload remains unchanged after hydration.
- Built-in customization still works before/after overlay use.
- iPhone portrait + landscape first-use/reload produces no freeze, duplicate renderer, leaked input lock or eager unrelated asset load.
- Remote modular Creator appearance is not called complete until a separate multiplayer replication pass is validated.

## Evidence

- Branch: `creator-character-state-bridge-v1`, stacked from `creator-use-authority-v1` / PR #277.
- Source/docs/audit changes are committed on the branch.
- No Node audit, Supabase integration, Playwright, Pages or iPhone/LIVE execution is claimed yet from this environment. Status remains `IMPLEMENTED_PENDING_VERIFY`.

## Next action

Run the new bridge audit + upstream audits from a runnable checkout, then execute the authenticated reload/clear/logout/revocation cases on test Supabase and iPhone/LIVE. After this local-player bridge validates, the next focused architecture pass is **Creator Modular Appearance Replication V1** for remote viewers, using server-accepted stable revision/runtime identities rather than client-local ownership or image bytes.

## Handoff prompt

> Continue `IMP-2026-09-16-CREATOR-CHARACTER-BRIDGE-007` on `creator-character-state-bridge-v1`. Read `docs/systems/CREATOR_CHARACTER_STATE_BRIDGE.md`, `docs/systems/CHARACTER_CUSTOMIZATION_SYSTEM.md`, `docs/systems/CREATOR_USE_AUTHORITY.md`, and upstream Creator ledger entries before editing. Preserve `KeloCharacterCustomization`/`KeloCharacterVisualStack`/`KeloAvatar` as owners. Never persist Creator bindings through local `select()`/`applySnapshot()`, never create local ownership, and never turn Creator visual equipment into gameplay stats. First run the bridge + Character + Creator upstream + docs audits, then test no-bindings lazy behavior, reload restore, clear, logout/account switch, revocation and iPhone/LIVE rendering. Do not claim remote modular Creator cosmetics complete; that is the next separate replication pass.
