# Kelo World — System Documentation Standard

> Obligatorio para cualquier sistema/capacidad nueva y para todo owner que cambie de contrato.

## Tres niveles

1. **Documentación global canónica**: describe engine/arquitectura/estado actual.
2. **Documento técnico del sistema**: describe un owner específico.
3. **Implementation Ledger**: conserva intención, alcance y estado de un pass material entre agentes sin convertir planes en hechos.

Empieza siempre por `docs/DOCUMENTATION_INDEX.md`.

## Documento técnico obligatorio

Ruta: `docs/systems/<SYSTEM_ID>.md`.

Debe incluir propósito, owner, fuentes, estado que posee/no posee, API, flujo, dependencias, eventos, local-vs-online authority, persistencia, invariantes, extension points, ejemplos, anti-patrones, legacy/adapters, tests/CI, observabilidad, deuda y checklist de extensión.

## Implementation Ledger obligatorio para passes materiales

Ruta: `docs/IMPLEMENTATION_LEDGER.md`.

Úsalo cuando un trabajo:

- abarque más de un owner/archivo importante;
- se vaya a continuar en varios turnos/agentes;
- implemente un roadmap por fases;
- cambie una frontera arquitectónica o pipeline;
- tenga partes implementadas y otras deliberadamente pendientes.

Cada entrada debe separar explícitamente:

- **User intent / source prompt** — qué se quiere conseguir;
- **Planned scope** — lo acordado pero todavía no necesariamente hecho;
- **Implemented now** — solo código ya escrito en la rama/HEAD citado;
- **Deferred deliberately** — lo que no se hizo todavía;
- **Acceptance / gates** — qué prueba falta para poder validar;
- **Evidence** — commits/tests/LIVE reales;
- **Next action / Handoff prompt** — cómo continuar sin inventar un plan paralelo.

Estados permitidos: `PROPOSED`, `ACTIVE`, `IMPLEMENTED_PENDING_VERIFY`, `VALIDATED`, `PAUSED`, `SUPERSEDED`.

**Regla crítica:** el ledger preserva intención, pero no puede elevar un plan a comportamiento implementado ni un commit a `VALIDATED` sin la evidencia exigida por `AGENTS.md`.

Antes de continuar un pass con entrada `ACTIVE` o `IMPLEMENTED_PENDING_VERIFY`, el agente debe leer esa entrada y continuarla/actualizarla en lugar de iniciar un diseño paralelo incompatible.

## Catálogo

`docs/system-catalog.json` enlaza `id`, `owner`, `source`, `technicalDoc`, `playerVisible`, `playerGuideAnchor` cuando aplique y `status`.

## Player guide

Si el cambio altera una mecánica visible, también debe actualizar `guide.html`. No exponer secretos, claves, rutas admin ni internals explotables.

## Regla de sincronización

Si cambia API, ownership, boot order, authority, asset pipeline o flujo visible, el mismo pass debe evaluar y actualizar:

- código;
- system doc afectado;
- `docs/IMPLEMENTATION_LEDGER.md` cuando el pass sea material/multiagente;
- `system-catalog.json` si cambia metadata;
- `guide.html` si aplica;
- `ENGINE_MAP.md` si cambia engine/boot/owner;
- `docs/ARCHITECTURE_CURRENT.md` si cambia frontera arquitectónica;
- `docs/GAME_STATE_CURRENT.md` si cambia capacidad observable;
- `docs/CODE_INDEX.md` si se añade/mueve un owner importante;
- tests/CI.

No hace falta reescribir auditorías o archivos históricos; se preservan como evidencia y se enlazan desde el índice.

## Autoridad documental

LIVE verificado > owner contracts > boot real > docs canónicos > system docs > implementation ledger > memory/historical.

El ledger explica **por qué/qué se está haciendo**, pero nunca vence a la realidad del runtime ni a los contratos del owner.

Un sistema nuevo sin documentación no está terminado.
