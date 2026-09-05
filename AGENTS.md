# ⚠️ LEY DEL REPO — LÉE ESTO PRIMERO

**Todo lo que se cree o se cambie debe nacer listo para enchufarse al online.**
No rediseñar después. Misma API hoy (local-fallback) y mañana (server).

Documento corto: [`docs/ONLINE_FIRST.md`](docs/ONLINE_FIRST.md)

Antes de marcar algo como listo:
> ¿Puedo conectarlo al online cambiando solo la capa de autoridad, sin rehacer lógica, IDs, dueños ni el flujo del jugador?

Si es NO, no está listo.

---

# Kelo World — Mandatory Development Rules

This file is mandatory reading before any implementation, refactor, integration, or new gameplay/system pass in Kelo World.

## RULE 1 — ONLINE-FIRST ARCHITECTURE (MANDATORY)

Every new Kelo World system must work in the current playable prototype while being architected so it can later move naturally to online/server-authoritative execution without rebuilding its core domain model, ownership model, persistence contract, or UI flow.

Before implementation, explicitly identify:

1. What state the feature owns.
2. What operations mutate that state.
3. What identity/ownership rules must remain invariant.
4. Which operations are currently client-authoritative.
5. Which operations must become server-authoritative before real multiplayer/economy launch.
6. The boundary/API through which the client will eventually request those operations from the server.

### Required design rule

Client UI should request an operation and render its result. Critical game rules must not be permanently coupled to DOM/UI code, localStorage, client globals, array indexes, or other client-only implementation details.

Using localStorage/client state is allowed for the current prototype only when the system has a documented authority boundary that allows the authoritative implementation to move to the server later without redesigning the feature.

### Mandatory acceptance question

Before declaring any feature complete, answer:

> Could this feature be connected to Supabase/server-authoritative multiplayer by replacing the authority/persistence layer, without rebuilding the feature's core logic, data identities, ownership rules, or player-facing flow?

If the answer is NO, the architecture is not complete.

### Systems covered

This rule applies to all gameplay and economy systems, including but not limited to:

- Inventory / Backpack
- Containers / Warehouse
- Equipment
- Market / Escrow
- Trade
- currencies and economy
- crafting
- resources and gathering
- drops and loot
- NPC interactions
- quests
- professions
- properties / housing
- mounts
- guilds
- progression
- cooldowns
- PvP and combat state
- abilities / stones / hotbar casts visible to other players

### Server-authoritative target

Before production multiplayer, the server must be authoritative for any operation capable of creating, destroying, transferring, spending, earning, owning, selling, buying, equipping, or otherwise changing valuable/shared game state.

The client may predict or display state for responsiveness, but it must not be the trusted source of truth for multiplayer-critical state.

### Architecture principle

Build locally playable now; make authority replaceable later.

Do not create throwaway offline architecture that must be rewritten to become online.

## RULE 2 — PRESERVE VALIDATED SYSTEMS

Do not reimplement or destructively refactor a validated subsystem merely to make a new feature cleaner. Extend through small interfaces/contracts where possible. If integration threatens an existing validated invariant, stop, inspect the dependency, and choose the smaller compatible integration.

## RULE 3 — VALIDATE REAL BEHAVIOR

A green unit/CI test alone is not sufficient for user-facing systems. When the feature is exposed in the deployed game, validate the relevant LIVE flow, inspect runtime errors, and visually inspect mobile UI when applicable before recording the feature as validated.

## RULE 4 — MEMORY

System-specific memory documents record validated implementation details. They do not override this file. Plans must never be recorded as implemented behavior.

For Inventory/Containers/Market, read `docs/BACKPACK_SYSTEM_MEMORY.md` before changes.
For visual/world work, read `docs/VISUAL_DIRECTION_MEMORY.md` before changes.
For online-first law, read `docs/ONLINE_FIRST.md` before changes.

## Required startup protocol for every development pass

1. Read `ONLINE_FIRST.md` and this `AGENTS.md` completely.
2. Read the memory document(s) for the subsystem being changed.
3. Inspect the current code and deployed state before modifying it.
4. Preserve validated invariants.
5. Apply RULE 1 to the proposed design before implementation.
6. Test deterministically.
7. Validate LIVE when the changed feature is user-facing/deployed.
8. Update subsystem memory only with behavior actually validated.
