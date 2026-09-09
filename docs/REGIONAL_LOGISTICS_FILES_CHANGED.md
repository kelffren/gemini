# Regional Logistics — Implementation Surface

## New files

- `src/systems/regional-economy-math.js` — pure deterministic risk/economic-distance math.
- `src/systems/regional-economy-system.js` — regional reserves, production, pricing, contracts, route events.
- `src/systems/caravan-system.js` — persistent cart lifecycle/possession/hidden cargo.
- `src/systems/faction-clan-system.js` — faction/clan memberships, roles, permissions, ownership identities.
- `src/systems/logistics-devtools.js` — debug/simulation surface delegating to owners.
- `scripts/regional-logistics-audit.js` — deterministic integration audit.
- `.github/workflows/regional-logistics-ci.yml` — CI gate.
- `docs/systems/REGIONAL_ECONOMY_LOGISTICS_SYSTEM.md` — technical owner documentation.
- regional architecture/reuse/online/performance/debt notes under `docs/`.

## Modified files

- `src/systems/container-system.js` — extends existing inventory owner for arbitrary dynamic containers and partial extraction while preserving latest transaction/checkpoint semantics.
- `src/systems/combat/combat-engine.js` — respects attached-cart attack restriction.
- `index.html` — loads the new owners after `KeloContainers` and preserves latest Commerce/Title runtime.
- `package.json` — adds `audit:logistics`, preserving existing audits.
- `docs/system-catalog.json` — registers the new owners.

## Why new files were indispensable

The new files correspond only to capabilities that had no existing owner: regional economy/risk, cart lifecycle, faction/clan identity and diagnostics. Inventory, movement, render, camera, events, combat, persistence and player commerce are extended/reused instead of duplicated.
