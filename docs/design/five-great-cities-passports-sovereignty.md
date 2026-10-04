# The Five Great Cities — Sovereignty, Passports & Strategic Materials

Status: **Canonical Kelo World design specification**

This document preserves the core rules for the Five Great Cities. Exact numbers, names, timers, prices and balance curves are configurable unless explicitly marked as a design law.

## 1. Core fantasy

Kelo World contains **Five Great Cities**. These are not ordinary settlements. Each is a strategic political and economic center that can be conquered and governed by player clans.

A ruling clan gains valuable privileges, but ownership is never permanent. Conquering a Great City creates something valuable enough that other players and clans have a reason to take it away.

**Design law: The Five Great Cities never truly belong to anyone. They are only being governed temporarily.**

## 2. Sovereignty

Each Great City has one active sovereign government recognized by the server.

The sovereign clan/government can:
- display its rule publicly;
- operate the city's Passport Authority;
- issue, sell or grant city passports under configured rules;
- receive/control configured city economic privileges;
- influence legal access to the city's strategic infrastructure and material market;
- defend the city during eligible conquest events.

Sovereignty is server-authoritative and changes only through valid conquest/governance systems.

## 3. Strategic material

Each Great City has an exclusive or uniquely efficient source/market for a **strategic material** needed throughout the broader economy.

Illustrative placeholders:
- Valeria — Astral Crystal
- Drakmor — Obsidian Alloy
- Solara — Sun Essence
- Nymira — Arcane Silk
- Kharum — Ancient Catalyst

Final names may change.

These materials should matter across systems such as:
- advanced crafting;
- equipment;
- watches/relic craftsmanship;
- construction;
- upgrades;
- alchemy;
- other high-value production.

No single city/material should be allowed to permanently switch off the whole game for everyone else.

High-tier recipes may intentionally require resources from two or more Great Cities. This creates trade, treaties, rivalry, smuggling, blockades and interdependence between governments.

## 4. Passport Authority

The sovereign government controls issuance of passports for its city.

It may, within configured limits:
- sell passports for KC;
- grant passports to allies;
- issue promotional/free passports;
- deny new issuance to hostile groups where allowed;
- create diplomatic access policies.

A passport is a real persistent game object, not merely a hidden boolean.

Minimum passport identity:
- passport serial;
- city;
- registered holder;
- issuing government/clan;
- government/era or season;
- issuance timestamp;
- current validity state;
- configured permissions/rights;
- provenance/history.

Example:

PASSPORT — VALERIA
Holder: Kelo
Serial: V-018421
Issuer: BLACK WOLVES
Government: Season 12
Status: VALID
Entry: Authorized
Trade: Authorized
Strategic Material Market: Authorized

## 5. Entering without a passport

A player may physically attempt to enter a controlled Great City without a valid passport.

The player is treated as an unauthorized foreigner/intruder under the city's rules.

City guards can identify and attack unauthorized players.

This creates gameplay rather than a simple locked menu:
- infiltration;
- dangerous unauthorized travel;
- smuggling;
- escape;
- future black-market systems.

Guard behavior, detection and safe/hostile zones must be server-authoritative and tuned so the mechanic is challenging rather than arbitrary.

## 6. Physical passport risk

Passports are physical/persistent items and can be exposed to configured loss/drop mechanics.

A passport may fall/be lost under eligible risk conditions.

The exact loss rules must integrate with RED/BLACK/BLUE criminality, PvP zones and other inventory-protection systems.

Registered identity and physical possession are separate concepts. A stolen passport must not automatically become perfect identity impersonation. Future systems may support stolen documents, transferable permits, forgery or black markets, but those require explicit mechanics.

## 7. Fall of a government

When a new clan/coalition conquers a Great City, passports issued by the defeated government lose their legal authority.

**Do not delete their historical objects.**

Instead:

REVOKED — FALLEN GOVERNMENT
Issued by: BLACK WOLVES
Government fell: Season 13
Legal entry authority: INVALID

This preserves collector/provenance value while removing functional access.

The new sovereign government must decide how to issue the new generation of valid passports.

Possible political choices:
- sell them;
- grant them;
- reward allies;
- run temporary free issuance;
- negotiate access through treaties;
- deny hostile factions where rules permit.

A conquest therefore resets political permission without erasing history.

## 8. Passport generations

Every change of sovereignty creates a new government era/generation.

Passports must preserve which government issued them.

This allows historical collectibles such as:
- First Government Passport;
- Siege-era Passport;
- Last Passport issued before the Fall of Valeria;
- passports signed/issued under famous clans.

Historical value and legal validity are separate.

## 9. Conquest events

Great Cities are captured through scheduled/server-authoritative conquest events, not arbitrary instant ownership changes.

A conquest should require meaningful military objectives. Exact combat design will live in the future conquest-system specification.

Possible objectives:
- gates;
- defensive structures;
- control points;
- government building;
- supply objectives;
- final sovereignty objective.

The winner must subsequently defend the city during future eligible conquest windows.

**Power creates something to lose.**

## 10. Coalition Invasions

Smaller clans can combine forces to challenge a stronger sovereign clan.

At least two eligible smaller clans may form a **Coalition Invasion** under configured eligibility rules.

The coalition must formally exist before the conquest begins.

The system should record:
- coalition members;
- declared war objective;
- intended governing arrangement;
- configured reward/privilege agreement where supported.

The design should permit alliances to become future sources of political tension. Winning together does not guarantee they remain friends afterward.

Coalition mechanics must prevent dominant mega-clans from trivially splitting into fake small clans solely to exploit small-clan advantages.

## 11. Government economics

Sovereignty must be economically desirable.

Possible controlled benefits include:
- passport issuance revenue;
- configured city taxes/fees;
- privileged access to strategic-material infrastructure;
- city market privileges;
- diplomatic leverage;
- prestige.

However, sovereign control must not allow permanent economic suffocation of the entire server.

Alternative acquisition paths, smuggling, trade, conquest, substitutes, stockpiles or other counterplay should preserve a functioning economy.

## 12. Diplomacy

Passport access and strategic materials should create player-driven negotiations.

Examples:
- one clan pays for legal access instead of invading;
- a sovereign grants free passports to an ally;
- a coalition member demands future market privileges for military support;
- rival cities exchange strategic materials;
- a government imposes hostile access policy;
- players smuggle resources around restrictions.

The system should generate politics from incentives rather than scripted dialogue.

## 13. Interaction with Relic Heat

Great City sovereignty follows the same Kelo World philosophy as Founder relic ownership.

A clan controlling a Great City possesses:
- visible prestige;
- strategic resources;
- economic leverage;
- something the server wants.

Future systems may create a distinct **Sovereignty Heat** or integrate city control into broader clan Heat.

Holding a city should make a clan more important and more contested, not safer.

## 14. Interaction with criminality

Unauthorized entry, theft, smuggling and other actions may interact with the RED/BLACK/BLUE/Most Wanted systems when explicitly defined.

Do not automatically classify every enemy soldier in a declared conquest as a criminal. Legitimate war and criminal activity are distinct server-authoritative contexts.

## 15. Anti-exploit requirements

At minimum:
- passports have unique server-authoritative serials;
- clients cannot forge validity;
- old-government passports cannot retain hidden access after revocation;
- sovereignty changes are atomic/server-authoritative;
- duplicate passports cannot be created by inventory races;
- fake coalition structures cannot trivially bypass eligibility;
- market wash trading cannot manufacture government revenue bonuses;
- logout/login cannot bypass guard/legal status;
- passport storage does not create duplicate access rights;
- all issuance, revocation and government transitions are auditable.

## 16. Emotional objective

The Five Great Cities should create:
- pride in conquest;
- fear of losing sovereignty;
- greed for strategic resources;
- resentment over access restrictions;
- diplomacy over passports;
- loyalty to allies;
- betrayal and coalition politics;
- smuggling and outlaw identity;
- nostalgia for fallen governments;
- server-wide stories around famous sieges.

A player should remember:
“I still have my Valeria passport from before Black Wolves fell.”

A clan should remember:
“We helped Diamonds take the city, and then they changed the passport deal.”

That history is part of the world.

## 17. System principle

Kelo World uses the same risk/reward structure at three scales:

**Individual:** criminal power/profit creates Most Wanted pressure.

**Clan:** relic wealth creates Relic Heat.

**Civilization:** Great City sovereignty creates political and military pressure.

The stronger the position, the more valuable it becomes — and the more other players should have a reason to contest it.
