# Kelo World — MMORPG Wave 1 Implementation State

**Programa:** `kelo-world-community-mmorpg-59`  
**Branch de trabajo:** `feat/mmorpg-wave1-root-systems`  
**Base:** `main` después de PR #391 / `c146b0dc8a50037ae35b68b907ecc583703a69f1`  
**Owner runtime:** `src/mmorpg/wave1-root-systems.mjs`  
**Audit:** `scripts/mmorpg-wave1-root-audit.mjs`

## Regla de continuidad

No saltar a Wave 2 hasta que estas nueve raíces pasen Main Stability Gate. No marcar `integrated` ni `live-verified` por existir código: primero deben conectarse al owner real correspondiente y demostrar evidencia de integración.

## Nueve raíces Wave 1

1. `world-partition` — deterministic cell IDs, exclusive authority ownership, transfer epochs, load/unload consumers.
2. `area-of-interest` — entity index + viewer subscriptions with enter/exit hysteresis.
3. `authoritative-entity-replication` — intents separated from authority commits, optimistic version CAS, protected client patch guard.
4. `persistent-world-state` — per-cell revisioned state with authority checks and reconstruction.
5. `world-event-ledger` — append-only idempotent event stream with replay/audit.
6. `creator-identity-reputation` — stable creator identity and trusted-source reputation signals only.
7. `creator-permissions` — role/capability gate for build/test/review/publish/moderate/revenue actions.
8. `world-version-control` — immutable revisions, fork, three-way merge and restore.
9. `mmo-trust-liveops-control-plane` — feature flags, kill switches, trust signals, incidents and auditable admin actions.

## Estado actual

- Código de foundation específico Wave 1: **IMPLEMENTADO EN BRANCH**.
- Audit de invariantes: **IMPLEMENTADO EN BRANCH**.
- Main Stability Gate: **CONECTADO; pendiente resultado del PR**.
- Estado formal de los nueve sistemas en `docs/mmorpg-community-systems.json`: se mantiene deliberadamente en `contract-defined` hasta que la evidencia de CI y la integración con owners actuales justifiquen promoción.

## Próxima cirugía después de CI verde

Integrar las raíces con owners existentes sin crear autoridades paralelas:

- World Partition / Persistent State → World Map + Online Foundation.
- Authority Replication → Online Foundation + Guardian authority transport.
- AOI → Generic Props Residency + networking subscriptions.
- Creator Identity/Permissions → Online identity + Universal Content Studio.
- World Version Control → Map Forge / Studio creator revisions.
- Trust/LiveOps → Game Tuning + Bug Recovery Mesh + Guardian.

Después de esas conexiones, promover únicamente los sistemas que cumplan su `doneWhen`; luego abrir Wave 2 en orden de dependencias.
