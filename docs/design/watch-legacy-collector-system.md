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


## 18. Genesis Event — The Founders 100
At the opening Genesis event, the server mints exactly 100 Founder watches:
FOUNDERS #001 through FOUNDERS #100.

Rules:
- The server never mints #101 or replacements.
- Each has the permanent, non-copyable Founder’s Blessing.
- Initial target: +15% experience while the physical Founder watch is carried in the player's eligible inventory.
- Storing the watch remotely does not grant the bonus.
- In explicitly designated loot-risk PvP content, death while carrying it has an initial 50% chance to drop the watch.
- The watch itself is never destroyed by this drop.
- Whoever legitimately acquires it receives the complete artifact and provenance.
- Capture, gift, inheritance, sale and recovery events are permanently recorded.
- No insurance may erase the intended Founder PvP risk.
- If Founder watches disappear into inactive accounts, the server does not create replacements. Reduced circulating supply becomes part of world history.

The +15% and 50% values are initial design targets and must remain server-configurable for balance testing.

## 19. Monthly Champion Stars
Every competitive period (initial target: one month), one official champion receives the exclusive right to engrave that period's Champion Star.

A star contains immutable provenance:
- champion player ID/display identity at engraving time
- championship period
- watch serial
- timestamp
- champion qualification proof/reference
- champion power snapshot
- power contribution granted
- engraving sequence/edition when limited

When the champion's engraving window ends, that month's star can never be newly produced again.

### Limited engraving supply
The champion receives a finite number of engraving charges for that championship period. Initial target: 10.

This creates scarcity based on a real player decision: the champion chooses which watches receive their historical mark. Unused charges expire at the end of the window and are not recreated.

### Safe contract vs direct trust
Two supported routes:
1. Engraving Contract — the owner escrows the watch and payment; the champion receives only the permission necessary to engrave. The system charges a meaningful KC fee as an economy sink.
2. Direct Transfer — the owner voluntarily transfers control of the watch to the champion. The champion may return it, trade it, or keep it according to normal game rules.

Before Direct Transfer, UI must explicitly state that ownership/control is being transferred and that return is not guaranteed. Social betrayal can therefore exist as an intentional game risk, not as deceptive UI.

Do not support real-money scams, impersonation, account theft or out-of-game deception as game mechanics.

### Objective trust history
Instead of a simple five-star reputation rating, expose factual history where appropriate:
- engraving contracts completed
- direct-transfer watches received
- direct-transfer watches subsequently returned
- escrow contracts fulfilled/defaulted where applicable
- historical value/number of artifacts worked on

Repeated fake transfers or alt-account loops must not create prestige.

## 20. Champion Power Imprint
A Champion Star is both provenance and a permanent power imprint.

At the instant of engraving, the server snapshots the champion's authoritative eligible power. The resulting bonus is permanently bound to that specific star/watch even if the champion later changes equipment, loses rank or stops playing.

Initial conversion target:
10,000 eligible champion power = +1 Watch Power Point.

Example:
Champion power at engraving: 10,000
Star: OCT-2026
Permanent contribution: +1 Watch Power Point

A later champion with 30,000 eligible power could contribute +3 raw Watch Power Points under the same baseline conversion.

The exact conversion curve MUST be configurable and should not necessarily remain linear at high values.

### Power stacking and long-term balance
Historical watches should become stronger as meaningful champions engrave them, but infinite seasons must not create infinite combat dominance.

Use three layers:
- Raw Historical Power: never capped; records the full amount contributed throughout history and is collector value.
- Effective Watch Power: gameplay power derived from Raw Historical Power through a diminishing-returns curve and/or season-adjusted cap.
- Provenance Power: collector metric representing who contributed, when, and under what championship strength; never deleted by balance patches.

This means a 20-year-old Grail can truthfully contain enormous historical power without automatically one-shotting new players.

Candidate effective-power model (balancing placeholder, not final):
effective = SCALE * log(1 + rawHistoricalPower / SCALE)

Alternative curves/caps should be simulation-tested before implementation.

### Preventing temporary power manipulation
The engraving snapshot must NOT blindly read a UI combat number.

Eligible Champion Power should be server-authoritative and may use:
- validated equipped build
- championship-eligible stats
- normalized competitive power
- anti-borrowing/anti-swap eligibility window
- snapshot of the build actually used to qualify/win where appropriate

This prevents a champion borrowing every high-power item for 30 seconds solely to inflate an engraving.

### Multi-champion Grails
A watch may accumulate Champion Stars from different periods.

Example:
FOUNDERS #007
Founder’s Blessing: +15% XP
OCT 2026 Star — Champion A — 10,000 snapshot — +1 raw power
FEB 2027 Star — Champion B — 24,000 snapshot — contribution according to curve
AUG 2027 Star — Champion C — 31,000 snapshot — contribution according to curve

The passport shows each star separately. Their identities are never merged into an anonymous stat.

A community category such as “Grand Slam” can emerge for watches carrying many historically important champion engravings. Prefer objective requirements if the system later recognizes such a title.

## 21. Why Champion engraving creates collector value
Champion engraving combines:
- time-limited scarcity
- limited supply
- human choice
- social negotiation
- trust/risk
- permanent provenance
- measurable contribution
- gameplay utility
- irreversible history

The desired fantasy is not merely “this watch has +8 attack.” It is:
“Eight real champions, across several years, personally chose or agreed to work on this exact serial, and their historical power remains embedded in it.”

The passport must always preserve that explanation.


## 22. Founder Relic Display — Clan City Hall

Founder watches can be converted from a personal progression asset into a clan-wide strategic relic by physically exhibiting them in the clan City Hall.

### Mutually exclusive modes
Every Founder watch has one active custody mode at a time:

**Personal Carry**
- Founder remains in an eligible player's carried inventory.
- Founder’s Blessing grants the carrier the configured personal XP bonus (initial target: +15% XP).
- The watch does NOT contribute the City Hall clan bonus.
- If carried into designated loot-risk PvP, normal Founder drop rules apply.

**City Hall Display**
- Founder is deposited into a real relic display slot in the clan City Hall.
- Founder’s personal +15% XP bonus is disabled while displayed.
- The displayed Founder grants an initial +1% XP to eligible members of that clan.
- The watch remains the same unique serial with its full provenance; it is not copied or converted into a generic buff.
- Removing it from display immediately ends its clan bonus and allows it to return to an eligible custody state.

A Founder can never grant both its personal and City Hall XP bonuses simultaneously.

### Physical visibility
Displayed Founders must be inspectable objects in the City Hall, not invisible account flags.

Players should be able to inspect:
- serial number
- nickname/title
- owner/custodian/clan
- Genesis status
- Champion Stars
- Mastery Imprints
- Battle Scars
- provenance timeline
- Population Report
- historical power
- time displayed by current clan

Example:

DIAMONDS CITY HALL
RELICS ON DISPLAY

FOUNDERS #007 — THE KINGMAKER
FOUNDERS #031
FOUNDERS #088

Clan Inspiration: +3% XP (example before any diminishing-return rules)
Relics displayed: 3

### Clan Inspiration
Initial balancing target:
1 displayed Founder = +1% clan XP.

The stacking function must be server-configurable. Do not permanently hard-code linear stacking. Large collections may use diminishing returns, display-slot limits, clan-size normalization, or another tested curve if unrestricted stacking becomes dominant.

Raw relic count and historical prestige remain visible even if effective gameplay bonus uses diminishing returns.

### Strategic and emotional purpose
City Hall display turns a Founder into visible clan capital.

The intended decision is:
- keep the Founder personally for a large individual advantage;
- or sacrifice that personal advantage to improve the whole clan.

This should create negotiation and internal clan politics over custody, display, war risk and allocation of scarce Founders.

A clan possessing multiple Founders should visibly feel prestigious and strategically important without making new clans permanently noncompetitive.

### Ownership and custody
Displaying a Founder does not erase ownership/provenance.

The ledger records:
- deposited_to_city_hall
- removed_from_city_hall
- clan_display_started
- clan_display_ended
- clan custody duration

The implementation must explicitly define whether legal ownership remains with the depositing player, transfers to clan treasury custody, or depends on the clan's configured relic policy. The UI must show the consequence before deposit.

### Conflict integration
Founder displays are intended to become objectives for future clan conflict systems.

If later versions permit City Hall raids or relic capture:
- capture must happen only through explicitly designated opt-in/declared clan-war rules;
- the exact unique watch changes custody;
- no duplicate is created;
- the losing clan immediately loses that relic's Clan Inspiration contribution;
- the capturing clan may later display the same serial and gain its eligible bonus;
- the capture becomes a permanent Battle Scar/provenance event.

Example:
Captured from DIAMONDS City Hall by BLACK WOLVES — Season 9.
Displayed as enemy trophy for 43 days.
Reclaimed by DIAMONDS — Season 10.

This makes stealing a Founder strategically meaningful: the victor can remove progression utility from a rival, acquire a scarce collector artifact, and potentially convert it into its own clan progression.

### Anti-exploit rules
- A serial can exist in only one custody/display state.
- Display bonuses are server-authoritative.
- Moving between personal/display modes cannot duplicate XP rewards.
- Clan hopping cannot leave stale bonuses.
- A Founder in escrow, trade, transfer, or unresolved capture state grants no conflicting duplicate bonus.
- Offline/inactive ownership does not clone display effects.
- Audit every custody transition in the immutable provenance ledger.

### Design principle
Founder watches represent scarce, visible power.

Personal Carry answers:
“What does owning this relic do for ME?”

City Hall Display answers:
“What does our clan possessing this relic do for US?”

The player or clan must choose. The same Founder must never answer both questions at full strength simultaneously.


## 23. Relic Heat — Wealth Makes the Clan a Target

Founder relics must never create only positive snowball progression. A clan that accumulates scarce relics gains prestige and progression, but also becomes increasingly visible, strategically valuable, and desirable to attack.

Core equation:

**More relics → more power → more prestige → more visibility → more enemies → more risk.**

The purpose is to make a wealthy relic-holding clan a natural target of the server rather than a permanently safe dominant faction.

### Relic Heat
Every clan holding or displaying eligible high-value relics generates **Relic Heat**.

Heat should consider signals such as:
- number of Founder relics held/displayed;
- percentage of known Founder supply controlled;
- collector/historical significance of those relics;
- duration of concentrated ownership;
- other future strategic relic categories.

Exact thresholds and formulas are server-configurable and must be balanced through simulation.

Example public status:

DIAMONDS
Founders displayed: 4
Clan Inspiration: +4% XP before stacking adjustments
Relic Heat: EXTREME
4 Genesis Relics currently exposed to eligible clan-conflict systems

### Public wealth visibility
Relic wealth should be visible enough to generate desire and conflict.

When allowed by the conflict rules, players can inspect which important relics a clan is publicly displaying, including serials and relevant collector characteristics.

Example:

DIAMONDS RELIC VAULT

FOUNDERS #007 — 4 Champion Stars
FOUNDERS #012 — Genesis pristine
FOUNDERS #031 — Former World Champion relic
FOUNDERS #044 — 382K Legacy XP
FOUNDERS #089 — 3 War Scars

The motivation should be:
“They have #007 and we want it,”
not merely:
“The quest says kill ten enemies.”

### World Target
At sufficiently high relic concentration/Heat, a clan can become a **World Target**.

Example:

WORLD TARGET

BLACK WOLVES controls 11 of the original 100 Founder Relics.
Relic Heat: EXTREME.
Their City Hall is eligible for increased strategic pressure under the configured war rules.

World Target status is a prestige signal and a danger signal. It must not mean unrestricted griefing or permanent vulnerability. Conflict remains governed by explicit server-authoritative war/raid rules and defined windows.

### Relic Hunts
High Heat can unlock or increase the frequency/value of scheduled **Relic Hunt** opportunities.

A Relic Hunt is a server-authoritative conflict window in which eligible enemy clans/participants can pursue objectives that may eventually expose a relic vault or displayed relic.

A hunt should involve meaningful intermediate objectives rather than instant theft:
- territory access;
- gates/defensive structures;
- control points;
- defenders;
- vault access conditions;
- extraction/escape conditions;
- other PvP objectives.

Exact rules are intentionally left for the clan-war system.

### Wealth creates pressure
Additional relics should eventually increase strategic burden, not only rewards.

Potential Heat consequences include:
- greater public visibility;
- World Target status;
- more valuable enemy objectives;
- increased frequency or attractiveness of eligible challenge windows;
- increasing defensive/logistical cost;
- stronger incentives for rival clans and mercenaries to participate.

Do not implement arbitrary humiliation debuffs merely for being wealthy. Pressure should emerge primarily from other players having better reasons and opportunities to contest valuable holdings.

### Anti-snowball principle
A dominant clan must face a real strategic question:

“We can acquire another Founder, but do we want the additional Heat that comes with controlling it?”

The ninth relic may increase prestige and utility while also crossing a Heat threshold that makes the clan substantially more attractive to attack.

This creates a natural counterweight to relic accumulation without making success meaningless.

### Mercenary and alliance economy
Relic concentration can create secondary player economies.

Supported/emergent behavior may include:
- clans hiring other clans for defense;
- mercenaries joining eligible Relic Hunts;
- alliances formed around protecting or attacking relic holders;
- KC-funded in-game relic recovery bounties;
- rival clans financing campaigns to recover specific serials;
- legitimate in-game information brokerage where supported by game systems.

Example:

RELIC RECOVERY BOUNTY
Target: FOUNDERS #007
Reward: 3,000,000 KC
Condition: successful server-validated recovery/capture event.

These systems must remain in-game and server-authoritative. They must not depend on real-money payments, account theft, impersonation, doxxing, or out-of-game harassment.

### Capturing strategic value
If a relic is legally captured under an eligible war system:
- the losing clan immediately loses that relic's active City Hall contribution;
- the exact serial changes custody;
- the capture is permanently appended to provenance;
- the winning side can later place that same relic into an eligible City Hall display;
- no duplicate or replacement is generated.

Thus a successful capture can simultaneously:
1. weaken an enemy's progression infrastructure;
2. transfer a scarce collectible;
3. increase the victor's prestige;
4. create a permanent historical event;
5. potentially increase the victor's own Relic Heat.

Winning therefore creates the next problem: the hunter can become the hunted.

### Emotional objective
Relic Heat exists to make ownership emotionally meaningful.

A high-value clan should experience:
- pride from controlling rare artifacts;
- greed for additional relics;
- fear of exposing them;
- pressure to organize defenses;
- political negotiation over whether to display or hide/carry assets;
- rivalry when enemies possess a historically important serial;
- desire for revenge/recovery after a capture.

The system should target competitive pride through transparent in-game accomplishments and losses, never personal harassment.

### Design law
A clan sitting on a mountain of relic wealth should feel powerful, but it should also feel like the whole server can see the mountain.

Relic ownership is not the end of the game. It creates content for the next conflict.
