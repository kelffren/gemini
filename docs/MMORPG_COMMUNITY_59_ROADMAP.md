# Kelo World — MMORPG Community 59 Roadmap

**Programa:** `kelo-world-community-mmorpg-59`  
**Regla de seguimiento:** **59/59** sistemas deben permanecer registrados hasta estar `live-verified` o ser sustituidos por una decisión arquitectónica explícita y documentada.  
**Fuente machine-readable:** `docs/mmorpg-community-systems.json`  
**Foundation runtime:** `src/mmorpg/community-platform-foundation.mjs`  
**CI guard:** `scripts/mmorpg-community-platform-audit.mjs`

## Objetivo

Convertir Kelo World de juego + Creator Suite en un MMORPG persistente y escalable donde la comunidad pueda construir mapas, quests, NPCs, eventos, assets, dungeons y raids sin entregar autoridad competitiva al cliente. Todo UGC debe ser versionado, atribuible, dependency-aware, reversible, moderable y cargado bajo demanda.

## Ejecutado en la entrega foundation

- Los 59 sistemas tienen ID estable, prioridad, wave, dependencias y criterio `doneWhen`.
- Foundation compartido: Event Bus, idempotencia, capability/RBAC, versionado + branch + merge, publication state machine, world grid, AOI index, sandbox declarativo, feature flags y lifecycle adapters.
- El Stability Gate debe validar que sigan existiendo exactamente 59 sistemas, que no aparezcan ciclos de dependencias y que este roadmap no pierda ninguno.
- Estado inicial deliberado: `contract-defined`. No equivale a decir que los 59 están integrados o LIVE.

## Reglas duras

1. Loot, progreso, moneda, rewards, publicación y estado competitivo terminan en autoridad; nunca se aceptan como verdad desde el cliente.
2. UGC pesado se entrega bajo demanda. Metadata, hashes, permisos y dependency graphs son ligeros; los bytes grandes no se precargan.
3. UGC no alcanza LIVE sin validación, security scan, moderación, provenance y rollback.
4. Branches, staging y playtests trabajan con revisiones inmutables.
5. Integrar con owners actuales de Kelo World; no revivir Legacy retirado.
6. `integrated` exige código + owner real + auditoría. `live-verified` exige evidencia LIVE/mobile.

## Waves

- **Wave 1:** contratos raíz: authority, persistence, version control, identity, permissions y LiveOps.
- **Wave 2:** routing, sync, packaging, dependency graph y provenance.
- **Wave 3:** collaboration, security, moderation, NPC runtime, merge y scripting sandbox.
- **Wave 4:** Creator tools + quest runtime + loot + party/LFG.
- **Wave 5:** publication, rollback, lifecycle, spawn/event systems, itemization y PvE base.
- **Wave 6:** dungeons, raids, progression, crafting, events y discovery.
- **Wave 7:** creator revenue share.
- **Wave 8:** recommendation madura.

## A. Mundo persistente y escala global

- [ ] 01 **World Partition System** — `world-partition` — P0/W1
- [ ] 02 **Seamless Shard Handoff** — `seamless-shard-handoff` — P0/W2
- [ ] 03 **Dynamic Shard Split/Merge** — `dynamic-shard-split-merge` — P0/W3
- [ ] 04 **Area of Interest System** — `area-of-interest` — P0/W1
- [ ] 05 **Authoritative Entity Replication** — `authoritative-entity-replication` — P0/W1
- [ ] 06 **Delta State Synchronization** — `delta-state-sync` — P0/W2
- [ ] 07 **Persistent World State** — `persistent-world-state` — P0/W1
- [ ] 08 **World Event Ledger** — `world-event-ledger` — P0/W1
- [ ] 09 **Cross-Region Replication** — `cross-region-replication` — P0/W3
- [ ] 10 **Global Player Routing** — `global-player-routing` — P0/W2
- [ ] 11 **Hot-Zone Autoscaler** — `hot-zone-autoscaler` — P0/W2
- [ ] 12 **Global World Clock** — `global-world-clock` — P1/W2
- [ ] 13 **Dynamic Climate System** — `dynamic-climate` — P1/W4
- [ ] 14 **Living Ecosystem Simulator** — `living-ecosystem` — P1/W5
- [ ] 15 **World Event Director** — `world-event-director` — P0/W5

## B. Gobernanza y ciclo de vida Creator

- [ ] 16 **Creator Identity & Reputation** — `creator-identity-reputation` — P0/W1
- [ ] 17 **Creator Permission System** — `creator-permissions` — P0/W1
- [ ] 18 **Real-Time Collaborative Editing** — `realtime-collaborative-editing` — P0/W3
- [ ] 19 **World Version Control** — `world-version-control` — P0/W1
- [ ] 20 **Map Branching** — `map-branching` — P0/W2
- [ ] 21 **World Merge Engine** — `world-merge-engine` — P0/W3
- [ ] 22 **Creator Staging Worlds** — `creator-staging-worlds` — P0/W3
- [ ] 23 **Creator Playtest System** — `creator-playtest` — P0/W4
- [ ] 24 **UGC Publishing Pipeline** — `ugc-publishing-pipeline` — P0/W5
- [ ] 25 **UGC Rollback System** — `ugc-rollback` — P0/W5
- [ ] 26 **Asset Package Manager** — `asset-package-manager` — P0/W2
- [ ] 27 **UGC Dependency Graph** — `ugc-dependency-graph` — P0/W2
- [ ] 28 **Community Asset Registry** — `community-asset-registry` — P0/W3

## C. Herramientas para que la comunidad cree el mundo

- [ ] 29 **Quest Creator** — `quest-creator` — P0/W4
- [ ] 30 **Quest Logic Graph** — `quest-logic-graph` — P0/W3
- [ ] 31 **Dialogue Creator** — `dialogue-creator` — P1/W4
- [ ] 32 **NPC Creator** — `npc-creator` — P0/W4
- [ ] 33 **NPC Behavior Editor** — `npc-behavior-editor` — P1/W4
- [ ] 34 **Dungeon Creator** — `dungeon-creator` — P1/W5
- [ ] 35 **Raid Creator** — `raid-creator` — P1/W6
- [ ] 36 **Community Event Creator** — `community-event-creator` — P1/W6
- [ ] 37 **Reward Designer** — `reward-designer` — P0/W4
- [ ] 38 **Cutscene/Cinematic Creator** — `cinematic-creator` — P2/W6
- [ ] 39 **Localization Creator** — `localization-creator` — P1/W3

## D. Seguridad, moderación y distribución UGC

- [ ] 40 **Sandboxed Community Scripting** — `sandboxed-community-scripting` — P0/W3
- [ ] 41 **Automated UGC Validator** — `automated-ugc-validator` — P0/W3
- [ ] 42 **Automated Playtest Bots** — `automated-playtest-bots` — P1/W5
- [ ] 43 **UGC Security Scanner** — `ugc-security-scanner` — P0/W3
- [ ] 44 **UGC Moderation Pipeline** — `ugc-moderation-pipeline` — P0/W3
- [ ] 45 **UGC Provenance & Licensing** — `ugc-provenance-licensing` — P0/W2
- [ ] 46 **Creator Revenue Share** — `creator-revenue-share` — P1/W7
- [ ] 47 **Community Content Discovery** — `community-content-discovery` — P1/W6
- [ ] 48 **Community Recommendation Engine** — `community-recommendation-engine` — P2/W8
- [ ] 49 **UGC Lifecycle Manager** — `ugc-lifecycle-manager` — P1/W5

## E. Runtime PvE/MMO

- [ ] 50 **Quest Runtime Engine** — `quest-runtime-engine` — P0/W4
- [ ] 51 **NPC AI Runtime** — `npc-ai-runtime` — P0/W3
- [ ] 52 **PvE Threat/Aggro System** — `pve-threat-aggro` — P1/W5
- [ ] 53 **Dynamic Spawn Director** — `dynamic-spawn-director` — P0/W4
- [ ] 54 **Deep Character Progression** — `deep-character-progression` — P1/W6
- [ ] 55 **Professions/Gathering/Crafting** — `professions-gathering-crafting` — P1/W6
- [ ] 56 **Procedural Itemization** — `procedural-itemization` — P1/W5
- [ ] 57 **Loot Authority & Ownership** — `loot-authority-ownership` — P0/W4
- [ ] 58 **Party / Raid / LFG Infrastructure** — `party-raid-lfg` — P0/W4

## F. Trust + LiveOps

- [ ] 59 **MMO Trust + LiveOps Control Plane** — `mmo-trust-liveops-control-plane` — P0/W1

## Definition of Done por sistema

El criterio exacto de cada uno está en `doneWhen` dentro de `docs/mmorpg-community-systems.json`. Un checkbox de este roadmap solo se marca cuando el estado alcanza como mínimo `integrated`; para `live-verified` debe existir evidencia sobre el build real y rollback probado cuando aplique.

## Orden de integración

Cerrar primero Waves 1–3 antes de abrir publicación comunitaria pública. Quest/NPC/Map creators pueden desarrollarse en paralelo sobre staging, pero `ugc-publishing-pipeline` no puede dar alcance LIVE hasta que authority, moderation, provenance, security scanning y rollback estén integrados. Revenue share y recommendation llegan después de medir uso real y atribución sin confiar en el cliente.

## Estados

- `contract-defined`: contrato, dependencias y DONE protegidos por CI.
- `foundation-active`: existe primitive compartida funcional.
- `integrated`: conectado al runtime/owner real y cubierto por auditoría.
- `live-verified`: integrado y probado en LIVE/mobile con evidencia.

## Regla para cualquier IA/agente que continúe

Leer primero `docs/mmorpg-community-systems.json`, luego este roadmap. Trabajar el sistema de menor wave y mayor prioridad que aún no esté `integrated`. Actualizar estado únicamente cuando cumpla `doneWhen`. Una nueva idea se vincula a uno de estos 59 o se documenta explícitamente como sistema 60+; nunca se elimina ni sustituye silenciosamente un ID.
