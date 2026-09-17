# Kelo World — MMORPG Wave 1 Implementation State

**Programa:** `kelo-world-community-mmorpg-59`  
**Foundation merged:** PR #391 → `c146b0dc8a50037ae35b68b907ecc583703a69f1`  
**Wave 1 roots merged:** PR #395 → `7c6e33879c9bf9796c2fa1a1b609fcb21e22f68d`  
**Branch actual:** `feat/mmorpg-wave1-owner-integration`  
**Root owner:** `src/mmorpg/wave1-root-systems.mjs`  
**Root audit:** `scripts/mmorpg-wave1-root-audit.mjs`  
**Binding map:** `docs/mmorpg-wave1-owner-bindings.json`  
**Binding audit:** `scripts/mmorpg-wave1-owner-integration-audit.mjs`

## Regla de continuidad

Las nueve raíces ya pasaron Main Stability Gate como foundation. La fase actual es conectar cada una con owners reales sin crear autoridades paralelas. `integrated` solo se usa cuando el owner actual satisface el contrato; lo demás permanece `foundation-active` con el faltante explícito en el binding map.

## Estado por raíz

| Sistema | Estado efectivo | Owner/evidencia actual |
|---|---|---|
| `world-partition` | `foundation-active` | Grid/claim/transfer root; falta lease/ownership durable server-side. |
| `area-of-interest` | `integrated` | `server/index.js` filtra social/PvP por spatial grid + hysteresis; Generic Props hace viewport residency. |
| `authoritative-entity-replication` | `foundation-active` | PvP ya es server-authoritative y root tiene version CAS; falta wiring compartido de entity revisions/idempotency. |
| `persistent-world-state` | `foundation-active` | Primitive replayable existe; Online Foundation tiene mapas versionados, pero falta store durable para mutaciones vivas del mundo. |
| `world-event-ledger` | `foundation-active` | Primitive append/idempotency/replay + tablas server audit/outbox/idempotency; falta schema/path de eventos de mundo. |
| `creator-identity-reputation` | `integrated` | `online-identity-store` ahora deriva Creator Principal exclusivamente desde Supabase JWT + RLS/account access verificados. |
| `creator-permissions` | `integrated` | Roles/permisos server-managed se transforman a capabilities Creator; claims de cliente no elevan permisos. |
| `world-version-control` | `integrated` | `maps/map_versions/map_version_chunks/map_asset_refs/map_publications` + Creator Revision + deterministic Map Forge + root fork/merge/restore. |
| `mmo-trust-liveops-control-plane` | `foundation-active` | Kill switches/incidents foundation + Game Tuning server boundary + Bug Recovery observability; falta un adapter trusted-server único. |

## Invariantes de autoridad

- `src/environment/world-map.js` sigue siendo **presentación local**, nunca world authority.
- Guardian/WebRTC sigue siendo **transport-only / authoritative:false**; no puede acuñar loot, economía, progreso ni world mutations.
- `server/index.js` + `server/pvp-authority.js` siguen siendo autoridad del gameplay competitivo.
- `server/online-identity-store.js` es la única raíz para Creator Principal de producción; una sesión legacy/invitada recibe `creatorPrincipal:null`.
- Bug Recovery puede generar evidencia/incidentes, pero nunca muta gameplay/editor authority.
- Game Tuning conserva su owner de configuración visual y server publish boundary; LiveOps no escribe sus internals directamente.

## Próxima cirugía

Cerrar los cinco gaps Wave 1 en este orden:

1. `world-event-ledger` + `persistent-world-state`: agregar storage/schema trusted-server para mutaciones de mundo, idempotency y replay por cell/revision.
2. `world-partition`: persistir lease/ownership de celdas y epoch sobre el owner anterior.
3. `authoritative-entity-replication`: conectar revision/idempotency del root al servidor sin sustituir `pvp-authority`.
4. `mmo-trust-liveops-control-plane`: adapter único que consume Game Tuning + Bug Recovery + server audit, manteniendo sus límites.
5. Re-ejecutar Stability Gate y promover únicamente los bindings cuya evidencia cumpla `doneWhen`.

No abrir Wave 2 antes de dejar estos gaps documentados y protegidos por CI; si alguno requiere infraestructura externa no disponible en la misma PR, mantenerlo `foundation-active` y no falsificar `integrated`.
