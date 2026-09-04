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

## Known limitations / next bottleneck

- The next architectural bottleneck is container-to-container transfer. Before pricing Backpack expansion or connecting Market, define a Warehouse container with atomic `Backpack ↔ Warehouse` transfer rules, capacity checks, stable item identity, rollback on failure, and persistence.
- Do not connect Market until container transfer semantics are proven; Market should eventually hold items in an escrow-like container so one item cannot exist simultaneously in Backpack and a listing.
- Keep drag/drop deferred until the existing tap-first interactions remain reliable across real mobile testing.
