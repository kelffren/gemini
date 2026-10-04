# Watch Legacy System — Collector Design Specification

Status: canonical design spec
Purpose: make watches persistent, social, scarce collector artifacts whose value comes from provenance, irreversible player work, history and utility—not only RNG rarity.

## 1. Core fantasy
A watch is a unique object with a permanent biography. A great watch should make another player say: “multiple important players worked on this object; it cannot simply be recreated.”

Every watch receives an immutable serial ID at creation. Example: CELESTIAL-000184.

## 2. Sources of collector value
Each watch tracks independently:
- Model/reference and base scarcity.
- Original quality and current condition.
- Creation season/date and maker.
- Lifetime XP invested.
- Current extractable XP.
- Permanent Legacy XP.
- Legacy Imprints.
- Complete provenance/ownership chain.
- Important achievements earned while equipped.
- Permanent modifications and craftsmen.
- Original configuration versus modified configuration.
- Population statistics.
- Nickname/title earned through history.

Two watches of the same model must be capable of having radically different collector value.

## 3. Three XP layers
### Active XP
Player-generated XP that may be deposited into a watch. It can be extracted, but extraction destroys a percentage permanently.

Initial balancing target:
- deposit 100 XP -> 100 Active XP
- extract 100 Active XP -> return ~70 XP to player
- ~30 XP is permanently destroyed

Rates are balancing variables, not hard-coded economy promises.

### Legacy XP
Permanent XP bound to the watch. It cannot be withdrawn. It represents irreversible work embedded in the artifact.

### Mastery Imprints
Permanent signatures contributed by qualified players. An imprint records contributor, qualification, season, contribution and resulting effect. It cannot be erased by later owners.

## 4. Collaboration rule
A single player must NOT be able to create the perfect Grail watch alone.

Candidate imprint disciplines:
- Explorer
- Champion/PvP
- Master Crafter/Jeweler
- Merchant
- Gatherer
- Social/Guild
- Founder/Event specialist

High-tier watches require different qualified contributors. A player must meet the qualification at contribution time.

Example Grail requirement:
5/5 distinct Legendary Imprints from at least four distinct qualified players.

Contributing should require a real sacrifice: XP, rare materials, limited crafting charge, achievement token, or combination. Part of consumed value is permanently sunk.

## 5. Provenance ledger
Never erase meaningful history.

Permanent events include:
- crafted_by
- minted
- gifted
- inherited
- sold
- won
- major_owner
- mastery_imprint
- permanent_modification
- championship
- world_first
- important expedition/event
- restoration

A transfer records its semantic type when applicable. “Gifted by Kelo to Ainara — Season 8” can therefore become collector history rather than an ordinary database transfer.

Normal trading must not let owners rewrite provenance.

## 6. Craftsmanship and irreversible modifications
Qualified craftsmen can perform modifications. Important modifications record:
- player/craftsman
- date/season
- component/material serial when relevant
- old configuration
- new configuration
- craftsmanship tier

Some transformations are irreversible. This creates identifiable eras and craftsmen: collectors can intentionally seek “Season 2 pieces modified by X”.

Original/unmodified condition remains separately visible so both original examples and historically modified examples can be desirable.

## 7. Achievements belong to the artifact
Selected accomplishments can become permanent watch provenance when the watch was genuinely equipped/eligible.

Examples:
- Won Season 4 Championship
- First completion of Raid X
- World-first event participation
- 1,000 successful trades
- 100 expeditions

Avoid farmable trivial statistics being treated as prestige.

## 8. Population Report
The game calculates objective population statistics for every reference/configuration.

Example:
CELESTIAL CHRONO
Created: 8,421
Quality 90+: 683
Quality 95+: 117
Quality 99: 8
3 Legendary Imprints: 41
4 Legendary Imprints: 7
5 Legendary Imprints: 1

The UI can show “Population: 1/1” only when the filters genuinely produce one existing qualifying item.

Population is calculated from authoritative item data, never manually assigned as marketing rarity.

## 9. Collector Score
Provide a discovery/ranking score, but NEVER let one score replace the underlying history.

Potential dimensions:
- intrinsic scarcity
- quality/condition
- age
- provenance strength
- contributor prestige
- achievement significance
- craftsmanship
- collaboration depth
- population rarity
- originality
- historical significance

Display why the score exists. Do not manufacture scarcity by secretly changing scores.

## 10. Named Grails
Exceptional watches may earn persistent community/system titles after objective thresholds or historical events.

Example:
CELESTIAL #000184 — “THE KINGMAKER”

A title does not clone onto another item and survives transfers.

## 11. Utility without pure pay-to-win
A gifted rare watch may transfer meaningful advantages because prior players invested work into it. However:
- power has designed caps;
- the best collector provenance need not equal maximum combat power;
- some benefits are versatility, access, convenience, specialization or prestige;
- old Grails should remain desirable even when combat metas change.

This preserves inheritance/gifting value without making every historical collectible mandatory for competitive play.

## 12. Sinks
Primary sinks:
- XP extraction loss
- Legacy XP conversion
- imprint costs
- irreversible craftsmanship
- restoration/maintenance
- high-tier material consumption
- optional fusion where one item/component is permanently consumed

Never destroy historically important watches automatically through decay. Condition degradation can create maintenance sinks, but ownership history must survive.

## 13. Anti-exploit rules
- Server-authoritative serial IDs and provenance.
- No history deletion.
- No duplicate serials.
- No self-trading loops generating prestige.
- Achievements require genuine eligibility and watch usage.
- Repeated transfers alone do not increase collector score.
- Contributor prestige is snapshotted/validated according to defined rules.
- Sybil/alts cannot satisfy distinct-person Grail requirements without anti-abuse checks.
- XP extraction cannot create net XP.
- Population queries derive from authoritative inventory including escrow/market state.

## 14. Collector UI
Every watch has a Certificate / Passport screen:
1. Hero visual + serial.
2. Reference, quality, condition.
3. Collector Score with explanation.
4. Population Report.
5. Active XP / Legacy XP.
6. Imprint constellation showing contributors.
7. Provenance timeline.
8. Important achievements.
9. Craftsmanship/modification history.
10. Previous notable owners.
11. Originality/configuration.
12. Market history where economy rules allow it.

For exceptional listings, marketplace presentation should emphasize historical significance rather than treating the watch like commodity loot.

## 15. Example
CELESTIAL CHRONO #000184 — THE KINGMAKER
Original Quality: 96/100
Lifetime XP invested: 187,420
Legacy XP: 41,800
Owners: 7
Contributors: 4
Legendary Imprints: 5/5
Championships: 2
World Firsts: 1
Population under current Grail criteria: 1

Provenance:
- Kelo — original creator
- Andrea — Master Crafter imprint
- Zeth — irreversible Meteor Dial modification
- Ragnar — Season 4 championship while equipped
- later gifted/inherited to current owner

The important point is that #000184 is valuable because its exact combination of people, sacrifices and historical events cannot be reproduced simply by obtaining another Celestial Chrono.

## 16. Implementation phases
Phase 1 — identity/provenance foundation:
unique serial, immutable creation metadata, ownership ledger, transfers, watch passport.

Phase 2 — XP economy:
Active XP deposits/extraction, sink, Legacy XP.

Phase 3 — collaboration:
qualifications, Mastery Imprints, distinct-contributor requirements, permanent contribution ledger.

Phase 4 — historical value:
achievement attachment, craftsman signatures, irreversible modifications, named artifacts.

Phase 5 — collector economy:
Population Report, Collector Score, advanced marketplace filters and historical presentation.

## 17. Design law
Never create collector value merely by writing “Legendary” on an item.

The strongest value must be explainable:
WHO touched it,
WHAT they sacrificed,
WHAT happened while it existed,
HOW many comparable examples exist,
and WHY its exact history cannot be recreated.

That is the canonical direction for Kelo World's watch collecting system.
