# Performance Notes — Regional Economy & Logistics

- Settlement production is lazy by elapsed time; there is no timer per settlement/resource.
- Market quotes recalculate on demand rather than every frame.
- Supply contracts are evaluated only for affected reserve changes/production refreshes plus boot recovery.
- Route risk reads active modifiers for the requested route; no world-wide per-frame risk pass exists.
- Economic routing uses Dijkstra over the settlement route graph. V1 intentionally keeps it uncached because the demo graph is tiny. At scale, cache by `(from,to,routeGraphRevision)` and invalidate only on route/risk changes.
- Carts reuse `KeloMovement.after` and `KeloRender.afterFrame`; cost is O(number of carts), not O(items × carts).
- Cargo uses shared dynamic containers. There is no inventory engine, timer, or loop per cart.
- Factions/clans are dictionaries keyed by stable IDs; permission lookup is local to the target clan.
- State revisions are prepared so server sync/cache invalidation can be added without changing public commands.

## Scale target guidance

For 20k resource/item definitions, definitions should move into data packs/registries while `KeloRegionalEconomy` keeps generic formulas. Settlement states should only contain resources actually stocked by that settlement, and demand propagation should be invalidated per resource/contract rather than globally.
