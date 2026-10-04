# Game History Chronicle System

Status: **Canonical architecture specification**

## Goal
Kelo World must remember its own history automatically and expose it to players through **Guía → Historia del juego**.

The chronicle is not a combat log. It records only events that become meaningful server history.

## Sources
1. **Official repository chronicle** — `data/game-history.json`. Design milestones and curated historical facts. ChatGPT/agents may update this file when the owner says **“actualiza”**.
2. **Server-authoritative history** — `server/game-history-store.js`. Confirmed runtime systems call `history.record(...)`.
3. **Client-observed history** — lightweight local fallback for semantic events emitted through `KeloEvents`; useful during offline/prototype development but never authoritative for valuable gameplay.

The UI merges these sources and removes duplicate IDs.

## What belongs in history
Record high-signal events such as:
- firsts and world records;
- Arena champions and important titles;
- Founder/relic captures and recoveries;
- Champion Stars and historically important crafts;
- Great City conquests and fallen governments;
- major clan wars;
- Most Wanted milestones;
- unique mission/event winners;
- Legacy Book milestones;
- major economic/server events chosen for permanent remembrance.

Do NOT record movement frames, normal attacks, every trade, every NPC interaction or other spam.

## Performance law
The Chronicle is **event-driven**.
- no second render loop;
- no polling loop;
- no scanning all objects every frame;
- bounded in-memory buffers;
- history UI loads on demand;
- deep history should be paginated/persisted server-side when production storage is enabled.

## Authority law
Valuable historical claims must originate from server-authoritative systems. Clients may display observations but cannot mint official history by sending arbitrary events.

## Integration API
Server systems receive or import the shared history owner and call:

```js
history.record({
  type: 'city_conquered',
  category: 'cities',
  importance: 5,
  title: 'Valeria has fallen',
  summary: 'Diamonds and Titans captured Valeria from Black Wolves.',
  cityId: 'valeria',
  clanId: 'diamonds',
  source: 'city-sovereignty'
});
```

Future systems should add one semantic record at the point where the server confirms the irreversible result.

## “Actualiza”
When the owner tells an AI agent **actualiza la historia**, the agent should:
1. inspect recent canonical design/runtime changes;
2. add only meaningful new milestones to `data/game-history.json`;
3. preserve old event IDs and chronology;
4. never rewrite historical facts merely because balance values change;
5. update this architecture only if the schema itself changes.

## UI
`game-history.html` is the public readable Chronicle.
The Guía contains a prominent **Historia del juego** entry.
Players can filter categories and manually press **Actualizar** to re-read sources.

## Future production persistence
The current server store is bounded in-memory. Before world history becomes production-critical, back it with persistent server storage (Supabase/Postgres) using the same record schema and pagination contract. The public Chronicle UI should not need to change.
