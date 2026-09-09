# Regional Logistics — Command / Event Contract

## Commands

### KeloRegionalEconomy
- `BuyResource`
- `SellResource`
- `DeliverSupplyContract`
- `RefreshSettlement`
- `ActivateRaiderBand`
- `EndWorldEvent`
- `Snapshot`

### KeloCaravans
- `AttachCart`
- `DetachCart`
- `BeginClaimCart`
- `CompleteClaimCart`
- `LoadCart`
- `UnloadCart`
- `Snapshot`

### KeloFactions
- `JoinFaction`
- `LeaveFaction`
- `CreateClan`
- `JoinClan`
- `LeaveClan`
- `SetClanRole`
- `Snapshot`

## Domain events

### Economy
- `regional-economy:settlement-stock-changed`
- `regional-economy:market-price-changed`
- `regional-economy:supply-contract-created`
- `regional-economy:supply-contract-updated`
- `regional-economy:supply-contract-completed`
- `regional-economy:raider-ambush-started`
- `regional-economy:raider-ambush-ended`
- `regional-economy:route-risk-changed`

### Caravans
- `caravans:cart-attached`
- `caravans:cart-detached`
- `caravans:cart-claimed`
- `caravans:cart-abandoned`
- `caravans:cart-claim-started`
- `caravans:cart-claim-interrupted`
- `caravans:cart-cargo-changed`

### Factions/Clans
- `factions:membership-changed`
- `factions:clan-created`
- `factions:clan-member-joined`
- `factions:clan-member-left`
- `factions:clan-role-changed`
- `factions:clan-disbanded`
