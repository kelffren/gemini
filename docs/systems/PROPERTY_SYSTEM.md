# Property System

## Status

**Foundation/online-transition owner.** `KELO_PROPERTY_SYSTEM` owns the current parcel/placement model and can delegate mutations to House authority or a replaceable remote adapter. Local fallback is still present and must not be described as full production server authority.

## Purpose

Property turns catalog templates into placements while preserving parcel edit rules, snapping, bounds, unit counts, collision ownership and render phases. It consumes `KELO_PROPERTY_CATALOG`; it does not own asset compilation, Creator marketplace ownership or Creator entitlements.

## Owner and files

- Runtime/domain owner: `KELO_PROPERTY_SYSTEM` — `src/property/property-system.js`
- Template owner: `KELO_PROPERTY_CATALOG` — `src/property/property-asset-catalog.js`
- Collision owner consumed: `KELO_COLLISION`
- Render owner consumed: `KELO_ENVIRONMENT_LAYERS`
- Atlas owner consumed: `KELO_ATLAS_CONTRACT`
- House authority, when applicable: `KELO_HOUSE_AUTHORITY`
- Replaceable online persistence: `installRemoteAdapter(adapter)`
- Optional Creator-content precondition: `Kelo Creator Use Authority`

## Mutation order

```text
UI/tool
  ↓
KELO_PROPERTY_SYSTEM.request(op,payload)
  ↓
all useGuard() preconditions
  ↓
House authority, if house mutation
  or remoteAdapter, if installed
  or localRequest fallback
  ↓
parcel/bounds/units/placement mutation
  ↓
collision + environment rendering
```

A guard may reject a cross-domain prerequisite but must not implement placement geometry or become the Property state owner.

## Public API

Important mutation/authority APIs:

- `request(op,payload)` — single public mutation mouth.
- `useGuard(fn)` — add async precondition before every authority route; returns dispose function.
- `installRemoteAdapter(adapter)` — replace local persistence/authority without changing UI callers.
- `ingestAuthoritySnapshot(snapshot)` — replace local mirror with a validated authority snapshot.
- `authorityLocalRequest(op,payload)` — explicit local fallback/debug bridge; not online authority.

Read/render helpers include `snapshot`, `parcel`, unit queries, placement queries, bounds/hit testing, `drawPlacements`, `exportLayout`, `refreshSceneColliders`, and `onChange`.

## Creator content

Creator templates are identified by `source:'creator-content'` plus immutable revision identity. Client entitlement checks are defense in depth only.

Creator Use Authority installs a `useGuard` for `place`:

1. resolve the template's exact Creator revision;
2. call `authorize_creator_property_placement` server-side;
3. server verifies active publication + creator ownership/exact entitlement;
4. only then does Property continue into House/remote/local domain rules.

`creator_property_use_authorizations` is an authorization receipt for **content use**, not proof that the placement is valid or globally persisted.

## Local units vs Creator entitlement

Built-in/local templates continue to require available local unit balance in the local fallback. An entitled Creator template is not copied into that local purchase balance; its right-to-use comes from Creator entitlement + server preflight.

This distinction must remain:

- `Property units` = domain inventory/balance concept for the local/current Property model.
- `Creator entitlement` = account license to one immutable Creator revision.
- `Creator property authorization` = server proof that the entitlement may be used for the requested placement attempt.
- `Actual placement` = Property/House/remote domain mutation.

## Collision and rendering

Property publishes placement colliders through the existing `KELO_COLLISION` owner key `property:placements`. It does not mutate the legacy obstacle array directly. Rendering remains through `KELO_ENVIRONMENT_LAYERS` in `props_back` / `props_front` phases.

## Invariants

1. `request()` remains the single public mutation mouth.
2. `useGuard()` runs before House/remote/local authority and never replaces them.
3. Creator entitlement is never stored as fake Property units.
4. Creator authorization does not claim parcel ownership or geometry validity.
5. Built-in/local templates keep their existing unit/bounds behavior.
6. Templates remain metadata; Property does not become an asset compiler.
7. Collisions remain owned by `KELO_COLLISION`.
8. No polling or second render loop.

## Anti-patterns

- Treating `authorize_creator_property_placement` as full server placement persistence.
- Bypassing `request()` to push into `state.placements`.
- Adding Creator purchase rows to local Property balances.
- Implementing parcel geometry inside Creator Use Authority.
- Making a use guard draw, collide or mutate state.
- Creating a second Property renderer for Creator props.

## Required validation

- built-in local placement still enforces units, parcel ownership and bounds;
- Creator prop without entitlement is rejected before placement mutation;
- exact entitled revision is authorized, while r3 does not authorize r4;
- House mutations still reach `KELO_HOUSE_AUTHORITY` after guards;
- installed remote adapter still receives allowed mutations after guards;
- Creator authorization failure leaves placement state unchanged;
- collision/render behavior remains unchanged for successful placements;
- `node scripts/creator-use-authority-audit.mjs` and existing Property/World audits pass;
- iPhone/LIVE placement receives visual verification before production claims.

## Next online step

A future full online Property authority should transactionally validate parcel ownership, geometry/bounds, domain inventory/cost and Creator-content authorization before persisting/broadcasting a placement. It should reuse the exact-revision Creator access rule rather than inventing another ownership system.
