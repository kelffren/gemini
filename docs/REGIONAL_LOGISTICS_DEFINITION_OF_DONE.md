# Regional Logistics — Definition of Done Matrix

| Requirement | Implementation / proof |
|---|---|
| Lazy production | `KeloRegionalEconomy` + `audit:logistics` |
| Buy reduces stock | `BuyResource` test |
| Sell increases stock | `SellResource` test |
| Specialization/tier quality | data definitions + audit |
| Scarcity pricing | explainable `MarketQuote` + audit |
| Auto contract | reserve threshold + audit |
| Delivery updates reserve | real Backpack extraction + audit |
| Reward decreases | severity-derived reward + audit |
| Recovery closes contract | close ratio + audit |
| Demand propagation | graph distance attenuation + audit |
| Risk → economic distance | pure math + Dijkstra + audit |
| Risk → larger margin | lower source pressure, no bonus + audit |
| Raider event risk | route modifier + audit |
| Cart persistence | `STATE.caravans` + dynamic container + serialization audit |
| Attach/drop/claim/death | `KeloCaravans` + audit |
| Attached basic attack lock | `KeloCombatEngine` integration + audit |
| Attached can receive damage | combat event behavior audit |
| Cargo hidden | authorization projection + audit |
| NPC cargo blind | `raiderShouldAggro` cart presence only |
| N-faction architecture | external faction definitions + generic registry logic |
| Clan faction binding | `KeloFactions` + audit |
| Roles/permissions | data definitions + audit |
| Online-ready boundary | strict request adapters; no online local fallback |
| Debug tooling | `KeloLogisticsDevtools` |
| Documentation | owner doc + catalog + reuse/architecture/online notes |

## Explicitly not yet complete

- Ability casts while ATTACHED need the existing ability owner to consume the same action policy.
- Actual RaiderBand NPC spawning/AI at AmbushNodes must be integrated through the existing NPC owner.
- Player-facing settlement/contract/faction UI is a later consumer pass.
- Server bridges/backend are prepared but not implemented.

These gaps are tracked rather than hidden.
