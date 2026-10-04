# Legacy Books — Champion Autographs & Signature Power

Status: **Canonical Kelo World design specification**

This document defines transferable autograph books as historical, social and gameplay assets. Exact formulas and balance values remain server-configurable unless explicitly marked as a design law.

## 1. Core fantasy

A Legacy Book is a transferable collectible that stores autographs from notable players.

Watches preserve the history of an artifact.
Legacy Books preserve the history of people.

A valuable book should become a time capsule of the server: champions, conquerors, criminals, explorers and special-event winners captured at the exact moment they signed it.

## 2. Persistent book identity

Every Legacy Book is a unique persistent object with at minimum:
- immutable serial;
- creation date/season;
- current owner;
- ownership provenance;
- autograph slots;
- Raw Signature Power;
- Effective Book Power;
- Collector/Legacy Score;
- historical statistics.

The complete book is transferable and may be traded/sold under normal eligible market rules.

Transferring the book transfers its existing signatures and history. Signatures are not recreated for the buyer.

## 3. Maximum 30 autographs

A Legacy Book has exactly **30 autograph slots** as the initial canonical capacity.

Once all 30 are occupied, the owner must keep the existing collection or permanently erase an autograph before adding another.

The slot limit is essential: it forces curation instead of infinite accumulation.

## 4. Who can issue valuable autographs

Autograph eligibility is earned through server-recognized accomplishments.

Candidate eligibility categories include:
- Arena Champions;
- weekly title holders;
- winners of designated special missions/events;
- World First achievers;
- Great City conquerors/governors where appropriate;
- validated Most Wanted #1 or other exceptional ranking achievements;
- future server-recognized prestigious titles.

Not every player automatically creates a prestigious autograph merely by signing.

The server records the qualification that made the signer eligible.

## 5. Signature scarcity — one every three days

An eligible signer may initially issue only **one qualifying autograph every 3 days total**.

This is a signer-level cooldown, not one autograph per book.

A champion therefore cannot sign hundreds of books immediately.

The cooldown creates:
- scarcity;
- negotiation;
- social demand;
- favors;
- autograph markets;
- meaningful choices about who receives the next signature.

Exact cooldown duration remains server-configurable, but 3 days is the initial design target.

## 6. Immutable signing snapshot

When an autograph is created, the server permanently snapshots the signer at that moment.

At minimum record:
- signer identity;
- autograph qualification/title;
- signing timestamp;
- signer level;
- eligible Power at signing;
- Verified Wealth at signing;
- relevant championship/event/season;
- autograph issuance sequence where useful.

Example:

RAGNAR
Arena Champion — Week 42
Power at signing: 84,250
Verified Wealth at signing: 12,840,000 KC
Level: 92
Signed: Oct 4, 2026
Signature: 8/30

If Ragnar later reaches 300,000 Power, the old autograph remains an 84,250-Power historical snapshot.

**History does not rewrite itself when the signer changes.**

## 7. Verified Wealth

Do not simply snapshot wallet balance.

Signature valuation must use **Verified Wealth**, calculated from server-authoritative eligible assets/economic state.

The calculation must resist:
- temporarily borrowing KC;
- circular transfers;
- alt-account transfers;
- wash trades;
- escrow manipulation;
- briefly moving wealth between friends before signing.

The autograph records the validated historical wealth snapshot, not an easily manipulated client number.

## 8. Signature Power

Each autograph contributes to the book's historical power.

Signature value may derive from multiple dimensions:
- eligible combat/power snapshot;
- Verified Wealth;
- prestige of the qualifying achievement;
- rarity/importance of the title;
- historical context.

Do not allow raw wealth alone to dominate every optimal book.

Maintain at least two layers:

**Raw Signature Power**
- historical uncapped/less-capped measure;
- preserves what the signatures represented.

**Effective Book Power**
- gameplay contribution derived from Raw Signature Power using caps, diminishing returns or another balanced curve.

Collector value and gameplay power must remain separable.

## 9. Diversity

A book containing 30 copies of effectively the same achievement type should not automatically be the ultimate collection.

Collector/Legacy scoring may reward meaningful diversity, for example:
- Arena Champions;
- Great City conquerors;
- Special Mission winners;
- explorers/world-first achievers;
- notorious historical criminals;
- other future prestige disciplines.

Diversity affects collector prestige and may influence carefully balanced book progression without making every category mandatory.

## 10. Erasing an autograph

The owner may erase an autograph to free one of the 30 slots.

Erasure is **irreversible**.

The deleted autograph:
- stops contributing power;
- stops occupying the slot;
- cannot be automatically restored;
- does not refund the signer's historical cooldown;
- cannot simply be reinserted from provenance.

The signer may potentially sign the book again in the future if eligible and off cooldown, but that creates a **new autograph with a new current snapshot**, not restoration of the deleted historical autograph.

The UI must clearly warn the owner before permanent deletion.

## 11. Transfer and market value

The entire Legacy Book is transferable.

A buyer receives:
- the exact serial;
- current 30-slot configuration;
- all surviving autographs;
- historical snapshots;
- provenance;
- Raw Signature Power;
- effective stats;
- collector history.

Applied signatures are not individually detached and sold unless a future mechanic explicitly introduces that behavior.

The intended primary market object is the **book as a curated historical collection**.

## 12. Provenance

Meaningful book events are permanently recorded.

Candidate events:
- book_created;
- autograph_added;
- autograph_erased;
- ownership_transfer;
- market_sale;
- gift;
- inheritance;
- notable milestone;
- completion of 30/30 collection;
- recognized collector achievement.

Deleting an autograph removes it from the active 30-slot collection, but audit/provenance systems may preserve that a historical action occurred without allowing the deleted autograph to function or be restored.

## 13. Historical scarcity

Old signatures can become valuable because the original moment cannot be recreated.

Examples:
- First Arena Champion;
- first ruler/conqueror of Valeria;
- Season 1 Most Wanted #1;
- winner of a one-time special mission;
- player who later retired;
- signer whose power/wealth snapshot represents an important era.

A newer, stronger player does not automatically make an older historical signature worthless.

## 14. Population and collector reporting

Books may expose objective collector statistics such as:
- total books with 30/30 signatures;
- books containing a particular historical autograph;
- books containing signatures from multiple first-generation champions;
- unique category combinations;
- age;
- number of previous owners;
- combined historical signer wealth;
- number of championship signatures.

Only server-authoritative data may produce claims such as Population 1/1.

## 15. Example book

LEGACY BOOK #00481
27/30 Signatures

Raw Signature Power: 486
Effective Book Power: +19

Combined Verified Wealth at signing: 184,300,000 KC

Arena Champions: 8
Great City Conquerors: 4
Special Mission Winners: 7
Most Wanted #1: 2

Collector Tier: MYTHIC

This is illustrative, not a final balance commitment.

## 16. Anti-exploit requirements

At minimum:
- autograph cooldown is server-authoritative;
- signer identity cannot be forged;
- title/qualification must be validated at signing;
- Power snapshot is server-authoritative;
- Verified Wealth uses anti-transfer/anti-wash logic;
- deleting/re-adding cannot restore an old snapshot;
- duplicated book serials are impossible;
- transfer does not duplicate signatures;
- alt-account loops do not create full prestige;
- fake titles do not qualify;
- client clocks cannot bypass the 3-day cooldown.

## 17. Social economy

The autograph cooldown intentionally creates interpersonal economics.

Emergent behavior may include:
- champions selling a future eligible autograph for KC;
- gifting signatures to friends;
- clans negotiating signatures;
- players pursuing specific historical figures;
- collectors competing for a champion's next available autograph;
- famous players refusing offers;
- books becoming known for their curated roster.

Any trade must remain within supported in-game systems. The design does not rely on real-money trading or out-of-game coercion.

## 18. Relationship to other Kelo World historical assets

Kelo World now has complementary historical asset classes:

**Watches / Founder Relics**
History accumulates around one persistent artifact.

**Legacy Books**
History accumulates through notable people who personally signed a persistent artifact.

**Great Cities & Passports**
History accumulates through governments, conquest and political eras.

These systems can reference one another without collapsing into the same mechanic.

A Great City conqueror may become autograph-eligible.
A Most Wanted #1 may become autograph-eligible.
An Arena Champion may engrave a Champion Star and separately possess autograph rights.

Each action remains independently scarce.

## 19. Design law

A Legacy Book must never be valuable merely because the UI labels it Mythic.

Its value should be explainable:

**Who signed it?**
**What had they achieved?**
**How powerful and wealthy were they at that exact moment?**
**How scarce was their ability to sign?**
**Which signatures did the owner choose to preserve within only 30 slots?**
**Can this exact historical collection ever be recreated?**

The best books should feel like pieces of server history that happen to provide gameplay power.
