# Kelo World — Backpack System Memory

## Purpose
Accumulated validated decisions for the Backpack/Inventory system. Record only behavior that has passed deterministic tests and/or LIVE mobile validation. Do not treat planned systems as implemented.

## Validated architecture — 2026-09-03

- `STATE.inventory` remains the legacy/source inventory used by existing systems. Backpack slot moves and sorting do not reorder that array.
- `STATE.backpack` schema version 2 owns portable slot ordering and capacity metadata.
- Base portable capacity is 20 slots arranged as 5 columns on mobile.
- Mobile Backpack interaction is tap-first. Current slot target is 52×52 CSS px. Drag and drop is deliberately not implemented yet.
- `equipment-v1.1.0` uses explicit `null` to represent an intentionally empty equipment slot. `Equipment.ensure()` initializes only slots whose property never existed and does not repopulate explicit empty slots.
- Backpack can equip and unequip equipment through the existing Equipment system without auto-refilling the empty slot.
- `backpack-v1.1.0` implements explicit stack signatures, max-stack-aware merging, splitting to a unique stack instance, Backpack-slot sorting, protected discard, and a capacity-expansion primitive.
- Moving a stack onto a compatible stack merges as much quantity as the target can accept. Remaining quantity stays in the source stack.
- Split requires an empty target slot and creates a new identity for the new stack.
- Equipment cannot be discarded through Backpack. Bound items cannot be discarded through Backpack.
- `backpack-ui-v1.2.0` exposes Equip/Unequip, Move/Merge, Split with a mobile stepper, Sort, and inline discard confirmation.
- Capacity expansion exists only as a technical primitive. No currency price, NPC, quest, premium purchase, or other economy rule has been validated for it.
- Warehouse/storage is not implemented yet.
- Market escrow / item transfer to Market is not implemented yet.
- GodsWar is used only as a functional reference for limited portable inventory, space pressure, expansion, and separation of carried inventory from external storage. No GodsWar art, UI, layout, assets, or code are copied.

## Validation — 2026-09-03

Runtime head certified: `9a192626e47a01360166cf23d135070aec2b5426`.

- Backpack CI run `33827267539`: SUCCESS.
- Kelo CI run `33827267637`: SUCCESS.
- GitHub Pages run `33827267183`: SUCCESS.
- Backpack LIVE mobile audit run `33827267588`: SUCCESS.
- LIVE viewport: 390×844 CSS px at DPR 2.
- LIVE slot target: 52×52 CSS px.
- LIVE initial state: 20 capacity, 12 used, 8 free.
- Equipment validation: unequip produced `null`; calling `getEquipped()` did not auto-refill; re-equip restored `eq_weapon` and survived reload.
- Stack merge validation: synthetic quantities 7 + 6 with `maxStack=10` became 3 + 10.
- Stack split validation: resulting quantities were 1, 2, and 10, with a unique identity for the split stack.
- Sort control was present and functional.
- Equipment discard returned `EQUIPMENT_PROTECTED`.
- Bound-item discard returned `BOUND_ITEM_PROTECTED`.
- Inline discard confirmation was visible and usable on mobile.
- Test-only synthetic inventory objects were removed before final reload.
- Final LIVE report: `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- LIVE screenshot was inspected: Backpack fits the 390×844 viewport, the 5-column grid remains legible, quantities are readable, and the inline discard confirmation remains inside the panel without clipping.

## Known limitations / next bottleneck — 2026-09-03

- The next architectural bottleneck is container-to-container transfer. Before pricing Backpack expansion or connecting Market, define a Warehouse container with atomic `Backpack ↔ Warehouse` transfer rules, capacity checks, stable item identity, rollback on failure, and persistence.
- Do not connect Market until container transfer semantics are proven; Market should eventually hold items in an escrow-like container so one item cannot exist simultaneously in Backpack and a listing.
- Keep drag/drop deferred until the existing tap-first interactions remain reliable across real mobile testing.

## Validated Container System + Warehouse V1 — 2026-09-04

- `container-v1.0.0` is the first shared container contract for portable/stored inventory.
- The ownership invariant is: **one item → one identity → one container**.
- Backpack portable instances remain in `STATE.inventory` for compatibility with existing systems.
- Warehouse instances live in `STATE.warehouse.items`; one physical instance is never intentionally duplicated into both arrays.
- `STATE.warehouse` schema version 1 contains: `id`, `type`, `owner`, `capacity`, `slots`, `items`, and `permissions`.
- Warehouse V1 id is `warehouse_main`, owner is `local_pioneer`, and validated capacity is 30 slots.
- Warehouse slot ordering is independent and persistent.
- `transferItem(sourceContainer, destinationContainer, itemKey, quantity)` implements the validated transfer path: VALIDATE → PREPARE → EXECUTE → PERSIST; execution exceptions restore a pre-operation snapshot.
- Destination capacity is strict: if the complete requested amount cannot fit, the transfer returns `DESTINATION_FULL` and performs zero mutation.
- Full-instance transfer preserves the same item identity.
- Partial-stack transfer keeps the source identity for the remainder and creates a new identity for the moved split.
- Compatible destination stacks are filled in destination slot order and never exceed `maxStack`.
- Total quantity is invariant for pure transfers; tests compare totals before/after and also verify identity uniqueness across Backpack + Warehouse.
- `bound`, `rarity`, `metadata`, stack fields, and other item properties survive transfer.
- Equipped equipment cannot be stored and returns `EQUIPPED_ITEM_PROTECTED`.
- `equipment-v1.1.1` is Warehouse-aware when resolving starter equipment identities: `Equipment.ensure()` will not recreate a starter item that exists in Warehouse. Stored equipment is not equipable until it is transferred back into Backpack.
- `warehouse-ui-v1.0.1` is mobile-first and tap-first: 5 columns, 52×52 CSS px slots, separate MOCHILA / ALMACÉN tabs, capacity counter, item details, Transfer action, and quantity stepper.
- Warehouse selection defaults to transferring the complete stack. The stepper is used only when the player explicitly wants a partial amount.
- Drag and drop remains deliberately deferred.
- No Warehouse price, expansion price, NPC, quest, premium currency rule, subscription, or economy restriction has been introduced.
- Market Escrow, Trade, and House Storage remain unimplemented; the container contract is prepared for future container types but no fake functionality is exposed.

## Validation — Container System + Warehouse V1 — 2026-09-04

Certified runtime head: `13f37687511a9da2801c9e1fd2a1f1cba8d0a720`.

- Backpack CI run `33837308422`: SUCCESS. It validated legacy Backpack mechanics plus Container/Warehouse deterministic mechanics.
- Kelo CI run `33837308479`: SUCCESS.
- Forge CI run `33837308485`: SUCCESS after its version expectation was aligned to the Warehouse-aware `equipment-v1.1.1`; Forge mechanics were not changed.
- GitHub Pages run `33837307907`: SUCCESS on the certified runtime head.
- Warehouse LIVE mobile audit run `33837308460`: SUCCESS.
- Backpack LIVE regression audit was updated only for current title/version expectations and its functional audit step passed successfully in run `33837476191`.
- LIVE viewport: 390×844 CSS px at DPR 2.
- Warehouse LIVE slot target: 52×52 CSS px.
- Initial LIVE state: Backpack 12/20 used; Warehouse 0/30 used.
- Full Backpack → Warehouse transfer of synthetic x4 item preserved identity and preserved `bound=true`, `rarity='Epic'`, and `metadata.seal='keep'`; total quantity stayed 16.
- Warehouse → Backpack return restored the same full instance to portable inventory.
- Stack merge validation: source x6 into destination x7 with `maxStack=10` produced destination x10 plus overflow/source identity x3; total quantity remained 29 before and after.
- Full destination validation returned `DESTINATION_FULL` with byte-for-byte equivalent inventory/backpack/warehouse state before and after the rejected operation.
- Equipped `eq_weapon` transfer returned `EQUIPPED_ITEM_PROTECTED`.
- Warehouse item survived a page reload and remained stored, not duplicated in Backpack.
- LIVE screenshot was visually inspected: 30 Warehouse slots fit the mobile panel in 5 columns, quantities and tabs are legible, and the panel does not clip at 390×844.
- Final Warehouse LIVE report: `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.

## Server-authority boundary — audited 2026-09-04

- Backpack, Warehouse and transfers are still client-authoritative and persist through the current client state/localStorage path. This is a functional prototype boundary, not anti-cheat/security authority.
- Before real multiplayer economy launch, the server should become authoritative for: container transfers, item creation/destruction, stack quantities, Market listings/escrow, currencies, crafting outputs/inputs, and drops/loot grants.
- Do not label the current client-side transfer layer as secure or authoritative.

## Next bottleneck

- The next logical inventory/economy bottleneck is **Market Escrow**, implemented as another real container using the now-validated transfer semantics.
- A future listing should move an item physically from Backpack to `market_escrow`; the same identity must not remain simultaneously portable and listed.
- Market work should also be the point where transfer/listing operations begin crossing an explicit server-authoritative transaction boundary instead of extending client-only ownership logic.
- Trade and House Storage should remain deferred until Market Escrow proves the generalized container contract under a third container type.
