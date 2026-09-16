# LiveOps HOT World Content

`src/systems/liveops-world-content.json` is the explicit HOT catalog for NPC presentation, mission definitions for **new acceptances**, and event definitions for **new instances**.

## Safety boundary

The HOT owner may replace only its immutable definition pointer. It must never mutate player inventory, gold, XP already earned, claimed rewards, active mission progress, active event instances, NPC spawns, combat state, timers, persistence, or server authority.

- NPC definitions are presentation/content only. The owner does not spawn NPCs.
- `pinMission(id)` returns an immutable snapshot for a newly accepted mission. A future mission runtime must persist/pin that revision and continue using it until the mission ends.
- `pinEvent(id)` returns an immutable snapshot for a newly created event instance. Running instances must keep their pinned definition.
- No JSON field may contain executable callbacks, scripts, reward/economy payloads, or automatic triggers.
- Unknown fields, duplicate IDs, unsafe text, invalid references, invalid counts, and unsupported schema versions reject the whole candidate before mutation.
- HOT application is transactional through `KeloHotDataRegistry`; failure rolls the catalog pointer back.

## Schema v1

Top level:

```json
{
  "schemaVersion": 1,
  "revision": "content-2026-09-16-a",
  "npcs": [],
  "missions": [],
  "events": []
}
```

NPC fields: `id`, `revision`, `enabled`, `name`, `role`, `summary`, optional `tags`, optional `dialogue` (`id`, `text`).

Mission fields: `id`, `revision`, `enabled`, `title`, `summary`, `category`, optional `giverNpcId`, `objectives` (`id`, `label`). There are deliberately no reward amounts or executable objective handlers in v1.

Event fields: `id`, `revision`, `enabled`, `title`, `summary`, `kind`, `locationId`, `minPlayers`, `recommendedPlayers`. There are deliberately no schedules, auto-start triggers, combat scripts, or reward payloads in v1.

## Runtime API

`window.KeloLiveOpsWorldContent` exposes:

- `getState()`
- `getCatalog()`
- `getNpc(id)` / `listNpcs()`
- `pinMission(id)` / `listMissions()`
- `pinEvent(id)` / `listEvents()`

A deploy that changes only `src/systems/liveops-world-content.json` is eligible for `hot-data` classification after the owner has registered. JS/schema/runtime-owner changes still require the updater's normal restart path.
