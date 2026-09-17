# Kelo World — System Documentation Standard

> Obligatorio para cualquier sistema/capacidad nueva y para todo owner que cambie de contrato.

## Tres niveles

1. **Documentación global canónica**: describe engine/arquitectura/estado actual.
2. **Documento técnico del sistema**: describe un owner específico.
3. **Contrato machine-readable**: permite que CI/agentes validen ownership, autoridad, dependencias y failure policy sin inferirlos de prosa.

Empieza siempre por `docs/DOCUMENTATION_INDEX.md`.

## Documento técnico obligatorio

Ruta: `docs/systems/<SYSTEM_ID>.md`.

Debe incluir propósito, owner, fuentes, estado que posee/no posee, API, flujo, dependencias, eventos, local-vs-online authority, persistencia, invariantes, extension points, ejemplos, anti-patrones, legacy/adapters, tests/CI, observabilidad, deuda y checklist de extensión.

Para owners que ya entraron en el rollout X-Foundation, el documento debe comenzar además con identidad parseable:

```text
<!-- KELO-SYSTEM-DOC
system-id: <catalog-id>
owner: <owner exacto del catálogo>
source: <source exacto del catálogo>
contract-version: <entero>
-->
```

CI puede extender gradualmente este requisito a más owners. No añadir metadata falsa solo para pasar el gate: debe describir el owner real.

## Catálogo

`docs/system-catalog.json` enlaza `id`, `owner`, `source`, `technicalDoc`, `playerVisible`, `playerGuideAnchor` cuando aplique y `status`.

## System Contracts

`docs/system-contracts.json` es el rollout machine-readable de owners críticos. Un contrato declara al menos:

- `id`, `owner`, `source`, `technicalDoc`;
- `apiVersion`;
- authority;
- `stateOwned` y `stateForbidden`;
- dependencias/consumos;
- lifecycle;
- failure policy;
- resource class;
- tests mínimos.

No sustituye el catálogo: debe coincidir exactamente con él para identidad/owner/source/doc.

## Authority Matrix

`docs/authority-matrix.json` declara el **system of record** de estados sensibles: identidad, PvP, Arena, economía, comercio, publicación, Guardian y promoción de KeloEvolution.

Regla: un fallback local puede existir para practice/offline/transición, pero nunca cambia silenciosamente la autoridad requerida de un estado competitivo, económico o publicado.

## X-Foundation policy / Capability Graph

`config/x-foundation-policy.json` añade a los System Contracts críticos:

- `dependsOnSystems`;
- failure mode estructurado;
- blast radius;
- kill-switch policy;
- browser compatibility policy.

`scripts/x-foundation-contract-audit.mjs` valida el grafo, bloquea ciclos/dependencias desconocidas, aplica guards pequeños sobre código nuevo y genera:

- `artifacts/x-foundation/capability-graph.json`;
- `artifacts/x-foundation/change-impact.json`.

El change-impact report enlaza archivos cambiados → sistemas afectados → dependientes → tests declarados. Es evidencia/selección de pruebas, no un nuevo owner runtime.

## Player guide

Si el cambio altera una mecánica visible, también debe actualizar `guide.html`. No exponer secretos, claves, rutas admin ni internals explotables.

## Regla de sincronización

Si cambia API, ownership, boot order, authority, asset pipeline o flujo visible, el mismo pass debe evaluar y actualizar:

- código;
- system doc afectado;
- `system-catalog.json` si cambia metadata;
- `system-contracts.json` si el owner está en el rollout o cambia su contrato crítico;
- `authority-matrix.json` si cambia system-of-record/fallback/persistencia sensible;
- `config/x-foundation-policy.json` si cambia una dependencia o failure boundary estructurada;
- `guide.html` si aplica;
- `ENGINE_MAP.md` si cambia engine/boot/owner;
- `docs/ARCHITECTURE_CURRENT.md` si cambia frontera arquitectónica;
- `docs/GAME_STATE_CURRENT.md` si cambia capacidad observable;
- `docs/CODE_INDEX.md` si se añade/mueve un owner importante;
- tests/CI.

No hace falta reescribir auditorías o archivos históricos; se preservan como evidencia y se enlazan desde el índice.

## Autoridad documental

LIVE verificado > owner contracts/authority matrix > boot real > docs canónicos > system docs > memory/historical.

Un sistema nuevo sin documentación/contrato aplicable no está terminado.
