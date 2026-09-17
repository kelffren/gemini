# Kelo World — MMORPG Wave 1 Implementation State

**Programa:** `kelo-world-community-mmorpg-59`  
**Foundation merged:** PR #391 → `c146b0dc8a50037ae35b68b907ecc583703a69f1`  
**Wave 1 roots merged:** PR #395 → `7c6e33879c9bf9796c2fa1a1b609fcb21e22f68d`  
**Owner integration merged:** PR #396 → `1b1daca3f674bccd8d31930245fccb687ed7bfb6`  
**Branch actual:** `feat/mmorpg-world-ledger-persistence`  
**Root owner:** `src/mmorpg/wave1-root-systems.mjs`  
**Root audit:** `scripts/mmorpg-wave1-root-audit.mjs`  
**Binding map:** `docs/mmorpg-wave1-owner-bindings.json`  
**Binding audit:** `scripts/mmorpg-wave1-owner-integration-audit.mjs`  
**World persistence audit:** `scripts/mmorpg-world-persistence-audit.mjs`

## Regla de continuidad

Las nueve raíces ya existen como foundation. Esta fase conecta owners reales sin duplicar autoridad. `integrated` exige owner real + CI; `live-verified` exige además evidencia LIVE específica. No abrir Wave 2 hasta cerrar los tres gaps Wave 1 restantes.

## Estado por raíz

| Sistema | Estado efectivo | Owner/evidencia actual |
|---|---|---|
| `world-partition` | `foundation-active` | Grid/claim/transfer root; falta lease/ownership durable server-side y handoff runtime. |
| `area-of-interest` | `integrated` | `server/index.js` filtra social/PvP por spatial grid + hysteresis; Generic Props hace viewport residency. |
| `authoritative-entity-replication` | `foundation-active` | PvP ya es server-authoritative y root tiene version CAS; falta wiring compartido de entity revisions/idempotency. |
| `persistent-world-state` | `integrated` | `server/world-state-store.js` + bridge + Edge v7 + `world_cell_snapshots`; mutación durable por celda con CAS de revisión, límites de tamaño y fallback RAM explícitamente no durable. |
| `world-event-ledger` | `integrated` | `world_event_ledger` + `world_apply_mutation` + `world_replay_events`; append-only, event IDs únicos, una revisión por celda, idempotency/audit/outbox atómicos. |
| `creator-identity-reputation` | `integrated` | Creator Principal nace solo de Supabase JWT + RLS/account access verificados. |
| `creator-permissions` | `integrated` | Roles/permisos server-managed → capabilities Creator; claims del cliente no elevan permisos. |
| `world-version-control` | `integrated` | `maps/map_versions/map_version_chunks/map_asset_refs/map_publications` + Creator Revision + deterministic Map Forge + fork/merge/restore foundation. |
| `mmo-trust-liveops-control-plane` | `foundation-active` | Kill switches/incidents foundation + Game Tuning server boundary + Bug Recovery observability; falta adapter trusted-server único. |

**Balance actual Wave 1:** 6 `integrated` / 3 `foundation-active` / 0 `live-verified`.

## Persistencia de mundo LIVE — 2026-09-17

Proyecto Supabase: `kelo-world` (`iapxdbitjdwvtbpjghct`, `us-west-2`).

Migraciones aplicadas en producción:

- `20260917060152_mmorpg_world_state_ledger_v1`
  - `public.world_cell_snapshots`
  - `public.world_event_ledger`
  - `world_get_snapshot`
  - `world_replay_events`
  - `world_apply_mutation`
  - RLS + grants service-only.
- `20260917060425_mmorpg_world_state_ledger_hardening_v1`
  - patch máximo 120 KB;
  - estado materializado máximo 450 KB;
  - resultado idempotente compacto, sin duplicar el snapshot completo en cada evento.

`kelo-server-state` está desplegada en producción como **Edge Function v7** con `world:load`, `world:replay` y `world:mutate`. Conserva `x-kelo-server-key` como autenticación server-to-server y no expone escritura directa al navegador.

`world_apply_mutation` realiza en una transacción: lock de celda → idempotency lookup → revision CAS → ledger append → snapshot update → audit event → outbox → resultado idempotente. El RPC está revocado para `public`, `anon` y `authenticated`; solo `service_role` puede ejecutarlo.

## Invariantes de autoridad

- `src/environment/world-map.js` sigue siendo **presentación local**, nunca world authority.
- Guardian/WebRTC sigue siendo **transport-only / authoritative:false**; no puede acuñar loot, economía, progreso ni world mutations.
- `server/index.js` + `server/pvp-authority.js` siguen siendo autoridad del gameplay competitivo.
- El WebSocket público no expone `world:mutate` ni `world:commit`.
- `server/world-state-store.js` es el owner de persistencia viva del mundo dentro del proceso server; no reemplaza los mapas authored/versionados de Map Forge.
- `server/online-identity-store.js` es la raíz de Creator Principal de producción; legacy/invitado recibe `creatorPrincipal:null`.
- Bug Recovery puede producir evidencia, pero nunca muta gameplay/editor authority.

## Próxima cirugía

Quedan tres gaps Wave 1, en este orden:

1. `world-partition`: persistir lease/ownership/epoch de celdas usando la infraestructura durable recién creada, con fencing para impedir doble autoridad.
2. `authoritative-entity-replication`: unir revision/idempotency del root al servidor actual sin sustituir `server/pvp-authority.js`.
3. `mmo-trust-liveops-control-plane`: adapter trusted-server único que conecte flags/incidentes/audit con Game Tuning y Bug Recovery manteniendo límites de autoridad.

Después: re-ejecutar Stability Gate, actualizar bindings únicamente con evidencia y solo entonces abrir Wave 2.
