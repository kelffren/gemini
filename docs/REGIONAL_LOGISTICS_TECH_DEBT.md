# Regional Logistics — Remaining Technical Debt

1. **Ability policy integration:** melee/basic combat is blocked while a cart is attached. `kelo-ability-boot` still needs to consume the same `KeloCaravans.canActorAttack()` policy before offensive ability casts. Do not solve this with a wrapper around `cast()`.
2. **Raider AI materialization:** Route events and AmbushNode IDs exist and affect economy. The existing NPC/AI owner must later spawn/drive actual RaiderBand actors at those nodes; do not create another NPC engine.
3. **Player UI:** settlement markets, contract board, caravan interaction and faction/clan panels do not yet have a player-facing UI in this foundation pass. Future UI must call owner commands and read snapshots only.
4. **Network backend:** client owners expose strict server-replaceable boundaries, but `requestRegionalEconomy`, `requestCaravan` and `requestFactionClan` still need server transport/backend implementation.
5. **Path cache:** current Dijkstra is intentionally direct for the small demo graph. Cache shortest economic paths by graph revision when route count grows materially.
6. **World persistence/sharding:** local `STATE` persistence is valid offline. Server world persistence, spatial authority and shard ownership are backend work.

None of these items should be addressed by creating parallel economy, inventory, NPC, combat, movement, event or persistence systems.
