# Regional Logistics — Test Plan

Primary deterministic gate: `npm run audit:logistics`.

The audit runs the actual browser-domain files inside a Node VM with only platform stubs for Canvas/hooks. It does not replace economy, containers, carts or factions with mocks.

Covered flows:

1. objective route risk and economic distance;
2. shortest-path selection does not reward a deliberate detour;
3. lazy one-hour production;
4. specialization output/quality;
5. scarcity quote breakdown;
6. buy/sell settlement stock;
7. emergency contract creation;
8. real Backpack delivery;
9. decreasing reward and close on reserve recovery;
10. regional demand attenuation;
11. high risk produces larger potential margin;
12. RaiderBand risk increase/restoration;
13. cart attach/protection/load/drop/claim/death;
14. hidden cargo projection;
15. owner vs currentController separation;
16. serialized state persistence;
17. faction join + clan creation + permissions;
18. combat basic/melee blocked while attached;
19. carrier still receives damage;
20. one-item-one-container identity audit.

CI also runs `npm run audit:docs`.
