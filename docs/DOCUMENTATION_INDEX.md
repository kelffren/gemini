# Kelo World — Documentation Index

**Sincronizado:** 2026-09-16

Este archivo define qué documentación debe leerse como estado actual, qué archivo conserva intención de implementación y qué archivos son memoria/histórico.

## Canónicos actuales

1. `../README.md` — entrada del repo.
2. `../AI_MOBILE_EXECUTION_BRIDGE.md` — protocolo operativo móvil para IAs, GitHub, LIVE y QA cloud.
3. `../ENGINE_MAP.md` — engine/boot/owners.
4. `GAME_STATE_CURRENT.md` — snapshot funcional actual.
5. `ARCHITECTURE_CURRENT.md` — arquitectura por capas.
6. `CODE_INDEX.md` — mapa de código.
7. `FEATURE_MATRIX.md` — estado por feature.
8. `IMPLEMENTATION_ROADMAP.md` — próximos pasos globales.
9. `KELO_FOUNDATION.md` — leyes Foundation.
10. `KELO_STUDIO_ARCHITECTURE.md` — World/Studio/Creators.
11. `ASSET_CONTRACT.md` — assets/atlases/placement.
12. `VISUAL_SYSTEM.md` — pipeline visual.
13. `SYSTEM_DOCUMENTATION_STANDARD.md` + `system-catalog.json` — contrato documental.
14. `IMPLEMENTATION_LEDGER.md` — ledger agregado histórico de passes materiales que atraviesan turnos o agentes.
15. `implementation-passes/*.md` — handoffs autocontenidos para passes stacked nuevos.

## Pass Creator activo

Para continuar el stack Creator actual, leer en este orden:

1. `systems/CREATOR_USE_AUTHORITY.md`
2. `systems/CREATOR_CHARACTER_STATE_BRIDGE.md`
3. `systems/CREATOR_MODULAR_APPEARANCE_REPLICATION.md`
4. `implementation-passes/IMP-2026-09-16-CREATOR-CHARACTER-BRIDGE-007.md`
5. `implementation-passes/IMP-2026-09-16-CREATOR-MODULAR-REPLICATION-008.md`

`008` supersede únicamente el punto diferido de **replicación remota modular** de `007`; no reescribe ni invalida el historial de `007`.

## Documentación por sistema

`docs/systems/*.md` es la fuente técnica de cada owner. Si cambia API, ownership, flujo o autoridad, el documento del sistema debe cambiar en el mismo pass.

## Ledger de implementación

`IMPLEMENTATION_LEDGER.md` conserva el historial agregado de objetivo, alcance, implementación, evidencia, gates pendientes y handoff de cambios materiales multiagente.

`docs/implementation-passes/*.md` permite que un pass stacked nuevo conserve ese mismo contrato de handoff sin reescribir el historial agregado completo. No reemplaza las entradas antiguas del ledger. Un agente que continúa un pass debe buscar primero su ID exacto en ambos lugares y actualizar el mismo archivo/entrada existente, nunca abrir un roadmap paralelo.

No son fuentes de verdad superiores al runtime. Un ítem `ACTIVE` o `IMPLEMENTED_PENDING_VERIFY` significa precisamente que todavía hay trabajo o verificación pendiente.

## Memorias operativas

`*_MEMORY.md` conserva decisiones y contexto acumulado. Puede contener historia útil, pero no debe vencer a los documentos canónicos actuales ni al runtime.

Ejemplos: `WORLD_BUILDER_MEMORY.md`, `BACKPACK_SYSTEM_MEMORY.md`, `PROPERTY_EDITOR_MEMORY.md`, `WORLD_EDIT_AUTHORITY_MEMORY.md`, `VISUAL_DIRECTION_MEMORY.md`.

## Históricos / auditorías

`docs/archive/`, `CHECKPOINT_*`, evidence, captures y auditorías son evidencia histórica. No se reescriben para aparentar que siempre describieron el estado actual.

## Orden de autoridad

1. comportamiento LIVE verificado;
2. contratos/owners Foundation;
3. `index.html` y boot real;
4. documentos canónicos de estado actual;
5. documentos de sistema;
6. implementation ledger + implementation-pass handoff;
7. memoria/histórico.

Cuando exista contradicción, corrige la documentación de estado actual en el mismo cambio, actualiza la entrada/handoff del pass afectado y deja el histórico intacto.
