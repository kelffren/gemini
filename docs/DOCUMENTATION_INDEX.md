# Kelo World — Documentation Index

**Sincronizado:** 2026-09-15

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
14. `IMPLEMENTATION_LEDGER.md` — intención/estado de passes materiales que atraviesan turnos o agentes; leer entradas ACTIVE antes de continuar ese trabajo.

## Documentación por sistema

`docs/systems/*.md` es la fuente técnica de cada owner. Si cambia API, ownership, flujo o autoridad, el documento del sistema debe cambiar en el mismo pass.

## Ledger de implementación

`IMPLEMENTATION_LEDGER.md` conserva el objetivo original, alcance planificado, lo realmente implementado, evidencia, gates pendientes y handoff de cambios materiales multiagente.

No es una fuente de verdad superior al runtime. Un ítem `ACTIVE` o `IMPLEMENTED_PENDING_VERIFY` significa precisamente que todavía hay trabajo o verificación pendiente. Si un agente continúa ese pass, debe actualizar la misma entrada en vez de abrir un roadmap incompatible.

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
6. implementation ledger (intención/continuidad, no autoridad runtime);
7. memoria/histórico.

Cuando exista contradicción, corrige la documentación de estado actual en el mismo cambio, actualiza la entrada del ledger afectada y deja el histórico intacto.
