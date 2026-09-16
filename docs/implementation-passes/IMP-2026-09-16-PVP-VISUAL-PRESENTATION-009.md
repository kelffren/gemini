# IMP-2026-09-16-PVP-VISUAL-PRESENTATION-009

**Status:** IMPLEMENTED_PENDING_VERIFY  
**Branch:** `pvp-visual-presentation-bridge-v1`  
**Depends on:** `IMP-2026-09-16-CREATOR-MODULAR-REPLICATION-008` / PR #301 and its upstream Creator/Character authority stack.

## User intent

Continue the Creator visual pipeline so server-authorized avatars, skins, cosmetics and visual weapons remain visible to other players inside online PvP, without bloating the competitive 20 Hz snapshot, trusting client-declared visual URLs/revisions, creating another renderer or adding another WebSocket.

## Problem found during implementation

The existing runtime had an overlap not visible from the previous social-only design review:

- `server/index.js` continued to send normal AOI `state` packets while players were in PvP, including `avatarManifest`;
- `server/pvp-authority.js` correctly emitted a separate presentation-free competitive snapshot;
- `engine-net.js upsert()` converted the absent PvP `avatarManifest` into `null`.

Result: a PvP snapshot could erase a trusted presentation that a normal state packet had just installed, creating potential visual flicker. At the same time, full manifests could be retransmitted repeatedly through normal state during PvP.

## Chosen architecture

Use a **same-WebSocket delta presentation wire** around the existing server output.

- `pvp-authority` remains untouched and presentation-agnostic.
- Server presentation remains the existing sanitized `player.avatarManifest` envelope.
- `server/pvp-presentation-wire.js` derives a compact `presentationKey` from full-body avatar identity + modular Creator `revisionKey`.
- Full `pvp:presentation` messages are event-like: first real visual, change, explicit clear or re-entry into viewer visibility.
- `pvp:snapshot` carries only `presentationKey`.
- PvP-time normal AOI state has repeated `avatarManifest` stripped and retains the compact key.
- `engine-net.js` preserves the cached manifest when a packet simply omits that field; only explicit server clear removes it.
- `KeloPvPWorld` already calls `renderAvatar(peer,false)`, so no PvP renderer is added.

## Implemented

- New `server/pvp-presentation-wire.js`.
- Presentation identity uses SHA-256-derived `p1:<20 hex>` cache key.
- Per-socket/per-actor sent-key cache uses `WeakMap` socket state and `Map` actor keys; no timer or polling.
- No initial clear packet for actors that never had a presentation.
- Unchanged presentation is skipped across repeated snapshots.
- r3 → r4 changes key and sends one new envelope.
- Visual → no visual sends explicit clear once.
- Actors pruned from PvP visibility are eligible for one resend when re-visible.
- Existing server bootstrap installs the wire before the canonical server index boots; no second listener/socket/server.
- `engine-net.js` now handles `pvp:presentation`, preserves trusted peer manifest when PvP snapshot omits the field, and records diagnostics/mismatch counters.
- Existing Creator avatar/modular Appearance runtime remains the render path.
- Added pure Node smoke test and static architecture audit.
- Added technical system documentation and canonical documentation references.

## Security boundaries

- The client cannot request or submit a PvP presentation revision/URL.
- `presentationKey` is cache identity, not access/ownership proof.
- Remote rendering grants no local entitlement.
- No Creator visual equipment stats enter `KeloEquipment` or PvP damage.
- `server/pvp-authority.js` remains competitive truth and receives no presentation responsibility.
- No new Supabase migration: this layer consumes trusted state already produced by upstream server presentation authority.

## Performance boundaries

- Full manifests are not copied into every 20 Hz PvP snapshot.
- Existing normal state during PvP keeps non-presentation metadata but strips repeated heavy `avatarManifest`.
- Actors with no visual avoid an initial empty presentation packet.
- No second render loop, no presentation polling, no Creator library bulk sync.

## Files

- `server/pvp-presentation-wire.js`
- `server/pvp-presentation-wire-smoke-test.js`
- `server/sprite-ai-bootstrap.js`
- `server/package.json`
- `engine-net.js`
- `scripts/pvp-visual-presentation-audit.mjs`
- `docs/systems/PVP_VISUAL_PRESENTATION_BRIDGE.md`
- this handoff
- canonical architecture/code/system catalog updates in the same pass.

## Executed evidence

The pure Node wire smoke was executed in this environment after the empty-packet optimization and passed. It verified deterministic/different revision keys, single initial real presentation, no repeat for unchanged snapshot, no useless initial clear for empty actors, r3→r4 update, stripping heavy manifests from PvP-time normal state, explicit clear, return after clear and resend after visibility prune.

The repository-wide static audit, full server suite, Supabase stack, multi-account WebSocket integration, Pages/Playwright and iPhone LIVE have **not** been claimed executed from this pass.

## Validation gates

- `node scripts/pvp-visual-presentation-audit.mjs` passes in a full checkout.
- `npm --prefix server run test:pvp-presentation` passes under declared Node 24.x.
- existing PvP authority/smoke tests stay green.
- Account A and B enter online PvP and see each other's server-authorized social presentation without flicker.
- r3→r4 while in PvP updates once and never shows stale r3 afterward.
- clear-slot/full-body avatar changes propagate without modifying competitive state.
- no-cosmetic actors do not generate presentation spam.
- packet inspection confirms full manifests are not present in every PvP snapshot.
- iPhone portrait/landscape multi-peer PvP has no freeze, leaked input lock or duplicate renderer.

## Next action after validation

Move to **Creator Appearance Authoring Contract V2 / Preview Parity**: make the editor/Photoshop-like authoring tools preview the same sheet/socket/anchor/transform contract used by local social, remote social and PvP rendering, so creators see pixel-for-pixel output before publication.
