# Recommended Next Step — Regional Logistics

After this foundation is green, the next implementation pass should be **player-facing caravan/contract gameplay on the real world map**, without adding new domain owners:

1. Map real settlement IDs/market interaction points to `KeloRegionalEconomy` settlements.
2. Map physical AmbushNode positions to the existing world/NPC owner.
3. Add a small consumer UI for settlement quotes/contracts using only `KeloRegionalEconomy.request()/quote()/snapshot()`.
4. Add cart interaction prompts that call `KeloCaravans.request()`.
5. Wire offensive ability validation to `KeloCaravans.canActorAttack()` through the existing ability owner.
6. Materialize RaiderBand NPCs through the existing NPC/combat foundation.
7. Only after those flows are fun offline, implement the three network authority bridges on the server.

Do not start territorial warfare, clan banking, diplomacy, insurance or automated shipping before this loop is playable end-to-end.
