# Regional Economy + Logistics — Reuse Report

## Scope audited

Antes de implementar se revisaron `AGENTS.md`, `docs/KELO_FOUNDATION.md`, `docs/ONLINE_FIRST.md`, `docs/SYSTEM_DOCUMENTATION_STANDARD.md`, `ENGINE_MAP.md`, `index.html`, `engine-a.js`, `KeloEvents`, `KeloMovement`, `KeloRender`, `KeloCamera`, `KeloContainers`, `KeloCommerceAuthority`, `KeloPvPWorld`, `KeloCombatEngine` y el runtime de habilidades.

## REUTILIZAR

- Events → `KeloEvents`.
- Inventarios y movimientos físicos de items → `KeloContainers`.
- Backpack → adapter existente de `KeloContainers` sobre `STATE.inventory`.
- Persistencia offline → `STATE/saveState`.
- Movimiento → `KeloMovement`.
- Render/cámara → `KeloRender` + `KeloCamera`.
- Combat melee/basic → `KeloCombatEngine`.
- Player commerce/trade/stalls → `KeloCommerceAuthority`; no se sustituye por regional economy.
- Network authority pattern → `KeloNetAuthority`.

## EXTENDER

- `KeloContainers`: dynamic containers y partial extract para carretas/recursos.
- `KeloCombatEngine`: consulta la restricción `KeloCaravans.canActorAttack()`.
- Save state: ramas `regionalEconomy`, `caravans`, `socialGroups`, `dynamicContainers`.

## CREAR — capacidad realmente ausente

- `KeloRegionalEconomyMath`: matemática pura de risk/economic distance/demand attenuation.
- `KeloRegionalEconomy`: settlement stocks, lazy production, scarcity quotes, contracts, route events.
- `KeloCaravans`: entidad cart física/persistente y possession/claim.
- `KeloFactions`: memberships/clans/roles/permissions/ownership model.
- `KeloLogisticsDevtools`: observación y simulación delegada.

## No creado

No se creó otro EventBus, InventoryV2, EconomyManager2, NPC engine, movement loop, render loop, interaction engine, persistence engine ni commerce system paralelo.

## Owner decisions

- **Economy regional:** `KeloRegionalEconomy`.
- **Route risk / economic distance:** `KeloRegionalEconomy` consume `KeloRegionalEconomyMath`.
- **Supply contracts:** `KeloRegionalEconomy`.
- **Cart lifecycle:** `KeloCaravans`.
- **Cart inventory:** `KeloContainers`.
- **Faction/clan membership:** `KeloFactions`.
- **Trade jugador↔jugador:** sigue siendo `KeloCommerceAuthority`.

## Regla permanente

> DO NOT CREATE PARALLEL SYSTEMS. EXTEND THE EXISTING OWNER.
